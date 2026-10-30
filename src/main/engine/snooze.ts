import type { SnoozeOption } from '../../shared/types'

const HOUR = 60 * 60 * 1000

const atTime = (base: Date, daysAhead: number, hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + daysAhead,
    h,
    m,
    0,
    0
  ).getTime()
}

// When a snoozed item comes back. "Tomorrow" and "Monday" resurface at the start of the work day.
export function snoozeUntil(option: SnoozeOption, now: Date, workStart: string): number {
  switch (option) {
    case 'hour':
      return now.getTime() + HOUR
    case 'tomorrow':
      return atTime(now, 1, workStart)
    case 'monday': {
      const daysToMonday = (1 - now.getDay() + 7) % 7 || 7 // always a future Monday
      return atTime(now, daysToMonday, workStart)
    }
  }
}
