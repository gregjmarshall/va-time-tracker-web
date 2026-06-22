'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ManualEntryDialog } from '@/components/entries/ManualEntryDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { timeEntries, projects as projectsApi, clients as clientsApi, suggestions } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ProjectResponse, TimeEntryResponse } from '@/lib/types'

dayjs.extend(isoWeek)

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}

function formatDuration(s?: number) {
  if (!s) return '0m'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatTime(iso: string) {
  return dayjs(iso).format('h:mm A')
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500',
]

const DOT_COLORS = [
  '#6366f1', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4',
]

// ── Weekly Bar Chart ──────────────────────────────────────────────────────────

function WeeklyChart({ dailyHours }: { dailyHours: number[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const todayIdx = dayjs().isoWeekday() - 1
  const max = Math.max(...dailyHours, 4) // At least 4h for scale
  const weekTotal = dailyHours.reduce((a, b) => a + b, 0)

  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">Weekly Overview</p>
      <div className="flex items-end gap-2.5 mb-6" style={{ height: 100 }}>
        {dailyHours.map((h, i) => {
          const pct = (h / max) * 100
          const isToday = i === todayIdx
          return (
    <div className="flex-1 flex flex-col items-center gap-3" style={{ height: 140 }}>
      <div className="w-full flex items-end flex-1">
        <div
          className="w-full rounded-lg transition-all duration-500"
          style={{
            height: `${Math.max(pct, 5)}%`,
            background: isToday
              ? 'linear-gradient(180deg, #664ec2 0%, #7c5cf6 100%)'
              : h > 0
              ? 'rgba(102, 78, 194, 0.4)'
              : 'rgba(102, 78, 194, 0.1)',
            boxShadow: isToday ? '0 4px 12px rgba(124, 92, 246, 0.4)' : 'none',
          }}
        />
      </div>
      <span className={`text-[11px] font-bold ${isToday ? 'text-white' : 'text-muted-foreground/50'}`}>
        {days[i]}
      </span>
    </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between pt-5 border-t border-border/50">
        <span className="text-xs font-medium text-muted-foreground">This Week</span>
        <span className="text-sm font-bold">{formatDuration(weekTotal * 3600)}</span>
      </div>
    </div>
  )
}

// ── Entry Row ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry, project, clientName, colorIdx, onEdit, onDelete,
}: {
  entry: TimeEntryResponse; project?: ProjectResponse; clientName?: string
  colorIdx: number; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-8 py-6 border-b border-white/5 last:border-0 group transition-colors">
      <div className="w-40 flex-shrink-0">
        <p className="text-[14px] font-bold text-white tracking-tight">
          {formatTime(entry.startedAt)}{entry.endedAt ? ` – ${formatTime(entry.endedAt)}` : ''}
        </p>
        <p className="text-[12px] font-medium text-muted-foreground/60 mt-1">{formatDuration(entry.durationSeconds)}</p>
      </div>

      <div className="flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: DOT_COLORS[colorIdx % DOT_COLORS.length] }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-white truncate group-hover:text-primary transition-colors">{entry.description || '—'}</p>
        {(clientName || project) && (
          <p className="text-[12px] font-medium text-muted-foreground/50 mt-1 truncate">
            {[clientName, project?.name].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all text-muted-foreground/30 hover:text-white hover:bg-white/5 flex-shrink-0 cursor-pointer">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32 bg-[#121432]/95 backdrop-blur-2xl border-white/10 shadow-2xl">
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer font-bold text-xs py-2.5">Edit Entry</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete} className="cursor-pointer font-bold text-xs py-2.5">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function WorkerDashboard() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const [manualOpen, setManualOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntryResponse | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [showDescInput, setShowDescInput] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [suggestionList, setSuggestionList] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const today = dayjs().format('YYYY-MM-DD')
  const weekStart = dayjs().startOf('isoWeek').toISOString()
  const weekEnd = dayjs().endOf('isoWeek').toISOString()
  const greeting = dayjs().hour() < 12 ? 'Good morning' : dayjs().hour() < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.firstName || user?.email.split('@')[0] || ''

  const { data: activeEntry = null, refetch: refetchActive } = useQuery({
    queryKey: ['active-timer', token],
    queryFn: async () => { try { return await timeEntries.active(token!) } catch { return null } },
    enabled: !!token,
    refetchInterval: 30_000,
  })

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
    refetchInterval: 10_000, // Faster refresh
  })

  const { data: weekData } = useQuery({
    queryKey: ['time-entries-week', token, weekStart],
    queryFn: () => timeEntries.list(token!, { from: weekStart, to: weekEnd, size: 500 }),
    enabled: !!token,
  })

  useEffect(() => {
    if (activeEntry?.isRunning) {
      setElapsed(dayjs().diff(dayjs(activeEntry.startedAt), 'second'))
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      setElapsed(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [activeEntry?.isRunning, activeEntry?.startedAt])

  useEffect(() => {
    if (!token || description.length < 2) { setSuggestionList([]); return }
    const t = setTimeout(async () => {
      try { const r = await suggestions.search(token, description); setSuggestionList(r.suggestions) } catch { /**/ }
    }, 300)
    return () => clearTimeout(t)
  }, [description, token])

  const startMutation = useMutation({
    mutationFn: () => timeEntries.start(token!, { projectId: activeProjectId!, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries-week'] })
      refetchActive()
      setShowDescInput(false)
      setShowProjectPicker(false)
      setDescription('')
      toast.success('Timer started')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stopMutation = useMutation({
    mutationFn: () => timeEntries.stop(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries-week'] })
      refetchActive()
      setActiveProjectId(null)
      toast.success('Timer stopped')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (entryId: number) => timeEntries.delete(token!, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries-week'] })
      toast.success('Entry deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Derived
  const clientMap = new Map(clientList.map((c) => [c.clientId, c]))
  const projectMap = new Map(projectList.map((p) => [p.projectId, p]))
  const projectsByClient = clientList
    .map((c) => ({ client: c, projects: projectList.filter((p) => p.clientId === c.clientId) }))
    .filter((g) => g.projects.length > 0)

  const completedEntries = (todayData?.entries ?? []).filter((e) => !e.isRunning)
  const todaySeconds = completedEntries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0)

  const dailyHours = Array(7).fill(0)
  ;(weekData?.entries ?? []).filter((e) => !e.isRunning).forEach((e) => {
    const idx = dayjs(e.startedAt).isoWeekday() - 1
    dailyHours[idx] += (e.durationSeconds ?? 0) / 3600
  })

  const runningProject = activeEntry?.isRunning ? projectMap.get(activeEntry.projectId) : null
  const runningClient = runningProject ? clientMap.get(runningProject.clientId) : null

  // Recent clients from today's entries
  const recentClients = clientList
    .map((client, idx) => {
      const entries = completedEntries.filter((e) => {
        const p = projectMap.get(e.projectId)
        return p?.clientId === client.clientId
      })
      if (entries.length === 0) return null
      const secs = entries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0)
      const lastProject = projectMap.get(entries[entries.length - 1].projectId)
      return { client, secs, lastProject, colorIdx: idx }
    })
    .filter(Boolean) as { client: typeof clientList[0]; secs: number; lastProject?: ProjectResponse; colorIdx: number }[]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground/80 font-medium mt-1">{dayjs().format('dddd, D MMMM YYYY')}</p>
        </div>
        <div className="flex items-center gap-5">
          <button className="relative w-11 h-11 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all group shadow-sm">
            <svg className="w-6 h-6 text-muted-foreground/40 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#7c5cf6] rounded-full border-2 border-[#121432]" />
          </button>
          <button
            className="flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[14px] text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#7c5cf6]/20"
            style={{ background: 'linear-gradient(135deg, #664ec2 0%, #7c5cf6 100%)' }}
          >
            <div className="w-5 h-5 flex items-center justify-center bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm9 12H6v-8h12v8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            Start Break
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-10 pb-10">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-12 gap-8 items-start">

            {/* ── Left column ── */}
            <div className="col-span-8 space-y-8">

              {/* Timer card */}
              {activeEntry?.isRunning ? (
                <div
                  className="relative rounded-[32px] p-10 overflow-hidden shadow-2xl shadow-primary/20"
                  style={{ background: 'linear-gradient(135deg, #452cb5 0%, #664ec2 50%, #7c5cf6 100%)' }}
                >
                  <div className="absolute inset-0 opacity-20">
                    <svg viewBox="0 0 600 120" className="w-full h-full" preserveAspectRatio="none">
                      <path d="M0,60 C150,110 300,10 450,60 S600,110 600,60 L600,120 L0,120 Z" fill="white" />
                      <path d="M0,80 C150,120 300,30 450,80 S600,120 600,80 L600,120 L0,120 Z" fill="white" opacity="0.4" />
                    </svg>
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-10">
                      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                        </span>
                        <span className="text-[11px] font-black text-white uppercase tracking-[0.1em]">Tracking</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-10">
                      <div className="min-w-0">
                        <p className="text-4xl font-bold text-white tracking-tight leading-tight mb-3">
                          {activeEntry.description || 'Managing that diary'}
                        </p>
                        <p className="text-[15px] text-white/50 font-medium">
                          {[runningClient?.name, runningProject?.name].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-8 flex-shrink-0">
                        <span className="text-6xl font-mono font-bold text-white tabular-nums tracking-tighter">
                          {formatElapsed(elapsed)}
                        </span>
                        <button
                          onClick={() => stopMutation.mutate()}
                          disabled={stopMutation.isPending}
                          className="px-8 py-3 rounded-2xl bg-[#ec4899] hover:bg-[#d946ef] text-white font-black text-[15px] transition-all disabled:opacity-60 shadow-xl shadow-black/20"
                        >
                          {stopMutation.isPending ? '…' : 'Stop'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Description input */}
              {showDescInput && activeProjectId ? (
                <div className="rounded-[32px] glass-card p-8 shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-xs font-black text-primary uppercase tracking-widest">Ready to track</span>
                  </div>
                  <p className="text-lg font-bold mb-6 tracking-tight">
                    {projectMap.get(activeProjectId)?.name}
                    <span className="font-medium text-muted-foreground/50 ml-2">
                      · {clientMap.get(projectMap.get(activeProjectId)?.clientId ?? 0)?.name}
                    </span>
                  </p>
                  <div className="flex gap-4 relative">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="What are you working on?"
                        className="h-14 bg-background/40 border-white/5 focus:border-primary/50 transition-all rounded-2xl px-6 text-[15px] font-medium"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && description.trim()) startMutation.mutate() }}
                        autoFocus
                      />
                      {showSuggestions && suggestionList.length > 0 && (
                        <div className="absolute top-full mt-3 w-full bg-[#121432]/95 border border-white/10 rounded-[24px] shadow-2xl z-20 overflow-hidden backdrop-blur-2xl">
                          {suggestionList.map((s) => (
                            <button key={s} className="w-full text-left px-6 py-4 text-[14px] hover:bg-white/5 transition-colors font-bold border-b border-white/5 last:border-0"
                              onMouseDown={() => { setDescription(s); setShowSuggestions(false) }}>{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button className="h-14 px-10 rounded-2xl font-black text-[15px] bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20" onClick={() => startMutation.mutate()} disabled={!description.trim() || startMutation.isPending}>
                      {startMutation.isPending ? '…' : 'Start'}
                    </Button>
                    <Button variant="ghost" className="h-14 w-14 rounded-2xl text-muted-foreground/40 hover:text-white hover:bg-white/5" onClick={() => { setShowDescInput(false); setActiveProjectId(null) }}>✕</Button>
                  </div>
                </div>
              ) : null}

            {/* Project picker (when not running) */}
            {!activeEntry?.isRunning && (
              <div className="rounded-[32px] glass-card overflow-hidden shadow-xl">
                {projectList.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-[15px] text-muted-foreground/60 font-medium tracking-tight">No projects assigned yet — ask your admin to assign you to some projects.</p>
                  </div>
                ) : (
                  projectsByClient.map(({ client, projects }, groupIdx) => (
                    <div key={client.clientId}>
                      {groupIdx > 0 && <div className="h-px bg-white/5" />}
                      <div className="px-8 py-4 bg-white/5">
                        <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">{client.name}</p>
                      </div>
                      {projects.map((project) => {
                        const isSelected = activeProjectId === project.projectId && showDescInput
                        return (
                          <button
                            key={project.projectId}
                            onClick={() => { setActiveProjectId(project.projectId); setDescription(''); setShowDescInput(true) }}
                            className="w-full flex items-center justify-between px-8 py-5 text-left border-t border-white/5 hover:bg-white/5 transition-all group"
                          >
                            <span className="text-[15px] font-bold tracking-tight text-white/80 group-hover:text-white">{project.name}</span>
                            <span className={`text-[12px] font-black text-primary transition-all ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-[-4px]'}`}>
                              {isSelected ? '◉ SELECTED' : '▶ START'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Today's entries */}
            <div className="rounded-[32px] glass-card overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
                <h2 className="text-lg font-bold tracking-tight">Today&apos;s entries</h2>
                <button
                  onClick={() => setManualOpen(true)}
                  className="text-[12px] font-black text-white/60 hover:text-white border border-white/10 rounded-2xl px-5 py-2 hover:bg-white/5 transition-all shadow-sm uppercase tracking-wider"
                >
                  + Manual Entry
                </button>
              </div>
              <div className="px-8 pb-4">
                {completedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-20 font-medium">No activity tracked yet today</p>
                ) : (
                  completedEntries.map((entry, i) => {
                    const proj = projectMap.get(entry.projectId)
                    const client = proj ? clientMap.get(proj.clientId) : undefined
                    return (
                      <EntryRow
                        key={entry.entryId}
                        entry={entry}
                        project={proj}
                        clientName={client?.name}
                        colorIdx={i}
                        onEdit={() => setEditEntry(entry)}
                        onDelete={() => deleteMutation.mutate(entry.entryId)}
                      />
                    )
                  })
                )}
              </div>
            </div>

          </div>

          {/* ── Right sidebar ── */}
          <div className="col-span-4 space-y-6">

            {/* Today's summary */}
            <div className="rounded-[32px] glass-card p-8 shadow-xl">
              <p className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-8">Today&apos;s Summary</p>
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center shadow-inner">
                      <svg className="w-5 h-5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[15px] font-bold text-muted-foreground/70">Time Tracked</span>
                  </div>
                  <span className="text-xl font-bold tabular-nums tracking-tight">{formatDuration(todaySeconds)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center shadow-inner">
                      <svg className="w-5 h-5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[15px] font-bold text-muted-foreground/70">Tasks Completed</span>
                  </div>
                  <span className="text-xl font-bold tabular-nums tracking-tight">5</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-11 h-11 rounded-2xl bg-white/5 flex items-center justify-center shadow-inner">
                      <svg className="w-5 h-5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-[15px] font-bold text-muted-foreground/70">Entries Logged</span>
                  </div>
                  <span className="text-xl font-bold tabular-nums tracking-tight">{completedEntries.length}</span>
                </div>
              </div>
              <div className="mt-10 pt-8 border-t border-white/5">
                <a href="/dashboard/reports" className="text-[14px] text-primary hover:text-primary/80 font-black flex items-center justify-center gap-2 group transition-all">
                  View Report
                  <svg className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Weekly chart */}
            <div className="rounded-[32px] glass-card p-8 shadow-xl">
              <WeeklyChart dailyHours={dailyHours} />
            </div>

          </div>
        </div>

        {/* Recent clients — full width below the two-column area */}
        {recentClients.length > 0 && (
          <div className="rounded-[32px] glass-card overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
              <h2 className="text-[11px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Recent Clients</h2>
            </div>
            <div className="grid grid-cols-4 gap-6 p-8">
              {recentClients.slice(0, 4).map(({ client, secs, lastProject, colorIdx }) => (
                <div key={client.clientId} className="flex items-center gap-5 p-5 rounded-[24px] border border-white/5 bg-[#1c1e3d]/40 hover:bg-[#30356c] transition-all group cursor-pointer shadow-sm">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 shadow-lg ${AVATAR_COLORS[colorIdx % AVATAR_COLORS.length]}`}>
                    {client.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold truncate tracking-tight group-hover:text-primary transition-colors leading-tight">{client.name}</p>
                    <p className="text-[12px] text-muted-foreground/50 font-medium truncate mt-1">{lastProject?.name}</p>
                    <p className="text-[13px] text-muted-foreground/70 font-bold mt-2">{formatDuration(secs)} today</p>
                  </div>
                  <svg className="w-5 h-5 text-muted-foreground/10 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ))}
            </div>
            <div className="px-8 py-5 border-t border-white/5 bg-white/5 flex justify-end">
              <a href="/dashboard/clients" className="text-[13px] text-primary hover:text-white font-black flex items-center gap-2 transition-all">
                View all clients
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        )}

        </div>
      </div>

      <ManualEntryDialog
        open={manualOpen || !!editEntry}
        onClose={() => { setManualOpen(false); setEditEntry(null) }}
        projects={projectList}
        editEntry={editEntry}
      />
    </div>
  )
}
