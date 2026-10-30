import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Settings, Signal } from '../src/shared/types'

// Only the settings and a place to save rows are needed; the rest is stubbed.
const holder = globalThis as unknown as { __settings: Settings }
holder.__settings = DEFAULT_SETTINGS
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../src/main/db/repos', () => ({
  loadInbox: async () => [],
  saveInbox: async () => undefined
}))
vi.mock('../src/main/settingsStore', () => ({ getSettings: () => holder.__settings }))
vi.mock('../src/main/autostart', () => ({ getAutostart: () => false }))
vi.mock('../src/main/connectors/google/auth', () => ({ hasGoogleCredentials: () => false }))

const { getState, setSourceSignals } = await import('../src/main/appState')

const at = (y: number, m: number, d: number, h: number, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()

const meeting = (id: string, start: number, minutes = 30): Signal => ({
  id: `calendar:${id}`,
  source: 'calendar',
  kind: 'meeting',
  title: id,
  url: 'https://calendar.google.com',
  occurredAt: start,
  startsAt: start,
  endsAt: start + minutes * 60_000
})

const withDays = (daysAhead: number): void => {
  holder.__settings = { ...DEFAULT_SETTINGS, calendar: { daysAhead } }
}
const shown = (): string[] =>
  getState()
    .signals.filter((s) => s.kind === 'meeting')
    .map((s) => s.title)

describe('meetings shown according to "days ahead"', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 9, 29, 10, 0) }) // Thursday 29 Oct, 10:00 local
    setSourceSignals('calendar', [
      meeting('running', at(2026, 10, 29, 9, 45), 60), // started 15 min ago
      meeting('today-pm', at(2026, 10, 29, 16)),
      meeting('today-late', at(2026, 10, 29, 23, 30)),
      meeting('tomorrow', at(2026, 10, 30, 9)),
      meeting('day3', at(2026, 10, 31, 9)),
      meeting('next-week', at(2026, 11, 4, 9)),
      meeting('far', at(2026, 11, 20, 9)),
      meeting('over', at(2026, 10, 29, 8), 30) // already finished
    ])
  })
  afterEach(() => vi.useRealTimers())

  it('today only', () => {
    withDays(1)
    expect(shown().sort()).toEqual(['running', 'today-late', 'today-pm'])
  })

  it('today and tomorrow (the default)', () => {
    expect(DEFAULT_SETTINGS.calendar.daysAhead).toBe(2)
    withDays(2)
    expect(shown().sort()).toEqual(['running', 'today-late', 'today-pm', 'tomorrow'])
  })

  it('three days', () => {
    withDays(3)
    expect(shown()).toContain('day3')
    expect(shown()).not.toContain('next-week')
  })

  it('a week reaches Wednesday of next week but not three weeks out', () => {
    withDays(7)
    expect(shown()).toContain('next-week')
    expect(shown()).not.toContain('far')
  })

  it('two weeks', () => {
    withDays(14)
    expect(shown()).toContain('next-week')
    expect(shown()).not.toContain('far')
    withDays(30)
    expect(shown()).toContain('far')
  })

  it('never shows a meeting that already finished', () => {
    withDays(30)
    expect(shown()).not.toContain('over')
  })

  it('the yellow circle counts only the next 24 hours, however far the list reaches', () => {
    withDays(14)
    // running, today-pm, today-late (13.5 h) and tomorrow 09:00 (23 h) are within 24 h of 10:00
    expect(getState().badge.meetingCount).toBe(4)
    expect(shown().length).toBeGreaterThan(4)
  })
})
