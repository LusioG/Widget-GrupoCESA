import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildAuthorizeUrl,
  challengeFor,
  exchangeCode,
  isWidgetUrl,
  needsRefresh,
  newPkce,
  newState,
  parseCallback,
  refreshTokens,
  SlackOAuthError
} from '../src/main/auth/slackOAuth'
import { SLACK_REDIRECT_URI, SLACK_USER_SCOPES } from '../src/shared/slackApp'

const NOW = 1_800_000_000_000

// A fake of Slack's token endpoint: it records what was sent and answers what it is told to.
function fakeSlack(answer: unknown): {
  http: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
    json(): Promise<unknown>
  }>
  sent: { url: string; params: URLSearchParams }[]
} {
  const sent: { url: string; params: URLSearchParams }[] = []
  return {
    sent,
    http: async (url, init) => {
      sent.push({ url, params: new URLSearchParams(init.body) })
      return { json: async () => answer }
    }
  }
}

describe('PKCE', () => {
  it('derives the challenge as the standard says (RFC 7636, appendix B)', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    )
  })

  it('makes a new random verifier each time, long enough, with its own challenge', () => {
    const a = newPkce()
    const b = newPkce()
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.challenge).toBe(challengeFor(a.verifier))
    expect(newState()).not.toBe(newState())
  })
})

describe('the page where the person says "Permitir"', () => {
  const url = new URL(
    buildAuthorizeUrl({ clientId: '123.456', state: 'abc', challenge: 'CHAL' })
  )

  it('goes to Slack and asks for the person\'s own read-only access, with PKCE', () => {
    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/v2/authorize')
    expect(url.searchParams.get('client_id')).toBe('123.456')
    expect(url.searchParams.get('state')).toBe('abc')
    expect(url.searchParams.get('code_challenge')).toBe('CHAL')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('redirect_uri')).toBe(SLACK_REDIRECT_URI)
    expect(url.searchParams.get('user_scope')).toBe(SLACK_USER_SCOPES.join(','))
  })

  it('asks for no bot and for no write permission', () => {
    expect(url.searchParams.has('scope')).toBe(false) // `scope` would be the bot's
    for (const scope of (url.searchParams.get('user_scope') ?? '').split(',')) {
      expect(scope).not.toMatch(/write|history|files|admin/)
    }
  })

  it('never carries a secret', () => {
    expect(url.toString()).not.toMatch(/secret/i)
  })
})

describe('what Slack sends the browser back to', () => {
  it('gives the code when it is for this sign-in', () => {
    expect(parseCallback('grupocesa-widget://slack?code=ABC&state=s1', 's1')).toEqual({ code: 'ABC' })
  })

  it('refuses an address with another state (not started by this widget)', () => {
    expect(parseCallback('grupocesa-widget://slack?code=ABC&state=otro', 's1')).toEqual({
      error: 'invalid'
    })
    expect(parseCallback('grupocesa-widget://slack?code=ABC', 's1')).toEqual({ error: 'invalid' })
  })

  it('knows when the person said no', () => {
    expect(parseCallback('grupocesa-widget://slack?error=access_denied&state=s1', 's1')).toEqual({
      error: 'denied'
    })
  })

  it('refuses what is not a widget address or has no code', () => {
    expect(parseCallback('https://evil.example/?code=ABC&state=s1', 's1')).toEqual({ error: 'invalid' })
    expect(parseCallback('grupocesa-widget://slack?state=s1', 's1')).toEqual({ error: 'invalid' })
    expect(parseCallback('no es una dirección', 's1')).toEqual({ error: 'invalid' })
  })

  it('recognises the widget addresses among the arguments of a start', () => {
    expect(isWidgetUrl('grupocesa-widget://slack?code=1')).toBe(true)
    expect(isWidgetUrl('GRUPOCESA-WIDGET://slack')).toBe(true)
    expect(isWidgetUrl('https://slack.com')).toBe(false)
    expect(['widget.exe', '--flag', 'grupocesa-widget://slack?code=1'].find(isWidgetUrl)).toBe(
      'grupocesa-widget://slack?code=1'
    )
  })
})

describe('swapping the code for the token', () => {
  const answer = {
    ok: true,
    authed_user: {
      id: 'U1',
      access_token: 'xoxe.xoxp-1-AAA',
      refresh_token: 'xoxe-1-RRR',
      expires_in: 43_200
    }
  }

  it('sends the verifier and never a client secret', async () => {
    const slack = fakeSlack(answer)
    await exchangeCode(
      { clientId: '123.456', code: 'CODE', verifier: 'VERIFIER' },
      { http: slack.http, now: NOW, apiBase: 'https://slack.test/api' }
    )
    expect(slack.sent).toHaveLength(1)
    expect(slack.sent[0].url).toBe('https://slack.test/api/oauth.v2.access')
    expect(Object.fromEntries(slack.sent[0].params)).toEqual({
      client_id: '123.456',
      code: 'CODE',
      code_verifier: 'VERIFIER',
      redirect_uri: SLACK_REDIRECT_URI
    })
  })

  it('keeps the token, how to renew it and when it expires', async () => {
    const tokens = await exchangeCode(
      { clientId: 'c', code: 'x', verifier: 'v' },
      { http: fakeSlack(answer).http, now: NOW }
    )
    expect(tokens).toEqual({
      accessToken: 'xoxe.xoxp-1-AAA',
      refreshToken: 'xoxe-1-RRR',
      expiresAt: NOW + 43_200 * 1000,
      userId: 'U1'
    })
  })

  it('accepts a token that never expires', async () => {
    const tokens = await exchangeCode(
      { clientId: 'c', code: 'x', verifier: 'v' },
      { http: fakeSlack({ ok: true, authed_user: { id: 'U1', access_token: 'xoxp-1-AAA' } }).http }
    )
    expect(tokens).toEqual({ accessToken: 'xoxp-1-AAA', userId: 'U1' })
  })

  it('fails with Slack\'s own reason, or when there is no token for the person', async () => {
    await expect(
      exchangeCode({ clientId: 'c', code: 'x', verifier: 'v' }, { http: fakeSlack({ ok: false, error: 'bad_code_verifier' }).http })
    ).rejects.toMatchObject({ code: 'bad_code_verifier' })
    await expect(
      exchangeCode({ clientId: 'c', code: 'x', verifier: 'v' }, { http: fakeSlack({ ok: true, access_token: undefined }).http })
    ).rejects.toBeInstanceOf(SlackOAuthError)
  })
})

describe('renewing a token that expires', () => {
  it('asks with the refresh token, with no client secret, and reads the new token at the top', async () => {
    const slack = fakeSlack({ ok: true, access_token: 'xoxe.xoxp-1-BBB', refresh_token: 'xoxe-1-SSS', expires_in: 43_200 })
    const tokens = await refreshTokens({ clientId: 'c', refreshToken: 'xoxe-1-RRR' }, { http: slack.http, now: NOW })
    expect(Object.fromEntries(slack.sent[0].params)).toEqual({
      client_id: 'c',
      grant_type: 'refresh_token',
      refresh_token: 'xoxe-1-RRR'
    })
    expect(tokens).toMatchObject({ accessToken: 'xoxe.xoxp-1-BBB', refreshToken: 'xoxe-1-SSS' })
    expect(tokens.expiresAt).toBe(NOW + 43_200 * 1000)
  })

  it('fails when Slack refuses (the refresh token is too old)', async () => {
    await expect(
      refreshTokens({ clientId: 'c', refreshToken: 'viejo' }, { http: fakeSlack({ ok: false, error: 'invalid_refresh_token' }).http })
    ).rejects.toMatchObject({ code: 'invalid_refresh_token' })
  })

  it('renews only a token that expires, a few minutes before it does', () => {
    const refreshToken = 'r'
    expect(needsRefresh({ refreshToken, expiresAt: NOW + 60 * 60 * 1000 }, NOW)).toBe(false)
    expect(needsRefresh({ refreshToken, expiresAt: NOW + 4 * 60 * 1000 }, NOW)).toBe(true)
    expect(needsRefresh({ refreshToken, expiresAt: NOW - 1000 }, NOW)).toBe(true)
    expect(needsRefresh({ expiresAt: NOW - 1000 }, NOW)).toBe(false) // nothing to renew it with
    expect(needsRefresh({ refreshToken }, NOW)).toBe(false) // a token by hand does not expire
  })
})

describe('no secret in the widget', () => {
  it('has no client secret anywhere in the sign-in code', () => {
    for (const file of ['src/main/auth/slackOAuth.ts', 'src/main/auth/slackSignIn.ts', 'src/shared/slackApp.ts']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/client_secret|CLIENT_SECRET|clientSecret/)
    }
  })
})
