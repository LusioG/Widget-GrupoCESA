import type { Auth as GoogleAuth } from 'googleapis'
import type { GoogleFeature } from '../../../shared/types'
import { authorizeWithLoopback } from '../../auth/oauth'
import { deleteSecret, getSecret, hasSecret, setSecret } from '../../auth/secrets'
import { AuthError } from '../types'
import { apiDisabledInfo, httpStatus } from './errors'

// Narrowest read-only scopes that cover what each feature needs.
// gmail.metadata: headers and labels only, never the message body.
export const GOOGLE_SCOPES: Record<GoogleFeature, string> = {
  calendar: 'https://www.googleapis.com/auth/calendar.events.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.metadata'
}

const KEYS = {
  clientId: 'google.clientId',
  clientSecret: 'google.clientSecret',
  refreshToken: 'google.refreshToken',
  features: 'google.features'
} as const

type Features = Record<GoogleFeature, boolean>

export function hasGoogleCredentials(): boolean {
  return hasSecret(KEYS.clientId)
}

export function saveGoogleCredentials(clientId: string, clientSecret: string): void {
  setSecret(KEYS.clientId, clientId.trim())
  if (clientSecret.trim()) setSecret(KEYS.clientSecret, clientSecret.trim())
  else deleteSecret(KEYS.clientSecret)
}

export function getFeatures(): Features {
  const stored = getSecret(KEYS.features)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Features>
      return { calendar: !!parsed.calendar, gmail: !!parsed.gmail }
    } catch {
      // fall through to the default
    }
  }
  // A token saved before features existed was a Calendar-only login.
  return { calendar: hasSecret(KEYS.refreshToken), gmail: false }
}

const saveFeatures = (features: Features): void =>
  setSecret(KEYS.features, JSON.stringify(features))

export function isFeatureConnected(feature: GoogleFeature): boolean {
  return hasSecret(KEYS.refreshToken) && getFeatures()[feature]
}

export async function oauthClient(): Promise<GoogleAuth.OAuth2Client> {
  const clientId = getSecret(KEYS.clientId)
  if (!clientId) throw new Error('Google credentials are not configured')
  const { google } = await import('googleapis') // heavy: loaded on demand
  return new google.auth.OAuth2(clientId, getSecret(KEYS.clientSecret))
}

// An OAuth client that already carries the stored refresh token.
export async function authorizedClient(): Promise<GoogleAuth.OAuth2Client> {
  const refreshToken = getSecret(KEYS.refreshToken)
  if (!refreshToken) throw new AuthError('Not connected to Google')
  const client = await oauthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

// Desktop apps cannot add scopes to an existing grant, so enabling a feature asks for the
// scopes of every enabled feature again and replaces the stored token.
export async function enableFeature(feature: GoogleFeature): Promise<void> {
  const next: Features = { ...getFeatures(), [feature]: true }
  const scopes = (Object.keys(next) as GoogleFeature[])
    .filter((f) => next[f])
    .map((f) => GOOGLE_SCOPES[f])

  const client = await oauthClient()
  const { Auth } = await import('googleapis')
  let codeVerifier = ''

  await authorizeWithLoopback({
    buildAuthUrl: async (redirectUri, state) => {
      const pkce = await client.generateCodeVerifierAsync()
      codeVerifier = pkce.codeVerifier
      return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state,
        redirect_uri: redirectUri,
        code_challenge: pkce.codeChallenge,
        code_challenge_method: Auth.CodeChallengeMethod.S256
      })
    },
    exchange: async (code, redirectUri) => {
      const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirectUri })
      if (!tokens.refresh_token) throw new Error('Google did not return a refresh token')
      // Google lets the user untick individual permissions: make sure ours was granted.
      const granted = (tokens.scope ?? '').split(' ')
      if (!granted.includes(GOOGLE_SCOPES[feature])) throw new Error('Permission was not granted')
      setSecret(KEYS.refreshToken, tokens.refresh_token)
      saveFeatures(next)
    }
  })
}

// Turns one feature off; the login itself is removed when nothing is left.
export function disableFeature(feature: GoogleFeature): void {
  const next: Features = { ...getFeatures(), [feature]: false }
  saveFeatures(next)
  if (!next.calendar && !next.gmail) deleteSecret(KEYS.refreshToken)
}

export { apiDisabledInfo, httpStatus }

// 401 / invalid_grant / revoked access means the user must reconnect.
export function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return (
    httpStatus(error) === 401 || /invalid_grant|insufficient.*(scope|permission)/i.test(message)
  )
}
