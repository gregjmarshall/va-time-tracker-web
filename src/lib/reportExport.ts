import dayjs from 'dayjs'
import { ACCENT } from '@/lib/colors'
import { bucketLabel } from '@/components/reports/HoursChart'
import type { ChartBucket, ChartGranularity, DetailedEntryRow, SummaryRow } from '@/lib/types'

/** Columns of the itemised export, in order. */
const COLUMNS = ['Date', 'Start', 'End', 'Member', 'Client', 'Project', 'Description', 'Hours', 'Rounded Hours', 'Billable', 'Holiday Cover'] as const

const hours = (s?: number | null) => ((s ?? 0) / 3600).toFixed(2)

function entryCells(e: DetailedEntryRow): string[] {
  const start = dayjs(e.startedAt)
  return [
    start.format('YYYY-MM-DD'),
    start.format('HH:mm'),
    e.endedAt ? dayjs(e.endedAt).format('HH:mm') : 'running',
    e.userName,
    e.clientName ?? '',
    e.projectName ?? '',
    e.description,
    hours(e.durationSeconds),
    hours(e.roundedDurationSeconds),
    e.isBillable ? 'Yes' : 'No',
    e.isCover ? 'Yes' : 'No',
  ]
}

function csvCell(v: string) {
  // Quote everything; neutralise spreadsheet formula injection from free-text fields
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return `"${safe.replace(/"/g, '""')}"`
}

export function fileSlug(label: string) {
  return label.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

/** One row per entry. */
export function exportEntriesCsv(entries: DetailedEntryRow[], label: string) {
  const lines = [COLUMNS.join(','), ...entries.map(e => entryCells(e).map(csvCell).join(','))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `time-entries-${fileSlug(label)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function chartSvg(buckets: ChartBucket[], g: ChartGranularity) {
  if (buckets.length === 0) return ''
  const W = 700, H = 150, padL = 30, padB = 18
  const max = Math.max(1, ...buckets.map(b => b.billableHours + b.nonBillableHours))
  const slot = (W - padL) / buckets.length
  const barW = Math.max(2, Math.min(28, slot - 2))
  const every = Math.max(1, Math.ceil(buckets.length / 16))
  const y = (h: number) => (h / max) * (H - padB)
  const bars = buckets.map((b, i) => {
    const x = padL + i * slot + (slot - barW) / 2
    const bh = y(b.billableHours), nh = y(b.nonBillableHours)
    const base = H - padB
    const label = i % every === 0
      ? `<text x="${(x + barW / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#888">${esc(bucketLabel(b.start, g))}</text>` : ''
    return `<rect x="${x.toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${ACCENT.teal}"/>
      <rect x="${x.toFixed(1)}" y="${(base - bh - nh).toFixed(1)}" width="${barW.toFixed(1)}" height="${nh.toFixed(1)}" fill="${ACCENT.sky}"/>${label}`
  }).join('')
  return `<svg width="100%" viewBox="0 0 ${W} ${H}">
    <line x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="#ddd"/>
    <text x="${padL - 4}" y="10" text-anchor="end" font-size="9" fill="#888">${max.toFixed(1)}h</text>
    ${bars}
  </svg>`
}

const TH = 'padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9a5a45;text-align:left'
const TD = 'padding:7px 10px;font-size:11px;color:#333;vertical-align:top'
const SECTION = 'font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:12px'

/** Print window: header totals, chart, summary by project, then every entry. */
export function exportReportPdf(win: Window, opts: {
  label: string
  subtitle: string
  rows: SummaryRow[]
  entries: DetailedEntryRow[]
  chart?: { granularity: ChartGranularity; buckets: ChartBucket[] }
}) {
  const { label, subtitle, rows, entries, chart } = opts
  const rounded = rows.reduce((s, r) => s + r.roundedTotalHours, 0)
  const billable = rows.reduce((s, r) => s + r.billableRoundedTotalHours, 0)

  const summaryRows = rows.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fafafa' : 'white'}">
      <td style="${TD};font-weight:600">${esc(r.clientName)}</td>
      <td style="${TD}">${esc(r.projectName)}</td>
      <td style="${TD};text-align:right">${r.totalHours.toFixed(2)}h</td>
      <td style="${TD};text-align:right">${r.roundedTotalHours.toFixed(2)}h</td>
      <td style="${TD};text-align:right">${r.billableRoundedTotalHours.toFixed(2)}h</td>
    </tr>`).join('')

  const entryRows = entries.map((e, i) => {
    const c = entryCells(e)
    return `<tr style="background:${i % 2 === 0 ? '#fafafa' : 'white'};page-break-inside:avoid">
      <td style="${TD};white-space:nowrap">${c[0]}<br/><span style="color:#888">${c[1]}–${c[2]}</span></td>
      <td style="${TD}">${esc(c[3])}</td>
      <td style="${TD}">${esc(c[4])}<br/><span style="color:#888">${esc(c[5])}</span></td>
      <td style="${TD}">${esc(c[6])}</td>
      <td style="${TD};text-align:right;white-space:nowrap">${c[8]}h</td>
      <td style="${TD};text-align:center">${e.isBillable ? '✓' : ''}</td>
      <td style="${TD};text-align:center">${e.isCover ? '✓' : ''}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Time Report — ${esc(label)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: white; }
  table { width:100%; border-collapse:collapse; border:1px solid #eee; }
  thead { display: table-header-group; }
  @page { margin: 12mm 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <div style="background:#1b1a18;border-bottom:4px solid #ee6a4a;padding:32px 40px;color:#f4efe8;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;opacity:0.7;margin-bottom:8px">Time Report</div>
    <div style="font-size:26px;font-weight:800;margin-bottom:4px">${esc(label)}</div>
    <div style="font-size:13px;opacity:0.75">${esc(subtitle)} · Generated ${dayjs().format('D MMMM YYYY')}</div>
    <div style="display:flex;gap:40px;margin-top:24px;">
      <div><div style="font-size:11px;opacity:0.6;text-transform:uppercase">Rounded hours</div><div style="font-size:24px;font-weight:800">${rounded.toFixed(1)}h</div></div>
      <div><div style="font-size:11px;opacity:0.6;text-transform:uppercase">Billable</div><div style="font-size:24px;font-weight:800">${billable.toFixed(1)}h</div></div>
      <div><div style="font-size:11px;opacity:0.6;text-transform:uppercase">Entries</div><div style="font-size:24px;font-weight:800">${entries.length}</div></div>
    </div>
  </div>
  ${chart && chart.buckets.length ? `<div style="padding:28px 40px 8px;">
    <div style="${SECTION}">Billable <span style="color:${ACCENT.teal}">■</span> vs non-billable <span style="color:${ACCENT.sky}">■</span></div>
    ${chartSvg(chart.buckets, chart.granularity)}
  </div>` : ''}
  <div style="padding:24px 40px 8px;">
    <div style="${SECTION}">Summary by project</div>
    <table><thead><tr style="background:#f4f0fe">
      <th style="${TH}">Client</th><th style="${TH}">Project</th>
      <th style="${TH};text-align:right">Hours</th><th style="${TH};text-align:right">Rounded</th><th style="${TH};text-align:right">Billable</th>
    </tr></thead><tbody>${summaryRows}</tbody></table>
  </div>
  <div style="padding:24px 40px 40px;">
    <div style="${SECTION}">Entries</div>
    <table><thead><tr style="background:#f4f0fe">
      <th style="${TH}">Date</th><th style="${TH}">Member</th><th style="${TH}">Client / project</th><th style="${TH}">Description</th>
      <th style="${TH};text-align:right">Rounded</th><th style="${TH};text-align:center">Billable</th><th style="${TH};text-align:center">Cover</th>
    </tr></thead><tbody>${entryRows || `<tr><td colspan="7" style="${TD};text-align:center;color:#888">No entries</td></tr>`}</tbody></table>
  </div>
  <script>window.onload = () => { window.print() }</script>
</body></html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
