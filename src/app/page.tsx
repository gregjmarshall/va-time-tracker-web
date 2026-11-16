'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, useAuthHydrated } from '@/stores/auth'

export default function RootPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const mounted = useAuthHydrated()

  useEffect(() => {
    if (mounted) router.replace(token ? '/dashboard' : '/login')
  }, [mounted, token, router])

  return null
}
