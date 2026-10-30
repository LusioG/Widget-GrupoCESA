import { homedir } from 'os'
import { describe, expect, it } from 'vitest'
import { describeError, redact } from '../src/main/redact'

describe('redact', () => {
  it.each([
    ['Slack user token', 'token xoxp-1234567890-abcdefghij failed', 'xoxp-1234567890'],
    ['Slack bot token', 'xoxb-111111111111-222222222222-abcdefABCDEF', 'xoxb-111111111111'],
    ['Slack app token', 'app xapp-1-A0123456789-0123456789-abcdef', 'xapp-1-A0123456789'],
    ['ClickUp token', 'Authorization pk_12345678_ABCDEFGHIJKLMNOP', 'pk_12345678'],
    ['Google access token', 'got ya29.a0AfH6SMBxxxxxxxxxxxxxxxx', 'ya29.a0AfH6SMB'],
    ['Google refresh token', 'refresh 1//0gAbCdEfGhIjKlMnOpQrStUvWx', '1//0gAbCdEfGh'],
    ['Bearer header', 'Authorization: Bearer abc123DEF456ghi789', 'abc123DEF456ghi789'],
    ['JWT', 'id eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJl', 'eyJhbGciOiJSUzI1NiJ9'],
    ['OAuth code in a URL', 'GET /?code=4/0AX4XfWhSecretCode&state=abc123', '4/0AX4XfWhSecretCode'],
    [
      'client secret in a URL',
      'https://x.test/token?client_secret=GOCSPX-abcdef&x=1',
      'GOCSPX-abcdef'
    ],
    ['e-mail address', 'sender luciano@grupocesa.net failed', 'luciano@grupocesa.net'],
    ['long opaque string', `id ${'A1b2C3d4'.repeat(6)}`, 'A1b2C3d4A1b2C3d4']
  ])('masks a %s', (_name, input, secret) => {
    const out = redact(input)
    expect(out).not.toContain(secret)
    expect(out).toMatch(/\[|redacted/i)
  })

  it('keeps ordinary text readable', () => {
    expect(redact('sync failed for source clickup after 3 retries')).toBe(
      'sync failed for source clickup after 3 retries'
    )
  })

  it('keeps the shape of the message around a masked token', () => {
    expect(redact('Slack rejected xoxp-1234567890-abcdefghij (invalid_auth)')).toBe(
      'Slack rejected [slack-token] (invalid_auth)'
    )
  })

  it('hides the Windows user name that appears in file paths', () => {
    const out = redact(`at ${homedir()}\\widget\\src\\main\\index.ts:10`)
    expect(out).not.toContain(homedir())
    expect(out).toContain('~')
  })

  it('truncates absurdly long lines', () => {
    expect(redact('word '.repeat(2000)).length).toBeLessThanOrEqual(2001)
  })
})

describe('describeError', () => {
  it('summarises an error with name, message and the top of the stack', () => {
    const e = new TypeError('boom')
    const out = describeError(e)
    expect(out).toMatch(/^TypeError: boom/)
    expect(out.split('|').length).toBeLessThanOrEqual(3)
  })

  it('masks secrets that end up inside an error message', () => {
    const out = describeError(new Error('request failed with token xoxp-9999999999-abcdefghij'))
    expect(out).not.toContain('xoxp-9999999999')
  })

  it('handles non-Error values', () => {
    expect(describeError('plain string xapp-1-A0123456789-abcdef')).not.toContain('A0123456789')
    expect(describeError({ some: 'object' })).toBe('Unknown error')
    expect(describeError(undefined)).toBe('Unknown error')
  })
})
