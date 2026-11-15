import { test } from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import { retainerBurn, workingDays } from './retainerBurn.ts'

// England & Wales, Dec 2026: Christmas Day (Fri 25th) and Boxing Day substitute (Mon 28th)
const EW_DEC_2026 = new Set(['2026-12-25', '2026-12-28'])

test('December 2026 has 23 weekdays, 21 working days once bank holidays are excluded', () => {
  assert.equal(workingDays(dayjs('2026-12-01')).total, 23)
  assert.deepEqual(workingDays(dayjs('2026-12-01'), EW_DEC_2026), { before: 0, fromToday: 21, total: 21 })
})

test('days left from mid-December skip the holidays', () => {
  // From Mon 21st: 21, 22, 23, 24, (25 hol), (28 hol), 29, 30, 31 → 7 days, 14 before
  assert.deepEqual(workingDays(dayjs('2026-12-21'), EW_DEC_2026), { before: 14, fromToday: 7, total: 21 })
  assert.equal(retainerBurn(40, 20, EW_DEC_2026, dayjs('2026-12-21')).daysLeft, 7)
  assert.equal(retainerBurn(40, 20, new Set(), dayjs('2026-12-21')).daysLeft, 9)
})

test('a holiday today is not counted as a working day left', () => {
  assert.equal(workingDays(dayjs('2026-12-28'), EW_DEC_2026).fromToday, 3)
})

test('needed per day spreads the remainder over non-holiday days', () => {
  const burn = retainerBurn(42, 28, EW_DEC_2026, dayjs('2026-12-24'))
  // 24, 29, 30, 31 left
  assert.equal(burn.daysLeft, 4)
  assert.equal(burn.neededPerDay, 3.5)
})

test('pace uses working days before today, excluding holidays', () => {
  // On Tue 29th: 18 working days before (of 21), so even pace is 21h × 18/21 = 18h for a 21h retainer
  const onPace = retainerBurn(21, 18, EW_DEC_2026, dayjs('2026-12-29'))
  assert.equal(onPace.status, 'green')
  assert.ok(Math.abs(onPace.pace! - 1) < 1e-9)
  // Ignoring holidays would expect 21 × 20/23 ≈ 18.3h, so the same hours look slightly behind
  assert.ok(retainerBurn(21, 18, new Set(), dayjs('2026-12-29')).pace! < 1)
})

test('statuses: over, early, amber, red', () => {
  const today = dayjs('2026-12-15') // 10 working days before, 21 total
  assert.equal(retainerBurn(10, 11, EW_DEC_2026, today).status, 'over')
  assert.equal(retainerBurn(21, 0, EW_DEC_2026, dayjs('2026-12-02')).status, 'early')
  assert.equal(retainerBurn(21, 8, EW_DEC_2026, today).status, 'amber') // 0.8 of 10h
  assert.equal(retainerBurn(21, 6, EW_DEC_2026, today).status, 'red') // 0.6
})

test('a month with no holidays is unchanged', () => {
  assert.deepEqual(workingDays(dayjs('2026-11-16'), EW_DEC_2026), workingDays(dayjs('2026-11-16')))
})
