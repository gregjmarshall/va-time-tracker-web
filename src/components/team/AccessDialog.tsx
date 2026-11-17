'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { users, projects as projectsApi, clients as clientsApi } from '@/lib/api'
import { clientColor } from '@/lib/colors'
import { useAuthStore } from '@/stores/auth'
import type { UserResponse } from '@/lib/types'
import { memberName } from './member'

const matches = (text: string, q: string) => text.toLowerCase().includes(q)

/**
 * Which projects a team member is assigned to, and which clients they can see without an assignment.
 * Search matches client or project names; a matching client shows all its projects. Saved in one call.
 */
export function AccessDialog({ member, onClose }: { member: UserResponse; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'projects' | 'clients'>('projects')
  const [search, setSearch] = useState('')
  const [projectIds, setProjectIds] = useState<Set<number> | null>(null)
  const [clientIds, setClientIds] = useState<Set<number> | null>(null)

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects-all', token],
    queryFn: () => projectsApi.list(token!),
    enabled: !!token,
  })
  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token,
  })
  const { data: access, isLoading } = useQuery({
    queryKey: ['member-access', token, member.userId],
    queryFn: () => users.access(token!, member.userId),
    enabled: !!token,
  })

  // Seed the editable sets once the saved access has loaded
  if (access && projectIds === null) setProjectIds(new Set(access.projectIds))
  if (access && clientIds === null) setClientIds(new Set(access.clientIds))

  const save = useMutation({
    mutationFn: () => users.setAccess(token!, member.userId, { projectIds: [...projectIds!], clientIds: [...clientIds!] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-access'] })
      queryClient.invalidateQueries({ queryKey: ['member-history'] })
      queryClient.invalidateQueries({ queryKey: ['project-history'] })
      queryClient.invalidateQueries({ queryKey: ['projects-overview'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['access-requests'] })
      toast.success(`Access updated for ${memberName(member)}`)
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggle = (set: Set<number> | null, update: (s: Set<number>) => void, id: number) => {
    const next = new Set(set ?? [])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    update(next)
  }

  const q = search.trim().toLowerCase()
  const groups = clientList
    .map((c) => {
      const projects = allProjects.filter((p) => p.clientId === c.clientId)
      const shown = !q || matches(c.name, q) ? projects : projects.filter((p) => matches(p.name, q))
      return { client: c, projects: shown }
    })
    .filter((g) => g.projects.length > 0)
  const visibleClients = clientList.filter((c) => !q || matches(c.name, q))

  const projectCount = projectIds?.size ?? 0
  const clientCount = clientIds?.size ?? 0
  const ready = projectIds !== null && clientIds !== null

  const tabButton = (value: 'projects' | 'clients', label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`flex-1 py-2 transition-colors ${tab === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label} <span className="num opacity-70">({count})</span>
    </button>
  )

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Access for {memberName(member)}</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {tabButton('projects', 'Projects', projectCount)}
          {tabButton('clients', 'Client visibility', clientCount)}
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'projects' ? 'Search clients or projects…' : 'Search clients…'}
            className="pl-9"
          />
        </div>

        <div className="space-y-4 max-h-[50vh] overflow-y-auto -mx-1 px-1">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>}

          {tab === 'projects' && ready && (
            <>
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {q ? 'No matching clients or projects.' : 'No projects yet. Create some in Clients.'}
                </p>
              )}
              {groups.map(({ client, projects }) => {
                const allOn = projects.every((p) => projectIds!.has(p.projectId))
                return (
                  <div key={client.clientId}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full" style={{ background: clientColor(client.clientId) }} />
                        {client.name}
                      </p>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const next = new Set(projectIds!)
                            projects.forEach((p) => (allOn ? next.delete(p.projectId) : next.add(p.projectId)))
                            setProjectIds(next)
                          }}
                        >
                          {allOn ? 'Clear all' : 'Select all'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {projects.map((p) => (
                        <label key={p.projectId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer">
                          <input
                            type="checkbox"
                            checked={projectIds!.has(p.projectId)}
                            onChange={() => toggle(projectIds, setProjectIds, p.projectId)}
                            className="rounded border-border accent-primary h-4 w-4"
                          />
                          <span className="text-sm">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {tab === 'clients' && ready && (
            <>
              <p className="text-xs text-muted-foreground px-1">
                Lets this team member see all of a client&apos;s projects and team activity without a project assignment.
              </p>
              {visibleClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{q ? 'No matching clients.' : 'No clients yet.'}</p>
              )}
              <div className="space-y-0.5">
                {visibleClients.map((c) => (
                  <label key={c.clientId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientIds!.has(c.clientId)}
                      onChange={() => toggle(clientIds, setClientIds, c.clientId)}
                      className="rounded border-border accent-primary h-4 w-4"
                    />
                    <span className="w-2 h-2 rounded-full" style={{ background: clientColor(c.clientId) }} />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!ready || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
