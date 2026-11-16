'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { MessageSquareTextIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { clients as clientsApi, projects as projectsApi } from '@/lib/api'
import { invalidateTimeData, useDescriptionRequired } from '@/lib/queries'
import { useAuthStore } from '@/stores/auth'
import { formatHm, parseHours, timesheets, type TimesheetCell, type TimesheetRow, type TimesheetWeek } from '@/lib/timesheetApi'

interface PendingNote {
  projectId: number
  projectName: string
  date: string
  seconds: number
  note: string
}

function emptyRow(projectId: number, projectName: string, clientName: string | undefined, days: string[]): TimesheetRow {
  return {
    projectId, projectName, clientName, totalSeconds: 0,
    cells: days.map((date) => ({ date, totalSeconds: 0, otherSeconds: 0, isBillable: true, entryCount: 0 })),
  }
}

/** Projects × days grid. Typing hours sets the cell total; the backend keeps one entry per cell. */
export function TimesheetGrid({ week, viewedUserId, queryKey }: { week: TimesheetWeek; viewedUserId?: number; queryKey: unknown[] }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const descriptionRequired = useDescriptionRequired()
  const [addedProjectIds, setAddedProjectIds] = useState<number[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingNote, setPendingNote] = useState<PendingNote | null>(null)
  const [adding, setAdding] = useState(false)
  const editable = !week.locked

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
  const clientName = (clientId: number) => clientList.find((c) => c.clientId === clientId)?.name

  const mutation = useMutation({
    mutationFn: (v: { projectId: number; date: string; seconds: number; note?: string }) =>
      timesheets.setCell(token!, { ...v, userId: viewedUserId }),
    onSuccess: (data, v) => {
      queryClient.setQueryData(queryKey, data)
      setDrafts((d) => { const next = { ...d }; delete next[`${v.projectId}:${v.date}`]; return next })
      setPendingNote(null)
      invalidateTimeData(queryClient)
      queryClient.invalidateQueries({ queryKey: ['timesheet-team'] })
    },
    onError: (err: Error, v) => {
      toast.error(err.message)
      setDrafts((d) => { const next = { ...d }; delete next[`${v.projectId}:${v.date}`]; return next })
    },
  })

  const shownIds = new Set(week.rows.map((r) => r.projectId))
  const rows: TimesheetRow[] = [
    ...week.rows,
    ...addedProjectIds
      .filter((id) => !shownIds.has(id))
      .map((id) => {
        const p = projectList.find((x) => x.projectId === id)
        return emptyRow(id, p?.name ?? 'Project', p ? clientName(p.clientId) : undefined, week.days)
      }),
  ]
  const addable = projectList
    .filter((p) => p.isActive && !rows.some((r) => r.projectId === p.projectId))
    .map((p) => ({ ...p, clientName: clientName(p.clientId) ?? '' }))
    .sort((a, b) => a.clientName.localeCompare(b.clientName) || a.name.localeCompare(b.name))

  function commit(row: TimesheetRow, cell: TimesheetCell) {
    const key = `${row.projectId}:${cell.date}`
    const raw = drafts[key]
    if (raw === undefined || row.projectId == null) return
    const seconds = parseHours(raw)
    if (seconds === null) {
      toast.error('Enter hours like 1.5, 1:30 or 90m')
      setDrafts((d) => { const next = { ...d }; delete next[key]; return next })
      return
    }
    if (seconds === cell.totalSeconds) {
      setDrafts((d) => { const next = { ...d }; delete next[key]; return next })
      return
    }
    // A new grid entry needs a note when the workspace requires descriptions
    if (seconds > cell.otherSeconds && !cell.note && descriptionRequired) {
      setPendingNote({ projectId: row.projectId, projectName: row.projectName, date: cell.date, seconds, note: '' })
      return
    }
    mutation.mutate({ projectId: row.projectId, date: cell.date, seconds })
  }

  function cancelNote() {
    if (pendingNote) {
      const key = `${pendingNote.projectId}:${pendingNote.date}`
      setDrafts((d) => { const next = { ...d }; delete next[key]; return next })
    }
    setPendingNote(null)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left font-medium px-3 py-2">Project</th>
              {week.days.map((d) => (
                <th key={d} className={`font-medium px-1 py-2 w-[78px] ${dayjs(d).isSame(dayjs(), 'day') ? 'text-primary' : ''}`}>
                  <div>{dayjs(d).format('ddd')}</div>
                  <div className="text-[11px] opacity-70">{dayjs(d).format('D MMM')}</div>
                </th>
              ))}
              <th className="font-medium px-3 py-2 w-[72px] text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No time this week{editable ? ' — add a project row to start.' : '.'}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.projectId ?? 'none'} className="border-b border-border last:border-0">
                <td className="px-3 py-2 align-middle">
                  <div className="font-medium text-foreground truncate max-w-[220px]">{row.projectName}</div>
                  {row.clientName && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{row.clientName}</div>}
                </td>
                {row.cells.map((cell) => {
                  const key = `${row.projectId}:${cell.date}`
                  const canEdit = editable && row.projectId != null
                  const value = drafts[key] ?? formatHm(cell.totalSeconds)
                  const hints = [
                    cell.otherSeconds > 0 ? `${formatHm(cell.otherSeconds)} from timer/manual entries` : '',
                    cell.note ? `Note: ${cell.note}` : '',
                    cell.totalSeconds > 0 && !cell.isBillable ? 'Non-billable' : '',
                  ].filter(Boolean).join('\n')
                  return (
                    <td key={cell.date} className="px-1 py-1.5 text-center align-middle">
                      <div className="relative group/cell">
                        <input
                          aria-label={`${row.projectName} ${dayjs(cell.date).format('ddd D MMM')}`}
                          title={hints || undefined}
                          value={value}
                          disabled={!canEdit || mutation.isPending}
                          inputMode="decimal"
                          placeholder={canEdit ? '–' : ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                          onBlur={() => commit(row, cell)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setDrafts((d) => { const next = { ...d }; delete next[key]; return next })
                          }}
                          className={`w-full h-9 rounded-md text-center tabular-nums bg-white/5 border border-transparent focus:border-primary/60 focus:outline-none disabled:opacity-60 ${
                            cell.totalSeconds > 0 && !cell.isBillable ? 'text-muted-foreground italic' : 'text-foreground'
                          } ${cell.otherSeconds > 0 ? 'underline decoration-dotted decoration-muted-foreground/60 underline-offset-4' : ''}`}
                        />
                        {cell.cellEntryId && (canEdit || cell.note) && (
                          <button
                            type="button"
                            aria-label="Cell note"
                            disabled={!canEdit}
                            onClick={() => setPendingNote({ projectId: row.projectId!, projectName: row.projectName, date: cell.date, seconds: cell.totalSeconds, note: cell.note ?? '' })}
                            className={`absolute -top-1 -right-1 rounded-full p-0.5 ${cell.note ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover/cell:opacity-100'}`}
                          >
                            <MessageSquareTextIcon className="size-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-right tabular-nums font-medium">{formatHm(row.totalSeconds) || '0:00'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border text-xs">
              <td className="px-3 py-2 text-muted-foreground">Daily total</td>
              {week.dayTotals.map((t, i) => (
                <td key={week.days[i]} className="px-1 py-2 text-center tabular-nums">{formatHm(t) || '–'}</td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatHm(week.totalSeconds) || '0:00'}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {editable && (
        adding ? (
          <div className="flex items-center gap-2">
            <select
              autoFocus
              defaultValue=""
              onChange={(e) => {
                const id = Number(e.target.value)
                if (id) setAddedProjectIds((ids) => [...ids, id])
                setAdding(false)
              }}
              onBlur={() => setAdding(false)}
              className="px-3 py-2 rounded-lg text-sm border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Choose a project…</option>
              {addable.map((p) => (
                <option key={p.projectId} value={p.projectId}>{p.clientName ? `${p.clientName} — ` : ''}{p.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={addable.length === 0}>
            <PlusIcon /> Add row
          </Button>
        )
      )}

      {pendingNote && (
        <Dialog open onOpenChange={(v) => !v && cancelNote()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Note for {pendingNote.projectName}, {dayjs(pendingNote.date).format('ddd D MMM')}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (descriptionRequired && !pendingNote.note.trim()) { toast.error('Add a note describing what you worked on.'); return }
                mutation.mutate({ projectId: pendingNote.projectId, date: pendingNote.date, seconds: pendingNote.seconds, note: pendingNote.note })
              }}
            >
              <Textarea
                autoFocus
                placeholder="What did you work on?"
                value={pendingNote.note}
                onChange={(e) => setPendingNote({ ...pendingNote, note: e.target.value })}
                maxLength={500}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={cancelNote}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending}>Save {formatHm(pendingNote.seconds)}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
