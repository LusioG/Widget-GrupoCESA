export type Interval = { start: number; end: number } // epoch ms

const MINUTE = 60_000

// Local-time work window for the day that contains `day`, from "HH:MM" strings.
export function workWindow(day: Date, workStart: string, workEnd: string): Interval {
  const at = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number)
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).getTime()
  }
  return { start: at(workStart), end: at(workEnd) }
}

// Merge overlapping or touching intervals; ignores empty/invalid ones.
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .sort((a, b) => a.start - b.start)
  const merged: Interval[] = []
  for (const i of sorted) {
    const last = merged[merged.length - 1]
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end)
    else merged.push({ ...i })
  }
  return merged
}

// Free gaps inside `window` not covered by `busy`, at least `minMinutes` long.
export function freeSlots(busy: Interval[], window: Interval, minMinutes = 15): Interval[] {
  if (window.end <= window.start) return []
  const slots: Interval[] = []
  let cursor = window.start
  for (const b of mergeIntervals(busy)) {
    if (b.end <= window.start) continue
    if (b.start >= window.end) break
    if (b.start > cursor) slots.push({ start: cursor, end: Math.min(b.start, window.end) })
    cursor = Math.max(cursor, b.end)
    if (cursor >= window.end) break
  }
  if (cursor < window.end) slots.push({ start: cursor, end: window.end })
  return slots.filter((s) => s.end - s.start >= minMinutes * MINUTE)
}
