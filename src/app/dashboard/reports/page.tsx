'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { reports, clients } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { SummaryRow } from '@/lib/types'

dayjs.extend(isoWeek)

function fh(h: number) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

type RangeKey = 'ytd' | 'mtd' | 'last_month' | 'this_week' | 'last_week' | 'today' | 'yesterday'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'ytd',        label: 'Year to date' },
  { key: 'mtd',        label: 'Month to date' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_week',  label: 'This week' },
  { key: 'last_week',  label: 'Last week' },
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
]

function resolveRange(key: RangeKey) {
  const now = dayjs()
  switch (key) {
    case 'ytd':        return { from: now.startOf('year').toISOString(),            to: now.toISOString(),                       label: `${now.year()} so far` }
    case 'mtd':        return { from: now.startOf('month').toISOString(),           to: now.toISOString(),                       label: now.format('MMMM YYYY') }
    case 'last_month': return { from: now.subtract(1,'month').startOf('month').toISOString(), to: now.subtract(1,'month').endOf('month').toISOString(), label: now.subtract(1,'month').format('MMMM YYYY') }
    case 'this_week':  return { from: now.startOf('isoWeek').toISOString(),         to: now.toISOString(),                       label: 'This week' }
    case 'last_week':  return { from: now.subtract(1,'week').startOf('isoWeek').toISOString(), to: now.subtract(1,'week').endOf('isoWeek').toISOString(), label: 'Last week' }
    case 'today':      return { from: now.startOf('day').toISOString(),             to: now.endOf('day').toISOString(),          label: 'Today' }
    case 'yesterday':  return { from: now.subtract(1,'day').startOf('day').toISOString(), to: now.subtract(1,'day').endOf('day').toISOString(), label: 'Yesterday' }
  }
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(rows: SummaryRow[], rangeLabel: string) {
  const header = 'Client,Project,Hours,Rounded Hours\n'
  const body = rows.map(r =>
    `"${r.clientName}","${r.projectName}",${r.totalHours.toFixed(2)},${r.roundedTotalHours.toFixed(2)}`
  ).join('\n')
  const blob = new Blob([header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `time-report-${rangeLabel.replace(/\s+/g, '-').toLowerCase()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── PDF export (print window with inline SVG charts) ─────────────────────────

const PIE_COLORS = ['#7c5cf6','#4ade80','#f59e0b','#f87171','#38bdf8','#a78bfa','#34d399','#fb923c','#818cf8','#e879f9']

function buildPieSlices(rows: SummaryRow[]) {
  const total = rows.reduce((s, r) => s + r.totalHours, 0)
  if (total === 0) return []
  let cursor = 0
  return rows.map((r, i) => {
    const frac = r.totalHours / total
    const start = cursor
    cursor += frac
    const startAngle = start * 2 * Math.PI - Math.PI / 2
    const endAngle = cursor * 2 * Math.PI - Math.PI / 2
    const cx = 100, cy = 100, radius = 90
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const large = frac > 0.5 ? 1 : 0
    const path = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${radius},${radius} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], label: r.projectName, hours: r.totalHours, pct: Math.round(frac * 100) }
  })
}

function buildBarsSvg(rows: SummaryRow[]) {
  const maxH = Math.max(...rows.map(r => r.totalHours), 1)
  const W = 520, H = 140, barW = Math.min(40, (W - 40) / rows.length - 8), gap = (W - 40) / rows.length
  return { W, H, barW, gap, maxH }
}

function exportPdf(rows: SummaryRow[], rangeLabel: string, userName: string) {
  const total = rows.reduce((s, r) => s + r.totalHours, 0)
  const totalRounded = rows.reduce((s, r) => s + r.roundedTotalHours, 0)
  const slices = buildPieSlices(rows)
  const { W, H, barW, gap, maxH } = buildBarsSvg(rows)

  // Pie SVG
  const pieSvg = rows.length === 0 ? '' : `
    <svg width="200" height="200" viewBox="0 0 200 200">
      ${slices.map(s => `<path d="${s.path}" fill="${s.color}" stroke="white" stroke-width="1.5"/>`).join('')}
      <circle cx="100" cy="100" r="45" fill="white"/>
      <text x="100" y="96" text-anchor="middle" font-size="13" font-weight="700" fill="#1a1a2e">${total.toFixed(1)}</text>
      <text x="100" y="112" text-anchor="middle" font-size="10" fill="#666">hours</text>
    </svg>`

  // Bar chart SVG (no labels — colour key rendered below)
  const barSvg = rows.length === 0 ? '' : `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${rows.map((r, i) => {
        const bh = Math.max((r.totalHours / maxH) * H, 4)
        const x = 20 + i * gap + (gap - barW) / 2
        const y = H - bh
        const color = PIE_COLORS[i % PIE_COLORS.length]
        return `
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" rx="4" fill="${color}" opacity="0.85"/>
          <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#555">${r.totalHours.toFixed(1)}h</text>
        `
      }).join('')}
    </svg>`

  // Colour key for bar chart
  const barKey = rows.length === 0 ? '' : `
    <div style="display:flex;flex-wrap:wrap;gap:6px 18px;padding:10px 0 20px;">
      ${rows.map((r, i) => `
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="width:10px;height:10px;border-radius:2px;background:${PIE_COLORS[i % PIE_COLORS.length]};flex-shrink:0"></div>
          <span style="font-size:11px;color:#555">${r.projectName}</span>
        </div>`).join('')}
    </div>`

  // Legend
  const legend = slices.map(s => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="width:12px;height:12px;border-radius:3px;background:${s.color};flex-shrink:0"></div>
      <span style="font-size:12px;color:#333;flex:1">${s.label}</span>
      <span style="font-size:12px;font-weight:600;color:#333">${s.hours.toFixed(1)}h</span>
      <span style="font-size:11px;color:#888;width:32px;text-align:right">${s.pct}%</span>
    </div>`).join('')

  // Table rows
  const tableRows = rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fafafa' : 'white'}">
      <td style="padding:9px 14px;font-size:13px;font-weight:600;color:#222">${r.clientName}</td>
      <td style="padding:9px 14px;font-size:13px;color:#555">${r.projectName}</td>
      <td style="padding:9px 14px;font-size:13px;font-weight:600;color:#222;text-align:right">${r.totalHours.toFixed(2)}h</td>
      <td style="padding:9px 14px;font-size:13px;color:#777;text-align:right">${r.roundedTotalHours.toFixed(2)}h</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Time Report — ${rangeLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: white; }
    @page { margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#3a258c 0%,#7c5cf6 100%);padding:36px 48px;color:white;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;opacity:0.7;margin-bottom:8px">Time Report</div>
    <div style="font-size:30px;font-weight:800;margin-bottom:4px">${rangeLabel}</div>
    <div style="font-size:14px;opacity:0.7">${userName} · Generated ${dayjs().format('D MMMM YYYY')}</div>
    <div style="display:flex;gap:40px;margin-top:28px;">
      <div><div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:0.1em">Total Hours</div><div style="font-size:28px;font-weight:800;margin-top:2px">${total.toFixed(1)}h</div></div>
      <div><div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:0.1em">Rounded</div><div style="font-size:28px;font-weight:800;margin-top:2px">${totalRounded.toFixed(1)}h</div></div>
      <div><div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:0.1em">Projects</div><div style="font-size:28px;font-weight:800;margin-top:2px">${rows.length}</div></div>
    </div>
  </div>

  <!-- Charts -->
  ${rows.length > 0 ? `
  <div style="display:flex;gap:40px;padding:36px 48px;border-bottom:1px solid #eee;align-items:flex-start;flex-wrap:wrap;">
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:16px">By Project</div>
      ${pieSvg}
    </div>
    <div style="flex:1;min-width:220px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:16px">Breakdown</div>
      ${legend}
    </div>
  </div>
  <div style="padding:28px 48px 0;border-bottom:1px solid #eee;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:16px">Hours by Project</div>
    ${barSvg}
    ${barKey}
  </div>` : ''}

  <!-- Table -->
  <div style="padding:32px 48px 48px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:16px">Detailed Breakdown</div>
    <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #eee;">
      <thead>
        <tr style="background:#f4f0fe;">
          <th style="padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7c5cf6;text-align:left">Client</th>
          <th style="padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7c5cf6;text-align:left">Project</th>
          <th style="padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7c5cf6;text-align:right">Hours</th>
          <th style="padding:11px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7c5cf6;text-align:right">Rounded</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="background:#f4f0fe;border-top:2px solid #7c5cf6;">
          <td colspan="2" style="padding:11px 14px;font-size:13px;font-weight:700;color:#7c5cf6">Total</td>
          <td style="padding:11px 14px;font-size:13px;font-weight:800;color:#7c5cf6;text-align:right">${total.toFixed(2)}h</td>
          <td style="padding:11px 14px;font-size:13px;font-weight:800;color:#7c5cf6;text-align:right">${totalRounded.toFixed(2)}h</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <script>window.onload = () => { window.print() }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { token, user } = useAuthStore()
  const [tab, setTab] = useState('summary')
  const [rangeKey, setRangeKey] = useState<RangeKey>('mtd')
  const [clientId, setClientId] = useState<number | null>(null)

  const range = resolveRange(rangeKey)
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || ''

  const { data: clientList } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clients.list(token!),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })

  const selectedClient = clientList?.find(c => c.clientId === clientId) ?? null

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', token, rangeKey, clientId],
    queryFn: () => reports.summary(token!, { from: range.from, to: range.to, ...(clientId ? { clientId } : {}) }),
    enabled: !!token,
  })

  const { data: retainerReport, isLoading: retainerLoading } = useQuery({
    queryKey: ['reports-retainer', token],
    queryFn: () => reports.retainer(token!),
    enabled: !!token && user?.role === 'MANAGER',
  })

  const rows = summary?.rows ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Time</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{range.label}{selectedClient ? ` · ${selectedClient.name}` : ''}</p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv(rows, selectedClient ? `${range.label} - ${selectedClient.name}` : range.label)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              CSV
            </button>
            <button
              onClick={() => exportPdf(rows, selectedClient ? `${range.label} - ${selectedClient.name}` : range.label, userName)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm shadow-primary/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Date range pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRangeKey(r.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              rangeKey === r.key
                ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30'
                : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Client filter pills */}
      {clientList && clientList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setClientId(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              clientId === null
                ? 'bg-white/15 text-white border-white/30 shadow-sm'
                : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
            }`}
          >
            All clients
          </button>
          {clientList.map(c => (
            <button
              key={c.clientId}
              onClick={() => setClientId(c.clientId)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                clientId === c.clientId
                  ? 'bg-white/15 text-white border-white/30 shadow-sm'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:bg-white/10'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          {user?.role === 'MANAGER' && <TabsTrigger value="retainers">Retainers</TabsTrigger>}
        </TabsList>

        <TabsContent value="summary">
          {summaryLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Rounded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No entries for this period
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => (
                    <TableRow key={`${row.clientId}-${row.projectId}`}>
                      <TableCell className="font-medium">{row.clientName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.projectName}</TableCell>
                      <TableCell className="text-right font-mono">{fh(row.totalHours)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{fh(row.roundedTotalHours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {user?.role === 'MANAGER' && (
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
                    <Card key={row.clientId} className="shadow-sm">
                      <CardContent className="pt-5 pb-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-foreground">{row.clientName}</p>
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
