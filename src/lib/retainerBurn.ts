import dayjs, { type Dayjs } from 'dayjs'

/** over = used more than the allowance; red = high risk of not using it; early = too soon in the month to tell. */
export type BurnStatus = 'over' | 'red' | 'amber' | 'green' | 'early'

export interface RetainerBurn {
  status: BurnStatus
  /** Actual hours as a share of where they'd be at an even pace by now (1 = on pace) */
  pace: number | null
  /** Hours per working day needed from today to use the rest of the allowance */
  neededPerDay: number
  /** Working days left this month, including today */
  daysLeft: number
}

const isWorkingDay = (d: Dayjs) => d.day() !== 0 && d.day() !== 6

/** Mon–Fri days of [today]'s month, split into before today and today onwards. Bank holidays aren't excluded. */
export function workingDays(today: Dayjs = dayjs()) {
  const start = today.startOf('month')
  let before = 0, fromToday = 0
  for (let d = start; d.month() === start.month(); d = d.add(1, 'day')) {
    if (!isWorkingDay(d)) continue
    if (d.isBefore(today, 'day')) before++
    else fromToday++
  }
  return { before, fromToday, total: before + fromToday }
}

/** Below these shares of the even pace a retainer goes amber, then red. */
export const AMBER_PACE = 0.9
export const RED_PACE = 0.7
/** Working days that must have passed before the pace means anything. */
const MIN_DAYS = 2

/**
 * How a monthly retainer is being used so far. Compares actual hours with an even spread over the month's
 * working days up to yesterday, and works out the daily hours still needed.
 */
export function retainerBurn(allowance: number, actual: number, today: Dayjs = dayjs()): RetainerBurn {
  const { before, fromToday, total } = workingDays(today)
  const neededPerDay = fromToday > 0 ? Math.max(0, allowance - actual) / fromToday : 0
  if (actual > allowance) return { status: 'over', pace: null, neededPerDay: 0, daysLeft: fromToday }
  if (before < MIN_DAYS || allowance <= 0) return { status: 'early', pace: null, neededPerDay, daysLeft: fromToday }
  const expected = allowance * before / total
  const pace = actual / expected
  const status = pace >= AMBER_PACE ? 'green' : pace >= RED_PACE ? 'amber' : 'red'
  return { status, pace, neededPerDay, daysLeft: fromToday }
}
