import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { CalendarShow, Signal } from '../src/shared/types'

const holder = vi.hoisted(() => ({ show: 'all' as string }))
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../src/main/db/repos', () => ({ loadInbox: async () => [], saveInbox: async () => {} }))
vi.mock('../src/main/settingsStore', () => ({
  getSettings: () => ({
    ...DEFAULT_SETTINGS,
    calendar: { ...DEFAULT_SETTINGS.calendar, show: holder.show }
  })
}))
vi.mock('../src/main/autostart', () => ({ getAutostart: () => false }))
vi.mock('../src/main/connectors/google/auth', () => ({ hasGoogleCredentials: () => false }))

const { applyItemAction, getState, setSourceSignals } = await import('../src/main/appState')

let run = 0
const meeting = (n: number, video: boolean): Signal => ({
  id: `calendar:${run}-${n}`,
  source: 'calendar',
  kind: 'meeting',
  title: video ? `Reunión ${n}` : `Cita ${n}`,
  url: 'https://calendar.google.com',
  occurredAt: Date.now() + 3_600_000,
  startsAt: Date.now() + 3_600_000,
  endsAt: Date.now() + 7_200_000,
  meetingUrl: video ? 'https://meet.google.com/abc' : undefined
})
const task = (n: number): Signal => ({
  id: `clickup:${run}-${n}`,
  source: 'clickup',
  kind: 'task',
  title: `Tarea ${n}`,
  url: 'https://app.clickup.com',
  occurredAt: Date.now() - 1000
})
const titles = (): string[] => getState().signals.map((s) => s.title)

describe('calendar filter and trash', () => {
  beforeEach(() => {
    run += 1
    holder.show = 'all'
    setSourceSignals('calendar', [meeting(1, true), meeting(2, false)])
    setSourceSignals('clickup', [task(1), task(2)])
  })

  it.each([
    ['all', ['Reunión 1', 'Cita 2']],
    ['meets', ['Reunión 1']],
    ['plain', ['Cita 2']]
  ] as [CalendarShow, string[]][])('shows %s events', (show, expected) => {
    holder.show = show
    const meetings = getState().signals.filter((s) => s.kind === 'meeting')
    expect(meetings.map((s) => s.title).sort()).toEqual(expected.sort())
  })

  it('the filter also changes the yellow circle count', () => {
    holder.show = 'meets'
    expect(getState().badge.meetingCount).toBe(1)
    holder.show = 'plain'
    expect(getState().badge.meetingCount).toBe(1)
    holder.show = 'all'
    expect(getState().badge.meetingCount).toBe(2)
  })

  it('an event can be dismissed with the X, goes to the trash and can be restored', async () => {
    await applyItemAction({ ids: [`calendar:${run}-1`], action: 'dismiss' })
    expect(titles()).not.toContain('Reunión 1')
    expect(getState().trash.map((s) => s.title)).toEqual(['Reunión 1'])
    await applyItemAction({ ids: [`calendar:${run}-1`], action: 'restore' })
    expect(titles()).toContain('Reunión 1')
    expect(getState().trash).toEqual([])
  })

  it('emptying the trash removes items for good, restoring brings back the rest', async () => {
    const ids = [`clickup:${run}-1`, `clickup:${run}-2`]
    await applyItemAction({ ids, action: 'dismiss' })
    expect(getState().trash).toHaveLength(2)
    await applyItemAction({ ids: [ids[0]], action: 'purge' })
    expect(getState().trash.map((s) => s.title)).toEqual(['Tarea 2'])
    await applyItemAction({ ids: [ids[0]], action: 'restore' }) // purged: cannot come back
    expect(titles()).not.toContain('Tarea 1')
    await applyItemAction({ ids: [ids[1]], action: 'restore' })
    expect(titles()).toContain('Tarea 2')
  })

  it('purge only touches dismissed items', async () => {
    await applyItemAction({ ids: [`clickup:${run}-1`], action: 'purge' })
    expect(titles()).toContain('Tarea 1')
  })

  it('a dismissed event leaves the trash too when the filter hides it', async () => {
    await applyItemAction({ ids: [`calendar:${run}-2`], action: 'dismiss' })
    holder.show = 'meets'
    expect(getState().trash).toEqual([])
  })
})
