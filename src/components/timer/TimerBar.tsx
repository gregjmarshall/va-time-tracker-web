'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { timeEntries, timerSession as timerSessionApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ProjectResponse, ClientResponse, TimeEntryResponse, TimerSessionResponse } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { invalidateTimeData, useDescriptionRequired } from '@/lib/queries'
import { ProjectPicker, ProjectSearchList } from './ProjectPicker'
import { DescriptionInput } from './DescriptionInput'

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':')
}


// ── Pause session persistence ─────────────────────────────────────────────────

const PAUSE_KEY = 'va-timer-paused-session'

interface PausedSession {
  accumuledSeconds: number
  /** Every entry saved by pausing this session (name kept for stored sessions). */
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

// ── TimerBar: slim timer row shown at the top of every page ─────────────────────────────────────────────────────────────

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
  // Entries already saved by earlier pauses of this session; finalised (or discarded) together
  const segmentIdsRef = useRef<number[]>(initialPause?.nullProjectEntryIds ?? [])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [elapsed, setElapsed] = useState(initialPause?.accumuledSeconds ?? 0)
  const [description, setDescription] = useState(
    activeEntry?.description ?? initialPause?.description ?? ''
  )
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    activeEntry?.projectId ?? initialPause?.selectedProjectId ?? null
  )
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const descriptionRequired = useDescriptionRequired()
  const descriptionRef = useRef<HTMLInputElement>(null)

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
      setTimerState('running')
      toast.success(accumulatedRef.current > 0 ? 'Resumed' : 'Timer started')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Stop backend entry without requiring project (used for pause)
  const pauseMutation = useMutation({
    // needsDescription: paused because Stop was pressed without the required description
    mutationFn: async (_opts?: { needsDescription?: boolean }) => {
      await pendingUpdateRef.current
      return timeEntries.stop(token!)
    },
    onSuccess: (stoppedEntry, opts) => {
      accumulatedRef.current = elapsed
      segmentIdsRef.current.push(stoppedEntry.entryId)
      const session = {
        accumuledSeconds: accumulatedRef.current,
        nullProjectEntryIds: segmentIdsRef.current,
        description,
        selectedProjectId,
      }
      savePause(session)
      saveSessionMutation.mutate({
        accumulatedSeconds: accumulatedRef.current,
        entryIds: segmentIdsRef.current,
        description,
        projectId: selectedProjectId,
      })
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      onChanged()
      setTimerState('paused')
      if (opts?.needsDescription) {
        toast.warning('Timer paused. Add a description, then press stop to save.')
        descriptionRef.current?.focus()
      } else {
        toast.success('Paused')
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function resetTimer() {
    clearSessionMutation.mutate()
    invalidateTimeData(queryClient)
    onChanged()
    accumulatedRef.current = 0
    segmentIdsRef.current = []
    setTimerState('idle')
    setElapsed(0)
    setDescription('')
    setSelectedProjectId(null)
    setShowStopDialog(false)
    setShowDiscardDialog(false)
  }

  // Final stop — stops (if running), then gives every segment of the session the same project
  // and description
  const finalStopMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await pendingUpdateRef.current
      const ids = [...segmentIdsRef.current]
      if (timerState === 'running') {
        ids.push((await timeEntries.stop(token!, projectId)).entryId)
      }
      await Promise.all(ids.map((id) => timeEntries.update(token!, id, { projectId, description: description.trim() })))
    },
    onSuccess: () => {
      resetTimer()
      toast.success('Entry saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Discard — throws away all time tracked in this session without saving it
  const discardMutation = useMutation({
    mutationFn: async () => {
      await pendingUpdateRef.current
      const ids = [...segmentIdsRef.current]
      if (timerState === 'running' && activeEntry) ids.push(activeEntry.entryId)
      await Promise.all(ids.map((id) => timeEntries.delete(token!, id)))
    },
    onSuccess: () => {
      resetTimer()
      toast.success('Timer discarded')
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

  // Update the running entry (description / project while running). Updates are chained, and
  // pause / stop / discard wait for them: the backend update rewrites the whole entry, so one still
  // in flight when the timer stops would write it back as running.
  const pendingUpdateRef = useRef<Promise<unknown>>(Promise.resolve())
  function updateRunningEntry(body: { description?: string; projectId?: number }) {
    const entryId = activeEntry!.entryId
    pendingUpdateRef.current = pendingUpdateRef.current
      .then(() => timeEntries.update(token!, entryId, body))
      .then(() => queryClient.invalidateQueries({ queryKey: ['active-timer'] }))
      .catch(() => { /* the final stop re-applies project and description */ })
  }

  // ── Controls ──────────────────────────────────────────────────────

  function handlePlayPause() {
    if (timerState === 'running') {
      pauseMutation.mutate({})
    } else if (timerState === 'paused') {
      startMutation.mutate()
    } else {
      startMutation.mutate()
    }
  }

  function handleStop() {
    if (descriptionRequired && !description.trim()) {
      // Don't keep the clock running while we wait for a description: pause, then ask for it
      if (timerState === 'running') {
        pauseMutation.mutate({ needsDescription: true })
      } else {
        toast.error('Add a description before saving')
        descriptionRef.current?.focus()
      }
      return
    }
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
      updateRunningEntry({ projectId })
    }
  }

  function handleDescriptionBlur() {
    if (timerState === 'running' && activeEntry && description.trim() && description !== activeEntry.description) {
      updateRunningEntry({ description })
    }
  }

  // ── Derived ───────────────────────────────────────────────────────
  const isRunning = timerState === 'running'
  const isPaused = timerState === 'paused'
  const isActive = isRunning || isPaused
  const isBusy = startMutation.isPending || pauseMutation.isPending || finalStopMutation.isPending || discardMutation.isPending

  const displayProjectId = selectedProjectId ?? activeEntry?.projectId ?? null

  const dialogs = (
    <>
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
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <ProjectSearchList
              clientList={clientList}
              projectList={projectList}
              onSelect={(projectId) => finalStopMutation.mutate(projectId)}
              disabled={finalStopMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <Dialog open={showDiscardDialog} onOpenChange={(v) => { if (!v) setShowDiscardDialog(false) }}>
        <DialogContent className="sm:max-w-sm bg-[#1a1d3d] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">Discard this timer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            The <span className="text-white font-semibold">{formatElapsed(elapsed)}</span> tracked won&apos;t be saved. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDiscardDialog(false)} disabled={discardMutation.isPending}>Keep timer</Button>
            <Button variant="destructive" onClick={() => discardMutation.mutate()} disabled={discardMutation.isPending}>
              {discardMutation.isPending ? 'Discarding…' : 'Discard'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full">
      <div className="flex-1 min-w-12 sm:min-w-24">
        <DescriptionInput
          ref={descriptionRef}
          required={descriptionRequired}
          className="h-10 bg-white/5 border-white/10 focus:border-primary/40 rounded-xl px-4 text-sm placeholder:text-muted-foreground/50"
          value={description}
          onChange={setDescription}
          onBlur={handleDescriptionBlur}
        />
      </div>
      <div className="w-24 sm:w-32 lg:w-56 xl:w-72 flex-shrink-0 [&>div>button]:py-2 [&>div>button]:rounded-xl">
        <ProjectPicker
          clientList={clientList}
          projectList={projectList}
          selectedProjectId={displayProjectId}
          onSelect={handleProjectChange}
          placeholder="Select project"
        />
      </div>
      <div className="w-16 sm:w-20 flex-shrink-0 text-right">
        <span className={`num text-base sm:text-lg font-semibold ${isActive ? 'text-white' : 'text-muted-foreground/40'}`}>
          {formatElapsed(elapsed)}
        </span>
        {isPaused && <span className="block text-[9px] font-black text-sun uppercase tracking-[0.15em] -mt-0.5">Paused</span>}
      </div>
      <button onClick={handlePlayPause} disabled={isBusy}
        aria-label={isRunning ? 'Pause timer' : isPaused ? 'Resume timer' : 'Start timer'}
        title={isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${
          isRunning ? 'bg-primary shadow-[0_0_20px_rgba(124,92,246,0.55)] ring-2 ring-teal/70' : 'bg-primary hover:bg-primary/90'
        }`}>
        {isRunning ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1.5" /><rect x="14" y="4" width="4" height="16" rx="1.5" /></svg>
        ) : (
          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      {isActive && (
        <>
          <button onClick={handleStop} disabled={isBusy} aria-label="Stop and save" title="Stop and save"
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10 bg-white/5 text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-all active:scale-95 disabled:opacity-50">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
          </button>
          <button onClick={() => setShowDiscardDialog(true)} disabled={isBusy} aria-label="Discard timer" title="Discard timer"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-muted-foreground/50 hover:text-rose-300 hover:bg-white/5 transition-colors disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
      {dialogs}
    </div>
  )
}
