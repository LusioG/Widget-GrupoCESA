import { createHash, randomBytes } from 'crypto'
import {
  SLACK_CLIENT_ID,
  SLACK_REDIRECT_URI,
  SLACK_USER_SCOPES,
  WIDGET_PROTOCOL
} from '../../shared/slackApp'

// Sign in with Slack as a desktop app: OAuth with PKCE. Nothing here needs Electron, so it is all
// tested on its own. There is NO client secret anywhere: PKCE (the code verifier) is the proof.

const AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize'
const DEFAULT_API = 'https://slack.com/api'
const REFRESH_MARGIN_MS = 5 * 60 * 1000 // renew a token that expires within 5 minutes

// The Client ID: the one built in, or another for tests and for trying a copy of the app.
export const slackClientId = (): string => process.env['SLACK_CLIENT_ID'] || SLACK_CLIENT_ID

export class SlackOAuthError extends Error {
  constructor(readonly code: string) {
    super(`Slack OAuth: ${code}`)
  }
}

// ---- PKCE ----

export const challengeFor = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url')

// A random verifier (64 characters, inside the 43..128 the standard allows) and its challenge.
export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url')
  return { verifier, challenge: challengeFor(verifier) }
}

export const newState = (): string => randomBytes(16).toString('hex')

// ---- the page where the person says "Permitir" ----

export function buildAuthorizeUrl(input: {
  clientId: string
  state: string
  challenge: string
  redirectUri?: string
  scopes?: readonly string[]
}): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', input.clientId)
  // user_scope, not scope: it is the person's own access. No bot is asked for.
  url.searchParams.set('user_scope', (input.scopes ?? SLACK_USER_SCOPES).join(','))
  url.searchParams.set('redirect_uri', input.redirectUri ?? SLACK_REDIRECT_URI)
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

// ---- what Slack sends back to the widget ----

export type Callback = { code: string } | { error: 'denied' | 'invalid' }

export const isWidgetUrl = (raw: string): boolean => raw.toLowerCase().startsWith(`${WIDGET_PROTOCOL}://`)

// "grupocesa-widget://slack?code=…&state=…" (or "?error=access_denied").
export function parseCallback(raw: string, expectedState: string): Callback {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { error: 'invalid' }
  }
  if (!isWidgetUrl(raw) || url.searchParams.get('state') !== expectedState) {
    return { error: 'invalid' } // not for this sign-in: never accept it
  }
  if (url.searchParams.get('error')) return { error: 'denied' }
  const code = url.searchParams.get('code')
  return code ? { code } : { error: 'invalid' }
}

// ---- the token ----

export type SlackTokens = {
  accessToken: string
  refreshToken?: string // only when Slack made the token expire
  expiresAt?: number // epoch ms
  userId?: string
}

type TokenResponse = {
  ok?: boolean
  error?: string
  access_token?: string
  refresh_token?: string
  expires_in?: number
  authed_user?: {
    id?: string
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
}

type Http = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  json(): Promise<unknown>
}>

type Options = { now?: number; apiBase?: string; http?: Http }

async function callAccess(params: Record<string, string>, options: Options): Promise<SlackTokens> {
  const http = options.http ?? ((url, init) => fetch(url, init))
  const res = await http(`${options.apiBase ?? process.env['SLACK_API_URL'] ?? DEFAULT_API}/oauth.v2.access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  })
  const data = (await res.json()) as TokenResponse
  if (!data.ok) throw new SlackOAuthError(data.error ?? 'unknown_error')

  // The first time the token is under `authed_user`; a renewal may bring it at the top.
  const source = data.authed_user?.access_token ? data.authed_user : data
  if (!source.access_token) throw new SlackOAuthError('no_user_token')
  return {
    accessToken: source.access_token,
    ...(source.refresh_token && { refreshToken: source.refresh_token }),
    ...(typeof source.expires_in === 'number' && {
      expiresAt: (options.now ?? Date.now()) + source.expires_in * 1000
    }),
    ...(data.authed_user?.id && { userId: data.authed_user.id })
  }
}

// Swaps the code for the token. The proof is the verifier: no client secret is sent.
export const exchangeCode = (
  input: { clientId: string; code: string; verifier: string; redirectUri?: string },
  options: Options = {}
): Promise<SlackTokens> =>
  callAccess(
    {
      client_id: input.clientId,
      code: input.code,
      code_verifier: input.verifier,
      redirect_uri: input.redirectUri ?? SLACK_REDIRECT_URI
    },
    options
  )

// A token that expires is renewed with its refresh token, again with no client secret.
export const refreshTokens = (
  input: { clientId: string; refreshToken: string },
  options: Options = {}
): Promise<SlackTokens> =>
  callAccess(
    { client_id: input.clientId, grant_type: 'refresh_token', refresh_token: input.refreshToken },
    options
  )

export function needsRefresh(
  tokens: { refreshToken?: string; expiresAt?: number },
  now: number
): boolean {
  return !!tokens.refreshToken && !!tokens.expiresAt && tokens.expiresAt - now < REFRESH_MARGIN_MS
}
