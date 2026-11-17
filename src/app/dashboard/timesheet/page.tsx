'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { ChevronLeftIcon, ChevronRightIcon, LockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TimesheetGrid } from '@/components/timesheet/TimesheetGrid'
import { TeamTimesheets } from '@/components/timesheet/TeamTimesheets'
import { users as usersApi } from '@/lib/api'
import { invalidateTimeData } from '@/lib/queries'
import { isManagerial, type UserResponse } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { formatHm, STATUS_CLASS, STATUS_LABEL, timesheets, type TimesheetWeek } from '@/lib/timesheetApi'
import { HelpLink } from '@/components/help/HelpLink'

dayjs.extend(isoWeek)

const DATE = 'YYYY-MM-DD'

function displayName(u: UserResponse) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
}

export default function TimesheetPage() {
  const { token, user } = useAuthStore()
  const queryClient = useQueryClient()
  const managerial = isManagerial(user?.role)
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('isoWeek').format(DATE))
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [viewedUserId, setViewedUserId] = useState<number | undefined>(undefined)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const queryKey = ['timesheet-week', token, weekStart, viewedUserId ?? 'me']
  const { data: week, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => timesheets.week(token!, weekStart, viewedUserId),
    enabled: !!token && tab === 'mine',
  })
  const { data: people = [] } = useQuery({
    queryKey: ['users', token],
    queryFn: () => usersApi.list(token!),
    enabled: !!token && managerial,
  })

  const action = useMutation({
    mutationFn: (kind: 'submit' | 'withdraw' | 'approve' | 'reject' | 'reopen'): Promise<TimesheetWeek> => {
      switch (kind) {
        case 'submit': return timesheets.submit(token!, weekStart)
        case 'withdraw': return timesheets.withdraw(token!, weekStart, viewedUserId)
        case 'approve': return timesheets.approve(token!, week!.weekId!)
        case 'reject': return timesheets.reject(token!, week!.weekId!, reason)
        case 'reopen': return timesheets.reopen(token!, week!.weekId!)
      }
    },
    onSuccess: (data, kind) => {
      queryClient.setQueryData(queryKey, data)
      queryClient.invalidateQueries({ queryKey: ['timesheet-team'] })
      invalidateTimeData(queryClient)
      setRejecting(false)
      setReason('')
      toast.success({ submit: 'Week submitted', withdraw: 'Submission withdrawn', approve: 'Week approved', reject: 'Week rejected', reopen: 'Week reopened' }[kind])
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isThisWeek = weekStart === dayjs().startOf('isoWeek').format(DATE)
  const shift = (weeks: number) => setWeekStart(dayjs(weekStart).add(weeks, 'week').format(DATE))
  const viewingSomeoneElse = viewedUserId !== undefined && viewedUserId !== user?.userId

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal text-foreground flex items-center gap-2">Timesheet <HelpLink slug="timesheets" /></h1>
          <p className="text-sm text-muted-foreground">Type hours into the grid (1.5, 1:30 or 90m). Timer and manual entries show up here too.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => shift(-1)}><ChevronLeftIcon /></Button>
          <div className="min-w-[170px] text-center text-sm font-medium">
            {dayjs(weekStart).format('D MMM')} – {dayjs(weekStart).add(6, 'day').format('D MMM YYYY')}
          </div>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => shift(1)}><ChevronRightIcon /></Button>
          {!isThisWeek && <Button variant="ghost" size="sm" onClick={() => setWeekStart(dayjs().startOf('isoWeek').format(DATE))}>This week</Button>}
        </div>
      </div>

      {managerial && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'mine' | 'team')}>
            <TabsList>
              <TabsTrigger value="mine">Timesheet</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === 'mine' && (
            <select
              aria-label="Whose timesheet"
              value={viewedUserId ?? ''}
              onChange={(e) => setViewedUserId(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-2 rounded-lg text-sm border border-input bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">My timesheet</option>
              {people
                .filter((p) => p.isActive && p.userId !== user?.userId)
                .sort((a, b) => displayName(a).localeCompare(displayName(b)))
                .map((p) => <option key={p.userId} value={p.userId}>{displayName(p)}</option>)}
            </select>
          )}
        </div>
      )}

      {tab === 'team' && managerial ? (
        <TeamTimesheets weekStart={weekStart} onOpen={(id) => { setViewedUserId(id === user?.userId ? undefined : id); setTab('mine') }} />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-300">{(error as Error).message}</p>
      ) : week ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white/5 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {viewingSomeoneElse && <span className="font-semibold">{week.userName}</span>}
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${STATUS_CLASS[week.status]}`}>{STATUS_LABEL[week.status]}</span>
              {week.locked && <span className="flex items-center gap-1 text-xs text-muted-foreground"><LockIcon className="size-3" /> Locked</span>}
              <span className="text-muted-foreground">
                {formatHm(week.totalSeconds) || '0:00'} total · {formatHm(week.billableSeconds) || '0:00'} billable
              </span>
              {week.decidedByName && week.decidedAt && week.status !== 'SUBMITTED' && (
                <span className="text-xs text-muted-foreground">
                  {week.status === 'DRAFT' ? 'Reopened' : STATUS_LABEL[week.status]} by {week.decidedByName}, {dayjs(week.decidedAt).format('D MMM')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {week.canSubmit && <Button size="sm" onClick={() => action.mutate('submit')} disabled={action.isPending}>{week.status === 'REJECTED' ? 'Resubmit week' : 'Submit week'}</Button>}
              {week.canWithdraw && <Button size="sm" variant="outline" onClick={() => action.mutate('withdraw')} disabled={action.isPending}>Withdraw</Button>}
              {week.canApprove && <Button size="sm" onClick={() => action.mutate('approve')} disabled={action.isPending}>Approve</Button>}
              {week.canApprove && <Button size="sm" variant="destructive" onClick={() => setRejecting(true)} disabled={action.isPending}>Reject</Button>}
              {week.canReopen && <Button size="sm" variant="outline" onClick={() => action.mutate('reopen')} disabled={action.isPending}>Reopen</Button>}
            </div>
          </div>
          {week.status === 'REJECTED' && week.decisionNote && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">Rejected: {week.decisionNote}</p>
          )}
          {/* key: reset added rows and drafts when the week or person changes */}
          <TimesheetGrid key={`${weekStart}:${viewedUserId ?? 'me'}`} week={week} viewedUserId={viewedUserId} queryKey={queryKey} />
        </div>
      ) : null}

      {rejecting && (
        <Dialog open onOpenChange={(v) => !v && setRejecting(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Reject {week?.userName}&apos;s week</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); action.mutate('reject') }}>
              <Textarea autoFocus placeholder="What needs fixing?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={!reason.trim() || action.isPending}>Reject</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
