'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { AuthShell } from '@/components/auth/AuthShell'
import { useWorkspace } from '@/lib/queries'
import { useAuthHydrated, useAuthStore } from '@/stores/auth'

/** Placeholder for the setup wizard (wave 2: branding, invite team, CSV import, rates). */
export default function WelcomePage() {
  const router = useRouter()
  const { token, user } = useAuthStore()
  const hydrated = useAuthHydrated()
  const { data: ws } = useWorkspace()

  useEffect(() => {
    if (hydrated && !token) router.replace('/login')
  }, [hydrated, token, router])
  if (!hydrated || !token) return null

  const trialEnds = ws?.trialEndsAt ? new Date(ws.trialEndsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <AuthShell subtitle={`Welcome${user?.firstName ? `, ${user.firstName}` : ''}!`}>
      <div className="space-y-4 text-sm">
        <p><strong>{ws?.name ?? 'Your agency'}</strong> is ready.{trialEnds && <> Your free trial runs until <strong>{trialEnds}</strong>.</>}</p>
        <p className="text-muted-foreground">A guided setup (branding, inviting your team, importing clients) is coming soon. For now:</p>
        <div className="grid gap-2">
          <Link href="/dashboard/users" className={buttonVariants({ variant: 'outline' })}>Invite your team</Link>
          <Link href="/dashboard/clients" className={buttonVariants({ variant: 'outline' })}>Add your clients</Link>
          <Link href="/dashboard" className={buttonVariants()}>Go to dashboard</Link>
        </div>
      </div>
    </AuthShell>
  )
}
