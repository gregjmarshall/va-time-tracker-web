'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { timeEntries, timerSession as timerSessionApi, suggestions as suggestionsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ProjectResponse, ClientResponse, TimeEntryResponse, TimerSessionResponse } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}

const AFFIRMATIONS = [
  "You're doing great — keep it up! 🌟",
  "Every minute counts. You've got this! 💪",
  "Focused and productive — that's you! 🎯",
  "Amazing work happening right now! ✨",
  "You're making real progress today! 🚀",
  "Deep work is powerful work. Keep going! 🧠",
  "Your effort is paying off, one second at a time! ⏱️",
  "Look at you, getting things done! 🙌",
  "Consistency is a superpower — and you have it! ⚡",
  "Every task you finish is a win! 🏆",
  "You showed up and that already matters! 🌈",
  "In the zone! This is where magic happens! 🪄",
  "Small steps, big results. Keep moving! 👟",
  "Your clients are lucky to have you! 💼",
  "Flow state unlocked! Don't stop now! 🔓",
  "You're building something great! 🏗️",
  "Today's effort is tomorrow's success! 🌅",
  "Crushing it, one minute at a time! 🔥",
  "You're the kind of professional people rely on! 🤝",
  "Hard work like this doesn't go unnoticed! 👀",
  "You make it look easy — but we know the effort! 😎",
  "Stay with it — the best work comes from persistence! 🌱",
  "Time well spent is time well lived! ☀️",
  "You're investing in your best work right now! 💡",
  "Momentum is building — feel it! 🏄",
  "Great things are assembled minute by minute! 🔧",
  "The world works better because you work hard! 🌍",
  "Your dedication is truly inspiring! 🌻",
  "One focused hour beats ten distracted ones! 🎧",
  "You're on a roll — don't break the streak! 🎲",
  "Excellence is a habit, and you're proving it! 📈",
  "Another block of quality time — nice work! 🧱",
  "Whatever you're building, it matters! 💎",
  "You bring real value to every project! 💫",
  "The timer is running, and so are you! 🏃",
  "Proud of you for showing up and doing the work! 🫶",
  "Dialled in and delivering — that's the energy! ⚙️",
  "Your focus right now is a gift to your future self! 🎁",
  "Every tracked minute tells a story of effort! 📖",
  "You're not just working — you're making an impact! 🌊",
  "Solid, reliable, excellent. That's you! 🪨",
  "The best professionals track their time — and here you are! 📊",
  "Keep that momentum going — you're unstoppable! 🚂",
  "Real growth happens in moments exactly like this! 🌿",
  "You're turning time into results. That's powerful! ⚡",
  "Your work ethic is something to be proud of! 🦁",
  "Another session, another step forward! 👣",
  "You make the work look purposeful — because it is! 🎨",
  "Stay curious, stay focused, keep creating! 🔭",
  "Quiet effort, loud results. That's your style! 🎶",
  "You're writing the story of a productive day! 📝",
  "Tick tock — and you're making every second count! ⌚",
]

// ── Two-step client → project dropdown ───────────────────────────────────────

function ProjectPicker({
  clientList, projectList, selectedProjectId, onSelect,
}: {
  clientList: ClientResponse[]
  projectList: ProjectResponse[]
  selectedProjectId: number | null
  onSelect: (projectId: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'clients' | 'projects'>('clients')
  const [activeClientId, setActiveClientId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selectedProject = projectList.find((p) => p.projectId === selectedProjectId)
  const selectedClient = selectedProject ? clientList.find((c) => c.clientId === selectedProject.clientId) : null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filteredClients = clientList.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredProjects = projectList
    .filter((p) => p.clientId === activeClientId && p.isActive)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setStep('clients'); setSearch('') }}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/8 transition-all w-full text-left"
      >
        <svg className="w-4 h-4 flex-shrink-0 text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={`flex-1 ${selectedProject ? 'text-white' : ''}`}>
          {selectedProject
            ? `${selectedClient?.name} · ${selectedProject.name}`
            : 'Select project (optional)'}
        </span>
        {selectedProjectId ? (
          <span role="button" className="text-muted-foreground/40 hover:text-white text-xs px-1"
            onMouseDown={(e) => { e.stopPropagation(); onSelect(null) }}>✕</span>
        ) : (
          <svg className="w-4 h-4 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-[#151737]/98 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden">
          <div className="p-3 border-b border-white/5">
            <input autoFocus
              placeholder={step === 'clients' ? 'Search clients…' : 'Search projects…'}
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {step === 'clients' ? (
              filteredClients.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">No clients found</p>
                : filteredClients.map((c) => (
                  <button key={c.clientId} type="button"
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                    onClick={() => { setActiveClientId(c.clientId); setStep('projects'); setSearch('') }}>
                    {c.name}
                    <svg className="w-4 h-4 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))
            ) : (
              <>
                <button type="button"
                  className="w-full text-left px-4 py-2.5 text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest hover:bg-white/5 flex items-center gap-2 border-b border-white/5 transition-colors"
                  onClick={() => { setStep('clients'); setSearch('') }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {clientList.find((c) => c.clientId === activeClientId)?.name}
                </button>
                {filteredProjects.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">No projects found</p>
                  : filteredProjects.map((p) => (
                    <button key={p.projectId} type="button"
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white border-b border-white/5 last:border-0 transition-colors"
                      onClick={() => { onSelect(p.projectId); setOpen(false) }}>
                      {p.name}
                    </button>
                  ))
                }
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── List-style project picker inside the stop dialog ─────────────────────────

function ForceProjectPicker({ clientList, projectList, onSelect, isPending }: {
  clientList: ClientResponse[]
  projectList: ProjectResponse[]
  onSelect: (projectId: number) => void
  isPending: boolean
}) {
  const [clientId, setClientId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const filteredClients = clientList.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  const filteredProjects = projectList
    .filter((p) => p.clientId === clientId && p.isActive)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-3">
      <input autoFocus
        placeholder={clientId ? 'Search projects…' : 'Search clients…'}
        value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
      />
      <div className="max-h-64 overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5">
        {!clientId
          ? filteredClients.map((c) => (
            <button key={c.clientId} type="button" disabled={isPending}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white flex items-center justify-between transition-colors"
              onClick={() => { setClientId(c.clientId); setSearch('') }}>
              {c.name}
              <svg className="w-4 h-4 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))
          : <>
            <button type="button"
              className="w-full text-left px-4 py-2.5 text-[11px] font-black text-muted-foreground/50 uppercase tracking-widest hover:bg-white/5 flex items-center gap-2 transition-colors"
              onClick={() => { setClientId(null); setSearch('') }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {clientList.find((c) => c.clientId === clientId)?.name}
            </button>
            {filteredProjects.map((p) => (
              <button key={p.projectId} type="button" disabled={isPending}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                onClick={() => onSelect(p.projectId)}>
                {isPending ? '…' : p.name}
              </button>
            ))}
          </>
        }
      </div>
    </div>
  )
}

// ── Pause session persistence ─────────────────────────────────────────────────

const PAUSE_KEY = 'va-timer-paused-session'

interface PausedSession {
  accumuledSeconds: number
  nullProjectEntryIds: number[]
  description: string
  selectedProjectId: number | null
}

function savePause(s: PausedSession) {
  try { localStorage.setItem(PAUSE_KEY, JSON.stringify(s)) } catch { /* */ }
}
function loadPause(): PausedSession | null {
  try { const r = localStorage.getItem(PAUSE_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function clearPause() {
  try { localStorage.removeItem(PAUSE_KEY) } catch { /* */ }
}

// ── Main TimerBar ─────────────────────────────────────────────────────────────

interface Props {
  activeEntry: TimeEntryResponse | null
  pausedSession: TimerSessionResponse | null
  projectList: ProjectResponse[]
  clientList: ClientResponse[]
  onChanged: () => void
}

type TimerState = 'idle' | 'running' | 'paused'

export function TimerBar({ activeEntry, pausedSession, projectList, clientList, onChanged }: Props) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  // ── Timer state ───────────────────────────────────────────────────
  // Resolve initial paused state: backend prop is authoritative; localStorage is a
  // fast-path fallback for same-tab navigation (avoids a brief "idle" flash).
  const [initialPause] = useState<PausedSession | null>(() => {
    if (activeEntry?.isRunning) return null
    if (pausedSession) {
      return {
        accumuledSeconds: pausedSession.accumulatedSeconds,
        nullProjectEntryIds: pausedSession.entryIds,
        description: pausedSession.description,
        selectedProjectId: pausedSession.projectId,
      }
    }
    return loadPause()
  })

  const [timerState, setTimerState] = useState<TimerState>(() => {
    if (activeEntry?.isRunning) return 'running'
    return initialPause ? 'paused' : 'idle'
  })
  const accumulatedRef = useRef(initialPause?.accumuledSeconds ?? 0)
  const nullProjectEntryIdsRef = useRef<number[]>(initialPause?.nullProjectEntryIds ?? [])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [elapsed, setElapsed] = useState(initialPause?.accumuledSeconds ?? 0)
  const [description, setDescription] = useState(
    activeEntry?.description ?? initialPause?.description ?? ''
  )
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    activeEntry?.projectId ?? initialPause?.selectedProjectId ?? null
  )
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionList, setSuggestionList] = useState<string[]>([])
  const [affirmationIdx, setAffirmationIdx] = useState(() => Math.floor(Math.random() * AFFIRMATIONS.length))

  // Sync local state when a new active entry arrives (e.g. page reload with running timer)
  useEffect(() => {
    if (activeEntry?.isRunning && timerState === 'idle') {
      setTimerState('running')
      setDescription(activeEntry.description ?? '')
      setSelectedProjectId(activeEntry.projectId ?? null)
    }
    if (!activeEntry?.isRunning && timerState === 'running') {
      // Timer was stopped externally (another tab/device)
      setTimerState('idle')
      accumulatedRef.current = 0
      setElapsed(0)
    }
  }, [activeEntry?.isRunning, activeEntry?.entryId]) // eslint-disable-line

  // ── Elapsed tick ──────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (timerState === 'running' && activeEntry?.isRunning) {
      const tick = () => {
        const currentRunSecs = Math.floor(
          (Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000
        )
        setElapsed(accumulatedRef.current + currentRunSecs)
      }
      tick()
      intervalRef.current = setInterval(tick, 1000)
    } else if (timerState === 'idle') {
      setElapsed(0)
    }
    // paused: interval cleared, elapsed stays frozen

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerState, activeEntry?.isRunning, activeEntry?.startedAt]) // eslint-disable-line

  // ── Description suggestions ───────────────────────────────────────
  useEffect(() => {
    if (!token || description.length < 2) { setSuggestionList([]); return }
    const t = setTimeout(async () => {
      try { const r = await suggestionsApi.search(token, description); setSuggestionList(r.suggestions) } catch { /**/ }
    }, 300)
    return () => clearTimeout(t)
  }, [description, token])

  // ── Mutations ─────────────────────────────────────────────────────

  // Start a new backend entry (play / resume)
  const startMutation = useMutation({
    mutationFn: () => timeEntries.start(token!, {
      description: description || '',
      projectId: selectedProjectId ?? undefined,
    }),
    onSuccess: () => {
      clearSessionMutation.mutate()
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      onChanged()
      if (accumulatedRef.current === 0) {
        setAffirmationIdx(Math.floor(Math.random() * AFFIRMATIONS.length))
      }
      setTimerState('running')
      toast.success(accumulatedRef.current > 0 ? 'Resumed' : 'Timer started')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Stop backend entry without requiring project (used for pause)
  const pauseMutation = useMutation({
    mutationFn: () => timeEntries.stop(token!),
    onSuccess: (stoppedEntry) => {
      accumulatedRef.current = elapsed
      if (!stoppedEntry.projectId) {
        nullProjectEntryIdsRef.current.push(stoppedEntry.entryId)
      }
      const session = {
        accumuledSeconds: accumulatedRef.current,
        nullProjectEntryIds: nullProjectEntryIdsRef.current,
        description,
        selectedProjectId,
      }
      savePause(session)
      saveSessionMutation.mutate({
        accumulatedSeconds: accumulatedRef.current,
        entryIds: nullProjectEntryIdsRef.current,
        description,
        projectId: selectedProjectId,
      })
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      onChanged()
      setTimerState('paused')
      toast.success('Paused')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Final stop — stops (if running) and updates all null-project entries with the project
  const finalStopMutation = useMutation({
    mutationFn: async (projectId: number) => {
      if (timerState === 'running') {
        await timeEntries.stop(token!, projectId)
      }
      // Update any paused entries that had no project
      if (nullProjectEntryIdsRef.current.length > 0) {
        await Promise.all(
          nullProjectEntryIdsRef.current.map((id) =>
            timeEntries.update(token!, id, { projectId })
          )
        )
      }
    },
    onSuccess: () => {
      clearSessionMutation.mutate()
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries-week'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries-recent'] })
      onChanged()
      accumulatedRef.current = 0
      nullProjectEntryIdsRef.current = []
      setTimerState('idle')
      setElapsed(0)
      setDescription('')
      setSelectedProjectId(null)
      setShowStopDialog(false)
      toast.success('Entry saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Persist pause session to backend
  const saveSessionMutation = useMutation({
    mutationFn: (body: { accumulatedSeconds: number; entryIds: number[]; description: string; projectId?: number | null }) =>
      timerSessionApi.save(token!, body),
  })

  const clearSessionMutation = useMutation({
    mutationFn: () => timerSessionApi.clear(token!),
    onSuccess: () => {
      clearPause()
      queryClient.invalidateQueries({ queryKey: ['timer-session'] })
    },
  })

  // Update active entry (description / project while running)
  const updateMutation = useMutation({
    mutationFn: (body: { description?: string; projectId?: number }) =>
      timeEntries.update(token!, activeEntry!.entryId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-timer'] }),
  })

  // ── Controls ──────────────────────────────────────────────────────

  function handlePlayPause() {
    if (timerState === 'running') {
      pauseMutation.mutate()
    } else if (timerState === 'paused') {
      startMutation.mutate()
    } else {
      startMutation.mutate()
    }
  }

  function handleStop() {
    const projectId = selectedProjectId ?? activeEntry?.projectId ?? null
    if (!projectId) {
      setShowStopDialog(true)
      return
    }
    finalStopMutation.mutate(projectId)
  }

  function handleProjectChange(projectId: number | null) {
    setSelectedProjectId(projectId)
    if (timerState === 'running' && activeEntry && projectId !== null) {
      updateMutation.mutate({ projectId })
    }
  }

  function handleDescriptionBlur() {
    if (timerState === 'running' && activeEntry && description !== activeEntry.description) {
      updateMutation.mutate({ description })
    }
  }

  // ── Derived ───────────────────────────────────────────────────────
  const isRunning = timerState === 'running'
  const isPaused = timerState === 'paused'
  const isActive = isRunning || isPaused
  const isBusy = startMutation.isPending || pauseMutation.isPending || finalStopMutation.isPending

  const displayProjectId = selectedProjectId ?? activeEntry?.projectId ?? null
  const displayProject = displayProjectId ? projectList.find((p) => p.projectId === displayProjectId) ?? null : null
  const displayClient = displayProject ? clientList.find((c) => c.clientId === displayProject.clientId) ?? null : null

  return (
    <div className="rounded-[32px] glass-card p-8 shadow-xl">

      {/* Description — always visible */}
      <div className="relative mb-4">
        <Input
          placeholder="What are you working on? (optional)"
          className="h-12 bg-white/5 border-white/10 focus:border-primary/40 rounded-2xl px-5 text-[14px] placeholder:text-muted-foreground/40"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 150)
            handleDescriptionBlur()
          }}
        />
        {showSuggestions && suggestionList.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-[#151737]/98 border border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden backdrop-blur-2xl">
            {suggestionList.map((s) => (
              <button key={s}
                className="w-full text-left px-5 py-3 text-[13px] font-bold hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                onMouseDown={() => { setDescription(s); setShowSuggestions(false) }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Project picker — always enabled */}
      <div className="mb-8">
        <ProjectPicker
          clientList={clientList}
          projectList={projectList}
          selectedProjectId={displayProjectId}
          onSelect={handleProjectChange}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-center gap-10">

        {/* Play / Pause button */}
        <div className="relative flex-shrink-0">
          {isRunning && (
            <svg className="absolute pointer-events-none"
              style={{ inset: -7, width: 'calc(100% + 14px)', height: 'calc(100% + 14px)' }}
              viewBox="0 0 86 86">
              <circle cx="43" cy="43" r="40" fill="none"
                stroke="#7c5cf6" strokeWidth="2.5" strokeDasharray="10 5" strokeLinecap="round"
                style={{
                  transformOrigin: '43px 43px',
                  transform: 'rotate(-90deg)',
                  animation: 'timer-march 1.2s linear infinite',
                }}
              />
            </svg>
          )}
          <button
            onClick={handlePlayPause}
            disabled={isBusy}
            className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #5a3ec8 0%, #7c5cf6 100%)'
                : 'linear-gradient(135deg, #2e2670 0%, #4a32a8 100%)',
              boxShadow: isRunning
                ? '0 0 36px rgba(124,92,246,0.55), 0 6px 24px rgba(0,0,0,0.4)'
                : '0 4px 20px rgba(0,0,0,0.35)',
            }}
          >
            {isRunning ? (
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Elapsed + context */}
        {isActive && (
          <div className="flex-1 min-w-0">
            <span className="text-5xl font-mono font-bold text-white tabular-nums tracking-tighter block">
              {formatElapsed(elapsed)}
            </span>
            {isPaused && (
              <span className="text-[10px] font-black text-amber-400/80 uppercase tracking-[0.15em] mt-1 block">
                Paused
              </span>
            )}
            {displayClient && displayProject && (
              <p className="text-xs text-muted-foreground/50 font-medium mt-1 truncate">
                {displayClient.name} · {displayProject.name}
              </p>
            )}
          </div>
        )}

        {/* Stop button */}
        {isActive && (
          <button
            onClick={handleStop}
            disabled={isBusy}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center border border-white/10 bg-white/5 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-300 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="3" />
            </svg>
          </button>
        )}
      </div>

      {/* Affirmation */}
      {isRunning && (
        <p className="text-center text-sm text-primary/60 font-medium mt-6">
          {AFFIRMATIONS[affirmationIdx]}
        </p>
      )}

      {/* Force-project dialog */}
      <Dialog open={showStopDialog} onOpenChange={(v) => { if (!v) setShowStopDialog(false) }}>
        <DialogContent className="sm:max-w-sm bg-[#1a1d3d] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">Which project is this for?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1 mb-4">
            Select a project to save your{' '}
            <span className="text-white font-semibold">{formatElapsed(elapsed)}</span> entry.
            Click away to keep the timer running.
          </p>
          <ForceProjectPicker
            clientList={clientList}
            projectList={projectList}
            onSelect={(projectId) => finalStopMutation.mutate(projectId)}
            isPending={finalStopMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
