'use client'

import { useAuthStore } from '@/stores/auth'
import { WorkerDashboard } from '@/components/dashboard/WorkerDashboard'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return user.role === 'VA' ? <WorkerDashboard /> : <AdminDashboard />
}
