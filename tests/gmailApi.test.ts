import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { google } from 'googleapis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGoogleGmailApi } from '../src/main/connectors/gmail/api'
import type { GmailApi } from '../src/main/connectors/gmail/types'

// The real `googleapis` client talking to a local fake of the Gmail REST API.
const requests: { method: string; path: string; query: URLSearchParams; auth?: string }[] = []

const message = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  threadId: `t-${id}`,
  labelIds: ['INBOX', 'UNREAD'],
  snippet: 'Hola &amp; gracias',
  internalDate: '1800000000000',
  payload: {
    headers: [
      { name: 'From', value: 'Ana <ana@x.com>' },
      { name: 'Subject', value: 'Contrato' },
      { name: 'List-Unsubscribe', value: '<mailto:x@y.com>' }
    ]
  },
  ...extra
})

let server: Server
let api: GmailApi

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    requests.push({
      method: req.method ?? '',
      path: url.pathname,
      query: url.searchParams,
      auth: req.headers.authorization
    })
    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    const p = url.pathname.replace('/gmail/v1/users/me', '')

    if (p === '/profile') return json(200, { emailAddress: 'yo@cesa.com', historyId: '200' })
    if (p === '/messages') {
      return json(200, {
        messages: [
          { id: 'm1', threadId: 't-m1' },
          { id: 'm2', threadId: 't-m2' }
        ]
      })
    }
    if (p === '/messages/gone') return json(404, { error: { code: 404, message: 'Not Found' } })
    if (p.startsWith('/messages/')) return json(200, message(p.split('/')[2]))
    if (p === '/history') {
      if (url.searchParams.get('startHistoryId') === '1') {
        return json(404, { error: { code: 404, message: 'Requested entity was not found.' } })
      }
      if (url.searchParams.get('pageToken') === 'page2') {
        return json(200, {
          history: [{ id: '212', labelsAdded: [{ message: { id: 'm4' }, labelIds: ['UNREAD'] }] }],
          historyId: '215'
        })
      }
      return json(200, {
        history: [
          { id: '210', messagesAdded: [{ message: { id: 'm2', threadId: 't-m2' } }] },
          { id: '211', labelsRemoved: [{ message: { id: 'm1' }, labelIds: ['UNREAD'] }] },
          { id: '212', messagesDeleted: [{ message: { id: 'm3' } }] }
        ],
        historyId: '213',
        nextPageToken: 'page2'
      })
    }
    if (p === '/threads/t-m1') {
      return json(200, {
        id: 't-m1',
        messages: [message('m1', { labelIds: ['SENT'] }), message('m9')]
      })
    }
    if (p === '/labels') {
      return json(200, {
        labels: [
          { id: 'INBOX', name: 'INBOX' },
          { id: 'Label_1', name: 'Clientes' },
          { name: 'sin id' }
        ]
      })
    }
    json(500, { error: { message: `unexpected ${req.method} ${p}` } })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo

  const auth = new google.auth.OAuth2('id', 'secret')
  auth.setCredentials({ access_token: 'test-access-token', expiry_date: Date.now() + 3_600_000 })
  api = await createGoogleGmailApi(auth, { rootUrl: `http://127.0.0.1:${port}/` })
})

afterAll(() => new Promise<void>((r) => server.close(() => r())))

describe('createGoogleGmailApi against a fake Gmail server', () => {
  it('reads the profile', async () => {
    expect(await api.getProfile()).toEqual({ historyId: '200', email: 'yo@cesa.com' })
  })

  it('lists message ids for a label', async () => {
    expect(await api.listMessageIds('INBOX', 30)).toEqual(['m1', 'm2'])
    const r = requests.find((x) => x.path.endsWith('/messages') && x.query.has('labelIds'))!
    expect(r.query.getAll('labelIds')).toEqual(['INBOX'])
    expect(r.query.get('maxResults')).toBe('30')
  })

  it('gets a message as metadata only and lower-cases headers', async () => {
    const m = await api.getMessage('m1')
    expect(m).toMatchObject({
      id: 'm1',
      threadId: 't-m1',
      labelIds: ['INBOX', 'UNREAD'],
      internalDate: 1_800_000_000_000
    })
    expect(m?.headers).toMatchObject({
      from: 'Ana <ana@x.com>',
      subject: 'Contrato',
      'list-unsubscribe': '<mailto:x@y.com>'
    })
    const r = requests.find((x) => x.path.endsWith('/messages/m1'))!
    expect(r.query.get('format')).toBe('metadata')
    expect(r.query.getAll('metadataHeaders')).toContain('List-Unsubscribe')
  })

  it('returns null for a message that no longer exists', async () => {
    expect(await api.getMessage('gone')).toBeNull()
  })

  it('collects touched ids across history pages (added, removed labels, deleted, added labels)', async () => {
    const result = await api.listHistory('150')
    expect(result).not.toBe('expired')
    if (result === 'expired') return
    expect([...result.touchedIds].sort()).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(result.historyId).toBe('215') // last page wins
  })

  it('reports "expired" when Gmail dropped the history (404)', async () => {
    expect(await api.listHistory('1')).toBe('expired')
  })

  it('reads thread messages and lists labels', async () => {
    const msgs = await api.getThreadMessages('t-m1')
    expect(msgs.map((m) => m.labelIds)).toEqual([['SENT'], ['INBOX', 'UNREAD']])
    expect(await api.listLabels()).toEqual([
      { id: 'INBOX', name: 'INBOX' },
      { id: 'Label_1', name: 'Clientes' }
    ])
  })

  it('only ever sent GET requests, with the access token, and never asked for full bodies', () => {
    expect(requests.length).toBeGreaterThan(5)
    expect(requests.every((r) => r.method === 'GET')).toBe(true)
    expect(requests.every((r) => r.auth === 'Bearer test-access-token')).toBe(true)
    expect(
      requests.some((r) => r.query.get('format') === 'full' || r.query.get('format') === 'raw')
    ).toBe(false)
  })
})
