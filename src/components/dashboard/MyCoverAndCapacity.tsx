'use client'

import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { capacity, holidayCover } from '@/lib/api'
import { ACCENT } from '@/lib/colors'
import { useAuthStore } from '@/stores/auth'

function fh(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

export function coverDates(startDate: string, endDate?: string | null) {
  const start = dayjs(startDate)
  if (!endDate) return `From ${start.format('D MMM')} · no end date`
  const end = dayjs(endDate)
  return start.isSame(end, 'day') ? start.format('D MMM YYYY') : `${start.format('D MMM')} – ${end.format('D MMM YYYY')}`
}

/** The signed-in team member's active and upcoming holiday cover. Renders nothing if there is none. */
export function MyCoverCard() {
  const { token } = useAuthStore()
  const { data: covers = [] } = useQuery({
    queryKey: ['holiday-cover-mine', token],
    queryFn: () => holidayCover.mine(token!),
    enabled: !!token,
  })
  if (covers.length === 0) return null

  return (
    <div className="rounded-lg glass-card p-6 border border-amber-400/20">
      <h2 className="text-sm font-semibold mb-4" style={{ color: ACCENT.amber }}>Holiday cover</h2>
      <div className="space-y-4">
        {covers.map((c) => (
          <div key={c.coverId} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground truncate">{c.clientName}</p>
              <p className="text-[12px] font-medium text-muted-foreground/60 mt-1">{coverDates(c.startDate, c.endDate)}</p>
              {c.note && <p className="text-[12px] text-muted-foreground/50 mt-1 truncate">{c.note}</p>}
            </div>
            <span className={`num text-xs font-medium flex-shrink-0 ${c.status === 'ACTIVE' ? 'text-amber-400' : 'text-muted-foreground/50'}`}>
              {c.status === 'ACTIVE' ? `${fh(c.hoursLogged)} so far` : 'Upcoming'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The signed-in team member's hours this month: allocated, used, remaining, per client. */
export function MyCapacityCard() {
  const { token } = useAuthStore()
  const { data } = useQuery({
    queryKey: ['capacity-mine', token],
    queryFn: () => capacity.get(token!),
    enabled: !!token,
  })
  const row = data?.rows[0]
  if (!row || (row.allocatedHours === 0 && row.usedHours === 0 && row.coverHours === 0)) return null
  // No allocation yet means "nothing planned", not "0h allowed": show the hours, never "over".
  const allocated = row.allocatedHours > 0
  const pct = allocated ? Math.min((row.usedHours / row.allocatedHours) * 100, 100) : 0
  const over = allocated && row.remainingHours < 0

  return (
    <div className="rounded-lg glass-card p-6">
      <h2 className="text-sm font-semibold mb-4">{dayjs().format('MMMM')} hours</h2>
      <div className="flex items-baseline justify-between mb-3">
        <span className="num text-2xl font-semibold">{fh(row.usedHours)}</span>
        {allocated && <span className="text-sm font-medium text-muted-foreground/60">of {fh(row.allocatedHours)}</span>}
      </div>
      {allocated && (
        <div className="h-2 rounded-[2px] bg-white/5 overflow-hidden">
          <div className={`h-full rounded-[2px] ${over ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${over ? 100 : pct}%` }} />
        </div>
      )}
      <p className={`text-[12px] font-medium mt-2 ${over ? 'text-destructive' : 'text-muted-foreground/60'}`}>
        {!allocated ? 'tracked this month · no hours planned for you yet' : over ? `${fh(-row.remainingHours)} over` : `${fh(row.remainingHours)} remaining`}
        {row.coverHours > 0 && <span className="text-sun"> · {fh(row.coverHours)} holiday cover</span>}
      </p>
      <div className="mt-6 space-y-3">
        {row.clients.map((c) => (
          <div key={c.clientId ?? 'none'} className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-muted-foreground/80 truncate">{c.clientName}</span>
            <span className="font-mono tabular-nums text-muted-foreground/70 flex-shrink-0">
              {c.coverHours > 0 && <span className="text-sun mr-2">+{fh(c.coverHours)} cover</span>}
              {fh(c.usedHours)}{c.allocatedHours > 0 ? ` / ${fh(c.allocatedHours)}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
