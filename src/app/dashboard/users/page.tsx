'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { auth, users, projects as projectsApi, clients as clientsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { UserResponse } from '@/lib/types'

// ── Add User Dialog ───────────────────────────────────────────────────────────

function AddUserDialog({ role, onClose, onCreated }: { role: 'VA' | 'MANAGER'; onClose: () => void; onCreated: (email: string) => void }) {
  const { user: currentUser } = useAuthStore()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const label = role === 'VA' ? 'worker' : 'admin'

  const createMutation = useMutation({
    mutationFn: () =>
      auth.register({
        workspaceId: currentUser!.workspaceId,
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        role,
      }),
    onSuccess: () => {
      toast.success(`${role === 'VA' ? 'Worker' : 'Admin'} account created for ${email}`)
      onCreated(email)
    },
    onError: (err: Error) => setError(err.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add {label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Temporary password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required />
            <p className="text-xs text-muted-foreground">Share this with the {label} — they can update it later.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : `Create ${label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Assign Projects Dialog ────────────────────────────────────────────────────

function AssignProjectsDialog({ worker, onClose }: { worker: UserResponse; onClose: () => void }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

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

  const { data: assignmentMap = {} } = useQuery({
    queryKey: ['assignments-for-worker', token, worker.userId, allProjects.map((p) => p.projectId).join(',')],
    queryFn: async () => {
      const results: Record<number, boolean> = {}
      await Promise.all(
        allProjects.map(async (p) => {
          try {
            const a = await projectsApi.listAssignments(token!, p.projectId)
            results[p.projectId] = a.some((x) => x.userId === worker.userId)
          } catch {
            results[p.projectId] = false
          }
        })
      )
      return results
    },
    enabled: !!token && allProjects.length > 0,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ projectId, assigned }: { projectId: number; assigned: boolean }) => {
      if (assigned) {
        await projectsApi.unassign(token!, projectId, worker.userId)
      } else {
        await projectsApi.assign(token!, projectId, worker.userId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments-for-worker'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const byClient = clientList
    .map((c) => ({ client: c, projects: allProjects.filter((p) => p.clientId === c.clientId) }))
    .filter((g) => g.projects.length > 0)

  const displayName = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign projects to {displayName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-96 overflow-y-auto">
          {byClient.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No projects yet — create some in Clients.</p>
          )}
          {byClient.map(({ client, projects }) => (
            <div key={client.clientId}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{client.name}</p>
              <div className="space-y-1">
                {projects.map((p) => {
                  const assigned = assignmentMap[p.projectId] ?? false
                  return (
                    <label key={p.projectId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={() => toggleMutation.mutate({ projectId: p.projectId, assigned })}
                        className="rounded border-border accent-primary h-4 w-4"
                      />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { token, user: currentUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [addWorkerOpen, setAddWorkerOpen] = useState(false)
  const [addAdminOpen, setAddAdminOpen] = useState(false)
  const [assignWorker, setAssignWorker] = useState<UserResponse | null>(null)

  const { data: userList = [], isLoading } = useQuery({
    queryKey: ['users', token],
    queryFn: () => users.list(token!),
    enabled: !!token && currentUser?.role === 'MANAGER',
  })

  const updateMutation = useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: { role?: string; isActive?: boolean } }) =>
      users.update(token!, userId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (currentUser?.role !== 'MANAGER') {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Access restricted to admins</div>
  }

  const workers = userList.filter((u) => u.role === 'VA')
  const admins = userList.filter((u) => u.role === 'MANAGER')

  function handleWorkerCreated(email: string) {
    setAddWorkerOpen(false)
    queryClient.invalidateQueries({ queryKey: ['users'] }).then(() => {
      // auto-open assign dialog for new worker once list refreshes
      const newWorker = userList.find((u) => u.email === email)
      if (newWorker) setAssignWorker(newWorker)
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage workers and their project access</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddAdminOpen(true)}>+ Add admin</Button>
          <Button onClick={() => setAddWorkerOpen(true)}>+ Add worker</Button>
        </div>
      </div>

      {/* Workers */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Workers</h2>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {workers.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No workers yet —{' '}
                    <button className="text-primary hover:underline" onClick={() => setAddWorkerOpen(true)}>add one</button>
                  </TableCell>
                </TableRow>
              )}
              {workers.map((u) => {
                const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('') || u.email[0].toUpperCase()
                const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
                return (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dayjs(u.createdAt).format('D MMM YYYY')}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? 'secondary' : 'outline'} className="text-xs">
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setAssignWorker(u)}>
                        Assign projects
                      </Button>
                    </TableCell>
                    <TableCell>
                      {u.userId !== currentUser.userId && (
                        <button
                          onClick={() => updateMutation.mutate({ userId: u.userId, body: { isActive: !u.isActive } })}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Admins */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Admins</h2>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((u) => {
                const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('') || u.email[0].toUpperCase()
                const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
                return (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dayjs(u.createdAt).format('D MMM YYYY')}</TableCell>
                    <TableCell>
                      {u.userId !== currentUser.userId && (
                        <button
                          onClick={() => updateMutation.mutate({ userId: u.userId, body: { role: 'VA' } })}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Make worker
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {addWorkerOpen && (
        <AddUserDialog role="VA" onClose={() => setAddWorkerOpen(false)} onCreated={handleWorkerCreated} />
      )}
      {addAdminOpen && (
        <AddUserDialog role="MANAGER" onClose={() => setAddAdminOpen(false)} onCreated={() => { setAddAdminOpen(false); queryClient.invalidateQueries({ queryKey: ['users'] }) }} />
      )}
      {assignWorker && (
        <AssignProjectsDialog worker={assignWorker} onClose={() => setAssignWorker(null)} />
      )}
    </div>
  )
}
