'use client'

import { useRouter } from 'next/navigation'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/lib/types'

/** Stores a fresh session token (after login, sign-up or invite accept) and goes to [to]. */
export function useCompleteLogin() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  return async (token: string, to = '/dashboard') => {
    const me = await auth.me(token)
    setAuth(token, {
      userId: me.userId,
      email: me.email,
      firstName: me.firstName,
      lastName: me.lastName,
      role: me.role as Role,
      workspaceId: me.workspaceId,
      fullVisibility: me.fullVisibility ?? false,
      isOwner: me.isOwner ?? false,
    })
    router.replace(to)
  }
}
