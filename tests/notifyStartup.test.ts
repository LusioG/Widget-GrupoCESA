import { describe, expect, it } from 'vitest'
import { shouldNotify, startupHandledIds } from '../src/main/engine/notifyPolicy'
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
