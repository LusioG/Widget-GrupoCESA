import { describe, expect, it } from 'vitest'
import { freeSlots, mergeIntervals, workWindow } from '../src/main/engine/freeSlots'

const MIN = 60_000
const t = (h: number, m = 0): number => Date.UTC(2026, 9, 28, h, m)
const win = { start: t(9), end: t(18) }

describe('freeSlots', () => {
  it('returns the whole window when there are no meetings', () => {
    expect(freeSlots([], win)).toEqual([win])
  })

  it('splits the day around a meeting', () => {
    const slots = freeSlots([{ start: t(11), end: t(12) }], win)
    expect(slots).toEqual([
      { start: t(9), end: t(11) },
      { start: t(12), end: t(18) }
    ])
  })

  it('merges overlapping and back-to-back meetings', () => {
    const slots = freeSlots(
      [
        { start: t(10), end: t(11, 30) },
        { start: t(11), end: t(12) },
        { start: t(12), end: t(13) }
      ],
      win
    )
    expect(slots).toEqual([
      { start: t(9), end: t(10) },
      { start: t(13), end: t(18) }
    ])
  })

  it('clips meetings that start before or end after the work window', () => {
    const slots = freeSlots(
      [
        { start: t(8), end: t(10) },
        { start: t(17), end: t(19) }
      ],
      win
    )
    expect(slots).toEqual([{ start: t(10), end: t(17) }])
  })

  it('ignores meetings fully outside the window', () => {
    expect(freeSlots([{ start: t(6), end: t(8) }], win)).toEqual([win])
  })

  it('drops gaps shorter than the minimum', () => {
    const slots = freeSlots(
      [
        { start: t(9), end: t(10) },
        { start: t(10, 10), end: t(18) }
      ],
      win,
      15
    )
    expect(slots).toEqual([])
  })

  it('returns nothing when the day is fully booked', () => {
    expect(freeSlots([{ start: t(8), end: t(19) }], win)).toEqual([])
  })

  it('ignores invalid intervals', () => {
    const bad = [
      { start: t(12), end: t(11) },
      { start: NaN, end: t(13) }
    ]
    expect(freeSlots(bad, win)).toEqual([win])
  })
})

describe('mergeIntervals', () => {
  it('keeps unrelated intervals apart', () => {
    expect(
      mergeIntervals([
        { start: 10 * MIN, end: 20 * MIN },
        { start: 30 * MIN, end: 40 * MIN }
      ])
    ).toHaveLength(2)
  })
})

describe('workWindow', () => {
  it('builds the window in local time from HH:MM strings', () => {
    const day = new Date(2026, 9, 28, 15, 0)
    const w = workWindow(day, '09:00', '18:30')
    expect(new Date(w.start).getHours()).toBe(9)
    expect(new Date(w.end).getHours()).toBe(18)
    expect(new Date(w.end).getMinutes()).toBe(30)
    expect(new Date(w.start).getDate()).toBe(28)
  })
})
