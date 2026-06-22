import type {
  AuthResponse,
  BillingRateResponse,
  ClientResponse,
  ClientWithRetainerResponse,
  PagedTimeEntryResponse,
  ProjectResponse,
  RetainerReportResponse,
  RetainerResponse,
  RetainerStatusRow,
  RoundingMode,
  SlackConfigResponse,
  SummaryReportResponse,
  TimeEntryResponse,
  TimerSessionResponse,
  UserResponse,
  WorkspaceResponse,
} from './types'

const BASE = ''  // empty = relative URLs, proxied by Next.js rewrites
const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID ?? '1'

async function req<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}
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
      'X-Workspace-Id': WORKSPACE_ID,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    req<AuthResponse>('POST', '/api/auth/login-workspace', { body: { email, password } }),

  register: (body: { workspaceId: number; email: string; password: string; firstName?: string; lastName?: string; role?: string }) =>
    req<AuthResponse>('POST', '/api/auth/register', { body }),

  me: (token: string) =>
    req<{ userId: number; email: string; firstName?: string; lastName?: string; role: string; workspaceId: number; isActive: boolean }>(
      'GET', '/api/auth/me', { token }
    ),

  requestPasswordReset: (email: string) =>
    req<void>('POST', '/api/auth/request-password-reset', { body: { email } }),

  resetPassword: (token: string, password: string) =>
    req<void>('POST', '/api/auth/reset-password', { body: { token, password } }),
}

// Workspace
export const workspace = {
  get: (token: string) => req<WorkspaceResponse>('GET', '/api/workspace', { token }),
}

// Clients
export const clients = {
  list: (token: string) => req<ClientResponse[]>('GET', '/api/clients', { token }),
  get: (token: string, clientId: number) =>
    req<ClientWithRetainerResponse>('GET', `/api/clients/${clientId}`, { token }),
  create: (token: string, body: { name: string; contactEmail?: string }) =>
    req<ClientResponse>('POST', '/api/clients', { token, body }),
  update: (token: string, clientId: number, body: { name?: string; contactEmail?: string; isActive?: boolean }) =>
    req<ClientResponse>('PUT', `/api/clients/${clientId}`, { token, body }),
  deactivate: (token: string, clientId: number) =>
    req<void>('DELETE', `/api/clients/${clientId}`, { token }),
}

// Projects
export const projects = {
  list: (token: string, clientId?: number) =>
    req<ProjectResponse[]>('GET', '/api/projects', { token, query: clientId ? { clientId } : {} }),
  create: (token: string, body: { clientId: number; name: string; budgetHours?: number }) =>
    req<ProjectResponse>('POST', '/api/projects', { token, body }),
  update: (token: string, projectId: number, body: { name?: string; isActive?: boolean }) =>
    req<ProjectResponse>('PUT', `/api/projects/${projectId}`, { token, body }),
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
  summary: (token: string, params: { from?: string; to?: string; clientId?: number; userId?: number } = {}) =>
    req<SummaryReportResponse>('GET', '/api/reports/summary', { token, query: params }),

  detailed: (token: string, params: { from?: string; to?: string; clientId?: number; userId?: number; page?: number; size?: number } = {}) =>
    req<PagedTimeEntryResponse>('GET', '/api/reports/detailed', { token, query: params }),

  retainer: (token: string) =>
    req<RetainerReportResponse>('GET', '/api/reports/retainer', { token }),

  exportCsv: (token: string, year?: number) =>
    req<string>('GET', '/api/reports/export/spreadsheet', { token, query: year ? { year } : {} }),
}

// Retainers
export const retainers = {
  list: (token: string, clientId?: number) =>
    req<RetainerResponse[]>('GET', '/api/retainers', { token, query: clientId ? { clientId } : {} }),
  create: (token: string, body: { clientId: number; monthlyHours: number; effectiveFrom: string; effectiveTo?: string }) =>
    req<RetainerResponse>('POST', '/api/retainers', { token, body }),
  update: (token: string, retainerId: number, body: { monthlyHours?: number; effectiveTo?: string }) =>
    req<RetainerResponse>('PUT', `/api/retainers/${retainerId}`, { token, body }),
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
  list: (token: string) => req<UserResponse[]>('GET', '/api/users', { token }),
  update: (token: string, userId: number, body: { role?: string; isActive?: boolean; firstName?: string; lastName?: string }) =>
    req<UserResponse>('PUT', `/api/users/${userId}`, { token, body }),
  deactivate: (token: string, userId: number) =>
    req<void>('DELETE', `/api/users/${userId}`, { token }),
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
