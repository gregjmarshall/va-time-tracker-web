export type Role = 'ADMIN' | 'MANAGER' | 'TEAM_MEMBER'

/** Role hierarchy, highest first: ADMIN > MANAGER > TEAM_MEMBER. */
export const ROLES: Role[] = ['ADMIN', 'MANAGER', 'TEAM_MEMBER']

/** MANAGER or above — can run clients, projects, retainers, reports and team members. */
export function isManagerial(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

/** ADMIN only — can also manage Admin/Manager accounts, workspace settings, billing rates and integrations. */
export function isAdmin(role: Role | undefined): boolean {
  return role === 'ADMIN'
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'ADMIN': return 'Admin'
    case 'MANAGER': return 'Manager'
    case 'TEAM_MEMBER': return 'Team member'
  }
}

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
  /** When true, time entries can't be saved without a description. */
  descriptionRequired: boolean
  createdAt: string
  /** TRIAL, ACTIVE, OVERDUE or SUSPENDED */
  status?: WorkspaceStatus
  trialEndsAt?: string
  createdVia?: 'SIGNUP' | 'INVITE'
}

export type WorkspaceStatus = 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED'

export interface SignupResponse {
  /** Missing when email verification is required. */
  auth?: AuthResponse
  workspaceId: number
  slug: string
  trialEndsAt?: string
  verificationRequired: boolean
}

export interface WorkspaceChoice {
  workspaceId: number
  name: string
  /** Tells apart agencies with the same name. */
  slug: string
}

export type InviteKind = 'ORG' | 'MEMBER'
export type InviteState = 'OPEN' | 'USED' | 'EXPIRED' | 'REVOKED'

export interface Invitation {
  invitationId: number
  kind: InviteKind
  email: string
  role: Role
  agencyName?: string
  workspaceId?: number
  state: InviteState
  expiresAt: string
  usedAt?: string
  createdAt: string
}

/** Only returned at creation: the link can't be fetched again. */
export interface CreatedInvitation {
  invitation: Invitation
  token: string
  url: string
  emailSent: boolean
}

export interface InviteLookup {
  kind: InviteKind
  email: string
  role: Role
  state: InviteState
  expiresAt: string
  workspaceName?: string
  agencyName?: string
  invitedBy?: string
}

export interface PricingTier {
  tier: number
  minMembers: number
  maxMembers?: number
  monthlyPrice?: number
  annualPrice?: number
  contactUs: boolean
}

export interface PricingModel {
  currency: string
  trialDays: number
  graceDays: number
  annualFreeMonths: number
  tiers: PricingTier[]
}

export interface ClientResponse {
  clientId: number
  workspaceId: number
  name: string
  contactEmail?: string
  isActive: boolean
  createdAt: string
  /** YYYY-MM-DD, when the client relationship started */
  clientSince?: string
}

/** Hours this month against an allowance. */
export interface RetainerUsage {
  retainerHours?: number
  actualHoursThisMonth: number
  percentUsed?: number
  isOver: boolean
}

export interface ProjectRetainerStatus extends RetainerUsage {
  projectId: number
  retainerHours: number
}

/**
 * This month's client-wide retainer. actualHoursThisMonth leaves out hours on projects with their own
 * retainer; those are in projectRetainers.
 */
export interface RetainerStatus extends RetainerUsage {
  projectRetainers?: ProjectRetainerStatus[]
}

export interface ClientWithRetainerResponse {
  client: ClientResponse
  retainerStatus: RetainerStatus
  /** Start of the most recent time entry on this client */
  lastTrackedAt?: string
}

export type RateType = 'HOURLY' | 'MONTHLY'
export type PaymentMethod = 'DIRECT_DEBIT' | 'ADVANCE_RETAINER' | 'ARREARS'
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  DIRECT_DEBIT: 'Direct debit',
  ADVANCE_RETAINER: 'Advance retainer',
  ARREARS: 'Arrears',
}

/** A client's rate and payment method (Admins only) */
export interface ClientBillingResponse {
  clientId: number
  rateType?: RateType
  rateAmount?: number
  currency: string
  paymentMethod?: PaymentMethod
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

/** A row of the Projects tab. For team members, hours are their own and memberIds is empty. */
export interface ProjectOverview {
  projectId: number
  clientId: number
  clientName: string
  name: string
  isActive: boolean
  budgetHours?: number | null
  hoursThisMonth: number
  totalHours: number
  lastTrackedAt?: string | null
  memberIds: number[]
}

/** One change in the audit trail */
export interface AuditEvent {
  eventId: number
  actorUserId?: number | null
  actorName: string
  action: string
  summary: string
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
  /** Logged while the user was covering this client for someone. */
  isCover?: boolean
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
  coverRoundedTotalSeconds: number
  coverRoundedTotalHours: number
  billableRoundedTotalSeconds: number
  billableRoundedTotalHours: number
}

export type ChartGranularity = 'day' | 'week' | 'month'

/** One bar of the billable vs non-billable chart; start is the bucket's first local date (YYYY-MM-DD). */
export interface ChartBucket {
  start: string
  billableHours: number
  nonBillableHours: number
}

export interface SummaryReportResponse {
  rows: SummaryRow[]
  chart?: { granularity: ChartGranularity; buckets: ChartBucket[] }
}

/** One entry of the itemised report */
export interface DetailedEntryRow {
  entryId: number
  userId: number
  userName: string
  clientId?: number | null
  clientName?: string | null
  projectId?: number | null
  projectName?: string | null
  description: string
  startedAt: string
  endedAt?: string | null
  durationSeconds?: number | null
  roundedDurationSeconds?: number | null
  isBillable: boolean
  isRunning: boolean
  isCover: boolean
}

export interface DetailedReportResponse {
  entries: DetailedEntryRow[]
  total: number
}

/** Filters shared by the summary, detailed and export reports */
export type ReportParams = {
  from?: string
  to?: string
  clientId?: number
  projectId?: number
  userId?: number
  billable?: boolean
  cover?: CoverFilter
  /** IANA zone used to bucket the chart by local day */
  tz?: string
}

export interface RetainerStatusRow {
  clientId: number
  clientName: string
  retainerHours?: number
  actualHours: number
  percentUsed?: number
  isOver: boolean
  /** Set on a project retainer row */
  projectId?: number
  projectName?: string
}

export interface RetainerReportResponse {
  rows: RetainerStatusRow[]
}

export interface RetainerResponse {
  retainerId: number
  clientId: number
  /** Null/absent for the client-wide retainer */
  projectId?: number | null
  workspaceId: number
  monthlyHours: number
  effectiveFrom: string
  effectiveTo?: string
  createdAt: string
}

/** One month of a retainer's allowance vs rounded hours used; `live` = the current month (not final). */
export interface RetainerHistoryMonth {
  /** "YYYY-MM" */
  month: string
  allowanceHours: number
  actualHours: number
  varianceHours: number
  isOver: boolean
  live: boolean
}

export interface RetainerHistoryResponse {
  clientId: number
  projectId?: number | null
  /** Oldest first; months without a retainer are left out */
  months: RetainerHistoryMonth[]
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
  /** When they last started tracking time; absent if never */
  lastTrackedAt?: string | null
}

export interface MemberAccess {
  projectIds: number[]
  clientIds: number[]
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

// ── Holiday cover ────────────────────────────────────────────────────────────

export type CoverStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED'
export type CoverFilter = 'include' | 'exclude' | 'only'

export interface HolidayCoverResponse {
  coverId: number
  userId: number
  userName: string
  clientId: number
  clientName: string
  startDate: string
  endDate?: string | null
  note?: string | null
  status: CoverStatus
  hoursLogged: number
}

// ── Capacity ─────────────────────────────────────────────────────────────────

export interface ClientCapacity {
  clientId: number | null
  clientName: string
  allocatedHours: number
  usedHours: number
  coverHours: number
}

export interface UserCapacity {
  userId: number
  userName: string
  allocatedHours: number
  usedHours: number
  remainingHours: number
  coverHours: number
  clients: ClientCapacity[]
}

export interface CapacityResponse {
  month: string
  rows: UserCapacity[]
}

export interface ClientManagersResponse {
  clientId: number
  userIds: number[]
}

/** Admin overview for a period; hours are rounded as billed */
export interface OverviewResponse {
  from: string
  to: string
  totalHours: number
  billableHours: number
  entryCount: number
  /** Highest hours first */
  clients: { clientId: number; clientName: string; hours: number }[]
  /** Highest hours first */
  members: { userId: number; name: string; hours: number }[]
}

/** A team member asking to be put on projects. name/email are filled in for Managers' list. */
export interface AccessRequest {
  requestId: number
  userId: number
  message: string | null
  createdAt: string
  name?: string | null
  email?: string | null
}
