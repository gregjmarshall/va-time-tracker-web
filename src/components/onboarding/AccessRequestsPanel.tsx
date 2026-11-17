'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { toast } from 'sonner'
import { accessRequests } from '@/lib/api'
import type { UserResponse } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

dayjs.extend(relativeTime)

/** Open requests to be put on projects; Managers and Admins only. Shared with the nav badge. */
export function useOpenAccessRequests(enabled = true) {
  const { token } = useAuthStore()
  return useQuery({
    queryKey: ['access-requests', token],
    queryFn: () => accessRequests.list(token!),
    enabled: !!token && enabled,
    refetchInterval: 60_000,
  })
}

/** Team page: people waiting to be put on projects, with "Give access" opening the access dialog. */
export function AccessRequestsPanel({ members, onGiveAccess }: {
  members: UserResponse[]
  onGiveAccess: (member: UserResponse) => void
}) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const { data: requests = [] } = useOpenAccessRequests()
  const dismiss = useMutation({
    mutationFn: (userId: number) => accessRequests.dismiss(token!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] })
      queryClient.invalidateQueries({ queryKey: ['member-history'] })
      toast.success('Request dismissed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const byId = new Map(members.map((m) => [m.userId, m]))
  const rows = requests.filter((r) => byId.has(r.userId))
  if (rows.length === 0) return null

  return (
    <section className="rounded-lg border border-primary/30 bg-primary/[0.06] mb-6" aria-labelledby="access-requests-title">
      <h2 id="access-requests-title" className="text-sm font-semibold px-4 pt-3.5 pb-2">
        Waiting for access <span className="num text-muted-foreground font-normal">({rows.length})</span>
      </h2>
      <ul className="divide-y divide-border/60">
        {rows.map((r) => {
          const member = byId.get(r.userId)!
          return (
            <li key={r.requestId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="flex-1 min-w-48">
                <p className="text-sm"><span className="font-medium">{r.name}</span> asked to be added to projects</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dayjs(r.createdAt).fromNow()}{r.message ? <> · “{r.message}”</> : null}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(r.userId)} disabled={dismiss.isPending}>Dismiss</Button>
                <Button size="sm" onClick={() => onGiveAccess(member)}>Give access</Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
