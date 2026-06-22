'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ManualEntryDialog } from './ManualEntryDialog'
import { timeEntries } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { TimeEntryResponse, ProjectResponse } from '@/lib/types'

function formatDuration(seconds?: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

interface Props {
  entries: TimeEntryResponse[]
  projects: ProjectResponse[]
}

export function TimeEntryList({ entries, projects }: Props) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const [editEntry, setEditEntry] = useState<TimeEntryResponse | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (entryId: number) => timeEntries.delete(token!, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success('Entry deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const projectMap = new Map(projects.map((p) => [p.projectId, p]))

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No entries yet today
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-border">
        {entries.map((entry) => {
          const project = projectMap.get(entry.projectId)
          return (
            <div key={entry.entryId} className="flex items-center gap-4 py-3 group">
              {/* Time range */}
              <div className="flex-shrink-0 w-32 text-xs text-muted-foreground font-mono">
                <div>{dayjs(entry.startedAt).format('HH:mm')}</div>
                {entry.endedAt && <div>{dayjs(entry.endedAt).format('HH:mm')}</div>}
              </div>

              {/* Description + project */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{entry.description}</p>
                {project && (
                  <p className="text-xs text-muted-foreground mt-0.5">{project.name}</p>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {entry.isBillable && (
                  <Badge variant="secondary" className="text-xs">Billable</Badge>
                )}
                <span className="text-sm font-mono font-medium text-foreground tabular-nums w-14 text-right">
                  {formatDuration(entry.durationSeconds)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setEditEntry(entry)}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(entry.entryId)}
                  disabled={deleteMutation.isPending}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <ManualEntryDialog
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        projects={projects}
        editEntry={editEntry}
      />
    </>
  )
}
