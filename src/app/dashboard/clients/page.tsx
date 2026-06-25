'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { clients, projects, retainers, reports } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ClientResponse, ProjectResponse, RetainerStatus } from '@/lib/types'

function RetainerBar({ status }: { status: RetainerStatus }) {
  const used = status.percentUsed !== undefined ? Math.round(status.percentUsed) : null
  return (
    <div className="mt-2 space-y-1">
      {status.retainerHours ? (
        <>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{status.actualHoursThisMonth.toFixed(1)}h / {status.retainerHours}h</span>
            {used !== null && <span>{used}%</span>}
          </div>
          <Progress
            value={Math.min(used ?? 0, 100)}
            className={status.isOver ? '[&>div]:bg-destructive' : (used ?? 0) > 80 ? '[&>div]:bg-amber-500' : ''}
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{status.actualHoursThisMonth.toFixed(1)}h this month · no retainer</p>
      )}
    </div>
  )
}

const RECENT_KEY = 'va-recent-clients'
function loadRecent(): number[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function pushRecent(id: number) {
  const prev = loadRecent().filter(i => i !== id)
  localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, 5)))
}

export default function ClientsPage() {
  const { token, user } = useAuthStore()
  const isVA = user?.role === 'VA'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [recentIds, setRecentIds] = useState<number[]>([])
  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [retainerClientId, setRetainerClientId] = useState<number | null>(null)
  const [projectClientId, setProjectClientId] = useState<number | null>(null)

  useEffect(() => { setRecentIds(loadRecent()) }, [])

  function touchClient(id: number) {
    pushRecent(id)
    setRecentIds(loadRecent())
  }
  const [clientForm, setClientForm] = useState({ name: '', contactEmail: '' })
  const [projectName, setProjectName] = useState('')
  const [projectBudgetHours, setProjectBudgetHours] = useState('')
  const [projectType, setProjectType] = useState<'ongoing' | 'fixed'>('ongoing')
  const [retainerForm, setRetainerForm] = useState({ monthlyHours: '', effectiveFrom: new Date().toISOString().slice(0, 10) })

  const { data: clientList = [], isLoading } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clients.list(token!),
    enabled: !!token,
  })

  const { data: clientDetails = [] } = useQuery({
    queryKey: ['clients-with-retainer', token, clientList.map((c) => c.clientId).join(',')],
    queryFn: () => Promise.all(clientList.map((c) => clients.get(token!, c.clientId))),
    enabled: !!token && clientList.length > 0,
    refetchInterval: 120_000,
  })

  const { data: projectList = [] } = useQuery({
    queryKey: ['projects', token],
    queryFn: () => projects.list(token!),
    enabled: !!token,
  })

  const { data: summaryData } = useQuery({
    queryKey: ['reports-summary-alltime', token],
    queryFn: () => reports.summary(token!),
    enabled: !!token,
  })
  const projectHoursMap = new Map(
    (summaryData?.rows ?? []).map((r) => [r.projectId, r.totalHours])
  )

  const createClientMutation = useMutation({
    mutationFn: () => clients.create(token!, { name: clientForm.name, contactEmail: clientForm.contactEmail || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created')
      setCreateClientOpen(false)
      setClientForm({ name: '', contactEmail: '' })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createProjectMutation = useMutation({
    mutationFn: () => projects.create(token!, {
      clientId: projectClientId!,
      name: projectName,
      budgetHours: projectType === 'fixed' && projectBudgetHours ? Number(projectBudgetHours) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      setProjectClientId(null)
      setProjectName('')
      setProjectBudgetHours('')
      setProjectType('ongoing')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const retainerMutation = useMutation({
    mutationFn: () =>
      retainers.create(token!, {
        clientId: retainerClientId!,
        monthlyHours: Number(retainerForm.monthlyHours),
        effectiveFrom: retainerForm.effectiveFrom,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients-with-retainer'] })
      toast.success('Retainer set')
      setRetainerClientId(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const detailMap = new Map(clientDetails.map((d) => [d.client.clientId, d]))
  const projectsByClient = (clientId: number) => projectList.filter((p) => p.clientId === clientId && p.isActive)
  const assignedClientIds = new Set(projectList.map((p) => p.clientId))

  const activeClients = clientList.filter(c => c.isActive && (!isVA || assignedClientIds.has(c.clientId)))
  const q = search.trim().toLowerCase()
  const displayedClients = q
    ? activeClients.filter(c => c.name.toLowerCase().includes(q) || c.contactEmail?.toLowerCase().includes(q))
    : recentIds.length > 0
      ? activeClients.filter(c => recentIds.includes(c.clientId)).sort((a, b) => recentIds.indexOf(a.clientId) - recentIds.indexOf(b.clientId))
      : activeClients.slice(0, 5)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{isVA ? 'Your assigned clients and projects' : 'Manage clients, projects and retainers'}</p>
        </div>
        {!isVA && <Button onClick={() => setCreateClientOpen(true)}>+ New client</Button>}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
        </svg>
        <Input
          placeholder={`Search ${activeClients.length} clients…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>}

      {!isLoading && clientList.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground text-sm mb-3">No clients yet</p>
          {!isVA && <Button onClick={() => setCreateClientOpen(true)}>+ Create your first client</Button>}
        </div>
      )}

      {!q && activeClients.length > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          {recentIds.length > 0 ? 'Recently accessed' : 'Most recent'} · search to find all {activeClients.length} clients
        </p>
      )}
      {q && displayedClients.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">No clients match &quot;{search}&quot;</p>
      )}

      <div className="space-y-4">
        {displayedClients.map((client) => {
          const detail = detailMap.get(client.clientId)
          const clientProjects = projectsByClient(client.clientId)
          return (
            <div key={client.clientId} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Client header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {(user?.role === 'MANAGER' || user?.fullVisibility) ? (
                      <Link href={`/dashboard/clients/${client.clientId}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                        {client.name}
                      </Link>
                    ) : (
                      <h3 className="font-semibold text-foreground">{client.name}</h3>
                    )}
                    {client.contactEmail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{client.contactEmail}</p>
                    )}
                  </div>
                  <Badge variant={detail?.retainerStatus.isOver ? 'destructive' : 'secondary'} className="ml-2 flex-shrink-0">
                    {detail?.retainerStatus.isOver ? 'Over' : detail?.retainerStatus.retainerHours ? 'Retainer' : 'No retainer'}
                  </Badge>
                </div>
                {detail && <RetainerBar status={detail.retainerStatus} />}
                {!isVA && <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      touchClient(client.clientId)
                      setProjectClientId(client.clientId)
                      setProjectName('')
                    }}
                  >
                    + Add project
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      touchClient(client.clientId)
                      setRetainerClientId(client.clientId)
                      setRetainerForm({ monthlyHours: '', effectiveFrom: new Date().toISOString().slice(0, 10) })
                    }}
                  >
                    Set retainer
                  </Button>
                </div>}
              </div>

              {/* Projects */}
              {clientProjects.length > 0 && (
                <>
                  <Separator />
                  <div className="px-5 py-3 space-y-3">
                    {clientProjects.map((p) => {
                      const logged = projectHoursMap.get(p.projectId) ?? 0
                      const pct = p.budgetHours ? Math.min((logged / p.budgetHours) * 100, 100) : null
                      const isOver = p.budgetHours ? logged > p.budgetHours : false
                      return (
                        <div key={p.projectId}>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                            <span className="flex-1">{p.name}</span>
                            {p.budgetHours && (
                              <span className={`text-xs tabular-nums ${isOver ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {logged.toFixed(1)}h / {p.budgetHours}h
                              </span>
                            )}
                          </div>
                          {pct !== null && (
                            <div className="ml-3.5 mt-1.5">
                              <Progress
                                value={pct}
                                className={`h-1 ${isOver ? '[&>div]:bg-destructive' : pct > 80 ? '[&>div]:bg-amber-500' : ''}`}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Create client dialog */}
      <Dialog open={createClientOpen} onOpenChange={(v) => !v && setCreateClientOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Acme Corp" value={clientForm.name} onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Contact email <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input type="email" placeholder="contact@acme.com" value={clientForm.contactEmail} onChange={(e) => setClientForm((f) => ({ ...f, contactEmail: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClientOpen(false)}>Cancel</Button>
            <Button onClick={() => createClientMutation.mutate()} disabled={!clientForm.name.trim() || createClientMutation.isPending}>
              {createClientMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add project dialog */}
      <Dialog open={projectClientId !== null} onOpenChange={(v) => { if (!v) { setProjectClientId(null); setProjectType('ongoing'); setProjectBudgetHours('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add project</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Project name</Label>
              <Input
                placeholder="e.g. Diary Management"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && projectName.trim() && createProjectMutation.mutate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Project type</Label>
              <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setProjectType('ongoing')}
                  className={`flex-1 py-2 transition-colors ${projectType === 'ongoing' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Ongoing
                </button>
                <button
                  type="button"
                  onClick={() => setProjectType('fixed')}
                  className={`flex-1 py-2 transition-colors ${projectType === 'fixed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Fixed hours
                </button>
              </div>
            </div>
            {projectType === 'fixed' && (
              <div className="space-y-1.5">
                <Label>Budget hours</Label>
                <Input
                  type="number"
                  placeholder="e.g. 40"
                  min="1"
                  value={projectBudgetHours}
                  onChange={(e) => setProjectBudgetHours(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProjectClientId(null); setProjectType('ongoing'); setProjectBudgetHours('') }}>Cancel</Button>
            <Button
              onClick={() => createProjectMutation.mutate()}
              disabled={!projectName.trim() || (projectType === 'fixed' && !projectBudgetHours) || createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? 'Adding…' : 'Add project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set retainer dialog */}
      <Dialog open={retainerClientId !== null} onOpenChange={(v) => !v && setRetainerClientId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Set retainer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Monthly hours</Label>
              <Input type="number" placeholder="60" value={retainerForm.monthlyHours} onChange={(e) => setRetainerForm((f) => ({ ...f, monthlyHours: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Effective from</Label>
              <Input type="date" value={retainerForm.effectiveFrom} onChange={(e) => setRetainerForm((f) => ({ ...f, effectiveFrom: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetainerClientId(null)}>Cancel</Button>
            <Button onClick={() => retainerMutation.mutate()} disabled={!retainerForm.monthlyHours || retainerMutation.isPending}>
              {retainerMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
