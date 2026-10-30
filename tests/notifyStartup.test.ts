import { describe, expect, it } from 'vitest'
import {
  shouldNotify,
  shouldSound,
  startupHandledIds,
  startupSoundIds
} from '../src/main/engine/notifyPolicy'
import type { Signal } from '../src/shared/types'

const now = 1_000_000_000
const MIN = 60_000
const open = { enabled: true, paused: false, workTime: true, focus: false }

const base = { url: 'https://example.com', occurredAt: now, title: 'x' } as const
const meeting = (id: string, startsInMin: number): Signal => ({
  ...base,
  id,
  source: 'calendar',
  kind: 'meeting',
  startsAt: now + startsInMin * MIN,
  endsAt: now + (startsInMin + 30) * MIN
})
const item = (id: string, kind: Signal['kind'], urgency: number): Signal => ({
  ...base,
  id,
  source: 'slack',
  kind,
  urgency
})

describe('startup: what counts as already announced', () => {
  it('does not announce again what would notify right now', () => {
    const urgent = item('urgent', 'task', 0.9)
    const dm = item('dm', 'dm', 0.6)
    const soon = meeting('soon', 5)
    expect(startupHandledIds([urgent, dm, soon], now).sort()).toEqual(['dm', 'soon', 'urgent'])
  })

  it('keeps a later meeting eligible, so it still notifies when it is 10 minutes away', () => {
    const later = meeting('later', 180) // in three hours, already in the cache at startup
    expect(startupHandledIds([later], now)).toEqual([])
    // three hours later it is within the window and notifies
    expect(shouldNotify(later, open, now + 175 * MIN)).toBe(true)
  })

  it('keeps a not-yet-urgent item eligible for when it becomes urgent', () => {
    const task = item('task', 'task', 0.65)
    expect(startupHandledIds([task], now)).toEqual([])
    expect(shouldNotify({ ...task, urgency: 0.9 }, open, now)).toBe(true)
  })

  it('ignores items that never notify', () => {
    expect(
      startupHandledIds([item('mail', 'email', 0.4), item('fu', 'followup', 0.5)], now)
    ).toEqual([])
  })
})

describe('sound: ordinary mail and Slack messages also make it', () => {
  it('sounds for not-urgent mail, mentions and direct messages', () => {
    expect(shouldSound(item('mail', 'email', 0.2), open, now)).toBe(true)
    expect(shouldSound(item('mention', 'mention', 0.2), open, now)).toBe(true)
    expect(shouldSound(item('dm', 'dm', 0.2), open, now)).toBe(true)
  })

  it('still sounds for what notifies', () => {
    expect(shouldSound(item('urgent', 'task', 0.9), open, now)).toBe(true)
    expect(shouldSound(meeting('soon', 5), open, now)).toBe(true)
  })

  it('stays silent for ordinary tasks, follow-ups and far-away meetings', () => {
    expect(shouldSound(item('task', 'task', 0.4), open, now)).toBe(false)
    expect(shouldSound(item('fu', 'followup', 0.5), open, now)).toBe(false)
    expect(shouldSound(meeting('later', 180), open, now)).toBe(false)
  })

  it('respects pause, work hours and focus mode', () => {
    const mail = item('mail', 'email', 0.2)
    expect(shouldSound(mail, { ...open, paused: true }, now)).toBe(false)
    expect(shouldSound(mail, { ...open, workTime: false }, now)).toBe(false)
    expect(shouldSound(mail, { ...open, focus: true }, now)).toBe(false)
    // urgent still breaks through focus mode
    expect(shouldSound(item('u', 'email', 0.9), { ...open, focus: true }, now)).toBe(true)
  })

  it('does not sound at startup for what is already there', () => {
    const cached = [item('mail', 'email', 0.2), item('task', 'task', 0.4)]
    expect(startupSoundIds(cached, now)).toEqual(['mail'])
  })
})
