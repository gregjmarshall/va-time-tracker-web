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
import { ProjectPicker } from '@/components/timer/ProjectPicker'
import { DescriptionInput } from '@/components/timer/DescriptionInput'
import { Label } from '@/components/ui/label'
import { timeEntries } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { ClientResponse, ProjectResponse, TimeEntryResponse } from '@/lib/types'
import { invalidateTimeData, useDescriptionRequired } from '@/lib/queries'

interface Props {
  open: boolean
  onClose: () => void
  projects: ProjectResponse[]
  clients: ClientResponse[]
  editEntry?: TimeEntryResponse | null
}

export function ManualEntryDialog({ open, onClose, projects, clients, editEntry }: Props) {
  const { token, user } = useAuthStore()
  // Only Managers and Admins decide what's billable
  const canSetBillable = user?.role !== 'TEAM_MEMBER'
  const descriptionRequired = useDescriptionRequired()
  const queryClient = useQueryClient()

  const [description, setDescription] = useState(editEntry?.description ?? '')
  const [projectId, setProjectId] = useState<number | null>(editEntry?.projectId ?? null)
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
        projectId: projectId!,
        description: description.trim(),
        startedAt: dayjs(startedAt).toISOString(),
        endedAt: dayjs(endedAt).toISOString(),
        ...(canSetBillable ? { isBillable } : {}),
      }),
    onSuccess: () => {
      invalidateTimeData(queryClient)
      toast.success('Entry added')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      timeEntries.update(token!, editEntry!.entryId, {
        description: description.trim(),
        projectId: projectId!,
        startedAt: dayjs(startedAt).toISOString(),
        endedAt: dayjs(endedAt).toISOString(),
        ...(canSetBillable ? { isBillable } : {}),
      }),
    onSuccess: () => {
      invalidateTimeData(queryClient)
      toast.success('Entry updated')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSave = (!descriptionRequired || description.trim().length > 0) && projectId !== null && startedAt && endedAt

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
            <DescriptionInput
              value={description}
              onChange={setDescription}
              required={descriptionRequired}
              placeholder="What did you work on?"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Project</Label>
            <ProjectPicker
              clientList={clients}
              projectList={projects}
              selectedProjectId={projectId}
              onSelect={setProjectId}
            />
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

          {canSetBillable && <div className="flex items-center gap-2">
            <input
              id="billable"
              type="checkbox"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="rounded border-border accent-primary h-4 w-4"
            />
            <Label htmlFor="billable" className="cursor-pointer font-normal">Billable</Label>
          </div>}
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
