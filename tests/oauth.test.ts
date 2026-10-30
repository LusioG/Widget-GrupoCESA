import { beforeEach, describe, expect, it, vi } from 'vitest'

const openExternal = vi.fn<(url: string) => Promise<void>>()
vi.mock('electron', () => ({ shell: { openExternal: (url: string) => openExternal(url) } }))

import { authorizeWithLoopback } from '../src/main/auth/oauth'

// Plays the part of the browser: follows the redirect to the app's local listener.
async function browser(authUrl: string, params: Record<string, string>): Promise<Response> {
  const redirect = new URL(authUrl).searchParams.get('redirect_uri')!
  const url = new URL(redirect)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return fetch(url)
}

// Braces matter: returning the mock from beforeEach would make Vitest call it as a cleanup hook.
beforeEach(() => {
  openExternal.mockReset()
})

describe('authorizeWithLoopback', () => {
  it('uses a 127.0.0.1 redirect on a free port and passes a random state', async () => {
    let seen: { redirectUri: string; state: string } | undefined
    openExternal.mockImplementation(async (authUrl) => {
      void browser(authUrl, { code: 'abc', state: new URL(authUrl).searchParams.get('state')! })
    })
    await authorizeWithLoopback({
      buildAuthUrl: (redirectUri, state) => {
        seen = { redirectUri, state }
        return `https://accounts.example/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
      },
      exchange: async () => undefined
    })
    expect(seen?.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(Number(new URL(seen!.redirectUri).port)).toBeGreaterThan(1023)
    expect(seen?.state).toMatch(/^[0-9a-f]{32}$/)
  })

  it('opens the system browser and exchanges the returned code', async () => {
    const exchange = vi.fn(async () => undefined)
    openExternal.mockImplementation(async (authUrl) => {
      void browser(authUrl, {
        code: 'the-code',
        state: new URL(authUrl).searchParams.get('state')!
      })
    })
    await authorizeWithLoopback({
      buildAuthUrl: (redirectUri, state) =>
        `https://accounts.example/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
      exchange
    })
    expect(openExternal).toHaveBeenCalledOnce()
    expect(exchange).toHaveBeenCalledOnce()
    const [code, redirectUri] = exchange.mock.calls[0] as unknown as [string, string]
    expect(code).toBe('the-code')
    expect(redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('rejects a response with the wrong state (CSRF) and keeps waiting for the real one', async () => {
    const exchange = vi.fn(async () => undefined)
    let bad: Response | undefined
    openExternal.mockImplementation(async (authUrl) => {
      const state = new URL(authUrl).searchParams.get('state')!
      void (async () => {
        bad = await browser(authUrl, { code: 'evil', state: 'forged' })
        await browser(authUrl, { code: 'good', state })
      })()
    })
    await authorizeWithLoopback({
      buildAuthUrl: (redirectUri, state) =>
        `https://accounts.example/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
      exchange
    })
    expect(bad?.status).toBe(400)
    expect(exchange).toHaveBeenCalledTimes(1)
    expect((exchange.mock.calls[0] as unknown as [string])[0]).toBe('good')
  })

  it('rejects when the user denies access', async () => {
    openExternal.mockImplementation(async (authUrl) => {
      void browser(authUrl, {
        error: 'access_denied',
        state: new URL(authUrl).searchParams.get('state')!
      })
    })
    await expect(
      authorizeWithLoopback({
        buildAuthUrl: (redirectUri, state) =>
          `https://accounts.example/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
        exchange: async () => undefined
      })
    ).rejects.toThrow('Authorization denied')
  })

  it('times out if the user never comes back', async () => {
    openExternal.mockResolvedValue(undefined)
    await expect(
      authorizeWithLoopback({
        buildAuthUrl: () => 'https://accounts.example/auth',
        exchange: async () => undefined,
        timeoutMs: 150
      })
    ).rejects.toThrow('Authorization timed out')
  })

  it('propagates an exchange failure', async () => {
    openExternal.mockImplementation(async (authUrl) => {
      void browser(authUrl, { code: 'c', state: new URL(authUrl).searchParams.get('state')! })
    })
    await expect(
      authorizeWithLoopback({
        buildAuthUrl: (redirectUri, state) =>
          `https://accounts.example/auth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
        exchange: async () => {
          throw new Error('token endpoint said no')
        }
      })
    ).rejects.toThrow('token endpoint said no')
  })
})
