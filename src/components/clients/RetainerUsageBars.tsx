'use client'

import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { retainers } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const fmt = (h: number) => `${Math.round(Number(h) * 10) / 10}h`

/**
 * Last [months] months of one retainer (client-wide when projectId is null): hours used against the
 * allowance, teal when under, coral for the hours over. The current month is live, so marked "so far".
 */
export function RetainerUsageBars({ clientId, projectId, months = 12 }: {
  clientId: number
  projectId: number | null
  months?: number
}) {
  const { token } = useAuthStore()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['retainers', 'history', token, clientId, projectId, months],
    queryFn: () => retainers.history(token!, clientId, projectId, months),
    enabled: !!token,
  })

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading…</p>
  if (isError) return <p className="text-xs text-muted-foreground">Couldn&apos;t load usage.</p>
  const rows = [...(data?.months ?? [])].reverse() // newest first
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No retainer months yet.</p>

  const scale = Math.max(...rows.map((r) => Math.max(Number(r.allowanceHours), Number(r.actualHours))), 1)
  const pct = (h: number) => `${(Number(h) / scale) * 100}%`

  return (
    <ul className="space-y-1.5" aria-label="Hours used against allowance by month">
      {rows.map((r) => {
        const allowance = Number(r.allowanceHours)
        const actual = Number(r.actualHours)
        const under = Math.min(actual, allowance)
        const over = Math.max(actual - allowance, 0)
        return (
          <li key={r.month} className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {dayjs(`${r.month}-01`).format('MMM YY')}
              {r.live && <span className="block text-[10px] leading-none">so far</span>}
            </span>
            <div className="relative h-2.5 rounded-[2px] bg-white/5" title={`${fmt(actual)} of ${fmt(allowance)}`}>
              <div className="absolute inset-y-0 left-0 rounded-l-full bg-teal" style={{ width: pct(under) }} />
              {over > 0 && (
                <div className="absolute inset-y-0 rounded-r-full bg-coral" style={{ left: pct(allowance), width: pct(over) }} />
              )}
              {/* allowance marker */}
              <div className="absolute -inset-y-0.5 w-px bg-foreground/50" style={{ left: pct(allowance) }} />
            </div>
            <span className={`text-right tabular-nums ${r.isOver ? 'text-coral' : ''}`}>
              {fmt(actual)} / {fmt(allowance)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
