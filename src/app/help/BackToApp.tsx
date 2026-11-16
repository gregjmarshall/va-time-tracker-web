'use client'

import Link from 'next/link'
import { useAuthHydrated, useAuthStore } from '@/stores/auth'

/** "Back to pip" for signed-in users, "Sign in" for everyone else. */
export function BackToApp() {
  const hydrated = useAuthHydrated()
  const token = useAuthStore((s) => s.token)
  const signedIn = hydrated && !!token
  return (
    <Link
      href={signedIn ? '/dashboard' : '/login'}
      className="flex-shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
    >
      {signedIn ? '← Back to pip' : 'Sign in'}
    </Link>
  )
}
