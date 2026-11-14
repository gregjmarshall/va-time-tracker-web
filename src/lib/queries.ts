import { useQuery, type QueryClient } from '@tanstack/react-query'
import { workspace } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Query key roots whose data is derived from logged time. Any change to a time entry or timer
 * can move these numbers, including holiday cover hours and capacity used.
 */
const TIME_DERIVED_ROOTS = new Set([
  'active-timer',
  'timer-session',
  'time-entries',
  'time-entries-today',
  'time-entries-week',
  'time-entries-recent',
  'reports-summary',
  'reports-summary-week',
  'reports-summary-alltime',
  'reports-retainer',
  'clients-with-retainer',
  'client-activity',
  'holiday-cover',
  'holiday-cover-mine',
  'capacity',
  'capacity-mine',
])

/** Refetch everything that shows logged time. Call after creating, editing or deleting time. */
export function invalidateTimeData(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (q) => TIME_DERIVED_ROOTS.has(String(q.queryKey[0])),
  })
}

/** The signed-in user's workspace (settings such as whether descriptions are required). */
export function useWorkspace() {
  const { token } = useAuthStore()
  return useQuery({
    queryKey: ['workspace', token],
    queryFn: () => workspace.get(token!),
    enabled: !!token,
    staleTime: 60_000,
  })
}

/** Whether time entries need a description. Defaults to true until the workspace loads. */
export function useDescriptionRequired() {
  return useWorkspace().data?.descriptionRequired ?? true
}
