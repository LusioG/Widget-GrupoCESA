import type {
  ActionResult,
  ClickUpList,
  GmailLabel,
  GoogleFeature,
  SlackChannel,
  Source
} from '../shared/types'
import { clearSourceSignals, getAccount, publish, setAccount, setSourceSignals } from './appState'
import { CalendarConnector } from './connectors/calendar'
import { ClickUpConnector } from './connectors/clickup'
import { GmailConnector } from './connectors/gmail'
import { hasGoogleCredentials, saveGoogleCredentials } from './connectors/google/auth'
import { SlackConnector } from './connectors/slack'
import {
  ApiDisabledError,
  AuthError,
  type Connector,
  type RealtimeHandlers
} from './connectors/types'
import {
  clearSource,
  getSyncState,
  loadCachedSignals,
  replaceCachedSignals,
  saveSyncState
} from './db/repos'
import { logInfo, logWarn } from './logger'
import { contextFor, haltSource, registerConnector, syncNow } from './scheduler'

const clickup = new ClickUpConnector()
const calendar = new CalendarConnector()
const gmail = new GmailConnector()
const slack = new SlackConnector()
const connectors: Record<Source, Connector> = { clickup, calendar, gmail, slack }

const CLICKUP_POLL_MS = 5 * 60 * 1000
const CALENDAR_POLL_MS = 60 * 1000 // an incremental check is one tiny request
const GMAIL_POLL_MS = 90 * 1000 // 1-2 minutes

export { hasGoogleCredentials }

export async function initAccounts(): Promise<void> {
  registerConnector(clickup, CLICKUP_POLL_MS)
  registerConnector(calendar, CALENDAR_POLL_MS)
  registerConnector(gmail, GMAIL_POLL_MS) // Slack is push-based and is not polled

  for (const [source, connector] of Object.entries(connectors) as [Source, Connector][]) {
    if (!(await connector.isConnected())) continue
    const state = await getSyncState(source)
    const status = state?.status === 'needs_reconnect' ? 'needs_reconnect' : 'connected'
    setAccount(source, { status, lastSyncAt: state?.lastSyncAt ?? undefined })
    setSourceSignals(source, await loadCachedSignals(source)) // last known data while syncing
    if (status === 'needs_reconnect') haltSource(source)
  }
}

// ---- push-based connectors (Slack) ----

function realtimeHandlers(source: Source): RealtimeHandlers {
  return {
    onSignals: (signals) => {
      void replaceCachedSignals(source, signals)
      setSourceSignals(source, signals)
    },
    onAuthError: () => {
      logWarn('realtime', `${source}: credentials rejected, the account must be reconnected`)
      void saveSyncState(source, { status: 'needs_reconnect', error: 'auth' })
      setAccount(source, { status: 'needs_reconnect', error: 'auth' })
      void connectors[source].stop?.()
    },
    onStatus: (online) => {
      logInfo('realtime', `${source}: ${online ? 'connected' : 'connection lost, reconnecting'}`)
      const lastSyncAt = Date.now()
      if (online) void saveSyncState(source, { status: 'connected', lastSyncAt, error: null })
      // Losing the network is not a disconnection: keep the account and show "reconnecting".
      setAccount(source, { status: 'connected', lastSyncAt, error: online ? undefined : 'offline' })
    }
  }
}

async function startRealtime(source: Source): Promise<void> {
  const connector = connectors[source]
  if (!connector.start) return
  await connector.start(contextFor(source), realtimeHandlers(source))
}

// After sleep or a network change a socket can be silently dead: start the connections over.
export async function restartRealtimeConnectors(): Promise<void> {
  for (const source of Object.keys(connectors) as Source[]) {
    const connector = connectors[source]
    if (!connector.start || !(await connector.isConnected())) continue
    if ((await getSyncState(source))?.status === 'needs_reconnect') continue
    await connector.stop?.()
    await startRealtime(source).catch((error) =>
      logWarn('realtime', `${source}: could not restart`, error)
    )
  }
}

// After launch, wait a bit before opening connections so startup stays quiet.
export function startRealtimeConnectors(delayMs: number): void {
  setTimeout(async () => {
    for (const source of Object.keys(connectors) as Source[]) {
      const connector = connectors[source]
      if (!connector.start || !(await connector.isConnected())) continue
      if ((await getSyncState(source))?.status === 'needs_reconnect') continue
      await startRealtime(source).catch((error) =>
        logWarn('realtime', `${source}: could not start`, error)
      )
    }
  }, delayMs)
}

// ---- connecting / disconnecting ----

function describe(error: unknown, fallback: string): string {
  if (error instanceof AuthError) return 'La cuenta rechazó las credenciales.'
  const message = error instanceof Error ? error.message : ''
  if (message === 'Authorization timed out')
    return 'Se agotó el tiempo de espera de la autorización.'
  if (message === 'Authorization denied') return 'La autorización fue cancelada.'
  if (message === 'Permission was not granted') {
    return 'Google no concedió el permiso. Vuelve a intentarlo y acepta todos los permisos.'
  }
  return fallback
}

async function markConnected(source: Source): Promise<void> {
  await saveSyncState(source, { status: 'connected', error: null })
  setAccount(source, { status: 'connected' })
  syncNow(source)
}

export async function connectClickUp(token: string): Promise<ActionResult> {
  if (!token.trim()) return { ok: false, error: 'Pega tu token personal de ClickUp.' }
  try {
    clickup.setToken(token)
    await clickup.connect() // validates the token against the API
    await markConnected('clickup')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: describe(error, 'No se pudo conectar con ClickUp.') }
  }
}

export async function connectSlack(appToken: string, userToken: string): Promise<ActionResult> {
  if (!appToken.trim().startsWith('xapp-')) {
    return { ok: false, error: 'El token de la app debe empezar con xapp-.' }
  }
  if (!userToken.trim().startsWith('xoxp-')) {
    return { ok: false, error: 'El token de usuario debe empezar con xoxp-.' }
  }
  try {
    slack.setTokens(appToken, userToken)
    await slack.connect() // validates the user token
    await markConnected('slack')
    await startRealtime('slack')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: describe(error, 'No se pudo conectar con Slack.') }
  }
}

export function saveGoogleClient(clientId: string, clientSecret: string): ActionResult {
  if (!clientId.trim()) return { ok: false, error: 'Falta el Client ID de Google.' }
  try {
    saveGoogleCredentials(clientId, clientSecret)
    publish()
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudieron guardar las credenciales de forma segura.' }
  }
}

export async function connectGoogle(feature: GoogleFeature): Promise<ActionResult> {
  if (!hasGoogleCredentials()) return { ok: false, error: 'Primero guarda el Client ID de Google.' }
  try {
    await connectors[feature].connect()
    await markConnected(feature)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: describe(
        error,
        `No se pudo conectar con ${feature === 'gmail' ? 'Gmail' : 'Google Calendar'}.`
      )
    }
  }
}

// Disconnecting deletes the token, the cached signals and the sync state of that source.
export async function disconnectAccount(source: Source): Promise<void> {
  haltSource(source)
  await connectors[source].disconnect()
  await clearSource(source)
  clearSourceSignals(source)
  setAccount(source, { status: 'disconnected' })
}

// ---- lists for "what to watch" ----

async function guarded<T>(source: Source, fn: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof AuthError) {
      await saveSyncState(source, { status: 'needs_reconnect', error: 'auth' })
      setAccount(source, { status: 'needs_reconnect', error: 'auth' })
    } else if (error instanceof ApiDisabledError) {
      setAccount(source, {
        ...getAccount(source),
        status: 'connected',
        error: 'api_disabled',
        errorUrl: error.activationUrl
      })
    }
    return empty
  }
}

export const listClickUpLists = (): Promise<ClickUpList[]> =>
  guarded('clickup', () => clickup.listWatchable(), [])

export const listGmailLabels = (): Promise<GmailLabel[]> =>
  guarded('gmail', () => gmail.listWatchableLabels(), [])

export const listSlackChannels = (): Promise<SlackChannel[]> =>
  guarded('slack', () => slack.listChannels(), [])

export { syncNow }
