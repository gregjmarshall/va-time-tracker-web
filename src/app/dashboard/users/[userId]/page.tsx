'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import isoWeek from 'dayjs/plugin/isoWeek'
import { ArrowLeftIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { HoursChart } from '@/components/reports/HoursChart'
import { AccessDialog } from '@/components/team/AccessDialog'
import { EditMemberDialog, useToggleActive } from '@/components/team/MemberDialogs'
import { canManage, memberInitials, memberName } from '@/components/team/member'
import { users, reports, projects as projectsApi, clients as clientsApi } from '@/lib/api'
import { clientColor } from '@/lib/colors'
import { useAuthStore } from '@/stores/auth'
import { isManagerial, roleLabel } from '@/lib/types'

dayjs.extend(relativeTime)
dayjs.extend(isoWeek)

type Period = 'week' | 'month' | 'last30' | 'quarter'
const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 3 months' },
]

function periodRange(p: Period) {
  const now = dayjs()
  const from =
    p === 'week' ? now.startOf('isoWeek')
    : p === 'month' ? now.startOf('month')
    : p === 'last30' ? now.subtract(29, 'day').startOf('day')
    : now.subtract(3, 'month').startOf('day')
  return { from: from.toISOString(), to: now.toISOString() }
}

const fh = (h: number) => (h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`)
const hoursOf = (s?: number | null) => (s ?? 0) / 3600

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl glass-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num text-xl font-semibold mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export default function MemberPage() {
  const { userId: param } = useParams<{ userId: string }>()
  const userId = Number(param)
  const { token, user: currentUser } = useAuthStore()
  const [period, setPeriod] = useState<Period>('month')
  const [dialog, setDialog] = useState<'access' | 'edit' | null>(null)
  const toggleActive = useToggleActive()
  const allowed = isManagerial(currentUser?.role)

  const { data: userList = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users-all', token],
    queryFn: () => users.list(token!, { includeInactive: true }),
    enabled: !!token && allowed,
  })
  const member = userList.find((u) => u.userId === userId)
  const isTeamMember = member?.role === 'TEAM_MEMBER'

  const range = periodRange(period)
  const params = { ...range, userId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
  const { data: summary } = useQuery({
    queryKey: ['reports-summary', token, 'member', userId, period],
    queryFn: () => reports.summary(token!, params),
    enabled: !!token && allowed && !!member,
  })
  const { data: recent } = useQuery({
    queryKey: ['reports-detailed', token, 'member', userId, period],
    queryFn: () => reports.detailed(token!, { ...params, page: 0, size: 10 }),
    enabled: !!token && allowed && !!member,
  })
  const { data: access } = useQuery({
    queryKey: ['member-access', token, userId],
    queryFn: () => users.access(token!, userId),
    enabled: !!token && allowed && isTeamMember,
  })
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects-all', token],
    queryFn: () => projectsApi.list(token!),
    enabled: !!token && allowed && isTeamMember,
  })
  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token && allowed && isTeamMember,
  })

  if (!allowed) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Access restricted to managers and admins</div>
  }
  if (usersLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>
  if (!member) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/dashboard/users" className="text-sm text-muted-foreground hover:text-foreground">← Team</Link>
        <p className="mt-6 text-sm text-muted-foreground">That team member doesn&apos;t exist.</p>
      </div>
    )
  }

  const rows = summary?.rows ?? []
  const total = rows.reduce((s, r) => s + r.roundedTotalHours, 0)
  const billable = rows.reduce((s, r) => s + r.billableRoundedTotalHours, 0)
  const byClient = [...rows.reduce((m, r) => {
    const c = m.get(r.clientId) ?? { clientId: r.clientId, name: r.clientName, hours: 0 }
    c.hours += r.roundedTotalHours
    return m.set(r.clientId, c)
  }, new Map<number, { clientId: number; name: string; hours: number }>()).values()]
    .filter((c) => c.hours > 0)
    .sort((a, b) => b.hours - a.hours)
  const maxClient = Math.max(...byClient.map((c) => c.hours), 0)

  const projectName = new Map(allProjects.map((p) => [p.projectId, p]))
  const clientName = new Map(clientList.map((c) => [c.clientId, c.name]))
  const assigned = (access?.projectIds ?? [])
    .map((id) => projectName.get(id))
    .filter((p) => !!p)
    .sort((a, b) => (clientName.get(a!.clientId) ?? '').localeCompare(clientName.get(b!.clientId) ?? '') || a!.name.localeCompare(b!.name))
  const visibleClients = (access?.clientIds ?? []).map((id) => ({ id, name: clientName.get(id) })).filter((c) => c.name)

  const manageable = !!currentUser && canManage(currentUser, member)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link href="/dashboard/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Team
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary font-semibold">{memberInitials(member)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">{memberName(member)}</h1>
            <p className="text-sm text-muted-foreground truncate">{member.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">{roleLabel(member.role)}</Badge>
              {!member.isActive && <Badge variant="outline" className="text-xs">Deactivated</Badge>}
              <span>Joined {dayjs(member.createdAt).format('D MMM YYYY')}</span>
              <span>·</span>
              <span>{member.lastTrackedAt ? `Last tracked ${dayjs(member.lastTrackedAt).fromNow()}` : 'Not tracked yet'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isTeamMember && member.isActive && <Button variant="outline" size="sm" onClick={() => setDialog('access')}>Manage access</Button>}
          {manageable && <Button variant="outline" size="sm" onClick={() => setDialog('edit')}>Edit</Button>}
          {manageable && (
            <Button
              variant="outline"
              size="sm"
              className={member.isActive ? 'text-destructive hover:text-destructive' : ''}
              disabled={toggleActive.isPending}
              onClick={() => toggleActive.mutate(member)}
            >
              {member.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </div>
      </div>

      {/* Period */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              period === p.value ? 'bg-primary text-primary-foreground border-primary' : 'border-white/10 bg-white/5 text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Hours" value={fh(total)} />
        <Tile label="Billable" value={fh(billable)} sub={total > 0 ? `${Math.round((billable / total) * 100)}% of hours` : undefined} />
        <Tile label="Clients" value={String(byClient.length)} />
        <Tile label="Entries" value={String(recent?.total ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Billable vs non-billable</h2>
          {summary?.chart ? <HoursChart buckets={summary.chart.buckets} granularity={summary.chart.granularity} /> : <p className="text-sm text-muted-foreground">Loading…</p>}
        </div>
        <div className="rounded-2xl glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Hours by client</h2>
          {byClient.length === 0 && <p className="text-sm text-muted-foreground">No time in this period.</p>}
          <div className="space-y-3">
            {byClient.map((c) => (
              <div key={c.clientId}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate">{c.name}</span>
                  <span className="num text-muted-foreground">{fh(c.hours)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${maxClient ? (c.hours / maxClient) * 100 : 0}%`, background: clientColor(c.clientId) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${isTeamMember ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-2xl glass-card p-5`}>
          <h2 className="text-sm font-semibold mb-3">Recent entries</h2>
          {recent && recent.entries.length === 0 && <p className="text-sm text-muted-foreground">No entries in this period.</p>}
          <ul className="divide-y divide-white/5">
            {recent?.entries.map((e) => (
              <li key={e.entryId} className="flex items-start justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm truncate">{e.description || <span className="text-muted-foreground">No description</span>}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    {e.clientId != null && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: clientColor(e.clientId) }} />}
                    <span className="truncate">{[e.clientName, e.projectName].filter(Boolean).join(' · ') || 'No project'}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="num text-sm">{e.isRunning ? 'Running' : fh(Math.round(hoursOf(e.roundedDurationSeconds) * 100) / 100)}</p>
                  <p className="text-xs text-muted-foreground">{dayjs(e.startedAt).format('ddd D MMM, HH:mm')}</p>
                </div>
              </li>
            ))}
          </ul>
          {recent && recent.total > recent.entries.length && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing the latest {recent.entries.length} of <span className="num">{recent.total}</span>. See all in <Link href="/dashboard/reports" className="text-primary hover:underline">Reports</Link>.
            </p>
          )}
        </div>

        {isTeamMember && (
          <div className="rounded-2xl glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Access</h2>
              <span className="text-xs text-muted-foreground">{member.fullVisibility ? 'Sees all clients' : 'Sees only this access'}</span>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Projects</p>
            {assigned.length === 0 && <p className="text-sm text-muted-foreground mb-3">None assigned.</p>}
            <ul className="space-y-1 mb-4">
              {assigned.map((p) => (
                <li key={p!.projectId} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: clientColor(p!.clientId) }} />
                  <span className="truncate">{p!.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{clientName.get(p!.clientId)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Client visibility</p>
            {visibleClients.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
            <ul className="space-y-1">
              {visibleClients.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: clientColor(c.id) }} />
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {dialog === 'access' && <AccessDialog member={member} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditMemberDialog member={member} onClose={() => setDialog(null)} />}
    </div>
  )
}
