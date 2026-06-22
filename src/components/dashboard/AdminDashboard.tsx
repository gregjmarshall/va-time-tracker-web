'use client'

import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
dayjs.extend(isoWeek)
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { reports, timeEntries } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

function formatHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function AdminDashboard() {
  const { token, user } = useAuthStore()

  const weekStart = dayjs().startOf('isoWeek').toISOString()
  const weekEnd = dayjs().endOf('isoWeek').toISOString()
  const today = dayjs().format('YYYY-MM-DD')
  const greeting = (() => {
    const h = dayjs().hour()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  })()

  const { data: weekSummary } = useQuery({
    queryKey: ['reports-summary-week', token],
    queryFn: () => reports.summary(token!, { from: weekStart, to: weekEnd }),
    enabled: !!token,
  })

  const { data: retainerReport } = useQuery({
    queryKey: ['reports-retainer', token],
    queryFn: () => reports.retainer(token!),
    enabled: !!token,
  })

  const { data: todayData } = useQuery({
    queryKey: ['time-entries-today', token, today],
    queryFn: () => timeEntries.list(token!, { from: `${today}T00:00:00Z`, to: `${today}T23:59:59Z`, size: 100 }),
    enabled: !!token,
  })

  // Build day-by-day hours for this week
  const dayTotals = (() => {
    const map: Record<string, number> = {}
    ;(weekSummary?.rows ?? []).forEach((row) => {
      // rows are aggregated per project, not per day — use detailed entries instead
    })
    return map
  })()

  const totalWeekHours = (weekSummary?.rows ?? []).reduce((sum, r) => sum + r.totalHours, 0)
  const todayEntries = (todayData?.entries ?? []).filter((e) => !e.isRunning)
  const todayHours = todayEntries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0) / 3600

  const firstName = user?.firstName || user?.email.split('@')[0]

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{greeting}, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{dayjs().format('dddd, D MMMM YYYY')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Today</p>
          <p className="text-3xl font-semibold font-mono">{formatHours(todayHours)}</p>
          <p className="text-xs text-muted-foreground mt-1">{todayEntries.length} entr{todayEntries.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">This week</p>
          <p className="text-3xl font-semibold font-mono">{formatHours(totalWeekHours)}</p>
          <p className="text-xs text-muted-foreground mt-1">across {new Set((weekSummary?.rows ?? []).map((r) => r.clientId)).size} clients</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Retainers over</p>
          <p className="text-3xl font-semibold font-mono text-destructive">
            {(retainerReport?.rows ?? []).filter((r) => r.isOver).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">of {(retainerReport?.rows ?? []).filter((r) => r.retainerHours).length} retainer clients</p>
        </div>
      </div>

      {/* Week breakdown by client/project */}
      {(weekSummary?.rows ?? []).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3">This week by project</h2>
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {weekSummary!.rows.map((row, i) => {
              const pct = totalWeekHours > 0 ? (row.totalHours / totalWeekHours) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.projectName}</p>
                    <p className="text-xs text-muted-foreground">{row.clientName}</p>
                  </div>
                  <div className="w-32 hidden sm:block">
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  <span className="text-sm font-mono font-medium tabular-nums w-14 text-right">{formatHours(row.totalHours)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Retainer status */}
      {(retainerReport?.rows ?? []).filter((r) => r.retainerHours).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Client retainers</h2>
          <div className="space-y-3">
            {retainerReport!.rows.filter((r) => r.retainerHours).map((row) => {
              const used = row.percentUsed !== undefined ? Math.round(row.percentUsed) : 0
              return (
                <div key={row.clientId} className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-medium">{row.clientName}</p>
                      <Badge variant={row.isOver ? 'destructive' : used > 80 ? 'outline' : 'secondary'} className="text-xs">
                        {row.isOver ? 'Over' : used > 80 ? 'Near limit' : 'On track'}
                      </Badge>
                    </div>
                    <Progress value={Math.min(used, 100)}
                      className={row.isOver ? '[&>div]:bg-destructive' : used > 80 ? '[&>div]:bg-amber-500' : ''} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono font-semibold">{formatHours(row.actualHours)}</p>
                    <p className="text-xs text-muted-foreground">of {formatHours(row.retainerHours!)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(weekSummary?.rows ?? []).length === 0 && (retainerReport?.rows ?? []).length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <p className="mb-2">No activity yet this week.</p>
          <a href="/dashboard/clients" className="text-primary hover:underline">Set up clients and projects →</a>
        </div>
      )}
    </div>
  )
}
