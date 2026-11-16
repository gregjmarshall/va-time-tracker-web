'use client'

import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '@/lib/types'

interface AuthUser {
  userId: number
  email: string
  firstName?: string
  lastName?: string
  role: Role
  workspaceId: number
  fullVisibility?: boolean
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'va-tracker-auth' }
  )
)

/**
 * True once the persisted auth state has been read from localStorage.
 * Always false on the server and during hydration, so the first client render
 * matches the server HTML; then it flips to true without a setState-in-effect.
 */
export function useAuthHydrated() {
  return useSyncExternalStore(
    (onChange) => useAuthStore.persist.onFinishHydration(onChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  )
}
