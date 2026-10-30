import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Settings } from '../src/shared/types'

const holder = globalThis as unknown as { __settings: Settings }
const list = vi.fn(async (params: Record<string, unknown>) => ({
  params,
  data: { items: [], nextSyncToken: 'token-1' }
}))
vi.mock('googleapis', () => ({ google: { calendar: () => ({ events: { list } }) } }))
vi.mock('../src/main/settingsStore', () => ({ getSettings: () => holder.__settings }))
vi.mock('../src/main/connectors/google/auth', () => ({
  authorizedClient: async () => ({}),
  disableFeature: () => undefined,
  enableFeature: async () => undefined,
  isFeatureConnected: () => true,
  httpStatus: () => undefined,
  isAuthFailure: () => false,
  apiDisabledInfo: () => null
}))

const { CalendarConnector } = await import('../src/main/connectors/calendar')

let cursor: string | undefined
const ctx = {
  getCursor: async () => cursor,
  setCursor: async (c: string | undefined) => void (cursor = c),
  loadCached: async () => []
}
const withDays = (daysAhead: number): void => {
  holder.__settings = { ...DEFAULT_SETTINGS, calendar: { daysAhead } }
}
const lastParams = (): Record<string, unknown> => list.mock.calls.at(-1)![0]
const days = (iso: unknown): number =>
  Math.round((new Date(String(iso)).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)

describe('Calendar asks Google for as many days as the setting says', () => {
  const connector = new CalendarConnector()
  beforeEach(() => {
    list.mockClear()
    cursor = undefined
  })

  it('reads today and tomorrow by default', async () => {
    withDays(2)
    await connector.sync(ctx)
    expect(days(lastParams()['timeMax'])).toBe(2)
  })

  it('reads a week when asked', async () => {
    withDays(7)
    await connector.sync(ctx)
    expect(days(lastParams()['timeMax'])).toBe(7)
  })

  it('then only asks for changes while the setting stays the same', async () => {
    withDays(7)
    await connector.sync(ctx)
    await connector.sync(ctx)
    expect(lastParams()['syncToken']).toBe('token-1')
    expect(lastParams()['timeMax']).toBeUndefined()
  })

  it('starts over with the new window as soon as the setting changes', async () => {
    withDays(2)
    await connector.sync(ctx)
    withDays(14)
    await connector.sync(ctx)
    expect(lastParams()['syncToken']).toBeUndefined()
    expect(days(lastParams()['timeMax'])).toBe(14)
  })
})
