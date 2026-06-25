'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { clientTeamAccess } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ClientActivityProject, ClientActivityRunningEntry } from '@/lib/types'

function formatDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return <span className="tabular-nums">{formatDuration(elapsed)}</span>
}

function RunningEntry({ entry }: { entry: ClientActivityRunningEntry }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-green-500/5 border border-green-500/20">
      <span className="relative flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-400 block" />
        <span className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-75" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{entry.description || '—'}</p>
        <p className="text-xs text-muted-foreground">{entry.userName}</p>
      </div>
      <span className="text-xs font-bold text-green-400 flex-shrink-0">
        <LiveTimer startedAt={entry.startedAt} />
      </span>
    </div>
  )
}

function ProjectCard({ project }: { project: ClientActivityProject }) {
  const totalSeconds = project.recentEntries.reduce((s, e) => s + (e.durationSeconds ?? 0), 0)
  const budgetPct = project.budgetHours ? Math.min((totalSeconds / 3600 / project.budgetHours) * 100, 100) : null

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-foreground">{project.projectName}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {project.runningEntries.length > 0 && (
              <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                {project.runningEntries.length} live
              </span>
            )}
            {project.budgetHours && (
              <span className="text-xs text-muted-foreground">
                {(totalSeconds / 3600).toFixed(1)}h / {project.budgetHours}h
              </span>
            )}
          </div>
        </div>
        {budgetPct !== null && (
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetPct >= 100 ? 'bg-destructive' : budgetPct > 80 ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        {project.runningEntries.map((e) => (
          <RunningEntry key={e.entryId} entry={e} />
        ))}

        {project.recentEntries.length === 0 && project.runningEntries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No recent activity</p>
        )}

        {project.recentEntries.slice(0, 8).map((e) => (
          <div key={e.entryId} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/3 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{e.description || '—'}</p>
              <p className="text-xs text-muted-foreground">{e.userName} · {dayjs(e.startedAt).format('D MMM, h:mm A')}</p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">{formatDuration(e.durationSeconds)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ClientActivityPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const router = useRouter()
  const { token, user } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-activity', token, clientId],
    queryFn: () => clientTeamAccess.activity(token!, Number(clientId)),
    enabled: !!token && !!clientId,
    refetchInterval: 10_000,
  })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground text-sm">You don&apos;t have access to this client&apos;s activity.</p>
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">Go back</button>
      </div>
    )
  }

  const activeProjects = data?.projects.filter(p => p.runningEntries.length > 0 || p.recentEntries.length > 0) ?? []
  const emptyProjects = data?.projects.filter(p => p.runningEntries.length === 0 && p.recentEntries.length === 0) ?? []
  const liveCount = data?.projects.reduce((s, p) => s + p.runningEntries.length, 0) ?? 0

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isLoading ? 'Loading…' : data?.clientName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {liveCount > 0
              ? <span className="text-green-400 font-medium">{liveCount} team member{liveCount !== 1 ? 's' : ''} working now</span>
              : 'No active timers'}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading activity…</div>
      )}

      {!isLoading && data && (
        <>
          {data.projects.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">No projects for this client yet.</div>
          )}

          {/* Active / recent projects first */}
          {activeProjects.length > 0 && (
            <div className="space-y-4 mb-6">
              {activeProjects.map(p => <ProjectCard key={p.projectId} project={p} />)}
            </div>
          )}

          {/* Projects with no activity */}
          {emptyProjects.length > 0 && (
            <>
              {activeProjects.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">No recent activity</p>
              )}
              <div className="space-y-3">
                {emptyProjects.map(p => (
                  <div key={p.projectId} className="rounded-xl border border-border/50 bg-card/50 px-5 py-4">
                    <p className="text-sm font-medium text-muted-foreground">{p.projectName}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
