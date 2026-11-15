'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import { ACCENT } from '@/lib/colors'
import type { ChartBucket, ChartGranularity } from '@/lib/types'

export const BILLABLE_COLOR = ACCENT.teal
export const NON_BILLABLE_COLOR = ACCENT.sky

function fh(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

export function bucketLabel(start: string, g: ChartGranularity, long = false) {
  const d = dayjs(start)
  if (g === 'month') return d.format(long ? 'MMMM YYYY' : 'MMM')
  if (g === 'week') return long ? `Week of ${d.format('D MMM YYYY')}` : d.format('D MMM')
  return d.format(long ? 'ddd D MMM YYYY' : 'D')
}

/** Nice round axis maximum and step for [max] hours. */
function axis(max: number) {
  if (max <= 0) return { top: 4, step: 1 }
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag
  return { top: Math.ceil(max / step) * step, step }
}

/** Stacked billable / non-billable bars, one per day, week or month. */
export function HoursChart({ buckets, granularity }: { buckets: ChartBucket[]; granularity: ChartGranularity }) {
  const [hover, setHover] = useState<number | null>(null)
  const totals = buckets.map(b => b.billableHours + b.nonBillableHours)
  const { top, step } = axis(Math.max(0, ...totals))
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  // Thin out x labels so they never collide
  const every = Math.max(1, Math.ceil(buckets.length / 16))
  const h = buckets[hover ?? -1]

  return (
    <div className="relative">
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: BILLABLE_COLOR }} />Billable</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: NON_BILLABLE_COLOR }} />Non-billable</span>
        <span className="ml-auto">{granularity === 'day' ? 'Per day' : granularity === 'week' ? 'Per week' : 'Per month'}</span>
      </div>
      <div className="flex gap-2">
        {/* y axis */}
        <div className="relative w-8 h-44 shrink-0">
          {ticks.map(t => (
            <span key={t} className="num absolute right-0 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: `${100 - (t / top) * 100}%` }}>{t}h</span>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-44">
            {ticks.map(t => (
              <div key={t} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${100 - (t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {buckets.map((b, i) => {
                const total = totals[i]
                return (
                  <div
                    key={b.start}
                    className="relative flex-1 h-full flex flex-col justify-end cursor-default"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {hover === i && <div className="absolute inset-0 rounded bg-white/5" />}
                    <div className="relative mx-auto w-full max-w-8 flex flex-col justify-end rounded-t overflow-hidden" style={{ height: `${(total / top) * 100}%` }}>
                      <div style={{ height: total ? `${(b.nonBillableHours / total) * 100}%` : 0, background: NON_BILLABLE_COLOR }} />
                      <div style={{ height: total ? `${(b.billableHours / total) * 100}%` : 0, background: BILLABLE_COLOR }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-[2px] mt-1.5">
            {buckets.map((b, i) => (
              <span key={b.start} className="num flex-1 text-center text-[10px] text-muted-foreground overflow-visible whitespace-nowrap">
                {i % every === 0 ? bucketLabel(b.start, granularity) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      {h && (
        <div className="pointer-events-none absolute top-6 right-0 rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-md">
          <p className="font-semibold text-foreground mb-1">{bucketLabel(h.start, granularity, true)}</p>
          <p className="flex justify-between gap-4"><span style={{ color: BILLABLE_COLOR }}>Billable</span><span className="num">{fh(h.billableHours)}</span></p>
          <p className="flex justify-between gap-4"><span style={{ color: NON_BILLABLE_COLOR }}>Non-billable</span><span className="num">{fh(h.nonBillableHours)}</span></p>
          <p className="flex justify-between gap-4 border-t border-white/10 mt-1 pt-1"><span className="text-muted-foreground">Total</span><span className="num">{fh(h.billableHours + h.nonBillableHours)}</span></p>
        </div>
      )}
    </div>
  )
}
