'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { me } from '@/lib/api'
import type { AuditEvent } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

dayjs.extend(relativeTime)

const SEEN_KEY = (userId: number) => `pip-access-updates-seen-${userId}`
const MAX_AGE_DAYS = 14

function readSeen(userId: number) {
  try { return Number(localStorage.getItem(SEEN_KEY(userId)) ?? 0) } catch { return 0 }
}
function writeSeen(userId: number, eventId: number) {
  try { localStorage.setItem(SEEN_KEY(userId), String(eventId)) } catch { /* private mode */ }
}

/** "Assigned to Inbox; Can now see Acme" → "added you to Inbox; gave you access to Acme" */
function phrase(summary: string) {
  return summary
    .replace(/Assigned to /g, 'added you to ')
    .replace(/Unassigned from /g, 'removed you from ')
    .replace(/Can now see /g, 'gave you access to ')
    .replace(/Can no longer see /g, 'removed your access to ')
}

/**
 * Tells someone when a manager changes what they can track to ("Alex added you to Inbox & diary"),
 * and refreshes their projects so the timer's picker has them without a reload.
 */
export function AccessUpdates() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const userId = user?.userId
  // The dashboard only renders once auth has hydrated in the browser, so localStorage is readable here
  const [seen, setSeen] = useState<number | null>(() => (userId ? readSeen(userId) : null))

  const { data: updates = [] } = useQuery({
    queryKey: ['my-updates', token],
    queryFn: () => me.updates(token!),
    enabled: !!token,
    refetchInterval: 60_000,
  })

  const fresh: AuditEvent[] = seen === null ? [] : updates.filter(
    (u) => u.eventId > seen && dayjs(u.createdAt).isAfter(dayjs().subtract(MAX_AGE_DAYS, 'day'))
  )
  const newest = fresh[0]?.eventId

  // New access arrived: pull the fresh project and client lists in
  useEffect(() => {
    if (!newest) return
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
    queryClient.invalidateQueries({ queryKey: ['access-request-mine'] })
    queryClient.invalidateQueries({ queryKey: ['projects-overview'] })
  }, [newest, queryClient])

  if (!userId || fresh.length === 0) return null

  const dismiss = () => { writeSeen(userId, updates[0].eventId); setSeen(updates[0].eventId) }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.06] px-4 sm:px-5 py-3.5 flex items-start gap-3" role="status">
      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" aria-hidden />
      <ul className="flex-1 min-w-0 space-y-1 text-sm">
        {fresh.slice(0, 3).map((u) => (
          <li key={u.eventId}>
            <span className="font-medium">{u.actorName}</span> {phrase(u.summary)}
            <span className="text-muted-foreground"> · {dayjs(u.createdAt).fromNow()}</span>
          </li>
        ))}
        {fresh.length > 3 && <li className="text-muted-foreground">and {fresh.length - 3} more changes</li>}
      </ul>
      <button onClick={dismiss} className="text-sm text-muted-foreground hover:text-foreground flex-shrink-0">Got it</button>
    </div>
  )
}
