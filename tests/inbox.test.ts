import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Signal } from '../src/shared/types'

// appState only needs the settings and a place to save rows; everything else is stubbed.
const saved: unknown[] = []
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../src/main/db/repos', () => ({
  loadInbox: async () => [],
  saveInbox: async (row: unknown) => void saved.push(row)
}))
vi.mock('../src/main/settingsStore', () => ({ getSettings: () => DEFAULT_SETTINGS }))
vi.mock('../src/main/autostart', () => ({ getAutostart: () => false }))
vi.mock('../src/main/connectors/google/auth', () => ({ hasGoogleCredentials: () => false }))

const { applyItemAction, getState, setSourceSignals, undoLastChange } =
  await import('../src/main/appState')

let run = 0 // the inbox keeps what was done to each id, so every test gets its own ids
const gid = (n: number): string => `gmail:${run}-${n}`
const mail = (n: number): Signal => ({
  id: gid(n),
  source: 'gmail',
  kind: 'email',
  title: `Correo ${n}`,
  url: 'https://mail.google.com',
  occurredAt: Date.now() - 60_000,
  sender: 'Alguien <a@x.com>'
})

const titles = (): string[] => getState().signals.map((s) => s.title)

describe('undo and the snoozed list', () => {
  beforeEach(async () => {
    await undoLastChange() // forget the previous test's change
    saved.length = 0
    run += 1
    setSourceSignals('gmail', [mail(1), mail(2), mail(3)])
  })

  it('undoes a dismiss', async () => {
    await applyItemAction({ ids: [gid(1)], action: 'dismiss' })
    expect(titles()).not.toContain('Correo 1')
    expect(await undoLastChange()).toBe(true)
    expect(titles()).toContain('Correo 1')
  })

  it('undoes a batch, restoring every item', async () => {
    await applyItemAction({ ids: [gid(2), gid(3)], action: 'dismiss' })
    expect(titles()).toEqual(['Correo 1'])
    expect(await undoLastChange()).toBe(true)
    expect(titles().sort()).toEqual(['Correo 1', 'Correo 2', 'Correo 3'])
  })

  it('can only be undone once', async () => {
    await applyItemAction({ ids: [gid(1)], action: 'dismiss' })
    expect(await undoLastChange()).toBe(true)
    expect(await undoLastChange()).toBe(false)
  })

  it('does nothing when there was nothing to undo', async () => {
    expect(await undoLastChange()).toBe(false)
  })

  it('undoes only the most recent change', async () => {
    await applyItemAction({ ids: [gid(1)], action: 'dismiss' })
    await applyItemAction({ ids: [gid(2)], action: 'dismiss' })
    await undoLastChange()
    expect(titles()).toContain('Correo 2')
    expect(titles()).not.toContain('Correo 1')
  })

  it('puts a snoozed item on the snoozed list and undoes it', async () => {
    await applyItemAction({ ids: [gid(1)], action: 'snooze', until: 'tomorrow' })
    const state = getState()
    expect(state.signals.map((s) => s.title)).not.toContain('Correo 1')
    expect(state.snoozed.map((s) => s.title)).toEqual(['Correo 1'])
    expect(state.snoozed[0].snoozedUntil).toBeGreaterThan(Date.now())
    expect(await undoLastChange()).toBe(true)
    expect(getState().snoozed).toEqual([])
    expect(titles()).toContain('Correo 1')
  })

  it('brings a snoozed item back on demand', async () => {
    await applyItemAction({ ids: [gid(1), gid(2)], action: 'snooze', until: 'monday' })
    await applyItemAction({ ids: [gid(2)], action: 'restore' })
    const state = getState()
    expect(state.snoozed.map((s) => s.title)).toEqual(['Correo 1'])
    expect(state.signals.map((s) => s.title)).toContain('Correo 2')
  })

  it('does not list dismissed items as snoozed; they go to the trash and restore brings them back', async () => {
    await applyItemAction({ ids: [gid(3)], action: 'dismiss' })
    expect(getState().snoozed).toEqual([])
    expect(getState().trash.map((s) => s.title)).toEqual(['Correo 3'])
    await applyItemAction({ ids: [gid(3)], action: 'restore' })
    expect(titles()).toContain('Correo 3')
    expect(getState().trash).toEqual([])
  })

  it('lists the item that comes back first', async () => {
    await applyItemAction({ ids: [gid(1)], action: 'snooze', until: 'monday' })
    await applyItemAction({ ids: [gid(2)], action: 'snooze', until: 'hour' })
    expect(getState().snoozed.map((s) => s.title)).toEqual(['Correo 2', 'Correo 1'])
  })

  it('opening an item does not count as something to undo', async () => {
    await applyItemAction({ ids: [gid(1)], action: 'seen' })
    expect(await undoLastChange()).toBe(false)
  })
})
