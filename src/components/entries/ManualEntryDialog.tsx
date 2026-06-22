'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { timeEntries } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ProjectResponse, TimeEntryResponse } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  projects: ProjectResponse[]
  editEntry?: TimeEntryResponse | null
}

export function ManualEntryDialog({ open, onClose, projects, editEntry }: Props) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const [description, setDescription] = useState(editEntry?.description ?? '')
  const [projectId, setProjectId] = useState(editEntry ? String(editEntry.projectId) : '')
  const [startedAt, setStartedAt] = useState(
    editEntry ? dayjs(editEntry.startedAt).format('YYYY-MM-DDTHH:mm') : dayjs().subtract(1, 'hour').format('YYYY-MM-DDTHH:mm')
  )
  const [endedAt, setEndedAt] = useState(
    editEntry?.endedAt ? dayjs(editEntry.endedAt).format('YYYY-MM-DDTHH:mm') : dayjs().format('YYYY-MM-DDTHH:mm')
  )
  const [isBillable, setIsBillable] = useState(editEntry?.isBillable ?? true)

  const createMutation = useMutation({
    mutationFn: () =>
      timeEntries.create(token!, {
        projectId: Number(projectId),
        description,
        startedAt: dayjs(startedAt).toISOString(),
        endedAt: dayjs(endedAt).toISOString(),
        isBillable,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success('Entry added')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      timeEntries.update(token!, editEntry!.entryId, {
        description,
        projectId: Number(projectId),
        startedAt: dayjs(startedAt).toISOString(),
        endedAt: dayjs(endedAt).toISOString(),
        isBillable,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] })
      toast.success('Entry updated')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSave = description.trim().length > 0 && projectId && startedAt && endedAt

  function handleSave() {
    if (editEntry) updateMutation.mutate()
    else createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editEntry ? 'Edit entry' : 'Add time entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              placeholder="What did you work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Project</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
            >
              <option value="" disabled>Select project</option>
              {projects.map((p) => (
                <option key={p.projectId} value={String(p.projectId)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End time</Label>
              <Input
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="billable"
              type="checkbox"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="rounded border-border accent-primary h-4 w-4"
            />
            <Label htmlFor="billable" className="cursor-pointer font-normal">Billable</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || isPending}>
            {isPending ? 'Saving…' : editEntry ? 'Save changes' : 'Add entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
