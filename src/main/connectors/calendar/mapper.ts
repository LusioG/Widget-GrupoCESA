import type { Signal } from '../../../shared/types'
import type { Interval } from '../../engine/freeSlots'

// Minimal shape of a Google Calendar event (the fields we read).
export type CalendarEvent = {
  id?: string | null
  status?: string | null
  summary?: string | null
  htmlLink?: string | null
  description?: string | null
  location?: string | null
  hangoutLink?: string | null
  conferenceData?: {
    entryPoints?: { entryPointType?: string | null; uri?: string | null }[] | null
  } | null
  start?: { dateTime?: string | null; date?: string | null } | null
  end?: { dateTime?: string | null; date?: string | null } | null
  attendees?: { self?: boolean | null; responseStatus?: string | null }[] | null
}

const MEETING_LINK =
  /https?:\/\/(?:[\w-]+\.)*(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s"'<>)\]]*/i

export function extractMeetingUrl(event: CalendarEvent): string | undefined {
  const video = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri
  if (video) return video
  if (event.hangoutLink) return event.hangoutLink
  const text = `${event.description ?? ''} ${event.location ?? ''}`
  return text.match(MEETING_LINK)?.[0]
}

// Timed, attended events only. Cancelled, declined and all-day events do not count as meetings.
export function eventInterval(event: CalendarEvent): Interval | null {
  if (event.status === 'cancelled') return null
  const declined = event.attendees?.some((a) => a.self && a.responseStatus === 'declined')
  if (declined) return null
  const start = event.start?.dateTime
  const end = event.end?.dateTime
  if (!start || !end) return null // all-day events only carry `date`
  const s = Date.parse(start) // ISO strings carry their own UTC offset
  const e = Date.parse(end)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
  return { start: s, end: e }
}

export function eventToSignal(event: CalendarEvent): Signal | null {
  const interval = eventInterval(event)
  if (!interval || !event.id) return null
  return {
    id: `calendar:${event.id}`,
    source: 'calendar',
    kind: 'meeting',
    title: event.summary?.trim() || '(Sin título)',
    url: event.htmlLink ?? 'https://calendar.google.com',
    occurredAt: interval.start,
    startsAt: interval.start,
    endsAt: interval.end,
    meetingUrl: extractMeetingUrl(event)
  }
}
