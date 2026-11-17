'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { projects as projectsApi, users } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ClientResponse, ProjectOverview } from '@/lib/types'
import { HistoryList } from '@/components/audit/HistoryList'
import { memberInitials, memberName } from '@/components/team/member'

const SELECT_CLASS = 'w-full px-3 py-2 rounded-lg text-sm border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer'

/** Refreshes everything that lists projects after a change. */
export function useInvalidateProjects() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['projects-overview', 'projects', 'projects-all', 'project-history', 'project-team', 'clients-with-retainer']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

/** New project (pick a client) or edit name and budget of an existing one. */
export function ProjectDialog({ project, clients, onClose }: {
  project?: ProjectOverview
  clients: ClientResponse[]
  onClose: () => void
}) {
  const { token } = useAuthStore()
  const invalidate = useInvalidateProjects()
  const [clientId, setClientId] = useState<number | ''>(project?.clientId ?? '')
  const [name, setName] = useState(project?.name ?? '')
  const [budget, setBudget] = useState(project?.budgetHours ? String(project.budgetHours) : '')
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () => {
      const budgetHours = budget.trim() ? Number(budget) : undefined
      return project
        ? projectsApi.update(token!, project.projectId, {
            name: name.trim(),
            ...(budgetHours !== undefined ? { budgetHours } : project.budgetHours ? { clearBudget: true } : {}),
          })
        : projectsApi.create(token!, { clientId: Number(clientId), name: name.trim(), budgetHours })
    },
    onSuccess: (p) => {
      invalidate()
      toast.success(project ? `Saved ${p.name}` : `Created ${p.name}`)
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!project && !clientId) return setError('Pick a client.')
    if (!name.trim()) return setError('Give the project a name.')
    if (budget.trim() && !(Number(budget) > 0)) return setError('Budget must be a number of hours above 0, or left empty.')
    save.mutate()
  }

  const activeClients = clients.filter((c) => c.isActive !== false).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{project ? `Edit ${project.name}` : 'New project'}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-client">Client</Label>
            {project ? (
              <p className="text-sm text-muted-foreground">{project.clientName}</p>
            ) : (
              <select id="project-client" value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')} className={SELECT_CLASS}>
                <option value="">Choose a client…</option>
                {activeClients.map((c) => <option key={c.clientId} value={c.clientId}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Inbox management" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-budget">Budget (hours)</Label>
            <Input id="project-budget" type="number" min="0" step="0.5" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="No budget" />
            <p className="text-xs text-muted-foreground">Optional. Leave empty for an open-ended project.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : project ? 'Save' : 'Create project'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Who is assigned to the project (team members; saved in one call). */
export function ProjectTeamDialog({ project, onClose }: { project: ProjectOverview; onClose: () => void }) {
  const { token } = useAuthStore()
  const invalidate = useInvalidateProjects()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number> | null>(null)

  const { data: people = [] } = useQuery({
    queryKey: ['users', token],
    queryFn: () => users.list(token!),
    enabled: !!token,
  })
  const { data: team } = useQuery({
    queryKey: ['project-team', token, project.projectId],
    queryFn: () => projectsApi.team(token!, project.projectId),
    enabled: !!token,
  })
  if (team && selected === null) setSelected(new Set(team.userIds))

  const save = useMutation({
    mutationFn: () => projectsApi.setTeam(token!, project.projectId, [...selected!]),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['member-access'] })
      queryClient.invalidateQueries({ queryKey: ['member-history'] })
      queryClient.invalidateQueries({ queryKey: ['access-requests'] })
      toast.success(`Team updated for ${project.name}`)
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const q = search.trim().toLowerCase()
  const members = people
    .filter((u) => u.role === 'TEAM_MEMBER')
    .filter((u) => !q || memberName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .sort((a, b) => memberName(a).localeCompare(memberName(b)))

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Team for {project.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{project.clientName} · <span className="num">{selected?.size ?? 0}</span> assigned</p>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team members…" className="pl-9" autoFocus />
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-0.5 -mx-1 px-1">
          {!selected && <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>}
          {selected && members.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{q ? 'No one matches.' : 'No team members yet.'}</p>}
          {selected && members.map((u) => (
            <label key={u.userId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(u.userId)}
                onChange={() => {
                  const next = new Set(selected)
                  if (next.has(u.userId)) next.delete(u.userId)
                  else next.add(u.userId)
                  setSelected(next)
                }}
                className="rounded border-border accent-primary h-4 w-4"
              />
              <Avatar className="h-6 w-6"><AvatarFallback className="bg-primary/10 text-primary text-[10px]">{memberInitials(u)}</AvatarFallback></Avatar>
              <span className="text-sm">{memberName(u)}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!selected || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectHistoryDialog({ project, onClose }: { project: ProjectOverview; onClose: () => void }) {
  const { token } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['project-history', token, project.projectId],
    queryFn: () => projectsApi.history(token!, project.projectId),
    enabled: !!token,
  })
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>History · {project.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{project.clientName}</p>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          <HistoryList events={data} isLoading={isLoading} empty="No changes recorded yet. Changes from now on will show here." />
        </div>
      </DialogContent>
    </Dialog>
  )
}
