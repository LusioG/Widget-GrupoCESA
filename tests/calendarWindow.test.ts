import { describe, expect, it } from 'vitest'
import { dayOffset, horizonEnd, startOfDay } from '../src/shared/calendarWindow'

const at = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()

describe('calendar window', () => {
  const now = at(2026, 10, 29, 14, 30)

  it('ends at local midnight after the last day', () => {
    expect(horizonEnd(now, 1)).toBe(at(2026, 10, 30))
    expect(horizonEnd(now, 2)).toBe(at(2026, 10, 31))
    expect(horizonEnd(now, 7)).toBe(at(2026, 11, 5))
  })

  it('crosses months and years', () => {
    expect(horizonEnd(at(2026, 12, 30, 9), 3)).toBe(at(2027, 1, 2))
  })

  it('finds the start of a day', () => {
    expect(startOfDay(now)).toBe(at(2026, 10, 29))
  })

  it('counts calendar days, not 24-hour blocks', () => {
    expect(dayOffset(at(2026, 10, 29, 23, 59), now)).toBe(0)
    expect(dayOffset(at(2026, 10, 30, 0, 1), now)).toBe(1)
    expect(dayOffset(at(2026, 11, 2, 9), now)).toBe(4)
    expect(dayOffset(at(2026, 10, 28, 22), now)).toBe(-1)
  })
})
