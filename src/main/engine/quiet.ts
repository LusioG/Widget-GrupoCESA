import type { Settings, Signal } from '../../shared/types'

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function isWorkTime(now: Date, schedule: Settings['schedule']): boolean {
  if (!schedule.workDays.includes(now.getDay())) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  return minutes >= toMinutes(schedule.workStart) && minutes < toMinutes(schedule.workEnd)
}

const FOCUS_TITLE = /\bfocus\b|\benfoque\b|\bconcentraci[oó]n\b/i

// Focus is on when the user turned it on, or while a calendar block named "Focus" is running.
export function isFocusActive(
  signals: Signal[],
  now: number,
  manual: boolean,
  fromCalendar: boolean
): boolean {
  if (manual) return true
  if (!fromCalendar) return false
  return signals.some(
    (s) =>
      s.kind === 'meeting' &&
      FOCUS_TITLE.test(s.title) &&
      (s.startsAt ?? Infinity) <= now &&
      (s.endsAt ?? 0) > now
  )
}
