import type { Signal, Source } from '../../shared/types'

// Every connector is read-only: it must never create, edit or delete data in the service.
export interface Connector {
  id: Source
  isConnected(): Promise<boolean>
  connect(): Promise<void> // validates stored credentials / opens the OAuth flow
  disconnect(): Promise<void> // deletes the token; the caller clears the cache
  sync(ctx: ConnectorContext): Promise<Signal[]> // full current set; incremental inside when possible
  // Push-based connectors (Slack) keep a connection open instead of being polled.
  start?(ctx: ConnectorContext, handlers: RealtimeHandlers): Promise<void>
  stop?(): Promise<void>
}

export type RealtimeHandlers = {
  onSignals(signals: Signal[]): void // the complete current set for the source
  onAuthError(): void // credentials were revoked: the user must reconnect
  onStatus(connected: boolean): void
}

export type ConnectorContext = {
  getCursor(): Promise<string | undefined>
  setCursor(cursor: string | undefined): Promise<void>
  loadCached(): Promise<Signal[]>
}

// Thrown when Google answers that the API is switched off in the user's own Cloud project.
// Nothing is wrong with the login: the user has to enable the API and it starts working.
export class ApiDisabledError extends Error {
  constructor(
    readonly source: Source,
    readonly activationUrl?: string
  ) {
    super('API disabled in the Google Cloud project')
    this.name = 'ApiDisabledError'
  }
}

// Thrown when the credentials are no longer valid: the account becomes "needs reconnect".
export class AuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message)
    this.name = 'AuthError'
  }
}
