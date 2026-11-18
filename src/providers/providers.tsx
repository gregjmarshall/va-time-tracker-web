'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  )

  // Cached data belongs to one account. When the signed-in account changes (sign out, sign in
  // as someone else, accept an invite), drop it so nothing from the last account shows.
  useEffect(() => {
    const id = (u: { workspaceId: number; userId: number } | null) => (u ? `${u.workspaceId}:${u.userId}` : '')
    return useAuthStore.subscribe((state, prev) => {
      if (id(state.user) !== id(prev.user)) queryClient.clear()
    })
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  )
}
