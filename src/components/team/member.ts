import type { Role, UserResponse } from '@/lib/types'

export const memberName = (u: Pick<UserResponse, 'firstName' | 'lastName' | 'email'>) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email

export const memberInitials = (u: Pick<UserResponse, 'firstName' | 'lastName' | 'email'>) =>
  [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('').toUpperCase() || u.email[0].toUpperCase()

/**
 * Mirrors the backend rules (TeamService): Admins manage anyone, Managers only Team Members,
 * and nobody changes their own role or deactivates themselves.
 */
export function canManage(actor: { userId: number; role: Role }, target: UserResponse) {
  if (actor.userId === target.userId) return false
  return actor.role === 'ADMIN' || (actor.role === 'MANAGER' && target.role === 'TEAM_MEMBER')
}
