'use client'

import Link from 'next/link'
import { useAuthHydrated, useAuthStore } from '@/stores/auth'

function useSignedIn() {
  const hydrated = useAuthHydrated()
  const token = useAuthStore((s) => s.token)
  return hydrated && !!token
}

/** pip logo: back to the app (dashboard when signed in, sign-in otherwise). */
export function AppLogoLink({ children }: { children: React.ReactNode }) {
  const signedIn = useSignedIn()
  return (
    <Link
      href={signedIn ? '/dashboard' : '/login'}
      className="flex items-center gap-2.5 flex-shrink-0"
      aria-label={signedIn ? 'Back to pip' : 'Sign in to pip'}
    >
      {children}
    </Link>
  )
}

/** "Back to pip" for signed-in users, "Sign in" for everyone else. */
export function BackToApp() {
  const signedIn = useSignedIn()
  return (
    <Link
      href={signedIn ? '/dashboard' : '/login'}
      className="flex-shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm font-semibold text-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors whitespace-nowrap"
    >
      {signedIn ? '← Back to pip' : 'Sign in'}
    </Link>
  )
}
