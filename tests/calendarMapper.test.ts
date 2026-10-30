import { describe, expect, it } from 'vitest'
import {
  eventInterval,
  eventToSignal,
  extractMeetingUrl,
  type CalendarEvent
} from '../src/main/connectors/calendar/mapper'
import { freeSlots } from '../src/main/engine/freeSlots'

const timed = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1',
  summary: 'Daily',
  htmlLink: 'https://calendar.google.com/event?eid=1',
  start: { dateTime: '2026-10-28T10:00:00-05:00' },
  end: { dateTime: '2026-10-28T10:30:00-05:00' },
  ...over
})

describe('eventInterval', () => {
  it('parses timed events using their own UTC offset', () => {
    expect(eventInterval(timed())).toEqual({
      start: Date.UTC(2026, 9, 28, 15, 0),
      end: Date.UTC(2026, 9, 28, 15, 30)
    })
  })

  it('treats the same instant in different time zones as equal', () => {
    const a = eventInterval(timed({ start: { dateTime: '2026-10-28T10:00:00-05:00' } }))
    const b = eventInterval(timed({ start: { dateTime: '2026-10-28T17:00:00+02:00' } }))
    expect(a?.start).toBe(b?.start)
  })

  it('ignores all-day events', () => {
    expect(
      eventInterval({ id: 'x', start: { date: '2026-10-28' }, end: { date: '2026-10-29' } })
    ).toBeNull()
  })

  it('ignores cancelled events', () => {
    expect(eventInterval(timed({ status: 'cancelled' }))).toBeNull()
  })

  it('ignores events the user declined', () => {
    expect(
      eventInterval(timed({ attendees: [{ self: true, responseStatus: 'declined' }] }))
    ).toBeNull()
  })

  it('rejects events that end before they start', () => {
    expect(eventInterval(timed({ end: { dateTime: '2026-10-28T09:00:00-05:00' } }))).toBeNull()
  })
})

describe('extractMeetingUrl', () => {
  it('prefers the conferenceData video entry point', () => {
    const url = extractMeetingUrl(
      timed({
        hangoutLink: 'https://meet.google.com/old',
        conferenceData: {
          entryPoints: [
            { entryPointType: 'phone', uri: 'tel:+1' },
            { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }
          ]
        }
      })
    )
    expect(url).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('falls back to hangoutLink', () => {
    expect(extractMeetingUrl(timed({ hangoutLink: 'https://meet.google.com/zzz' }))).toBe(
      'https://meet.google.com/zzz'
    )
  })

  it.each([
    [
      'Zoom',
      'Únete: https://us02web.zoom.us/j/123456?pwd=abc gracias',
      'https://us02web.zoom.us/j/123456?pwd=abc'
    ],
    [
      'Teams',
      'https://teams.microsoft.com/l/meetup-join/19%3a123',
      'https://teams.microsoft.com/l/meetup-join/19%3a123'
    ],
    ['Meet', 'Link: https://meet.google.com/abc-defg-hij.', 'https://meet.google.com/abc-defg-hij.']
  ])('finds a %s link in the description', (_name, description, expected) => {
    expect(extractMeetingUrl(timed({ description }))).toBe(expected)
  })

  it('finds a link in the location', () => {
    expect(extractMeetingUrl(timed({ location: 'https://zoom.us/j/999' }))).toBe(
      'https://zoom.us/j/999'
    )
  })

  it('returns undefined when there is no link', () => {
    expect(extractMeetingUrl(timed({ description: 'Sala 3, piso 2' }))).toBeUndefined()
  })
})

describe('eventToSignal', () => {
  it('maps a meeting with a stable id and times', () => {
    const s = eventToSignal(timed({ hangoutLink: 'https://meet.google.com/q' }))
    expect(s).toMatchObject({
      id: 'calendar:e1',
      source: 'calendar',
      kind: 'meeting',
      title: 'Daily',
      meetingUrl: 'https://meet.google.com/q'
    })
    expect(s?.startsAt).toBe(Date.UTC(2026, 9, 28, 15, 0))
  })

  it('returns null for events that are not meetings', () => {
    expect(eventToSignal(timed({ status: 'cancelled' }))).toBeNull()
  })

  it('feeds freeSlots correctly end to end', () => {
    const interval = eventInterval(timed())!
    const slots = freeSlots(
      [interval],
      { start: Date.UTC(2026, 9, 28, 14), end: Date.UTC(2026, 9, 28, 18) },
      15
    )
    expect(slots).toHaveLength(2)
  })
})
