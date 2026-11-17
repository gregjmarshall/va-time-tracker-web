'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { calendar, reports } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { retainerBurn, type BurnStatus } from '@/lib/retainerBurn'
import { ACCENT, clientColor } from '@/lib/colors'

function formatHours(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

type Period = 'month' | 'quarter' | 'year'
const PERIODS: { key: Period; label: string; short: string }[] = [
  { key: 'month', label: 'Month to date', short: 'MTD' },
  { key: 'quarter', label: 'Quarter to date', short: 'QTD' },
  { key: 'year', label: 'Year to date', short: 'YTD' },
]

function periodStart(p: Period) {
  const now = dayjs()
  if (p === 'year') return now.startOf('year')
  if (p === 'quarter') return now.startOf('month').subtract(now.month() % 3, 'month')
  return now.startOf('month')
}

const BURN_STYLE: Record<BurnStatus, { dot: string; bar: string; label: string }> = {
  red: { dot: 'bg-destructive', bar: '[&>div]:bg-destructive', label: 'At risk' },
  amber: { dot: 'bg-sun', bar: '[&>div]:bg-sun', label: 'Behind' },
  green: { dot: 'bg-teal', bar: '[&>div]:bg-teal', label: 'On pace' },
  over: { dot: 'bg-sky', bar: '[&>div]:bg-sky', label: 'Over' },
  early: { dot: 'bg-muted-foreground/40', bar: '', label: 'Too early' },
}
const BURN_ORDER: BurnStatus[] = ['red', 'over', 'amber', 'early', 'green']

/** Horizontal bars for the top rows of a ranking, scaled to the largest. */
function TopBars({ title, rows, empty }: { title: string; rows: { key: number; label: string; hours: number; color: string }[]; empty: string }) {
  const max = Math.max(...rows.map((r) => r.hours), 0)
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold mb-4">{title}</h2>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className={`flex items-center gap-2 truncate ${i === 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {r.label}
                </span>
                <span className="num ml-3">{formatHours(r.hours)}</span>
              </div>
              <div className="h-1.5 rounded-[2px] bg-white/5 overflow-hidden">
                <div className="h-full rounded-[2px]" style={{ width: `${max ? (r.hours / max) * 100 : 0}%`, background: i === 0 ? 'var(--primary)' : 'var(--muted-foreground)', opacity: i === 0 ? 1 : 0.45 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminDashboard() {
  const { token, user } = useAuthStore()
  const [period, setPeriod] = useState<Period>('month')
  const from = periodStart(period)

  const greeting = (() => {
    const h = dayjs().hour()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  })()

  const { data: overview, isLoading } = useQuery({
    queryKey: ['reports-overview', token, period, from.format('YYYY-MM-DD')],
    queryFn: () => reports.overview(token!, { from: from.toISOString() }),
    enabled: !!token,
  })

  const { data: retainerReport } = useQuery({
    queryKey: ['reports-retainer', token],
    queryFn: () => reports.retainer(token!),
    enabled: !!token,
  })

  const { data: bankHolidays } = useQuery({
    queryKey: ['bank-holidays', 'england-and-wales'],
    queryFn: () => calendar.bankHolidays('england-and-wales'),
    staleTime: 24 * 60 * 60 * 1000,
    select: (d) => new Set(d.holidays.map((h) => h.date)),
  })

  const retainers = (retainerReport?.rows ?? [])
    .filter((r) => r.retainerHours)
    .map((r) => ({ row: r, burn: retainerBurn(r.retainerHours!, r.actualHours, bankHolidays) }))
    .sort((a, b) => BURN_ORDER.indexOf(a.burn.status) - BURN_ORDER.indexOf(b.burn.status) || (a.burn.pace ?? 1) - (b.burn.pace ?? 1))
  const atRisk = retainers.filter((r) => r.burn.status === 'red').length

  const total = overview?.totalHours ?? 0
  const billablePct = total > 0 ? Math.round(((overview?.billableHours ?? 0) / total) * 100) : 0
  const firstName = user?.firstName || user?.email.split('@')[0]
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase()

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl">{greeting}, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
        <div className="flex rounded-md border border-white/10 bg-white/5 p-0.5" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.key} role="tab" aria-selected={period === p.key} title={p.label} onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${period === p.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.short}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 rounded-lg border border-border bg-card mb-6 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Hours</p>
          <p className="num text-3xl font-medium tracking-tight">{isLoading ? '…' : formatHours(total)}</p>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel} · since {from.format('D MMM')}</p>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Billable</p>
          <p className="num text-3xl font-medium tracking-tight">{isLoading ? '…' : `${billablePct}%`}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatHours(overview?.billableHours ?? 0)} of {formatHours(total)}</p>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Retainers at risk</p>
          <p className={`num text-3xl font-medium tracking-tight ${atRisk ? 'text-coral' : ''}`}>{atRisk}</p>
          <p className="text-xs text-muted-foreground mt-1">of {retainers.length} this month, likely to go unused</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <TopBars title="Top clients" empty={`No time tracked ${periodLabel}.`}
          rows={(overview?.clients ?? []).filter((c) => c.hours > 0).slice(0, 3).map((c) => ({ key: c.clientId, label: c.clientName, hours: c.hours, color: clientColor(c.clientId) }))} />
        <TopBars title="Busiest team members" empty={`No time tracked ${periodLabel}.`}
          rows={(overview?.members ?? []).filter((m) => m.hours > 0).slice(0, 3).map((m, i) => ({ key: m.userId, label: m.name, hours: m.hours, color: [ACCENT.teal, ACCENT.sky, ACCENT.pink][i] }))} />
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold">Retainer burn · {dayjs().format('MMMM')}</h2>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {(['red', 'amber', 'green', 'over'] as BurnStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${BURN_STYLE[s].dot}`} />{BURN_STYLE[s].label}</span>
            ))}
          </div>
        </div>
        {retainers.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
            No retainers this month. <Link href="/dashboard/clients" className="text-primary hover:underline">Set one up →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {retainers.map(({ row, burn }) => {
              const style = BURN_STYLE[burn.status]
              const used = Math.min(100, (row.actualHours / row.retainerHours!) * 100)
              return (
                <div key={`${row.clientId}-${row.projectId ?? 0}`} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} aria-label={style.label} title={style.label} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-medium truncate">
                          {row.clientName}{row.projectName && <span className="text-muted-foreground"> · {row.projectName}</span>}
                        </p>
                        <p className="text-sm num flex-shrink-0">
                          {formatHours(row.actualHours)} <span className="text-muted-foreground">/ {formatHours(row.retainerHours!)}</span>
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 rounded-[2px] bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-[2px] ${style.dot}`} style={{ width: `${used}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {burn.status === 'over'
                          ? `${formatHours(row.actualHours - row.retainerHours!)} over the allowance`
                          : burn.daysLeft === 0
                            ? 'Month finished'
                            : <>
                                Needs {formatHours(Math.round(burn.neededPerDay * 10) / 10)}/day for {burn.daysLeft} working day{burn.daysLeft === 1 ? '' : 's'}
                                {burn.pace !== null && <> · {Math.round(burn.pace * 100)}% of even pace</>}
                              </>}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
