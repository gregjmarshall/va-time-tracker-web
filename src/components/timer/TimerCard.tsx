'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { timeEntries, projects as projectsApi, clients as clientsApi, suggestions } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { TimeEntryResponse, ProjectResponse, ClientResponse } from '@/lib/types'

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

interface Props {
  activeEntry: TimeEntryResponse | null
  allProjects: ProjectResponse[]
  onStarted: () => void
  onStopped: () => void
}

export function TimerCard({ activeEntry, allProjects, onStarted, onStopped }: Props) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [suggestionList, setSuggestionList] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token,
  })

  // Filter projects by selected client
  const clientProjects = clientId
    ? allProjects.filter((p) => String(p.clientId) === clientId)
    : allProjects

  // Reset project when client changes
  useEffect(() => {
    setProjectId('')
  }, [clientId])

  // Tick the running timer
  useEffect(() => {
    if (activeEntry?.isRunning) {
      const startSeconds = dayjs().diff(dayjs(activeEntry.startedAt), 'second')
      setElapsed(startSeconds)
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      setElapsed(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [activeEntry?.isRunning, activeEntry?.startedAt])

  // Description autocomplete
  useEffect(() => {
    if (!token || description.length < 2) { setSuggestionList([]); return }
    const timeout = setTimeout(async () => {
      try {
        const res = await suggestions.search(token, description)
        setSuggestionList(res.suggestions)
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(timeout)
  }, [description, token])

  const startMutation = useMutation({
    mutationFn: () =>
      timeEntries.start(token!, { projectId: Number(projectId), description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      onStarted()
      toast.success('Timer started')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stopMutation = useMutation({
    mutationFn: () => timeEntries.stop(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-timer'] })
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      onStopped()
      setDescription('')
      setClientId('')
      setProjectId('')
      toast.success('Timer stopped')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // No clients/projects yet
  if (clientList.length === 0 || allProjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">You need a client and project before you can track time.</p>
        <a href="/dashboard/clients" className="text-sm font-medium text-primary hover:underline">
          + Create your first client &amp; project →
        </a>
      </div>
    )
  }

  // Running timer display
  if (activeEntry?.isRunning) {
    const project = allProjects.find((p) => p.projectId === activeEntry.projectId)
    const client = clientList.find((c) => c.clientId === project?.clientId)
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-xs font-medium text-primary uppercase tracking-wide">Running</span>
            </div>
            <p className="text-lg font-semibold text-foreground truncate">{activeEntry.description}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[client?.name, project?.name].filter(Boolean).join(' › ')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="font-mono text-3xl font-semibold text-foreground tabular-nums">{formatElapsed(elapsed)}</span>
            <Button size="sm" variant="destructive" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending} className="min-w-[80px]">
              {stopMutation.isPending ? '…' : 'Stop'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const canStart = description.trim().length > 0 && projectId

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-medium text-muted-foreground mb-4">Start a timer</h2>
      <div className="flex gap-3 flex-col sm:flex-row">

        {/* Description */}
        <div className="relative flex-1">
          <Input
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestionList.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-10 overflow-hidden">
              {suggestionList.map((s) => (
                <button key={s} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onMouseDown={() => { setDescription(s); setShowSuggestions(false) }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Client */}
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="sm:w-40 h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="" disabled>Client</option>
          {clientList.map((c) => (
            <option key={c.clientId} value={String(c.clientId)}>{c.name}</option>
          ))}
        </select>

        {/* Project — filtered by client */}
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!clientId}
          className="sm:w-44 h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="" disabled>{clientId ? 'Project' : 'Pick client first'}</option>
          {clientProjects.map((p) => (
            <option key={p.projectId} value={String(p.projectId)}>{p.name}</option>
          ))}
        </select>

        {/* Start */}
        <Button onClick={() => startMutation.mutate()} disabled={!canStart || startMutation.isPending} className="sm:min-w-[90px]">
          {startMutation.isPending ? '…' : '▶ Start'}
        </Button>
      </div>
    </div>
  )
}
