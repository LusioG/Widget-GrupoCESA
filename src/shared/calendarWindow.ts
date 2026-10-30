// How far ahead the meetings reach, counted in calendar days starting today:
// 1 = today only, 2 = today and tomorrow, 7 = this and the next six days.
export const CALENDAR_DAY_CHOICES = [1, 2, 3, 7, 14] as const
export const MAX_CALENDAR_DAYS = 30

// The moment the window ends: local midnight after the last day (daylight-saving safe).
export function horizonEnd(now: number, daysAhead: number): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysAhead).getTime()
}

// Start of the local day that contains `ms`.
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Whole calendar days from `now`'s day to `ms`'s day (0 = same day, 1 = the next day).
export function dayOffset(ms: number, now: number): number {
  const a = startOfDay(now)
  const b = startOfDay(ms)
  return Math.round((b - a) / 86_400_000)
}
