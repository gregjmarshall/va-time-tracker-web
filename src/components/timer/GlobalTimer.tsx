'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { clients as clientsApi, projects as projectsApi, timeEntries, timerSession as timerSessionApi } from '@/lib/api'
import { invalidateTimeData } from '@/lib/queries'
import { useAuthStore } from '@/stores/auth'
import type { TimerSessionResponse } from '@/lib/types'
import { TimerBar } from './TimerBar'

/**
 * The timer bar at the top of every dashboard page. Waits for the running entry and any paused
 * session to load, because TimerBar reads its starting state from them once.
 */
export function GlobalTimer() {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()

  const active = useQuery({
    queryKey: ['active-timer', token],
    queryFn: async () => { try { return await timeEntries.active(token!) } catch { return null } },
    enabled: !!token,
    refetchInterval: 30_000,
  })
  const session = useQuery<TimerSessionResponse | null>({
    queryKey: ['timer-session', token],
    queryFn: async () => { try { return await timerSessionApi.get(token!) } catch { return null } },
    enabled: !!token,
    staleTime: Infinity,
  })
  const { data: projectList = [] } = useQuery({
    queryKey: ['projects', token],
    queryFn: () => projectsApi.list(token!),
    enabled: !!token,
  })
  const { data: clientList = [] } = useQuery({
    queryKey: ['clients', token],
    queryFn: () => clientsApi.list(token!),
    enabled: !!token,
  })

  if (!active.isFetched || !session.isFetched) {
    return <div className="h-10 flex-1 min-w-0 rounded-lg bg-white/5 animate-pulse" aria-hidden />
  }

  return (
    <TimerBar
      activeEntry={active.data ?? null}
      pausedSession={session.data ?? null}
      projectList={projectList}
      clientList={clientList}
      onChanged={() => { invalidateTimeData(queryClient); active.refetch() }}
    />
  )
}
