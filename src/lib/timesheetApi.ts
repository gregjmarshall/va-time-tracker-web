/** Weekly timesheets API (backend: TimesheetController, /api/timesheets). */

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID ?? '1'

export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface TimesheetCell {
  date: string
  /** Everything logged on this project and day, seconds */
  totalSeconds: number
  /** Timer/manual part of the total, which the grid can't shrink */
  otherSeconds: number
  cellEntryId?: number
  note?: string
  isBillable: boolean
  entryCount: number
}

export interface TimesheetRow {
  projectId: number | null
  projectName: string
  clientId?: number | null
  clientName?: string | null
  cells: TimesheetCell[]
  totalSeconds: number
}

export interface TimesheetWeek {
  weekId?: number
  userId: number
  userName: string
  weekStart: string
  days: string[]
  status: TimesheetStatus
  submittedAt?: string
  decidedByName?: string
  decidedAt?: string
  decisionNote?: string
  locked: boolean
  canSubmit: boolean
  canWithdraw: boolean
  canApprove: boolean
  canReopen: boolean
  rows: TimesheetRow[]
  dayTotals: number[]
  totalSeconds: number
  billableSeconds: number
}

export interface TimesheetTeamRow {
  userId: number
  userName: string
  role: string
  weekId?: number
  status: TimesheetStatus
  submittedAt?: string
  totalSeconds: number
  billableSeconds: number
}

export interface TimesheetTeam {
  weekStart: string
  rows: TimesheetTeamRow[]
}

/** The browser's IANA timezone; the backend uses it for day boundaries. */
export function browserTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

async function req<T>(method: string, path: string, token: string, opts: { body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const params = new URLSearchParams()
  Object.entries(opts.query ?? {}).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)) })
  const qs = params.toString()
  const res = await fetch(`/api/timesheets${path}${qs ? `?${qs}` : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Workspace-Id': WORKSPACE_ID },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const timesheets = {
  week: (token: string, weekStart: string, userId?: number) =>
    req<TimesheetWeek>('GET', '/week', token, { query: { weekStart, userId, tz: browserTz() } }),
  team: (token: string, weekStart: string) =>
    req<TimesheetTeam>('GET', '/team', token, { query: { weekStart, tz: browserTz() } }),
  setCell: (token: string, body: { userId?: number; projectId: number; date: string; seconds: number; note?: string; isBillable?: boolean }) =>
    req<TimesheetWeek>('PUT', '/cell', token, { body: { ...body, tz: browserTz() } }),
  submit: (token: string, weekStart: string) =>
    req<TimesheetWeek>('POST', '/week/submit', token, { body: { weekStart, tz: browserTz() } }),
  withdraw: (token: string, weekStart: string, userId?: number) =>
    req<TimesheetWeek>('POST', '/week/withdraw', token, { body: { weekStart, userId, tz: browserTz() } }),
  approve: (token: string, weekId: number) =>
    req<TimesheetWeek>('POST', `/weeks/${weekId}/approve`, token, { body: { tz: browserTz() } }),
  reject: (token: string, weekId: number, note: string) =>
    req<TimesheetWeek>('POST', `/weeks/${weekId}/reject`, token, { body: { note, tz: browserTz() } }),
  reopen: (token: string, weekId: number) =>
    req<TimesheetWeek>('POST', `/weeks/${weekId}/reopen`, token, { body: { tz: browserTz() } }),
}

/** "1.5", "1:30", "1h30", "90m", "45 min" → seconds. Empty → 0. Null when unreadable. */
export function parseHours(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return 0
  let m = s.match(/^(\d+):(\d{1,2})$/)
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60
  m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\s*(?:(\d+)\s*m(?:in)?s?)?$/)
  if (m) return Math.round(Number(m[1]) * 3600) + (m[2] ? Number(m[2]) * 60 : 0)
  m = s.match(/^(\d+)\s*m(?:in)?s?$/)
  if (m) return Number(m[1]) * 60
  m = s.match(/^\d*\.?\d+$/)
  if (m) return Math.round(Number(s) * 3600)
  return null
}

/** Seconds → "1:30" (blank for 0). */
export function formatHm(seconds: number): string {
  if (!seconds) return ''
  const mins = Math.round(seconds / 60)
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}

export const STATUS_LABEL: Record<TimesheetStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const STATUS_CLASS: Record<TimesheetStatus, string> = {
  DRAFT: 'bg-white/10 text-muted-foreground',
  SUBMITTED: 'bg-amber-500/15 text-amber-300',
  APPROVED: 'bg-emerald-500/15 text-emerald-300',
  REJECTED: 'bg-red-500/15 text-red-300',
}
