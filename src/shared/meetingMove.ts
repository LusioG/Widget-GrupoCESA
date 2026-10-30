import { dayOffset } from './calendarWindow'
import { shortDate } from './dueLabel'

// A meeting whose time was changed: moved earlier ("adelantada") or later ("atrasada").
export type MeetingMove = { direction: 'earlier' | 'later'; before: number }

const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

// `null` when the meeting was never moved (or is back where it was).
export function meetingMove(
  startsAt: number | undefined,
  movedFrom: number | undefined
): MeetingMove | null {
  if (startsAt === undefined || movedFrom === undefined || movedFrom === startsAt) return null
  return { direction: startsAt < movedFrom ? 'earlier' : 'later', before: movedFrom }
}

// The time it had before: "15:00", or with the day when it changed day too ("mié 4 nov, 15:00").
export function beforeText(move: MeetingMove, startsAt: number, now: number): string {
  const time = clock.format(move.before)
  return dayOffset(move.before, startsAt) === 0 ? time : `${shortDate(move.before, now)}, ${time}`
}

export const movedName = (move: MeetingMove): string =>
  move.direction === 'earlier' ? 'Adelantada' : 'Atrasada'

// "Adelantada · antes 15:00".
export function moveLabel(move: MeetingMove, startsAt: number, now: number): string {
  return `${movedName(move)} · antes ${beforeText(move, startsAt, now)}`
}
