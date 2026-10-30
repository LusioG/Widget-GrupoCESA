import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for the encrypted secrets store.
const store = new Map<string, string>()
vi.mock('../src/main/auth/secrets', () => ({
  setSecret: (k: string, v: string) => void store.set(k, v),
  getSecret: (k: string) => store.get(k),
  hasSecret: (k: string) => store.has(k),
  deleteSecret: (k: string) => void store.delete(k)
}))

// Fake consent screen: records the requested scopes and answers with configurable tokens.
const consent = {
  requestedScopes: [] as string[],
  grant: (scopes: string[]): { refresh_token?: string; scope: string } => ({
    refresh_token: 'refresh-1',
    scope: scopes.join(' ')
  })
}
vi.mock('../src/main/auth/oauth', () => ({
  authorizeWithLoopback: async (opts: {
    buildAuthUrl: (r: string, s: string) => Promise<string> | string
    exchange: (code: string, r: string) => Promise<void>
  }) => {
    await opts.buildAuthUrl('http://127.0.0.1:1234', 'state')
    await opts.exchange('code', 'http://127.0.0.1:1234')
  }
}))
vi.mock('googleapis', () => {
  class OAuth2 {
    constructor(
      public id: string,
      public secret?: string
    ) {}
    async generateCodeVerifierAsync(): Promise<{ codeVerifier: string; codeChallenge: string }> {
      return { codeVerifier: 'v', codeChallenge: 'c' }
    }
    generateAuthUrl(o: {
      scope: string[]
      prompt?: string
      code_challenge_method?: string
    }): string {
      consent.requestedScopes = o.scope
      return `https://accounts.google.test/?prompt=${o.prompt}&method=${o.code_challenge_method}`
    }
    async getToken(): Promise<{ tokens: { refresh_token?: string; scope: string } }> {
      return { tokens: consent.grant(consent.requestedScopes) }
    }
    setCredentials(): void {
      /* the fake client needs no credentials */
    }
  }
  return {
    google: { auth: { OAuth2 } },
    Auth: { CodeChallengeMethod: { S256: 'S256' } }
  }
})

import {
  disableFeature,
  enableFeature,
  getFeatures,
  GOOGLE_SCOPES,
  isAuthFailure,
  isFeatureConnected,
  saveGoogleCredentials
} from '../src/main/connectors/google/auth'

beforeEach(() => {
  store.clear()
  consent.grant = (scopes) => ({ refresh_token: 'refresh-1', scope: scopes.join(' ') })
  saveGoogleCredentials('client-id', 'client-secret')
})

describe('shared Google login with separate features', () => {
  it('starts with nothing connected', () => {
    expect(isFeatureConnected('calendar')).toBe(false)
    expect(isFeatureConnected('gmail')).toBe(false)
  })

  it('enabling Calendar asks only for the Calendar scope, with PKCE and offline access', async () => {
    await enableFeature('calendar')
    expect(consent.requestedScopes).toEqual([GOOGLE_SCOPES.calendar])
    expect(isFeatureConnected('calendar')).toBe(true)
    expect(isFeatureConnected('gmail')).toBe(false)
  })

  it('enabling Gmail afterwards asks for BOTH scopes (no incremental auth on desktop)', async () => {
    await enableFeature('calendar')
    await enableFeature('gmail')
    expect([...consent.requestedScopes].sort()).toEqual(
      [GOOGLE_SCOPES.calendar, GOOGLE_SCOPES.gmail].sort()
    )
    expect(getFeatures()).toEqual({ calendar: true, gmail: true })
  })

  it('enabling Gmail alone asks only for the Gmail scope', async () => {
    await enableFeature('gmail')
    expect(consent.requestedScopes).toEqual([GOOGLE_SCOPES.gmail])
    expect(isFeatureConnected('calendar')).toBe(false)
  })

  it('turning one feature off keeps the other working and keeps the login', async () => {
    await enableFeature('calendar')
    await enableFeature('gmail')
    disableFeature('calendar')
    expect(isFeatureConnected('calendar')).toBe(false)
    expect(isFeatureConnected('gmail')).toBe(true)
    expect(store.has('google.refreshToken')).toBe(true)
  })

  it('removes the stored login when the last feature is turned off', async () => {
    await enableFeature('calendar')
    disableFeature('calendar')
    expect(store.has('google.refreshToken')).toBe(false)
    expect(isFeatureConnected('calendar')).toBe(false)
  })

  it('fails and changes nothing if Google did not grant the requested permission', async () => {
    consent.grant = () => ({ refresh_token: 'r', scope: 'openid' }) // user unticked the box
    await expect(enableFeature('gmail')).rejects.toThrow('Permission was not granted')
    expect(isFeatureConnected('gmail')).toBe(false)
    expect(store.has('google.refreshToken')).toBe(false)
  })

  it('fails if Google returns no refresh token', async () => {
    consent.grant = (scopes) => ({ scope: scopes.join(' ') })
    await expect(enableFeature('calendar')).rejects.toThrow('refresh token')
    expect(isFeatureConnected('calendar')).toBe(false)
  })

  it('a login saved before features existed counts as Calendar-only', () => {
    store.set('google.refreshToken', 'old-token')
    expect(getFeatures()).toEqual({ calendar: true, gmail: false })
    expect(isFeatureConnected('calendar')).toBe(true)
    expect(isFeatureConnected('gmail')).toBe(false)
  })

  it('a feature is never "connected" without a stored login', () => {
    store.set('google.features', JSON.stringify({ calendar: true, gmail: true }))
    expect(isFeatureConnected('calendar')).toBe(false)
  })
})

describe('isAuthFailure', () => {
  it('recognises revoked or insufficient access', () => {
    expect(isAuthFailure(Object.assign(new Error('x'), { code: 401 }))).toBe(true)
    expect(isAuthFailure(new Error('invalid_grant'))).toBe(true)
    expect(isAuthFailure(new Error('Request had insufficient authentication scopes'))).toBe(true)
    expect(isAuthFailure(new Error('Insufficient Permission'))).toBe(true)
  })

  it('does not treat network or server errors as auth failures', () => {
    expect(isAuthFailure(Object.assign(new Error('boom'), { code: 500 }))).toBe(false)
    expect(isAuthFailure(new Error('ECONNRESET'))).toBe(false)
  })
})
