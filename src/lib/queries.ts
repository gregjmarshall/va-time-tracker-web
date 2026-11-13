import type { QueryClient } from '@tanstack/react-query'

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
