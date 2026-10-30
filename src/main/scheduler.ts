import type { Source } from '../shared/types'
import { getAccount, isPaused, setAccount, setSourceSignals } from './appState'
import {
  ApiDisabledError,
  AuthError,
  type Connector,
  type ConnectorContext
} from './connectors/types'
import { getSyncState, loadCachedSignals, replaceCachedSignals, saveSyncState } from './db/repos'
import { nextDelay } from './engine/backoff'
import { logWarn } from './logger'

export { nextDelay }

const RETRY_BASE_MS = 30_000

type Task = {
  connector: Connector
  baseMs: number
  failures: number
  halted: boolean // needs reconnect: stop polling until the user reconnects
  timer?: NodeJS.Timeout
  running: boolean
  lastRunAt: number // when it last finished, to refresh stale data when the panel opens
}

const tasks = new Map<Source, Task>()
let started = false

export function registerConnector(connector: Connector, baseMs: number): void {
  tasks.set(connector.id, {
    connector,
    baseMs,
    failures: 0,
    halted: false,
    running: false,
    lastRunAt: 0
  })
}

export function contextFor(source: Source): ConnectorContext {
  return {
    getCursor: async () => (await getSyncState(source))?.cursor ?? undefined,
    setCursor: (cursor) => saveSyncState(source, { cursor: cursor ?? null }),
    loadCached: () => loadCachedSignals(source)
  }
}

function schedule(task: Task, delay: number): void {
  if (task.timer) clearTimeout(task.timer)
  task.timer = setTimeout(() => void run(task), delay)
}

// `force`: the user asked to refresh, so it runs even while alerts are paused.
async function run(task: Task, force = false): Promise<void> {
  const { connector } = task
  if (task.running) return
  task.running = true
  let delay = task.baseMs
  try {
    // "Do not disturb": keep the timer alive but skip the network work.
    if ((isPaused() && !force) || task.halted || !(await connector.isConnected())) return

    const signals = await connector.sync(contextFor(connector.id))
    await replaceCachedSignals(connector.id, signals)
    setSourceSignals(connector.id, signals)
    const lastSyncAt = Date.now()
    await saveSyncState(connector.id, { status: 'connected', lastSyncAt, error: null })
    setAccount(connector.id, { status: 'connected', lastSyncAt })
    task.failures = 0
  } catch (error) {
    if (error instanceof ApiDisabledError) {
      // The login is fine; the API is off in the user's Cloud project. Keep retrying (it starts
      // working as soon as they enable it) and say exactly what to do.
      task.failures += 1
      delay = Math.min(nextDelay(RETRY_BASE_MS, task.failures - 1), task.baseMs * 2)
      logWarn('sync', `${connector.id}: the API is not enabled in the Google Cloud project`)
      await saveSyncState(connector.id, { error: 'api_disabled' }).catch(() => undefined)
      setAccount(connector.id, {
        ...getAccount(connector.id),
        status: 'connected',
        error: 'api_disabled',
        errorUrl: error.activationUrl
      })
    } else if (error instanceof AuthError) {
      task.halted = true
      logWarn('sync', `${connector.id}: credentials rejected, the account must be reconnected`)
      await saveSyncState(connector.id, { status: 'needs_reconnect', error: 'auth' }).catch(
        () => undefined
      )
      setAccount(connector.id, { status: 'needs_reconnect', error: 'auth' })
    } else {
      task.failures += 1
      // Retry soon after a failure (30 s, 1 min, 2 min...), not a whole polling period later.
      delay = Math.min(nextDelay(RETRY_BASE_MS, task.failures - 1), task.baseMs * 2)
      logWarn(
        'sync',
        `${connector.id}: sync failed (attempt ${task.failures}), retrying in ${Math.round(delay / 1000)} s`,
        error
      )
      await saveSyncState(connector.id, { error: 'sync' }).catch(() => undefined)
      // Still connected, but tell the user the data may be stale and that it will retry.
      setAccount(connector.id, { ...getAccount(connector.id), status: 'connected', error: 'sync' })
    }
  } finally {
    task.running = false
    task.lastRunAt = Date.now()
    if (started) schedule(task, delay)
  }
}

// The first sync waits a bit after launch so the app starts quietly.
export function startScheduler(initialDelayMs: number): void {
  started = true
  for (const task of tasks.values()) schedule(task, initialDelayMs)
}

// After waking from sleep or regaining the network: check every account right away.
export function syncAll(): void {
  for (const task of tasks.values()) {
    if (!task.halted) {
      task.failures = 0
      schedule(task, 0)
    }
  }
}

// Opening the panel: anything not checked in the last maxAgeMs is checked now, so what you see
// is never older than that, without waiting for the next polling cycle.
export function refreshStale(maxAgeMs: number): void {
  if (!started) return
  const now = Date.now()
  for (const task of tasks.values()) {
    if (task.halted || task.running || now - task.lastRunAt < maxAgeMs) continue
    schedule(task, 0)
  }
}

// "Actualizar" button: every account that is not waiting to be reconnected is checked now, and
// this resolves once they have all answered (or failed).
export async function refreshAll(): Promise<void> {
  const running: Promise<void>[] = []
  for (const task of tasks.values()) {
    if (task.halted) continue
    task.failures = 0
    running.push(run(task, true))
  }
  await Promise.all(running)
}

export function syncNow(source: Source): void {
  const task = tasks.get(source)
  if (!task) return
  task.halted = false
  task.failures = 0
  schedule(task, 0)
}

export function haltSource(source: Source): void {
  const task = tasks.get(source)
  if (!task) return
  task.halted = true
}
