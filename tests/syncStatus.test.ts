import { describe, expect, it } from 'vitest'
import { syncSummary } from '../src/shared/syncStatus'
import type { AccountInfo, Source } from '../src/shared/types'
import { apiDisabledInfo } from '../src/main/connectors/google/errors'

const accounts = (over: Partial<Record<Source, AccountInfo>>): Record<Source, AccountInfo> => ({
  clickup: { status: 'disconnected' },
  calendar: { status: 'disconnected' },
  slack: { status: 'disconnected' },
  gmail: { status: 'disconnected' },
  ...over
})

describe('syncSummary', () => {
  it('has nothing to say with no accounts', () => {
    expect(syncSummary(accounts({}))).toEqual({
      lastSyncAt: undefined,
      problems: [],
      apiDisabled: []
    })
  })

  it('uses the most recent sync of the connected accounts', () => {
    const s = syncSummary(
      accounts({
        clickup: { status: 'connected', lastSyncAt: 1000 },
        gmail: { status: 'connected', lastSyncAt: 5000 },
        slack: { status: 'needs_reconnect', lastSyncAt: 9000 } // not connected: ignored
      })
    )
    expect(s.lastSyncAt).toBe(5000)
  })

  it('lists accounts whose last check failed', () => {
    const s = syncSummary(
      accounts({
        clickup: { status: 'connected', lastSyncAt: 1, error: 'sync' },
        slack: { status: 'connected', lastSyncAt: 1, error: 'offline' },
        gmail: { status: 'connected', lastSyncAt: 1 }
      })
    )
    expect(s.problems.sort()).toEqual(['clickup', 'slack'])
  })

  it("reports a disabled Google API with Google's own link, or a fallback one", () => {
    const s = syncSummary(
      accounts({
        gmail: {
          status: 'connected',
          error: 'api_disabled',
          errorUrl:
            'https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=1'
        },
        calendar: { status: 'connected', error: 'api_disabled' }
      })
    )
    expect(s.apiDisabled).toEqual([
      {
        source: 'calendar',
        url: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com'
      },
      {
        source: 'gmail',
        url: 'https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=1'
      }
    ])
    expect(s.problems).toEqual([]) // it is not a connection problem
  })
})

describe('apiDisabledInfo', () => {
  const url =
    'https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=571708439320'
  const googleError = (status: number, message: string, extra: object = {}): unknown =>
    Object.assign(new Error(message), { status, ...extra })

  it('recognizes the "has not been used in project" answer and extracts the link', () => {
    const error = googleError(
      403,
      `Gmail API has not been used in project 571708439320 before or it is disabled. Enable it by visiting ${url} then retry.`
    )
    expect(apiDisabledInfo(error)).toEqual({ url })
  })

  it('takes the activation link from the error details when there is one', () => {
    const error = googleError(403, 'Forbidden', {
      response: {
        status: 403,
        data: {
          error: {
            message: 'x',
            details: [{ reason: 'SERVICE_DISABLED', metadata: { activationUrl: url } }]
          }
        }
      }
    })
    expect(apiDisabledInfo(error)).toEqual({ url })
  })

  it('recognizes accessNotConfigured even without a link', () => {
    const error = googleError(403, 'Forbidden', { errors: [{ reason: 'accessNotConfigured' }] })
    expect(apiDisabledInfo(error)).toEqual({ url: undefined })
  })

  it("never offers a link outside Google's console", () => {
    const error = googleError(
      403,
      'API has not been used in project 1 before or it is disabled. Visit https://evil.example/phish then retry.'
    )
    expect(apiDisabledInfo(error)).toEqual({ url: undefined })
  })

  it('ignores other errors', () => {
    expect(apiDisabledInfo(googleError(403, 'The caller does not have permission'))).toBeNull()
    expect(apiDisabledInfo(googleError(401, 'Invalid Credentials'))).toBeNull()
    expect(apiDisabledInfo(googleError(500, 'API has not been used in project'))).toBeNull()
    expect(apiDisabledInfo(new Error('network'))).toBeNull()
  })
})
