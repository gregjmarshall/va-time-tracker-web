'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { ManualEntryDialog } from '@/components/entries/ManualEntryDialog'
import { MyCapacityCard, MyCoverCard } from '@/components/dashboard/MyCoverAndCapacity'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { timeEntries, projects as projectsApi, clients as clientsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ProjectResponse, TimeEntryResponse } from '@/lib/types'
import { invalidateTimeData } from '@/lib/queries'
import { ACCENT, clientColor } from '@/lib/colors'

dayjs.extend(isoWeek)

function formatDuration(s?: number) {
  if (!s) return '0m'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatTime(iso: string) {
  return dayjs(iso).format('h:mm A')
}

// ── Weekly Bar Chart ──────────────────────────────────────────────────────────

function WeeklyChart({ dailyHours, liveElapsedHours }: { dailyHours: number[], liveElapsedHours: number }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayIdx = dayjs().isoWeekday() - 1
  const liveDailyHours = dailyHours.map((h, i) => i === todayIdx ? h + liveElapsedHours : h)
  const max = Math.max(...liveDailyHours, 0.5)
  const weekTotal = liveDailyHours.reduce((a, b) => a + b, 0)

  return (
    <div>
      <h2 className="text-sm font-semibold mb-4">Weekly overview</h2>

      {/* Bar area */}
      <div className="flex items-end gap-2" style={{ height: 96 }}>
        {liveDailyHours.map((h, i) => {
          const pct = Math.max((h / max) * 100, h > 0 ? 6 : 3)
          const isToday = i === todayIdx
          const label = h <= 0 ? null : h >= 1
            ? (h % 1 < 0.1 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`)
            : `${Math.round(h * 60)}m`
          return (
            <div key={i} className="flex-1 h-full relative flex items-end">
              {label && (
                <span
                  className="num absolute left-0 right-0 text-center text-[9px] text-muted-foreground/70 leading-none"
                  style={{ bottom: `calc(${pct}% + 4px)` }}
                >
                  {label}
                </span>
              )}
              <div
                className="w-full rounded-md transition-all duration-500"
                style={{
                  height: `${pct}%`,
                  background: isToday ? ACCENT.teal : h > 0 ? `${ACCENT.teal}66` : 'rgba(255,255,255,0.05)',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-2 mt-2 mb-5">
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex justify-center">
            <span className={`text-[11px] font-medium ${i === todayIdx ? 'text-foreground' : 'text-muted-foreground/50'}`}>
              {d}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <span className="text-xs font-medium text-muted-foreground">This week</span>
        <span className="num text-sm font-semibold">{formatDuration(weekTotal * 3600)}</span>
      </div>
    </div>
  )
}

// ── Entry Row ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry, project, clientName, onEdit, onDelete,
}: {
  entry: TimeEntryResponse; project?: ProjectResponse; clientName?: string
  onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-6 py-4 border-b border-white/5 last:border-0 group transition-colors">
      <div className="w-24 sm:w-40 flex-shrink-0">
        <p className="num text-[13px] font-semibold text-foreground">
          {formatTime(entry.startedAt)}{entry.endedAt ? ` – ${formatTime(entry.endedAt)}` : ''}
        </p>
        <p className="num text-[12px] text-muted-foreground/60 mt-1">{formatDuration(entry.durationSeconds)}</p>
      </div>

      <div className="flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project ? clientColor(project.clientId) : 'rgba(255,255,255,0.2)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-foreground truncate">{entry.description || '—'}</p>
        {(clientName || project || entry.isCover) && (
          <p className="text-[12px] font-medium text-muted-foreground/50 mt-1 truncate">
            {[clientName, project?.name].filter(Boolean).join(' · ')}
            {entry.isCover && <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: ACCENT.amber }}>Holiday cover</span>}
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Entry actions" className="p-1.5 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 transition-all text-muted-foreground/50 hover:text-foreground hover:bg-white/5 flex-shrink-0 cursor-pointer">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={onEdit} className="cursor-pointer text-xs py-2">Edit entry</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete} className="cursor-pointer text-xs py-2">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function WorkerDashboard() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [manualOpen, setManualOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntryResponse | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<TimeEntryResponse | null>(null)

  const today = dayjs().format('YYYY-MM-DD')
  const weekStart = dayjs().startOf('isoWeek').toISOString()
  const weekEnd = dayjs().endOf('isoWeek').toISOString()
  const greeting = dayjs().hour() < 12 ? 'Good morning' : dayjs().hour() < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.firstName || user?.email.split('@')[0] || ''

  const { data: activeEntry = null } = useQuery({
    queryKey: ['active-timer', token],
    queryFn: async () => { try { return await timeEntries.active(token!) } catch { return null } },
    enabled: !!token,
    refetchInterval: 30_000,
  })

  // Ticks once a second while a timer runs; elapsed is derived from it.
  const [now, setNow] = useState(() => Date.now())
  const isRunning = !!activeEntry?.isRunning
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isRunning])
  const liveElapsed = isRunning && activeEntry
    ? Math.max(0, Math.floor((now - new Date(activeEntry.startedAt).getTime()) / 1000))
    : 0

  const { data: projectList = [] } = useQuery({
    queryKey: ['projects', token],
    queryFn: () => projectsApi.list(token!),
    enabled: !!token,
  })

  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token,
  })

  const { data: todayData } = useQuery({
    queryKey: ['time-entries', token, today],
    queryFn: () => timeEntries.list(token!, { from: `${today}T00:00:00Z`, to: `${today}T23:59:59Z`, size: 100 }),
    enabled: !!token,
    refetchInterval: 10_000,
  })

  const { data: recentData } = useQuery({
    queryKey: ['time-entries-recent', token],
    queryFn: () => timeEntries.list(token!, { size: 20 }),
    enabled: !!token,
    refetchInterval: 10_000,
  })

  const { data: weekData } = useQuery({
    queryKey: ['time-entries-week', token, weekStart],
    queryFn: () => timeEntries.list(token!, { from: weekStart, to: weekEnd, size: 500 }),
    enabled: !!token,
  })

  const deleteMutation = useMutation({
    mutationFn: (entryId: number) => timeEntries.delete(token!, entryId),
    onSuccess: () => {
      invalidateTimeData(queryClient)
      setDeleteEntry(null)
      toast.success('Entry deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Derived
  const clientMap = new Map(clientList.map((c) => [c.clientId, c]))
  const projectMap = new Map(projectList.map((p) => [p.projectId, p]))

  const completedEntries = (todayData?.entries ?? []).filter((e) => !e.isRunning)
  const todaySeconds = completedEntries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0)

  const dailyHours = Array(7).fill(0)
  const weekStartDay = dayjs().startOf('isoWeek')
  ;(weekData?.entries ?? []).filter((e) => !e.isRunning && e.endedAt).forEach((e) => {
    const start = dayjs(e.startedAt)
    const end = dayjs(e.endedAt!)
    for (let d = 0; d < 7; d++) {
      const dayStart = weekStartDay.add(d, 'day')
      const dayEnd = dayStart.add(1, 'day')
      const overlapStart = start.isAfter(dayStart) ? start : dayStart
      const overlapEnd = end.isBefore(dayEnd) ? end : dayEnd
      if (overlapEnd.isAfter(overlapStart)) {
        dailyHours[d] += overlapEnd.diff(overlapStart, 'second') / 3600
      }
    }
  })

  const recentClients = clientList
    .map((client) => {
      const entries = completedEntries.filter((e) => {
        const p = e.projectId ? projectMap.get(e.projectId) : undefined
        return p?.clientId === client.clientId
      })
      if (entries.length === 0) return null
      const secs = entries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0)
      const lastPid = entries[entries.length - 1].projectId
      const lastProject = lastPid ? projectMap.get(lastPid) : undefined
      return { client, secs, lastProject }
    })
    .filter(Boolean) as { client: typeof clientList[0]; secs: number; lastProject?: ProjectResponse }[]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 pt-8 pb-6">
        <div>
          <h1 className="text-3xl font-normal text-foreground">{greeting}, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 sm:px-6 lg:px-10 pb-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

            {/* ── Left column ── */}
            <div className="xl:col-span-8 space-y-6 min-w-0">

              {/* Recent entries */}
              <div className="rounded-lg glass-card overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/5">
                  <h2 className="text-sm font-semibold">Recent entries</h2>
                  <button
                    onClick={() => setManualOpen(true)}
                    className="text-sm font-medium text-foreground/70 hover:text-foreground border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 transition-colors whitespace-nowrap"
                  >
                    + Manual entry
                  </button>
                </div>
                {(() => {
                  const recentEntries = (recentData?.entries ?? []).filter((e) => !e.isRunning)
                  return recentEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-16 px-6">No entries yet</p>
                  ) : (
                    <div className="overflow-y-auto" style={{ maxHeight: '26rem' }}>
                      <div className="px-4 sm:px-6 pb-2">
                        {recentEntries.map((entry) => {
                          const proj = entry.projectId ? projectMap.get(entry.projectId) : undefined
                          const client = proj ? clientMap.get(proj.clientId) : undefined
                          return (
                            <EntryRow
                              key={entry.entryId}
                              entry={entry}
                              project={proj}
                              clientName={client?.name}
                              onEdit={() => setEditEntry(entry)}
                              onDelete={() => setDeleteEntry(entry)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>

            </div>

            {/* ── Right sidebar ── */}
            <div className="xl:col-span-4 space-y-6 min-w-0">

              <MyCoverCard />

              {/* Today's summary */}
              <div className="rounded-lg glass-card p-6">
                <h2 className="text-sm font-semibold mb-6">Today&apos;s summary</h2>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative w-11 h-11 flex-shrink-0">
                        {activeEntry?.isRunning && (
                          <svg className="absolute pointer-events-none"
                            style={{ inset: -6, width: 'calc(100% + 12px)', height: 'calc(100% + 12px)' }}
                            viewBox="0 0 52 52">
                            <circle cx="26" cy="26" r="23" fill="none"
                              stroke={ACCENT.teal} strokeWidth="2" strokeDasharray="10 5" strokeLinecap="round"
                              style={{
                                transformOrigin: '26px 26px',
                                transform: 'rotate(-90deg)',
                                animation: 'timer-march 1.2s linear infinite, timer-glow 2s ease-in-out infinite',
                              }}
                            />
                          </svg>
                        )}
                        <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${ACCENT.sky}26`, color: ACCENT.sky }}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Time tracked</span>
                    </div>
                    <span className="num text-xl font-semibold">{formatDuration(todaySeconds + liveElapsed)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${ACCENT.teal}26`, color: ACCENT.teal }}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Entries logged</span>
                    </div>
                    <span className="num text-xl font-semibold">{completedEntries.length}</span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5">
                  <Link href="/dashboard/reports" className="text-sm text-primary hover:text-primary/80 font-semibold flex items-center justify-center gap-2 group transition-all">
                    View report
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Weekly chart */}
              <div className="rounded-lg glass-card p-6">
                <WeeklyChart dailyHours={dailyHours} liveElapsedHours={liveElapsed / 3600} />
              </div>

              <MyCapacityCard />

            </div>
          </div>

          {/* Recent clients */}
          {recentClients.length > 0 && (
            <div className="rounded-lg glass-card overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold">Recent clients</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 p-4 sm:p-6">
                {recentClients.slice(0, 4).map(({ client, secs, lastProject }) => (
                  <div key={client.clientId} className="flex items-center gap-4 p-4 rounded-lg border border-white/5 bg-white/[0.02]">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center text-base font-semibold flex-shrink-0" style={{ background: `${clientColor(client.clientId)}26`, color: clientColor(client.clientId) }}>
                      {client.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold truncate leading-tight">{client.name}</p>
                      <p className="text-[12px] text-muted-foreground/60 truncate mt-1">{lastProject?.name}</p>
                      <p className="text-[13px] text-muted-foreground/70 mt-1"><span className="num">{formatDuration(secs)}</span> today</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-white/5 flex justify-end">
                <Link href="/dashboard/clients" className="text-[13px] text-primary hover:text-foreground font-semibold flex items-center gap-2 transition-all">
                  View all clients
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>

      <ManualEntryDialog
        // Remount per entry so the form starts from that entry's values
        key={editEntry ? `edit-${editEntry.entryId}` : manualOpen ? 'new' : 'closed'}
        open={manualOpen || !!editEntry}
        onClose={() => { setManualOpen(false); setEditEntry(null) }}
        projects={projectList}
        clients={clientList}
        editEntry={editEntry}
      />

      <Dialog open={!!deleteEntry} onOpenChange={(v) => { if (!v) setDeleteEntry(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{deleteEntry?.description || 'Untitled entry'}</span>
            {deleteEntry && <> · {formatDuration(deleteEntry.durationSeconds)}</>}. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.entryId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
