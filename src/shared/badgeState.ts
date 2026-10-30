import type { BadgeState, Signal } from './types'

export const MEETING_SOON_MS = 10 * 60 * 1000
// The yellow circle counts meetings that are ongoing or start within a day, however far ahead the
// meetings list is set to look.
export const MEETING_COUNT_WINDOW_MS = 24 * 60 * 60 * 1000
export const URGENT_THRESHOLD = 0.8

const isMessage = (s: Signal): boolean =>
  s.kind === 'email' || s.kind === 'dm' || s.kind === 'mention'

// In focus mode only urgent items count and the "meeting soon" highlight is silenced.
// `lastSeenAt`: when the panel was last opened or closed; messages newer than that are "new".
// Without it nothing is new.
export function computeBadge(
  signals: Signal[],
  now: number,
  options: { focus?: boolean; lastSeenAt?: number } = {}
): BadgeState {
  const focus = options.focus ?? false
  const lastSeenAt = options.lastSeenAt ?? Number.POSITIVE_INFINITY
  const pending = signals.filter((s) => s.kind !== 'meeting')
  const urgentItems = pending.filter((s) => (s.urgency ?? 0) >= URGENT_THRESHOLD)
  const meetingSoon =
    !focus &&
    signals.some(
      (s) =>
        s.kind === 'meeting' &&
        s.startsAt !== undefined &&
        s.startsAt - now <= MEETING_SOON_MS &&
        (s.endsAt ?? s.startsAt) > now
    )
  return {
    count: focus ? urgentItems.length : pending.length,
    urgent: urgentItems.length > 0,
    urgentCount: urgentItems.length,
    meetingCount: signals.filter(
      (s) =>
        s.kind === 'meeting' &&
        (s.startsAt ?? s.occurredAt) - now < MEETING_COUNT_WINDOW_MS &&
        (s.endsAt ?? s.startsAt ?? s.occurredAt) > now
    ).length,
    // A new mail or Slack message pulses red; in focus mode only an urgent one does.
    messageAlert: pending.some(
      (s) =>
        isMessage(s) &&
        !s.seen &&
        s.occurredAt > lastSeenAt &&
        (!focus || (s.urgency ?? 0) >= URGENT_THRESHOLD)
    ),
    meetingSoon
  }
}

// Which extra circles the widget shows next to the main (green) number. The red one repeats the
// green number in focus mode (only urgent items count there), so it is left out then.
export function badgeCircles(
  badge: BadgeState,
  focus: boolean
): { urgent: number; meetings: number } {
  return { urgent: focus ? 0 : badge.urgentCount, meetings: badge.meetingCount }
}

// The vertical tab grows by one row for each extra circle that is showing.
export function tabExtraRows(badge: BadgeState, focus: boolean): number {
  const { urgent, meetings } = badgeCircles(badge, focus)
  return (urgent > 0 ? 1 : 0) + (meetings > 0 ? 1 : 0)
}
