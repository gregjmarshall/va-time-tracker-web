'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { accessRequests } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The signed-in person's open request to be put on projects, if any. */
export function useMyAccessRequest() {
  const { token } = useAuthStore()
  return useQuery({
    queryKey: ['access-request-mine', token],
    queryFn: async () => (await accessRequests.mine(token!)) ?? null,
    enabled: !!token,
  })
}

/**
 * "Ask to be added" for someone with no projects. Once asked it says so, instead of letting them
 * ask again; the request closes itself when a manager gives them access.
 */
export function RequestAccessButton({ className, size = 'default' }: { className?: string; size?: 'default' | 'sm' }) {
  const { token } = useAuthStore()
  const queryClient = useQueryClient()
  const { data: open, isLoading } = useMyAccessRequest()
  const ask = useMutation({
    mutationFn: () => accessRequests.create(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-request-mine'] })
      toast.success('Your manager has been told. Your projects will appear here once you’re added.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return null
  if (open) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        <span className="text-foreground font-medium">Asked to be added.</span> Your projects will appear here once your manager adds you.
      </p>
    )
  }
  return (
    <Button size={size} className={className} onClick={() => ask.mutate()} disabled={ask.isPending}>
      {ask.isPending ? 'Asking…' : 'Ask to be added to projects'}
    </Button>
  )
}
