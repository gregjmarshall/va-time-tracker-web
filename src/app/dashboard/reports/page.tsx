'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchSelect } from '@/components/reports/SearchSelect'
import { HoursChart } from '@/components/reports/HoursChart'
import { reports, clients, projects, users } from '@/lib/api'
import { clientColor } from '@/lib/colors'
import { exportEntriesCsv, exportReportPdf } from '@/lib/reportExport'
import { useAuthStore } from '@/stores/auth'
import { isManagerial, type CoverFilter, type ReportParams } from '@/lib/types'

dayjs.extend(isoWeek)

function fh(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

type RangeKey = 'ytd' | 'mtd' | 'last_month' | 'this_week' | 'last_week' | 'today' | 'yesterday' | 'custom'

const RANGES: { key: Exclude<RangeKey, 'custom'>; label: string }[] = [
  { key: 'ytd',        label: 'Year to date' },
  { key: 'mtd',        label: 'Month to date' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_week',  label: 'This week' },
  { key: 'last_week',  label: 'Last week' },
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
]

/** Local start/end of the range. Custom dates are inclusive YYYY-MM-DD. */
function resolveRange(key: RangeKey, customFrom: string, customTo: string) {
  const now = dayjs()
  const span = (from: dayjs.Dayjs, to: dayjs.Dayjs, label: string) => ({ from: from.toISOString(), to: to.toISOString(), label })
  switch (key) {
    case 'ytd':        return span(now.startOf('year'), now.endOf('day'), `${now.year()} so far`)
    case 'mtd':        return span(now.startOf('month'), now.endOf('day'), now.format('MMMM YYYY'))
    case 'last_month': { const m = now.subtract(1, 'month'); return span(m.startOf('month'), m.endOf('month'), m.format('MMMM YYYY')) }
    case 'this_week':  return span(now.startOf('isoWeek'), now.endOf('day'), 'This week')
    case 'last_week':  { const w = now.subtract(1, 'week'); return span(w.startOf('isoWeek'), w.endOf('isoWeek'), 'Last week') }
    case 'today':      return span(now.startOf('day'), now.endOf('day'), 'Today')
    case 'yesterday':  { const y = now.subtract(1, 'day'); return span(y.startOf('day'), y.endOf('day'), 'Yesterday') }
    case 'custom': {
      const f = dayjs(customFrom), t = dayjs(customTo)
      const sameYear = f.year() === t.year()
      const label = customFrom === customTo ? f.format('D MMM YYYY') : `${f.format(sameYear ? 'D MMM' : 'D MMM YYYY')} – ${t.format('D MMM YYYY')}`
      return span(f.startOf('day'), t.endOf('day'), label)
    }
  }
}

const SELECT_CLASS = 'px-3 py-2 rounded-lg text-sm font-semibold border border-white/10 bg-white/5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer'
const DATE_CLASS = 'px-3 py-1.5 rounded-lg text-sm font-semibold border border-white/10 bg-white/5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 [color-scheme:dark]'
const PAGE_SIZE = 50
const EXPORT_SIZE = 100_000

type BillableFilter = 'all' | 'billable' | 'non_billable'

const personName = (u: { firstName?: string; lastName?: string; email: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { token, user } = useAuthStore()
  const [tab, setTab] = useState('summary')
  const [rangeKey, setRangeKey] = useState<RangeKey>('mtd')
  const [customFrom, setCustomFrom] = useState(() => dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customTo, setCustomTo] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [clientId, setClientId] = useState<number | null>(null)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [memberId, setMemberId] = useState<number | null>(null)
  const [billable, setBillable] = useState<BillableFilter>('all')
  const [cover, setCover] = useState<CoverFilter>('include')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const customValid = rangeKey !== 'custom' || (!!customFrom && !!customTo && customFrom <= customTo)
  const range = resolveRange(rangeKey, customFrom, customTo)
  const userName = user ? personName(user) : ''
  const canManage = isManagerial(user?.role)

  const { data: clientList } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clients.list(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })

  const { data: projectList } = useQuery({
    queryKey: ['projects', token],
    queryFn: () => projects.list(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })

  const { data: memberList } = useQuery({
    queryKey: ['users', token],
    queryFn: () => users.list(token!),
    enabled: !!token && canManage,
    staleTime: 5 * 60_000,
  })

  const clientNames = useMemo(() => new Map((clientList ?? []).map(c => [c.clientId, c.name])), [clientList])
  const clientOptions = useMemo(
    () => (clientList ?? []).map(c => ({ value: c.clientId, label: c.name, color: clientColor(c.clientId) })).sort((a, b) => a.label.localeCompare(b.label)),
    [clientList])
  const projectOptions = useMemo(
    () => (projectList ?? [])
      .filter(p => clientId === null || p.clientId === clientId)
      .map(p => ({ value: p.projectId, label: p.name, hint: clientNames.get(p.clientId), color: clientColor(p.clientId) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [projectList, clientId, clientNames])
  const memberOptions = useMemo(
    () => (memberList ?? []).filter(u => u.isActive || u.userId === memberId).map(u => ({ value: u.userId, label: personName(u), hint: u.email })).sort((a, b) => a.label.localeCompare(b.label)),
    [memberList, memberId])

  const selectedClient = clientOptions.find(c => c.value === clientId)?.label
  const selectedProject = projectOptions.find(p => p.value === projectId)?.label
  const memberName = memberOptions.find(m => m.value === memberId)?.label ?? null
  const billableLabel = billable === 'billable' ? 'billable only' : billable === 'non_billable' ? 'non-billable only' : null
  const coverLabel = cover === 'exclude' ? 'excl. holiday cover' : cover === 'only' ? 'holiday cover only' : null
  const subtitle = [range.label, selectedClient, selectedProject, memberName, billableLabel, coverLabel].filter(Boolean).join(' · ')

  const params: ReportParams = {
    from: range.from,
    to: range.to,
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(memberId ? { userId: memberId } : {}),
    ...(billable !== 'all' ? { billable: billable === 'billable' } : {}),
    cover,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
  const filterKey = [range.from, range.to, clientId, projectId, memberId, billable, cover]

  // Any filter change goes back to page 1 of the itemised list
  const resetting = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0) }

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', token, ...filterKey],
    queryFn: () => reports.summary(token!, params),
    enabled: !!token && customValid,
  })

  const { data: detailed, isLoading: detailedLoading } = useQuery({
    queryKey: ['reports-detailed', token, ...filterKey, page],
    queryFn: () => reports.detailed(token!, { ...params, page, size: PAGE_SIZE }),
    enabled: !!token && customValid && tab === 'detailed',
    placeholderData: prev => prev,
  })

  const { data: retainerReport, isLoading: retainerLoading } = useQuery({
    queryKey: ['reports-retainer', token],
    queryFn: () => reports.retainer(token!),
    enabled: !!token && canManage,
  })

  const rows = summary?.rows ?? []
  const totalRounded = rows.reduce((s, r) => s + r.roundedTotalHours, 0)
  const totalBillable = rows.reduce((s, r) => s + r.billableRoundedTotalHours, 0)
  const pages = Math.max(1, Math.ceil((detailed?.total ?? 0) / PAGE_SIZE))
  const label = subtitle.replace(/ · /g, ' - ')

  async function runExport(kind: 'csv' | 'pdf') {
    if (!token) return
    // Open the print window before awaiting, so popup blockers still see the click
    const win = kind === 'pdf' ? window.open('', '_blank') : null
    win?.document.write('<p style="font-family:sans-serif;padding:24px;color:#666">Preparing report…</p>')
    setExporting(kind)
    try {
      const all = await reports.detailed(token, { ...params, page: 0, size: EXPORT_SIZE })
      if (kind === 'csv') exportEntriesCsv(all.entries, label)
      else if (win) exportReportPdf(win, { label: range.label, subtitle: [memberName ?? userName, ...subtitle.split(' · ').slice(1)].join(' · '), rows, entries: all.entries, chart: summary?.chart })
    } catch (err) {
      win?.close()
      throw err
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-normal text-foreground">{canManage ? 'Reports' : 'My Time'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => runExport('csv')}
              disabled={exporting !== null}
              title="Every entry in the current filters, one row each"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {exporting === 'csv' ? 'Exporting…' : 'CSV'}
            </button>
            <button
              onClick={() => runExport('pdf')}
              disabled={exporting !== null}
              title="Chart, summary and every entry in the current filters"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => resetting(setRangeKey)(r.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold border transition-all ${
              rangeKey === r.key
                ? 'bg-secondary text-foreground border-foreground/25'
                : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => {
            // Start the custom range from whatever preset is showing
            if (rangeKey !== 'custom') {
              setCustomFrom(dayjs(range.from).format('YYYY-MM-DD'))
              setCustomTo(dayjs(range.to).format('YYYY-MM-DD'))
            }
            resetting(setRangeKey)('custom')
          }}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold border transition-all ${
            rangeKey === 'custom'
              ? 'bg-secondary text-foreground border-foreground/25'
              : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'
          }`}
        >
          Custom…
        </button>
        {rangeKey === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" aria-label="From" value={customFrom} max={customTo || undefined}
              onChange={e => resetting(setCustomFrom)(e.target.value)} className={DATE_CLASS} />
            <span className="text-muted-foreground text-sm">to</span>
            <input type="date" aria-label="To" value={customTo} min={customFrom || undefined}
              onChange={e => resetting(setCustomTo)(e.target.value)} className={DATE_CLASS} />
            {!customValid && <span className="text-xs text-destructive">Pick a start on or before the end</span>}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {clientOptions.length > 0 && (
          <SearchSelect
            options={clientOptions}
            value={clientId}
            onChange={v => {
              resetting(setClientId)(v)
              // Drop a project that belongs to another client
              if (v !== null && projectId !== null && projectList?.find(p => p.projectId === projectId)?.clientId !== v) setProjectId(null)
            }}
            allLabel="All clients"
            placeholder="Search clients…"
          />
        )}
        {projectOptions.length > 0 && (
          <SearchSelect options={projectOptions} value={projectId} onChange={resetting(setProjectId)} allLabel="All projects" placeholder="Search projects…" />
        )}
        {canManage && memberOptions.length > 0 && (
          <SearchSelect options={memberOptions} value={memberId} onChange={resetting(setMemberId)} allLabel="Everyone" placeholder="Search people…" />
        )}
        <select value={billable} onChange={e => resetting(setBillable)(e.target.value as BillableFilter)} className={SELECT_CLASS}>
          <option value="all">Billable &amp; non-billable</option>
          <option value="billable">Billable only</option>
          <option value="non_billable">Non-billable only</option>
        </select>
        <select
          value={cover}
          onChange={e => resetting(setCover)(e.target.value as CoverFilter)}
          className={SELECT_CLASS}
          title="Holiday cover time is logged while covering a client for someone else"
        >
          <option value="include">Including holiday cover</option>
          <option value="exclude">Excluding holiday cover</option>
          <option value="only">Holiday cover only</option>
        </select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="detailed">Detailed</TabsTrigger>
          {canManage && <TabsTrigger value="retainers">Retainers</TabsTrigger>}
        </TabsList>

        <TabsContent value="summary">
          {summaryLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <div className="space-y-6">
              {summary?.chart && summary.chart.buckets.length > 0 && (
                <div className="rounded-lg border border-border bg-card shadow-sm p-5">
                  <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4">
                    <div><p className="text-xs text-muted-foreground">Total</p><p className="num text-xl font-semibold">{fh(totalRounded)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Billable</p><p className="num text-xl font-semibold text-teal">{fh(totalBillable)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Non-billable</p><p className="num text-xl font-semibold text-sky">{fh(Math.max(0, totalRounded - totalBillable))}</p></div>
                  </div>
                  <HoursChart buckets={summary.chart.buckets} granularity={summary.chart.granularity} />
                </div>
              )}
              <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rounded</TableHead>
                      <TableHead className="text-right">Billable</TableHead>
                      <TableHead className="text-right">Holiday cover</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No entries for this period
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((row) => (
                      <TableRow key={`${row.clientId}-${row.projectId}`}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: clientColor(row.clientId) }} />{row.clientName}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.projectName}</TableCell>
                        <TableCell className="text-right num">{fh(row.totalHours)}</TableCell>
                        <TableCell className="text-right num text-muted-foreground">{fh(row.roundedTotalHours)}</TableCell>
                        <TableCell className="text-right num text-muted-foreground">{fh(row.billableRoundedTotalHours)}</TableCell>
                        <TableCell className="text-right num text-muted-foreground">
                          {row.coverRoundedTotalHours > 0 ? <span className="text-amber-400">{fh(row.coverRoundedTotalHours)}</span> : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="detailed">
          {detailedLoading && !detailed ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {canManage && <TableHead>Member</TableHead>}
                      <TableHead>Client / project</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Rounded</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailed?.entries ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground py-8">No entries for this period</TableCell>
                      </TableRow>
                    )}
                    {(detailed?.entries ?? []).map(e => (
                      <TableRow key={e.entryId}>
                        <TableCell className="whitespace-nowrap">
                          <p className="font-medium">{dayjs(e.startedAt).format('ddd D MMM')}</p>
                          <p className="num text-xs text-muted-foreground">{dayjs(e.startedAt).format('HH:mm')}–{e.endedAt ? dayjs(e.endedAt).format('HH:mm') : 'now'}</p>
                        </TableCell>
                        {canManage && <TableCell className="whitespace-nowrap">{e.userName}</TableCell>}
                        <TableCell>
                          <p className="inline-flex items-center gap-2 font-medium">
                            {e.clientId != null && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: clientColor(e.clientId) }} />}
                            {e.clientName ?? '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">{e.projectName ?? 'No project'}</p>
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-normal text-muted-foreground">{e.description || '—'}</TableCell>
                        <TableCell className="text-right num">{e.isRunning ? 'running' : fh((e.roundedDurationSeconds ?? 0) / 3600)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <span className="inline-flex gap-1">
                            {e.isBillable
                              ? <Badge variant="secondary" className="text-teal">Billable</Badge>
                              : <Badge variant="secondary" className="text-sky">Non-billable</Badge>}
                            {e.isCover && <Badge variant="secondary" className="text-amber-400">Cover</Badge>}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(detailed?.total ?? 0) > PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="num">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, detailed!.total)} of {detailed!.total}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40">Previous</button>
                    <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="retainers">
            {retainerLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
            ) : (
              <div className="space-y-4">
                {(retainerReport?.rows ?? []).length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">No retainer data</p>
                )}
                {(retainerReport?.rows ?? []).map((row) => {
                  const used = Math.round(row.percentUsed ?? 0)
                  return (
                    <Card key={`${row.clientId}-${row.projectId ?? 0}`} className="shadow-sm">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-foreground">{row.clientName}{row.projectName && <span className="text-muted-foreground font-medium"> · {row.projectName}</span>}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {fh(row.actualHours)} used{row.retainerHours ? ` of ${fh(row.retainerHours)}` : ''}
                            </p>
                          </div>
                          <Badge variant={row.isOver ? 'destructive' : 'secondary'}>
                            {row.isOver ? 'Over' : used > 80 ? 'Near limit' : 'On track'}
                          </Badge>
                        </div>
                        {row.retainerHours && (
                          <div className="space-y-1">
                            <Progress value={Math.min(used, 100)}
                              className={row.isOver ? '[&>div]:bg-destructive' : used > 80 ? '[&>div]:bg-amber-500' : ''} />
                            <p className="text-xs text-muted-foreground text-right">{used}%</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
