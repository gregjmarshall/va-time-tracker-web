export type Role = 'VA' | 'MANAGER'
export type RoundingMode = 'NONE' | 'UP' | 'DOWN' | 'NEAREST'

export interface AuthResponse {
  token: string
  email: string
  firstName?: string
  lastName?: string
  role: Role
  workspaceId: number
}

export interface MeResponse {
  userId: number
  email: string
  firstName?: string
  lastName?: string
  role: Role
  workspaceId: number
  isActive: boolean
}

export interface WorkspaceResponse {
  workspaceId: number
  name: string
  slug: string
  subdomain: string
  logoUrl?: string
  primaryColor?: string
  createdAt: string
}

export interface ClientResponse {
  clientId: number
  workspaceId: number
  name: string
  contactEmail?: string
  isActive: boolean
  createdAt: string
}

export interface RetainerStatus {
  retainerHours?: number
  actualHoursThisMonth: number
  percentUsed?: number
  isOver: boolean
}

export interface ClientWithRetainerResponse {
  client: ClientResponse
  retainerStatus: RetainerStatus
}

export interface ProjectResponse {
  projectId: number
  clientId: number
  workspaceId: number
  name: string
  isActive: boolean
  budgetHours?: number
  createdAt: string
}

export interface TimerSessionResponse {
  sessionId: number
  accumulatedSeconds: number
  entryIds: number[]
  description: string
  projectId: number | null
}

export interface TimeEntryResponse {
  entryId: number
  workspaceId: number
  userId: number
  projectId: number | null
  description: string
  startedAt: string
  endedAt?: string
  durationSeconds?: number
  roundedDurationSeconds?: number
  roundingMode: RoundingMode
  roundingMinutes: number
  isBillable: boolean
  isRunning: boolean
  createdAt: string
}

export interface PagedTimeEntryResponse {
  entries: TimeEntryResponse[]
  total: number
  page: number
  size: number
}

export interface SummaryRow {
  clientId: number
  clientName: string
  projectId: number
  projectName: string
  totalSeconds: number
  totalHours: number
  roundedTotalSeconds: number
  roundedTotalHours: number
}

export interface SummaryReportResponse {
  rows: SummaryRow[]
}

export interface RetainerStatusRow {
  clientId: number
  clientName: string
  retainerHours?: number
  actualHours: number
  percentUsed?: number
  isOver: boolean
}

export interface RetainerReportResponse {
  rows: RetainerStatusRow[]
}

export interface RetainerResponse {
  retainerId: number
  clientId: number
  workspaceId: number
  monthlyHours: number
  effectiveFrom: string
  effectiveTo?: string
  createdAt: string
}

export interface BillingRateResponse {
  rateId: number
  workspaceId: number
  clientId?: number
  projectId?: number
  userId?: number
  hourlyRate: number
  currency: string
  effectiveFrom: string
  createdAt: string
}

export interface UserResponse {
  userId: number
  workspaceId: number
  email: string
  firstName?: string
  lastName?: string
  role: Role
  isActive: boolean
  fullVisibility: boolean
  emailVerified: boolean
  createdAt: string
}

export interface ClientActivityRunningEntry {
  entryId: number
  userId: number
  userName: string
  description: string
  startedAt: string
}

export interface ClientActivityRecentEntry {
  entryId: number
  userId: number
  userName: string
  description: string
  startedAt: string
  endedAt: string
  durationSeconds: number
}

export interface ClientActivityProject {
  projectId: number
  projectName: string
  budgetHours?: number
  runningEntries: ClientActivityRunningEntry[]
  recentEntries: ClientActivityRecentEntry[]
}

export interface ClientActivityResponse {
  clientId: number
  clientName: string
  projects: ClientActivityProject[]
}

export interface SlackConfigResponse {
  configId: number
  workspaceId: number
  clientId?: number
  webhookUrl: string
  notifyOn: string
  thresholdPct: number
  isActive: boolean
  createdAt: string
}
