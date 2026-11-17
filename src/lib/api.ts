import type {
  AuthResponse,
  BillingRateResponse,
  CapacityResponse,
  ClientActivityResponse,
  ClientManagersResponse,
  ClientResponse,
  MemberAccess,
  ProjectOverview,
  AuditEvent,
  AccessRequest,
  ClientWithRetainerResponse,
  ClientBillingResponse,
  PaymentMethod,
  RateType,
  DetailedReportResponse,
  HolidayCoverResponse,
  OverviewResponse,
  PagedTimeEntryResponse,
  ProjectResponse,
  ReportParams,
  RetainerReportResponse,
  RetainerHistoryResponse,
  RetainerResponse,
  RetainerStatusRow,
  RoundingMode,
  SlackConfigResponse,
  SummaryReportResponse,
  TimeEntryResponse,
  TimerSessionResponse,
  UserResponse,
  WorkspaceResponse,
  SignupResponse,
  InviteKind,
  Invitation,
  CreatedInvitation,
  InviteLookup,
  PricingModel,
  Role,
} from './types'

const BASE = ''  // empty = relative URLs, forwarded to the backend by src/proxy.ts
const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID ?? '1'

/** A failed API call; [body] is the parsed JSON error (e.g. workspace choices on a 409 login). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message)
  }
}

async function req<T>(
  method: string,
  path: string,
  opts: {
    token?: string
    body?: unknown
    query?: Record<string, string | number | boolean | undefined>
    /** Overrides the X-Workspace-Id header (login into a chosen workspace). */
    workspaceId?: number
  } = {}
): Promise<T> {
  let url = `${BASE}${path}`
  if (opts.query) {
    const params = new URLSearchParams()
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, String(v))
    })
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      'X-Workspace-Id': opts.workspaceId != null ? String(opts.workspaceId) : WORKSPACE_ID,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new ApiError((err as { message?: string }).message ?? res.statusText, res.status, err)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Auth
export const auth = {
  /** Finds the workspace from the email. A 409 ApiError carries `{ workspaces: WorkspaceChoice[] }` when there are several. */
  login: (email: string, password: string) =>
    req<AuthResponse>('POST', '/api/auth/login', { body: { email, password } }),

  loginWorkspace: (workspaceId: number, email: string, password: string) =>
    req<AuthResponse>('POST', '/api/auth/login-workspace', { body: { email, password }, workspaceId }),

  /** Public self-serve sign-up: new agency on a trial + its Admin. `website` is a honeypot (leave empty). */
  signup: (body: { agencyName: string; name: string; email: string; password: string; website?: string }) =>
    req<SignupResponse>('POST', '/api/auth/signup', { body }),

  /** Create an account. Needs a Manager/Admin token (the backend refuses anonymous sign-up once a workspace has users). */
  register: (token: string, body: { workspaceId: number; email: string; password: string; firstName?: string; lastName?: string; role?: string }) =>
    req<AuthResponse>('POST', '/api/auth/register', { token, body }),

  me: (token: string) =>
    req<{ userId: number; email: string; firstName?: string; lastName?: string; role: string; workspaceId: number; isActive: boolean; fullVisibility: boolean; isOwner?: boolean }>(
      'GET', '/api/auth/me', { token }
    ),

  requestPasswordReset: (email: string) =>
    req<void>('POST', '/api/auth/request-password-reset', { body: { email } }),

  resetPassword: (token: string, password: string) =>
    req<void>('POST', '/api/auth/reset-password', { body: { token, password } }),
}

// Invite links (MEMBER: Admins/Managers; ORG: platform owners)
export const invitations = {
  create: (token: string, body: { kind?: InviteKind; email: string; role?: Role; agencyName?: string }) =>
    req<CreatedInvitation>('POST', '/api/invitations', { token, body }),
  list: (token: string, kind: InviteKind = 'MEMBER') =>
    req<Invitation[]>('GET', '/api/invitations', { token, query: { kind } }),
  revoke: (token: string, invitationId: number) =>
    req<void>('DELETE', `/api/invitations/${invitationId}`, { token }),
  lookup: (inviteToken: string) =>
    req<InviteLookup>('GET', `/api/invitations/lookup/${encodeURIComponent(inviteToken)}`),
  accept: (body: { token: string; name: string; password: string; agencyName?: string }) =>
    req<AuthResponse>('POST', '/api/invitations/accept', { body }),
}

/** Public price list (from backend config). */
export const pricing = {
  get: () => req<PricingModel>('GET', '/api/pricing'),
}

// Workspace
export const workspace = {
  get: (token: string) => req<WorkspaceResponse>('GET', '/api/workspace', { token }),
  update: (token: string, body: { name?: string; descriptionRequired?: boolean }) =>
    req<WorkspaceResponse>('PUT', '/api/workspace', { token, body }),
}

// Clients
export const clients = {
  list: (token: string) => req<ClientResponse[]>('GET', '/api/clients', { token }),
  get: (token: string, clientId: number) =>
    req<ClientWithRetainerResponse>('GET', `/api/clients/${clientId}`, { token }),
  create: (token: string, body: { name: string; contactEmail?: string; clientSince?: string }) =>
    req<ClientResponse>('POST', '/api/clients', { token, body }),
  update: (token: string, clientId: number, body: { name?: string; contactEmail?: string; isActive?: boolean; clientSince?: string }) =>
    req<ClientResponse>('PUT', `/api/clients/${clientId}`, { token, body }),
  deactivate: (token: string, clientId: number) =>
    req<void>('DELETE', `/api/clients/${clientId}`, { token }),
}

// Client rate and payment method (Admins only)
export const clientBilling = {
  list: (token: string) => req<ClientBillingResponse[]>('GET', '/api/client-billing', { token }),
  /** Replaces all fields; omit one to clear it */
  update: (token: string, clientId: number, body: { rateType?: RateType; rateAmount?: number; paymentMethod?: PaymentMethod }) =>
    req<ClientBillingResponse>('PUT', `/api/client-billing/${clientId}`, { token, body }),
}

// Projects
export const projects = {
  list: (token: string, clientId?: number) =>
    req<ProjectResponse[]>('GET', '/api/projects', { token, query: clientId ? { clientId } : {} }),
  create: (token: string, body: { clientId: number; name: string; budgetHours?: number }) =>
    req<ProjectResponse>('POST', '/api/projects', { token, body }),
  /** budgetHours undefined = unchanged; clearBudget removes it */
  update: (token: string, projectId: number, body: { name?: string; isActive?: boolean; budgetHours?: number; clearBudget?: boolean }) =>
    req<ProjectResponse>('PUT', `/api/projects/${projectId}`, { token, body }),
  /** Projects tab: managers get every project with hours and team; team members their own projects and time */
  overview: (token: string) =>
    req<ProjectOverview[]>('GET', '/api/projects/overview', { token, query: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
  team: (token: string, projectId: number) =>
    req<{ userIds: number[] }>('GET', `/api/projects/${projectId}/team`, { token }),
  /** Replaces who is assigned to the project */
  setTeam: (token: string, projectId: number, userIds: number[]) =>
    req<{ userIds: number[] }>('PUT', `/api/projects/${projectId}/team`, { token, body: { userIds } }),
  /** Who changed what and when, newest first */
  history: (token: string, projectId: number) =>
    req<AuditEvent[]>('GET', `/api/projects/${projectId}/history`, { token }),
  deactivate: (token: string, projectId: number) =>
    req<void>('DELETE', `/api/projects/${projectId}`, { token }),
  assign: (token: string, projectId: number, userId: number) =>
    req<void>('POST', `/api/projects/${projectId}/assign/${userId}`, { token }),
  unassign: (token: string, projectId: number, userId: number) =>
    req<void>('DELETE', `/api/projects/${projectId}/assign/${userId}`, { token }),
  listAssignments: (token: string, projectId: number) =>
    req<{ userId: number; assignmentId: number }[]>('GET', `/api/projects/${projectId}/assignments`, { token }),
}

// Time Entries
export const timeEntries = {
  list: (
    token: string,
    params: { userId?: number; projectId?: number; from?: string; to?: string; page?: number; size?: number }
  ) => req<PagedTimeEntryResponse>('GET', '/api/time-entries', { token, query: params }),

  create: (
    token: string,
    body: {
      projectId: number
      description: string
      startedAt: string
      endedAt: string
      roundingMode?: RoundingMode
      roundingMinutes?: number
      isBillable?: boolean
    }
  ) => req<TimeEntryResponse>('POST', '/api/time-entries', {
    token,
    body: { roundingMode: 'NONE', roundingMinutes: 15, isBillable: true, ...body },
  }),

  update: (
    token: string,
    entryId: number,
    body: {
      description?: string
      projectId?: number
      startedAt?: string
      endedAt?: string
      isBillable?: boolean
      roundingMode?: RoundingMode
      roundingMinutes?: number
    }
  ) => req<TimeEntryResponse>('PUT', `/api/time-entries/${entryId}`, { token, body }),

  delete: (token: string, entryId: number) =>
    req<void>('DELETE', `/api/time-entries/${entryId}`, { token }),

  start: (
    token: string,
    body: { projectId?: number; description?: string; roundingMode?: RoundingMode; roundingMinutes?: number; isBillable?: boolean }
  ) => req<TimeEntryResponse>('POST', '/api/time-entries/start', {
    token,
    body: { roundingMode: 'NONE', roundingMinutes: 15, isBillable: true, ...body },
  }),

  stop: (token: string, projectId?: number) =>
    req<TimeEntryResponse>('POST', '/api/time-entries/stop', {
      token,
      body: projectId ? { projectId } : undefined,
    }),

  active: (token: string) =>
    req<TimeEntryResponse>('GET', '/api/time-entries/active', { token }),
}

// Reports
export const reports = {
  summary: (token: string, params: ReportParams = {}) =>
    req<SummaryReportResponse>('GET', '/api/reports/summary', { token, query: params }),

  /** Itemised entries, newest first */
  detailed: (token: string, params: ReportParams & { page?: number; size?: number } = {}) =>
    req<DetailedReportResponse>('GET', '/api/reports/detailed', { token, query: params }),

  retainer: (token: string) =>
    req<RetainerReportResponse>('GET', '/api/reports/retainer', { token }),

  /** Totals, hours per client and per team member for a period (Managers and Admins) */
  overview: (token: string, params: { from: string; to?: string }) =>
    req<OverviewResponse>('GET', '/api/reports/overview', { token, query: params }),

  exportCsv: (token: string, year?: number) =>
    req<string>('GET', '/api/reports/export/spreadsheet', { token, query: year ? { year } : {} }),
}

// Calendar
export type BankHolidayRegion = 'england-and-wales' | 'scotland' | 'northern-ireland'
export interface BankHolidaysResponse {
  region: BankHolidayRegion
  /** 'gov.uk' live feed (cached daily) or 'fallback' bundled list */
  source: 'gov.uk' | 'fallback'
  holidays: { date: string; title: string }[]
}
export const calendar = {
  /** UK bank holidays for a region (default England & Wales) */
  bankHolidays: (region: BankHolidayRegion = 'england-and-wales') =>
    req<BankHolidaysResponse>('GET', '/api/calendar/bank-holidays', { query: { region } }),
}

// Retainers
export const retainers = {
  /** History, newest first (Managers and Admins) */
  list: (token: string, clientId?: number) =>
    req<RetainerResponse[]>('GET', '/api/retainers', { token, query: clientId ? { clientId } : {} }),
  /** Sets monthly hours from a month ("YYYY-MM") onwards; projectId for a project retainer */
  set: (token: string, body: { clientId: number; projectId?: number | null; monthlyHours: number; effectiveFrom: string }) =>
    req<RetainerResponse>('POST', '/api/retainers', { token, body }),
  /** Makes the client or project ad hoc from a month onwards */
  end: (token: string, body: { clientId: number; projectId?: number | null; effectiveFrom: string }) =>
    req<void>('POST', '/api/retainers/end', { token, body }),
  /** Corrects one period's hours */
  update: (token: string, retainerId: number, body: { monthlyHours: number }) =>
    req<RetainerResponse>('PUT', `/api/retainers/${retainerId}`, { token, body }),
  /** Month-by-month allowance vs used: month-end snapshots, plus live for this month */
  history: (token: string, clientId: number, projectId?: number | null, months = 12) =>
    req<RetainerHistoryResponse>('GET', '/api/retainers/history', {
      token, query: projectId ? { clientId, projectId, months } : { clientId, months },
    }),
}

// Billing Rates
export const billingRates = {
  list: (token: string) => req<BillingRateResponse[]>('GET', '/api/billing-rates', { token }),
  create: (token: string, body: { clientId?: number; projectId?: number; userId?: number; hourlyRate: number; currency?: string; effectiveFrom: string }) =>
    req<BillingRateResponse>('POST', '/api/billing-rates', { token, body }),
  delete: (token: string, rateId: number) =>
    req<void>('DELETE', `/api/billing-rates/${rateId}`, { token }),
}

// Users
export const users = {
  /** Active accounts; includeInactive adds deactivated ones (Team page) */
  list: (token: string, opts: { includeInactive?: boolean } = {}) =>
    req<UserResponse[]>('GET', '/api/users', { token, query: opts.includeInactive ? { includeInactive: true } : undefined }),
  /** Projects the member is assigned to and clients they can see */
  access: (token: string, userId: number) =>
    req<MemberAccess>('GET', `/api/users/${userId}/access`, { token }),
  /** Replaces the member's assignments and client visibility with exactly these ids */
  setAccess: (token: string, userId: number, body: MemberAccess) =>
    req<MemberAccess>('PUT', `/api/users/${userId}/access`, { token, body }),
  /** Who changed what about this person and when, newest first */
  history: (token: string, userId: number) =>
    req<AuditEvent[]>('GET', `/api/users/${userId}/history`, { token }),
  update: (token: string, userId: number, body: { role?: string; isActive?: boolean; firstName?: string; lastName?: string; fullVisibility?: boolean }) =>
    req<UserResponse>('PUT', `/api/users/${userId}`, { token, body }),
  deactivate: (token: string, userId: number) =>
    req<void>('DELETE', `/api/users/${userId}`, { token }),
}

// Access requests: a team member asking to be put on projects
export const accessRequests = {
  /** Asking again while one is open returns the open one */
  create: (token: string, message?: string) =>
    req<AccessRequest>('POST', '/api/access-requests', { token, body: { message: message ?? null } }),
  /** The caller's open request, or undefined */
  mine: (token: string) => req<AccessRequest | undefined>('GET', '/api/access-requests/mine', { token }),
  /** Open requests in the workspace (Managers/Admins) */
  list: (token: string) => req<AccessRequest[]>('GET', '/api/access-requests', { token }),
  dismiss: (token: string, userId: number) =>
    req<void>('POST', `/api/access-requests/user/${userId}/dismiss`, { token }),
}

export const me = {
  /** Recent changes others made to what you can access, newest first */
  updates: (token: string) => req<AuditEvent[]>('GET', '/api/me/updates', { token }),
}

// Client team access
export const clientTeamAccess = {
  list: (token: string, clientId: number) =>
    req<{ userIds: number[] }>('GET', `/api/clients/${clientId}/team-access/`, { token }),
  grant: (token: string, clientId: number, userId: number) =>
    req<void>('POST', `/api/clients/${clientId}/team-access/${userId}`, { token }),
  revoke: (token: string, clientId: number, userId: number) =>
    req<void>('DELETE', `/api/clients/${clientId}/team-access/${userId}`, { token }),
  activity: (token: string, clientId: number) =>
    req<ClientActivityResponse>('GET', `/api/clients/${clientId}/team-access/activity`, { token }),
  myClients: (token: string) =>
    req<{ clientIds: number[] }>('GET', '/api/team-access/my-clients', { token }),
}

// Timer session (persisted pause state)
export const timerSession = {
  get: (token: string) => req<TimerSessionResponse>('GET', '/api/timer-session', { token }),
  save: (token: string, body: { accumulatedSeconds: number; entryIds: number[]; description: string; projectId?: number | null }) =>
    req<TimerSessionResponse>('POST', '/api/timer-session', { token, body }),
  clear: (token: string) => req<void>('DELETE', '/api/timer-session', { token }),
}

// Suggestions
export const suggestions = {
  search: (token: string, q: string) =>
    req<{ suggestions: string[] }>('GET', '/api/suggestions', { token, query: { q } }),
}

// Slack
export const slack = {
  listConfigs: (token: string) => req<SlackConfigResponse[]>('GET', '/api/slack/config', { token }),
  createConfig: (token: string, body: { clientId?: number; webhookUrl: string; notifyOn?: string; thresholdPct?: number }) =>
    req<SlackConfigResponse>('POST', '/api/slack/config', { token, body }),
  deleteConfig: (token: string, configId: number) =>
    req<void>('DELETE', `/api/slack/config/${configId}`, { token }),
}

// Holiday cover
export const holidayCover = {
  list: (token: string) => req<HolidayCoverResponse[]>('GET', '/api/holiday-cover', { token }),
  mine: (token: string) => req<HolidayCoverResponse[]>('GET', '/api/holiday-cover/mine', { token }),
  create: (token: string, body: { userId: number; clientIds: number[]; startDate: string; endDate?: string; note?: string }) =>
    req<HolidayCoverResponse[]>('POST', '/api/holiday-cover', { token, body }),
  update: (token: string, coverId: number, body: { startDate?: string; endDate?: string; clearEndDate?: boolean; note?: string }) =>
    req<HolidayCoverResponse>('PUT', `/api/holiday-cover/${coverId}`, { token, body }),
  end: (token: string, coverId: number) =>
    req<HolidayCoverResponse | undefined>('POST', `/api/holiday-cover/${coverId}/end`, { token }),
  delete: (token: string, coverId: number) =>
    req<void>('DELETE', `/api/holiday-cover/${coverId}`, { token }),
}

// Capacity
export const capacity = {
  get: (token: string, params: { month?: string; userId?: number } = {}) =>
    req<CapacityResponse>('GET', '/api/capacity', { token, query: params }),
  setAllocation: (token: string, body: { userId: number; clientId: number; monthlyHours: number; fromMonth?: string }) =>
    req<void>('PUT', '/api/capacity/allocations', { token, body }),
}

// Client managers (who oversees which client)
export const clientManagers = {
  list: (token: string) => req<ClientManagersResponse[]>('GET', '/api/client-managers', { token }),
  set: (token: string, clientId: number, userIds: number[]) =>
    req<ClientManagersResponse>('PUT', `/api/client-managers/${clientId}`, { token, body: { userIds } }),
}
