'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { MoreHorizontalIcon, PlayIcon, SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SearchSelect } from '@/components/reports/SearchSelect'
import { ProjectDialog, ProjectHistoryDialog, ProjectTeamDialog, useInvalidateProjects } from '@/components/projects/ProjectDialogs'
import { memberInitials, memberName } from '@/components/team/member'
import { clients as clientsApi, projects as projectsApi, timeEntries, timerSession as timerSessionApi, users } from '@/lib/api'
import { clientColor } from '@/lib/colors'
import { useAuthStore } from '@/stores/auth'
import { isManagerial, type ProjectOverview, type UserResponse } from '@/lib/types'
import { RequestAccessButton } from '@/components/onboarding/RequestAccess'
import { HelpLink } from '@/components/help/HelpLink'

dayjs.extend(relativeTime)

const fh = (h: number) => (h % 1 === 0 ? `${h}h` : `${Number(h).toFixed(1)}h`)
const lastTracked = (p: ProjectOverview) => (p.lastTrackedAt ? dayjs(p.lastTrackedAt).fromNow() : 'Never')

/** Hours against budget; turns coral when over. */
function BudgetBar({ used, budget }: { used: number; budget?: number | null }) {
  if (!budget) return <span className="text-xs text-muted-foreground">No budget</span>
  const pct = (used / budget) * 100
  const over = used > budget
  return (
    <div className="min-w-28">
      <div className="flex justify-between text-xs mb-1">
        <span className={`num ${over ? 'text-coral font-semibold' : ''}`}>{fh(used)} / {fh(budget)}</span>
        <span className="num text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 rounded-[2px] bg-white/5 overflow-hidden">
        <div className={`h-full rounded-[2px] ${over ? 'bg-coral' : pct >= 80 ? 'bg-sun' : 'bg-teal'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

function TeamStack({ ids, people }: { ids: number[]; people: Map<number, UserResponse> }) {
  const shown = ids.map((id) => people.get(id)).filter((u): u is UserResponse => !!u)
  if (shown.length === 0) return <span className="text-xs text-muted-foreground">Nobody</span>
  return (
    <div className="flex -space-x-1.5" title={shown.map(memberName).join(', ')}>
      {shown.slice(0, 4).map((u) => (
        <Avatar key={u.userId} className="h-6 w-6 ring-2 ring-card">
          <AvatarFallback className="bg-primary/15 text-primary text-[10px]">{memberInitials(u)}</AvatarFallback>
        </Avatar>
      ))}
      {shown.length > 4 && <span className="num text-xs text-muted-foreground pl-2.5 self-center">+{shown.length - 4}</span>}
    </div>
  )
}

// ── Managers and Admins ─────────────────────────────────────────────────────

function ManagerProjects() {
  const { token } = useAuthStore()
  const invalidate = useInvalidateProjects()
  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState<number | null>(null)
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [dialog, setDialog] = useState<{ kind: 'new' } | { kind: 'edit' | 'team' | 'history'; project: ProjectOverview } | null>(null)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['projects-overview', token],
    queryFn: () => projectsApi.overview(token!),
    enabled: !!token,
  })
  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token,
  })
  const { data: people = [] } = useQuery({
    queryKey: ['users', token],
    queryFn: () => users.list(token!),
    enabled: !!token,
  })
  const peopleById = new Map(people.map((u) => [u.userId, u]))

  const setActive = useMutation({
    mutationFn: (p: ProjectOverview) => projectsApi.update(token!, p.projectId, { isActive: !p.isActive }),
    onSuccess: (p) => {
      invalidate()
      toast.success(p.isActive ? `Restored ${p.name}` : `Archived ${p.name}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const q = search.trim().toLowerCase()
  const archivedCount = rows.filter((p) => !p.isActive).length
  const shown = rows
    .filter((p) => (status === 'active' ? p.isActive : !p.isActive))
    .filter((p) => clientId === null || p.clientId === clientId)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q))
  const monthTotal = shown.reduce((s, p) => s + Number(p.hoursThisMonth), 0)

  const TH = 'px-3 md:px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap'
  const TD = 'px-3 md:px-4 py-3 align-middle'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-normal flex items-center gap-2">Projects <HelpLink slug="projects" /></h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every project, its budget and who&apos;s on it · <span className="num">{fh(monthTotal)}</span> this month
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: 'new' })}>+ New project</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects or clients…" className="pl-9" />
        </div>
        <SearchSelect
          options={clientList.map((c) => ({ value: c.clientId, label: c.name, color: clientColor(c.clientId) }))}
          value={clientId}
          onChange={setClientId}
          allLabel="All clients"
          placeholder="Search clients…"
        />
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-sm">
          {(['active', 'archived'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-2 font-medium transition-colors ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'active' ? 'Active' : <>Archived <span className="num opacity-70">({archivedCount})</span></>}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr>
              <th className={TH}>Project</th>
              <th className={`${TH} text-right`}>This month</th>
              <th className={TH}>Total vs budget</th>
              <th className={`${TH} hidden lg:table-cell`}>Team</th>
              <th className={`${TH} hidden md:table-cell`}>Last tracked</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Loading…</td></tr>}
            {!isLoading && shown.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-8">
                {q || clientId !== null ? 'No projects match.' : status === 'archived' ? 'No archived projects.' : 'No projects yet.'}
              </td></tr>
            )}
            {shown.map((p) => (
              <tr key={p.projectId} className="border-b border-white/5 last:border-0">
                <td className={TD}>
                  <div className="flex items-center gap-2.5 min-w-0 max-w-56">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: clientColor(p.clientId) }} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.clientName}</p>
                    </div>
                  </div>
                </td>
                <td className={`${TD} text-right num whitespace-nowrap`}>{fh(Number(p.hoursThisMonth))}</td>
                <td className={TD}>
                  {p.budgetHours ? <BudgetBar used={Number(p.totalHours)} budget={p.budgetHours} /> : (
                    <span className="text-xs text-muted-foreground"><span className="num text-foreground">{fh(Number(p.totalHours))}</span> · no budget</span>
                  )}
                </td>
                <td className={`${TD} hidden lg:table-cell`}>
                  <button onClick={() => setDialog({ kind: 'team', project: p })} className="hover:opacity-80" aria-label={`Team for ${p.name}`}>
                    <TeamStack ids={p.memberIds} people={peopleById} />
                  </button>
                </td>
                <td className={`${TD} hidden md:table-cell text-muted-foreground whitespace-nowrap`}>{lastTracked(p)}</td>
                <td className={`${TD} text-right`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${p.name}`} />}>
                      <MoreHorizontalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setDialog({ kind: 'edit', project: p })}>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setDialog({ kind: 'team', project: p })}>Manage team</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setDialog({ kind: 'history', project: p })}>History</DropdownMenuItem>
                      <DropdownMenuItem className={`cursor-pointer ${p.isActive ? 'text-destructive' : ''}`} onClick={() => setActive.mutate(p)}>
                        {p.isActive ? 'Archive' : 'Restore'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {status === 'active' && <p className="text-xs text-muted-foreground mt-3">Archived projects keep their time but can&apos;t be tracked to. Restore them from Archived.</p>}

      {dialog?.kind === 'new' && <ProjectDialog clients={clientList} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <ProjectDialog project={dialog.project} clients={clientList} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'team' && <ProjectTeamDialog project={dialog.project} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'history' && <ProjectHistoryDialog project={dialog.project} onClose={() => setDialog(null)} />}
    </div>
  )
}

// ── Team members ────────────────────────────────────────────────────────────

function MyProjects() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['projects-overview', token],
    queryFn: () => projectsApi.overview(token!),
    enabled: !!token,
  })
  const { data: active } = useQuery({
    queryKey: ['active-timer', token],
    queryFn: async () => { try { return await timeEntries.active(token!) } catch { return null } },
    enabled: !!token,
  })
  const { data: paused } = useQuery({
    queryKey: ['timer-session', token],
    queryFn: async () => { try { return await timerSessionApi.get(token!) } catch { return null } },
    enabled: !!token,
  })
  const busy = !!active?.isRunning || !!paused
  const busyReason = active?.isRunning ? 'A timer is already running. Stop it first.' : paused ? 'You have a paused timer. Finish or discard it first.' : ''

  const start = useMutation({
    mutationFn: (p: ProjectOverview) => timeEntries.start(token!, { projectId: p.projectId, description: '' }),
    onSuccess: (_, p) => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      queryClient.invalidateQueries({ queryKey: ['projects-overview'] })
      toast.success(`Timer started on ${p.name}. Add what you're working on above.`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const q = search.trim().toLowerCase()
  const shown = rows.filter((p) => !q || p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q))
  const monthTotal = rows.reduce((s, p) => s + Number(p.hoursThisMonth), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-normal flex items-center gap-2">My projects <HelpLink slug="my-projects" /></h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          What you can track time to · <span className="num">{fh(monthTotal)}</span> logged this month
        </p>
      </div>
      {rows.length > 6 && (
        <div className="relative max-w-sm mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects or clients…" className="pl-9" />
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <div className="rounded-lg glass-card p-8 text-center text-sm text-muted-foreground space-y-4">
          <p>You&apos;re not on any projects yet, so there&apos;s nothing to track time to.</p>
          <RequestAccessButton className="mx-auto" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((p) => {
          const runningHere = active?.isRunning && active.projectId === p.projectId
          return (
            <div key={p.projectId} className="rounded-lg glass-card p-4 flex flex-col gap-3 border-l-2" style={{ borderLeftColor: clientColor(p.clientId) }}>
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.clientName}</p>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">This month</p>
                  <p className="num font-semibold">{fh(Number(p.hoursThisMonth))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">All time</p>
                  <p className="num font-semibold">{fh(Number(p.totalHours))}</p>
                </div>
              </div>
              {p.budgetHours ? <p className="text-xs text-muted-foreground">Budget <span className="num">{fh(p.budgetHours)}</span></p> : null}
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Last tracked {lastTracked(p).toLowerCase()}</span>
                {runningHere ? (
                  <Badge className="bg-teal/15 text-teal border-teal/30">Running</Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy || start.isPending} title={busyReason || `Start a timer on ${p.name}`} onClick={() => start.mutate(p)}>
                    <PlayIcon className="size-3.5" /> Start
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const { user } = useAuthStore()
  if (!user) return null
  return isManagerial(user.role) ? <ManagerProjects /> : <MyProjects />
}
