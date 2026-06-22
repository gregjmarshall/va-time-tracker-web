'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export default function RootPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted) router.replace(token ? '/dashboard' : '/login')
  }, [mounted, token, router])

  return null
}
