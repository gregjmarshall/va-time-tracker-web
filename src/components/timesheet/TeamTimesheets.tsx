'use client'

import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { formatHm, STATUS_CLASS, STATUS_LABEL, timesheets } from '@/lib/timesheetApi'

/** Managers/Admins: everyone's status for the week; open a row to review it. */
export function TeamTimesheets({ weekStart, onOpen }: { weekStart: string; onOpen: (userId: number) => void }) {
  const { token } = useAuthStore()
  const { data, isLoading, error } = useQuery({
    queryKey: ['timesheet-team', token, weekStart],
    queryFn: () => timesheets.team(token!, weekStart),
    enabled: !!token,
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-red-300">{(error as Error).message}</p>
  const rows = data?.rows ?? []
  const waiting = rows.filter((r) => r.status === 'SUBMITTED').length

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {waiting > 0 ? `${waiting} waiting for approval` : 'Nothing waiting for approval'} · {rows.filter((r) => r.status === 'DRAFT').length} not submitted
      </p>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Billable</TableHead>
              <TableHead className="hidden sm:table-cell">Submitted</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell className="font-medium">{r.userName}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatHm(r.totalSeconds) || '0:00'}</TableCell>
                <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatHm(r.billableSeconds) || '0:00'}</TableCell>
                <TableCell className="text-muted-foreground text-xs hidden sm:table-cell">{r.submittedAt ? dayjs(r.submittedAt).format('ddd D MMM, HH:mm') : '—'}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={r.status === 'SUBMITTED' ? 'default' : 'outline'} onClick={() => onOpen(r.userId)}>
                    {r.status === 'SUBMITTED' ? 'Review' : 'Open'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
