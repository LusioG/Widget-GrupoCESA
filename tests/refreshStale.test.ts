import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Connector } from '../src/main/connectors/types'

// The scheduler only needs somewhere to save results; the network is a fake connector.
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../src/main/db/repos', () => ({
  getSyncState: async () => undefined,
  loadCachedSignals: async () => [],
  replaceCachedSignals: async () => undefined,
  saveSyncState: async () => undefined
}))
vi.mock('../src/main/settingsStore', async () => {
  const { DEFAULT_SETTINGS } = await import('../src/shared/settingsSchema')
  return { getSettings: () => DEFAULT_SETTINGS }
})
vi.mock('../src/main/autostart', () => ({ getAutostart: () => false }))
vi.mock('../src/main/connectors/google/auth', () => ({ hasGoogleCredentials: () => false }))

const { refreshStale, registerConnector, startScheduler, refreshAll } =
  await import('../src/main/scheduler')

const POLL_MS = 60_000
const sync = vi.fn(async () => [])
const connector = {
  id: 'calendar',
  isConnected: async () => true,
  connect: async () => undefined,
  disconnect: async () => undefined,
  sync
} as unknown as Connector

describe('refreshStale (opening the panel)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sync.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('does nothing before the scheduler has started', async () => {
    registerConnector(connector, POLL_MS)
    refreshStale(30_000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(sync).not.toHaveBeenCalled()
  })

  it('checks right away what has never been checked or is older than the limit', async () => {
    startScheduler(10 * 60_000) // first sync far away, so only refreshStale can trigger it
    refreshStale(30_000)
    await vi.advanceTimersByTimeAsync(100)
    expect(sync).toHaveBeenCalledTimes(1)
  })

  it('leaves alone anything checked within the limit', async () => {
    await refreshAll() // a check that just happened
    sync.mockClear()
    refreshStale(30_000)
    await vi.advanceTimersByTimeAsync(100)
    expect(sync).not.toHaveBeenCalled()
  })

  it('checks again once the data is older than the limit', async () => {
    await refreshAll()
    sync.mockClear()
    await vi.advanceTimersByTimeAsync(31_000)
    refreshStale(30_000)
    await vi.advanceTimersByTimeAsync(100)
    expect(sync).toHaveBeenCalled()
  })
})
