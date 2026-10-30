import { describe, expect, it } from 'vitest'
import { badgeCircles, computeBadge, tabExtraRows } from '../src/shared/badgeState'
import type { Signal } from '../src/shared/types'

const now = 1_000_000_000
const base = { source: 'clickup', url: 'https://example.com', occurredAt: now } as const

const task = (id: string, urgency?: number): Signal => ({
  ...base,
  id,
  kind: 'task',
  title: id,
  urgency
})

const meeting = (id: string, startsInMin: number): Signal => ({
  ...base,
  id,
  source: 'calendar',
  kind: 'meeting',
  title: id,
  startsAt: now + startsInMin * 60_000,
  endsAt: now + (startsInMin + 30) * 60_000
})

describe('computeBadge', () => {
  it('counts pending items but not meetings', () => {
    const b = computeBadge([task('a'), task('b'), meeting('m', 120)], now)
    expect(b.count).toBe(2)
  })

  it('flags urgent when any item passes the threshold', () => {
    expect(computeBadge([task('a', 0.9)], now).urgent).toBe(true)
    expect(computeBadge([task('a', 0.3)], now).urgent).toBe(false)
  })

  it('flags a meeting starting within 10 minutes', () => {
    expect(computeBadge([meeting('m', 8)], now).meetingSoon).toBe(true)
    expect(computeBadge([meeting('m', 45)], now).meetingSoon).toBe(false)
  })

  it('ignores meetings that already ended', () => {
    expect(computeBadge([meeting('m', -60)], now).meetingSoon).toBe(false)
  })
})

describe('urgent and meeting circles', () => {
  const urgent = (id: string): Signal => task(id, 0.9)

  it('counts urgent items and meetings separately from the main number', () => {
    const b = computeBadge(
      [task('a', 0.2), urgent('b'), urgent('c'), meeting('m1', 60), meeting('m2', 300)],
      now
    )
    expect(b.count).toBe(3) // meetings are not pending items
    expect(b.urgentCount).toBe(2)
    expect(b.meetingCount).toBe(2)
  })

  it('has nothing to show when there is nothing', () => {
    const b = computeBadge([], now)
    expect(b).toMatchObject({ count: 0, urgentCount: 0, meetingCount: 0, urgent: false })
    expect(tabExtraRows(b, false)).toBe(0)
  })

  it('adds one tab row for each circle that shows', () => {
    expect(tabExtraRows(computeBadge([urgent('a')], now), false)).toBe(1)
    expect(tabExtraRows(computeBadge([meeting('m', 60)], now), false)).toBe(1)
    expect(tabExtraRows(computeBadge([urgent('a'), meeting('m', 60)], now), false)).toBe(2)
  })

  it('leaves the red circle out in focus mode, where the green number already is the urgent count', () => {
    const b = computeBadge([urgent('a'), task('b', 0.2), meeting('m', 60)], now, { focus: true })
    expect(b.count).toBe(1)
    expect(badgeCircles(b, true)).toEqual({ urgent: 0, meetings: 1 })
    expect(badgeCircles(b, false)).toEqual({ urgent: 1, meetings: 1 })
    expect(tabExtraRows(b, true)).toBe(1)
  })
})

describe('new-message alert (the red pulse)', () => {
  const at = (
    id: string,
    kind: Signal['kind'],
    ageMin: number,
    extra: Partial<Signal> = {}
  ): Signal => ({
    ...base,
    id,
    kind,
    title: id,
    occurredAt: now - ageMin * 60_000,
    ...extra
  })
  const seenAt = now - 5 * 60_000 // the panel was last looked at 5 minutes ago
  const alert = (signals: Signal[], focus = false): boolean =>
    computeBadge(signals, now, { focus, lastSeenAt: seenAt }).messageAlert

  it('is on for a mail or a Slack message that arrived after the panel was last seen', () => {
    expect(alert([at('m', 'email', 1)])).toBe(true)
    expect(alert([at('d', 'dm', 1)])).toBe(true)
    expect(alert([at('x', 'mention', 1)])).toBe(true)
  })

  it('is off for messages that were already there', () => {
    expect(alert([at('old', 'email', 30)])).toBe(false)
  })

  it('is off for tasks, even overdue or urgent ones', () => {
    expect(alert([at('t', 'task', 1, { urgency: 0.95, dueAt: now - 1000 })])).toBe(false)
  })

  it('is off for meetings and follow-ups', () => {
    expect(alert([at('f', 'followup', 1), meeting('m', 5)])).toBe(false)
  })

  it('is off for a message the user already opened', () => {
    expect(alert([at('m', 'email', 1, { seen: true })])).toBe(false)
  })

  it('is off when nothing says when the panel was last seen', () => {
    expect(computeBadge([at('m', 'email', 1)], now).messageAlert).toBe(false)
  })

  it('in focus mode only an urgent message raises it', () => {
    expect(alert([at('m', 'email', 1, { urgency: 0.4 })], true)).toBe(false)
    expect(alert([at('m', 'email', 1, { urgency: 0.9 })], true)).toBe(true)
  })
})
