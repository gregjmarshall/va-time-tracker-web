'use client'

import { useState } from 'react'
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
import { clients, clientBilling, projects, reports, clientTeamAccess, clientManagers, users } from '@/lib/api'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth'
import { RetainerDialog } from '@/components/clients/RetainerDialog'
import { clientColor } from '@/lib/colors'
import { ClientDetailsDialog } from '@/components/clients/ClientDetailsDialog'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { isAdmin, isManagerial, PAYMENT_METHOD_LABELS, type ClientBillingResponse, type ClientResponse, type ProjectResponse, type RetainerUsage, type UserResponse } from '@/lib/types'

function RetainerBar({ status }: { status: RetainerUsage }) {
  const used = status.percentUsed !== undefined ? Math.round(status.percentUsed) : null
  return (
    <div className="mt-2 space-y-1">
      {status.retainerHours ? (
        <>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="num">{status.actualHoursThisMonth.toFixed(1)}h / {status.retainerHours}h</span>
            {used !== null && <span className="num">{used}%</span>}
          </div>
          <Progress
            value={Math.min(used ?? 0, 100)}
            className={status.isOver ? '[&>div]:bg-destructive' : (used ?? 0) > 80 ? '[&>div]:bg-amber-500' : ''}
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{status.actualHoursThisMonth.toFixed(1)}h this month · ad hoc</p>
      )}
    </div>
  )
}

dayjs.extend(relativeTime)

type ClientFilter = 'all' | 'retainer' | 'adhoc' | 'active'
type ClientSort = 'name' | 'tracked'
const ACTIVE_DAYS = 30

/** "2y 3m", "5m" or "new" since a YYYY-MM-DD date. */
function tenure(since: string) {
  const months = dayjs().diff(dayjs(since), 'month')
  if (months < 1) return 'new'
  const y = Math.floor(months / 12), m = months % 12
  return [y && `${y}y`, m && `${m}m`].filter(Boolean).join(' ')
}

function formatRate(b?: ClientBillingResponse) {
  if (!b?.rateType || b.rateAmount == null) return null
  const amount = `£${Number(b.rateAmount).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
  return b.rateType === 'HOURLY' ? `${amount}/h` : `${amount}/month`
}

// ── Overseeing managers ───────────────────────────────────────────────────────

function OverseenBy({ clientId, managerIds, managers, onChange }: {
  clientId: number
  managerIds: number[]
  managers: UserResponse[]
  onChange: (clientId: number, userIds: number[]) => void
}) {
  const name = (u: UserResponse) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
  const assigned = managers.filter((m) => managerIds.includes(m.userId))
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
      <span>Overseen by</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="text-foreground hover:text-primary transition-colors cursor-pointer">
          {assigned.length > 0 ? assigned.map(name).join(', ') : <span className="text-muted-foreground underline decoration-dotted">nobody yet</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Managers overseeing this client</DropdownMenuLabel>
          {managers.map((m) => (
            <DropdownMenuCheckboxItem
              key={m.userId}
              checked={managerIds.includes(m.userId)}
              onCheckedChange={(checked) =>
                onChange(clientId, checked ? [...managerIds, m.userId] : managerIds.filter((id) => id !== m.userId))
              }
            >
              {name(m)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function ClientsPage() {
  const { token, user } = useAuthStore()
  const isTeamMember = !isManagerial(user?.role)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [mineChoice, setMineOnly] = useState<boolean | null>(null)
  const [filter, setFilter] = useState<ClientFilter>('all')
  const [sort, setSort] = useState<ClientSort>('name')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [detailsClient, setDetailsClient] = useState<ClientResponse | null>(null)
  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [retainerClient, setRetainerClient] = useState<ClientResponse | null>(null)
  const [projectClientId, setProjectClientId] = useState<number | null>(null)

  const [clientForm, setClientForm] = useState({ name: '', contactEmail: '' })
  const [projectName, setProjectName] = useState('')
  const [projectBudgetHours, setProjectBudgetHours] = useState('')
  const [projectType, setProjectType] = useState<'ongoing' | 'fixed'>('ongoing')

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

  const { data: myTeamAccess } = useQuery({
    queryKey: ['my-team-access', token],
    queryFn: () => clientTeamAccess.myClients(token!),
    enabled: !!token && isTeamMember,
  })
  const teamAccessIds = new Set(myTeamAccess?.clientIds ?? [])

  const { data: managerRows = [] } = useQuery({
    queryKey: ['client-managers', token],
    queryFn: () => clientManagers.list(token!),
    enabled: !!token && !isTeamMember,
  })
  const managersByClient = new Map(managerRows.map((r) => [r.clientId, r.userIds]))
  const { data: people = [] } = useQuery({
    queryKey: ['users', token],
    queryFn: () => users.list(token!),
    enabled: !!token && !isTeamMember,
  })
  const managers = people.filter((u) => u.isActive && isManagerial(u.role))
  const setManagersMutation = useMutation({
    mutationFn: ({ clientId, userIds }: { clientId: number; userIds: number[] }) => clientManagers.set(token!, clientId, userIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-managers'] }),
    onError: (err: Error) => toast.error(err.message),
  })

  const admin = isAdmin(user?.role)
  const { data: billingRows = [] } = useQuery({
    queryKey: ['client-billing', token],
    queryFn: () => clientBilling.list(token!),
    enabled: !!token && admin,
  })
  const billingByClient = new Map(billingRows.map((b) => [b.clientId, b]))

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

  const detailMap = new Map(clientDetails.map((d) => [d.client.clientId, d]))
  const projectsByClient = (clientId: number) => projectList.filter((p) => p.clientId === clientId && p.isActive)
  const assignedClientIds = new Set(projectList.map((p) => p.clientId))

  const activeClients = clientList.filter(c => c.isActive && (!isTeamMember || assignedClientIds.has(c.clientId) || teamAccessIds.has(c.clientId)))
  const myClients = activeClients.filter(c => user && managersByClient.get(c.clientId)?.includes(user.userId))
  // Managers land on the clients they oversee; admins on everything
  const mineOnly = mineChoice ?? (user?.role === 'MANAGER' && myClients.length > 0)
  const q = search.trim().toLowerCase()
  const clientHasRetainer = (id: number) => {
    const st = detailMap.get(id)?.retainerStatus
    return !!st?.retainerHours || (st?.projectRetainers?.length ?? 0) > 0
  }
  const lastTracked = (id: number) => detailMap.get(id)?.lastTrackedAt
  const activeSince = dayjs().subtract(ACTIVE_DAYS, 'day')
  const isActivelyTracked = (id: number) => { const t = lastTracked(id); return !!t && dayjs(t).isAfter(activeSince) }
  const filterMatches = (c: ClientResponse) =>
    filter === 'retainer' ? clientHasRetainer(c.clientId)
      : filter === 'adhoc' ? !clientHasRetainer(c.clientId)
      : filter === 'active' ? isActivelyTracked(c.clientId)
      : true
  const displayedClients = (mineOnly ? myClients : activeClients)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.contactEmail?.toLowerCase().includes(q))
    .filter(filterMatches)
    .sort((a, b) => sort === 'tracked'
      ? (lastTracked(b.clientId) ?? '').localeCompare(lastTracked(a.clientId) ?? '') || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name))
  const filterCount = (f: ClientFilter) => {
    const base = mineOnly ? myClients : activeClients
    return f === 'all' ? base.length : base.filter((c) => (f === 'retainer' ? clientHasRetainer(c.clientId) : f === 'adhoc' ? !clientHasRetainer(c.clientId) : isActivelyTracked(c.clientId))).length
  }
  const toggleProjects = (id: number) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-medium text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{isTeamMember ? 'Your assigned clients and projects' : 'Manage clients, projects and retainers'}</p>
        </div>
        {!isTeamMember && <Button onClick={() => setCreateClientOpen(true)}>+ New client</Button>}
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
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground text-sm mb-3">No clients yet</p>
          {!isTeamMember && <Button onClick={() => setCreateClientOpen(true)}>+ Create your first client</Button>}
        </div>
      )}

      {!isTeamMember && myClients.length > 0 && (
        <div className="flex gap-2 mb-4">
          {[{ mine: false, label: 'All clients' }, { mine: true, label: `My clients (${myClients.length})` }].map((o) => (
            <button
              key={o.label}
              onClick={() => setMineOnly(o.mine)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold border transition-all ${
                mineOnly === o.mine
                  ? 'bg-secondary text-foreground border-foreground/25'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {activeClients.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {([['all', 'All'], ['retainer', 'Retainer'], ['adhoc', 'Ad hoc'], ['active', `Tracked in last ${ACTIVE_DAYS} days`]] as [ClientFilter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                filter === f ? 'bg-white/15 text-foreground border-white/20' : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground'
              }`}>
              {label} <span className="opacity-60">{filterCount(f)}</span>
            </button>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value as ClientSort)} aria-label="Sort clients"
            className="ml-auto h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none [&>option]:bg-popover">
            <option value="name">Name A–Z</option>
            <option value="tracked">Recently tracked</option>
          </select>
        </div>
      )}
      {activeClients.length > 0 && displayedClients.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">{q ? <>No clients match &quot;{search}&quot;</> : 'No clients match this filter'}</p>
      )}

      <div className="space-y-4">
        {displayedClients.map((client) => {
          const detail = detailMap.get(client.clientId)
          const clientProjects = projectsByClient(client.clientId)
          const projectRetainers = new Map((detail?.retainerStatus.projectRetainers ?? []).map((r) => [r.projectId, r]))
          const hasRetainer = !!detail?.retainerStatus.retainerHours || projectRetainers.size > 0
          return (
            <div key={client.clientId} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              {/* Client header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: clientColor(client.clientId) }} />
                    {(isManagerial(user?.role) || user?.fullVisibility || teamAccessIds.has(client.clientId)) ? (
                      <Link href={`/dashboard/clients/${client.clientId}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                        {client.name}
                      </Link>
                    ) : (
                      <h3 className="font-semibold text-foreground">{client.name}</h3>
                    )}
                    {client.contactEmail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{client.contactEmail}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {[
                        client.clientSince && `Client since ${dayjs(client.clientSince).format('MMM YYYY')} (${tenure(client.clientSince)})`,
                        admin && formatRate(billingByClient.get(client.clientId)),
                        admin && billingByClient.get(client.clientId)?.paymentMethod && PAYMENT_METHOD_LABELS[billingByClient.get(client.clientId)!.paymentMethod!],
                        detail && (detail.lastTrackedAt ? `Last tracked ${dayjs(detail.lastTrackedAt).fromNow()}` : 'Not tracked yet'),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge variant={detail?.retainerStatus.isOver ? 'destructive' : 'secondary'} className="ml-2 flex-shrink-0">
                    {detail?.retainerStatus.isOver ? 'Over' : hasRetainer ? 'Retainer' : 'Ad hoc'}
                  </Badge>
                </div>
                {detail && <RetainerBar status={detail.retainerStatus} />}
                {!isTeamMember && managers.length > 0 && (
                  <OverseenBy
                    clientId={client.clientId}
                    managerIds={managersByClient.get(client.clientId) ?? []}
                    managers={managers}
                    onChange={(clientId, userIds) => setManagersMutation.mutate({ clientId, userIds })}
                  />
                )}
                {!isTeamMember && <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setProjectClientId(client.clientId)
                      setProjectName('')
                    }}
                  >
                    + Add project
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setDetailsClient(client)}>
                    Edit details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setRetainerClient(client)
                    }}
                  >
                    {hasRetainer ? 'Edit retainer' : 'Set retainer'}
                  </Button>
                </div>}
              </div>

              {/* Projects */}
              {clientProjects.length > 0 && (
                <>
                  <Separator />
                  <button type="button" onClick={() => toggleProjects(client.clientId)} aria-expanded={expanded.has(client.clientId)}
                    className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${expanded.has(client.clientId) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {clientProjects.length} {clientProjects.length === 1 ? 'project' : 'projects'}
                  </button>
                  {expanded.has(client.clientId) && <div className="px-5 pb-3 space-y-3">
                    {clientProjects.map((p) => {
                      const retainer = projectRetainers.get(p.projectId)
                      if (retainer) return (
                        <div key={p.projectId}>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: clientColor(client.clientId) }} />
                            <span className="flex-1">{p.name} <span className="text-xs">· own retainer</span></span>
                          </div>
                          <div className="ml-3.5"><RetainerBar status={retainer} /></div>
                        </div>
                      )
                      const logged = projectHoursMap.get(p.projectId) ?? 0
                      const pct = p.budgetHours ? Math.min((logged / p.budgetHours) * 100, 100) : null
                      const isOver = p.budgetHours ? logged > p.budgetHours : false
                      return (
                        <div key={p.projectId}>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: clientColor(client.clientId) }} />
                            <span className="flex-1">{p.name}</span>
                            {p.budgetHours && (
                              <span className={`num text-xs ${isOver ? 'text-destructive' : 'text-muted-foreground'}`}>
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
                  </div>}
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

      {detailsClient && (
        <ClientDetailsDialog client={detailsClient} billing={billingByClient.get(detailsClient.clientId)} onClose={() => setDetailsClient(null)} />
      )}
      <RetainerDialog key={retainerClient?.clientId ?? 'none'} client={retainerClient} projects={projectList} onClose={() => setRetainerClient(null)} />
    </div>
  )
}
