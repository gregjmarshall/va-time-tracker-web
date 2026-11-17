'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDescriptionRequired, useWorkspace } from '@/lib/queries'
import { useAuthStore } from '@/stores/auth'
import type { ClientResponse, ProjectResponse } from '@/lib/types'
import { RequestAccessButton } from './RequestAccess'

const DISMISS_KEY = (userId: number) => `pip-first-day-dismissed-${userId}`

/**
 * First-day guide for team members: what they can track to (or a way to ask), how the timer works,
 * and where the week goes. Shows until they dismiss it, or until they're on projects and have tracked time.
 */
export function FirstDayCard({ projects, clients, hasEntries }: {
  projects: ProjectResponse[]
  clients: ClientResponse[]
  hasEntries: boolean
}) {
  const { user } = useAuthStore()
  const { data: ws } = useWorkspace()
  const descriptionRequired = useDescriptionRequired()
  // The dashboard only renders once auth has hydrated in the browser, so localStorage is readable here
  const [dismissed, setDismissed] = useState(() => {
    if (!user?.userId) return true
    try { return localStorage.getItem(DISMISS_KEY(user.userId)) === '1' } catch { return false }
  })

  const active = projects.filter((p) => p.isActive)
  if (!user?.userId || dismissed || (active.length > 0 && hasEntries)) return null

  const clientName = new Map(clients.map((c) => [c.clientId, c.name]))
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY(user.userId), '1') } catch { /* private mode */ }
    setDismissed(true)
  }

  const step = 'grid grid-cols-[1.75rem_1fr] gap-x-3'
  const num = 'num w-7 h-7 rounded-md bg-secondary text-muted-foreground text-xs flex items-center justify-center'

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6" aria-labelledby="first-day-title">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 id="first-day-title" className="font-display text-2xl" style={{ fontFamily: 'var(--font-serif)' }}>
            Welcome{ws?.name ? ` to ${ws.name}` : ''}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Three things to know before you start.</p>
        </div>
        <button onClick={dismiss} className="text-sm text-muted-foreground hover:text-foreground flex-shrink-0">Hide</button>
      </div>

      <ol className="space-y-5">
        <li className={step}>
          <span className={num}>1</span>
          <div className="min-w-0">
            <p className="font-medium">Your projects</p>
            {active.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground mt-0.5 mb-3">You&apos;re not on any projects yet, so there&apos;s nothing to save time to.</p>
                <RequestAccessButton size="sm" />
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">
                You&apos;re on {active.length} project{active.length === 1 ? '' : 's'}:{' '}
                {active.slice(0, 4).map((p) => `${p.name} (${clientName.get(p.clientId) ?? 'client'})`).join(', ')}
                {active.length > 4 && ` and ${active.length - 4} more`}. <Link href="/dashboard/projects" className="text-primary hover:underline">See them all</Link>
              </p>
            )}
          </div>
        </li>
        <li className={step}>
          <span className={num}>2</span>
          <div>
            <p className="font-medium">Track as you go</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Press <span className="text-foreground">▶</span> in the bar at the top to start the clock. You can pick the project
              {descriptionRequired ? ' and write what you did' : ''} when you stop. Forgot to start it? Use <span className="text-foreground">+ Manual entry</span>.
            </p>
          </div>
        </li>
        <li className={step}>
          <span className={num}>3</span>
          <div>
            <p className="font-medium">Check your week</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your <Link href="/dashboard/timesheet" className="text-primary hover:underline">Timesheet</Link> shows the week at a glance. Fix anything there and submit it at the end of the week.
            </p>
          </div>
        </li>
      </ol>

      <p className="text-xs text-muted-foreground mt-5 pt-4 border-t border-border">
        More in <Link href="/help/first-login" className="text-primary hover:underline">Help: your first day</Link>.
      </p>
    </section>
  )
}
