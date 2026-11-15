'use client'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { AuditEvent } from '@/lib/types'

dayjs.extend(relativeTime)

/** Audit trail: what changed, who did it and when, newest first. */
export function HistoryList({ events, isLoading, empty = 'No changes recorded yet.' }: {
  events?: AuditEvent[]
  isLoading?: boolean
  empty?: string
}) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!events || events.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ol className="relative border-l border-white/10 ml-1.5 space-y-4">
      {events.map((e) => (
        <li key={e.eventId} className="pl-4">
          <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary/70 ring-2 ring-background" />
          <p className="text-sm">{e.summary}</p>
          <p className="text-xs text-muted-foreground mt-0.5" title={dayjs(e.createdAt).format('D MMM YYYY, HH:mm')}>
            {e.actorName} · {dayjs(e.createdAt).fromNow()}
          </p>
        </li>
      ))}
    </ol>
  )
}
