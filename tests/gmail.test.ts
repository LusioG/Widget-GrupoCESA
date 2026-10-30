import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  emailToSignal,
  isAutomated,
  parseFrom,
  threadUrl
} from '../src/main/connectors/gmail/mapper'
import { collectGmailFollowups, syncEmails } from '../src/main/connectors/gmail/sync'
import type { GmailApi, GmailMessage, HistoryResult } from '../src/main/connectors/gmail/types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const now = 1_800_000_000_000

const msg = (id: string, over: Partial<GmailMessage> = {}): GmailMessage => ({
  id,
  threadId: `t-${id}`,
  labelIds: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL'],
  snippet: 'Hola, te escribo por el contrato',
  internalDate: now - HOUR,
  headers: { from: 'Ana Pérez <ana@cliente.com>', subject: 'Contrato' },
  ...over
})

describe('parseFrom', () => {
  it('splits name and address', () => {
    expect(parseFrom('Ana Pérez <ana@cliente.com>')).toEqual({
      name: 'Ana Pérez',
      address: 'ana@cliente.com'
    })
    expect(parseFrom('"Pérez, Ana" <ana@cliente.com>')).toEqual({
      name: 'Pérez, Ana',
      address: 'ana@cliente.com'
    })
    expect(parseFrom('ana@cliente.com')).toEqual({ name: '', address: 'ana@cliente.com' })
    expect(parseFrom(undefined)).toEqual({ name: '', address: '' })
  })
})

describe('emailToSignal', () => {
  const watched = ['INBOX']

  it('maps an unread personal email', () => {
    const s = emailToSignal(msg('m1'), watched)
    expect(s).toMatchObject({
      id: 'gmail:m1',
      source: 'gmail',
      kind: 'email',
      title: 'Contrato',
      sender: 'Ana Pérez <ana@cliente.com>',
      url: threadUrl('t-m1'),
      occurredAt: now - HOUR
    })
    expect(s?.body).toBe('Ana Pérez · Hola, te escribo por el contrato')
    expect(s?.url).toBe('https://mail.google.com/mail/u/0/#all/t-m1')
  })

  it('ignores read mail', () => {
    expect(emailToSignal(msg('m', { labelIds: ['INBOX'] }), watched)).toBeNull()
  })

  it.each(['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'])(
    'ignores %s',
    (category) => {
      expect(
        emailToSignal(msg('m', { labelIds: ['INBOX', 'UNREAD', category] }), watched)
      ).toBeNull()
    }
  )

  it("ignores spam, trash, drafts and the user's own sent mail", () => {
    for (const l of ['SPAM', 'TRASH', 'DRAFT']) {
      expect(emailToSignal(msg('m', { labelIds: ['INBOX', 'UNREAD', l] }), watched), l).toBeNull()
    }
    expect(emailToSignal(msg('m', { labelIds: ['SENT', 'UNREAD'] }), ['SENT'])).toBeNull()
  })

  it('ignores newsletters (List-Unsubscribe), bulk precedence, auto-submitted and no-reply', () => {
    const h = (extra: Record<string, string>): GmailMessage =>
      msg('m', { headers: { from: 'Ana <ana@x.com>', subject: 's', ...extra } })
    expect(emailToSignal(h({ 'list-unsubscribe': '<mailto:u@x.com>' }), watched)).toBeNull()
    expect(emailToSignal(h({ precedence: 'bulk' }), watched)).toBeNull()
    expect(emailToSignal(h({ 'auto-submitted': 'auto-generated' }), watched)).toBeNull()
    expect(emailToSignal(h({ from: 'Tienda <no-reply@tienda.com>' }), watched)).toBeNull()
    expect(emailToSignal(h({ 'auto-submitted': 'no' }), watched)).not.toBeNull()
  })

  it('only keeps mail in the watched labels', () => {
    const m = msg('m', { labelIds: ['Label_7', 'UNREAD'] })
    expect(emailToSignal(m, ['INBOX'])).toBeNull()
    expect(emailToSignal(m, ['INBOX', 'Label_7'])).not.toBeNull()
  })

  it('handles missing subject and snippet', () => {
    const s = emailToSignal(msg('m', { snippet: '', headers: { from: 'ana@x.com' } }), watched)
    expect(s?.title).toBe('(Sin asunto)')
    expect(s?.body).toBe('ana@x.com')
  })

  it('isAutomated is false for a normal person', () => {
    expect(isAutomated(msg('m'))).toBe(false)
  })
})

// A tiny in-memory mailbox with a history log, to exercise the real sync algorithm.
class FakeMailbox implements GmailApi {
  messages = new Map<string, GmailMessage>()
  historyId = 100
  log: { id: number; ids: string[] }[] = []
  expired = false
  calls = { list: 0, get: 0, history: 0, thread: 0 }

  put(m: GmailMessage): void {
    this.messages.set(m.id, m)
    this.touch(m.id)
  }
  remove(id: string): void {
    this.messages.delete(id)
    this.touch(id)
  }
  touch(id: string): void {
    this.historyId += 1
    this.log.push({ id: this.historyId, ids: [id] })
  }

  async getProfile(): Promise<{ historyId: string; email: string }> {
    return { historyId: String(this.historyId), email: 'yo@cesa.com' }
  }
  async listMessageIds(label: string, max: number): Promise<string[]> {
    this.calls.list += 1
    return [...this.messages.values()]
      .filter((m) => m.labelIds.includes(label))
      .sort((a, b) => b.internalDate - a.internalDate)
      .slice(0, max)
      .map((m) => m.id)
  }
  async getMessage(id: string): Promise<GmailMessage | null> {
    this.calls.get += 1
    return this.messages.get(id) ?? null
  }
  async listHistory(start: string): Promise<HistoryResult | 'expired'> {
    this.calls.history += 1
    if (this.expired) return 'expired'
    const ids = this.log.filter((h) => h.id > Number(start)).flatMap((h) => h.ids)
    return { historyId: String(this.historyId), touchedIds: ids }
  }
  async getThreadMessages(threadId: string): Promise<GmailMessage[]> {
    this.calls.thread += 1
    return [...this.messages.values()].filter((m) => m.threadId === threadId)
  }
  async listLabels(): Promise<{ id: string; name: string }[]> {
    return []
  }
}

describe('syncEmails', () => {
  const watched = ['INBOX']
  const ids = (r: { signals: { id: string }[] }): string[] => r.signals.map((s) => s.id).sort()

  it('does a full sync first, then only fetches what changed', async () => {
    const box = new FakeMailbox()
    box.put(msg('a'))
    box.put(msg('b'))

    const first = await syncEmails({ api: box, watched, cursor: undefined, cached: [], now })
    expect(ids(first)).toEqual(['gmail:a', 'gmail:b'])
    expect(box.calls.list).toBe(1)

    box.calls = { list: 0, get: 0, history: 0, thread: 0 }
    box.put(msg('c'))
    const second = await syncEmails({
      api: box,
      watched,
      cursor: first.cursor,
      cached: first.signals,
      now
    })
    expect(ids(second)).toEqual(['gmail:a', 'gmail:b', 'gmail:c'])
    expect(box.calls.list).toBe(0) // no re-listing
    expect(box.calls.get).toBe(1) // only the new message
  })

  it('removes a message once it is read', async () => {
    const box = new FakeMailbox()
    box.put(msg('a'))
    box.put(msg('b'))
    const first = await syncEmails({ api: box, watched, cursor: undefined, cached: [], now })

    box.messages.set('a', msg('a', { labelIds: ['INBOX'] })) // UNREAD removed
    box.touch('a')
    const second = await syncEmails({
      api: box,
      watched,
      cursor: first.cursor,
      cached: first.signals,
      now
    })
    expect(ids(second)).toEqual(['gmail:b'])
  })

  it('removes deleted or archived messages', async () => {
    const box = new FakeMailbox()
    box.put(msg('a'))
    box.put(msg('b'))
    const first = await syncEmails({ api: box, watched, cursor: undefined, cached: [], now })

    box.remove('a')
    box.messages.set('b', msg('b', { labelIds: ['UNREAD'] })) // archived: INBOX removed
    box.touch('b')
    const second = await syncEmails({
      api: box,
      watched,
      cursor: first.cursor,
      cached: first.signals,
      now
    })
    expect(ids(second)).toEqual([])
  })

  it('starts over when Gmail has dropped the history (404)', async () => {
    const box = new FakeMailbox()
    box.put(msg('a'))
    const first = await syncEmails({ api: box, watched, cursor: undefined, cached: [], now })

    box.put(msg('b'))
    box.expired = true
    box.calls = { list: 0, get: 0, history: 0, thread: 0 }
    const second = await syncEmails({
      api: box,
      watched,
      cursor: first.cursor,
      cached: first.signals,
      now
    })
    expect(ids(second)).toEqual(['gmail:a', 'gmail:b'])
    expect(box.calls.list).toBe(1) // full resync happened
  })

  it('starts over when the watched labels change', async () => {
    const box = new FakeMailbox()
    box.put(msg('a'))
    box.put(msg('x', { labelIds: ['Label_7', 'UNREAD'] }))
    const first = await syncEmails({
      api: box,
      watched: ['INBOX'],
      cursor: undefined,
      cached: [],
      now
    })
    expect(ids(first)).toEqual(['gmail:a'])

    const second = await syncEmails({
      api: box,
      watched: ['INBOX', 'Label_7'],
      cursor: first.cursor,
      cached: first.signals,
      now
    })
    expect(ids(second)).toEqual(['gmail:a', 'gmail:x'])
  })

  it('starts over instead of fetching an enormous delta', async () => {
    const box = new FakeMailbox()
    const first = await syncEmails({ api: box, watched, cursor: undefined, cached: [], now })
    for (let i = 0; i < 150; i++) box.put(msg(`n${i}`, { internalDate: now - i }))
    box.calls = { list: 0, get: 0, history: 0, thread: 0 }
    await syncEmails({ api: box, watched, cursor: first.cursor, cached: first.signals, now })
    expect(box.calls.list).toBe(1)
  })

  it('drops unread mail older than two weeks', async () => {
    const box = new FakeMailbox()
    box.put(msg('old', { internalDate: now - 20 * DAY }))
    box.put(msg('new'))
    const r = await syncEmails({ api: box, watched, cursor: undefined, cached: [], now })
    expect(ids(r)).toEqual(['gmail:new'])
  })

  it('advances the history cursor', async () => {
    const box = new FakeMailbox()
    box.put(msg('a'))
    const first = await syncEmails({ api: box, watched, cursor: undefined, cached: [], now })
    box.put(msg('b'))
    const second = await syncEmails({
      api: box,
      watched,
      cursor: first.cursor,
      cached: first.signals,
      now
    })
    expect(Number(second.cursor.historyId)).toBeGreaterThan(Number(first.cursor.historyId))
  })
})

describe('collectGmailFollowups', () => {
  const sent = (id: string, threadId: string, ageH: number, subject = 'Propuesta'): GmailMessage =>
    msg(id, {
      threadId,
      labelIds: ['SENT'],
      internalDate: now - ageH * HOUR,
      headers: { from: 'yo@cesa.com', subject }
    })

  it('lists my last message in a thread when nobody answered', async () => {
    const box = new FakeMailbox()
    box.put(sent('s1', 'T1', 72))
    const out = await collectGmailFollowups({ api: box, cache: new Map(), now, waitHours: 48 })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'gmail:followup-T1', kind: 'followup', title: 'Propuesta' })
  })

  it('skips threads that got a reply', async () => {
    const box = new FakeMailbox()
    box.put(sent('s1', 'T1', 72))
    box.put(msg('r1', { threadId: 'T1', internalDate: now - 24 * HOUR })) // someone replied
    expect(await collectGmailFollowups({ api: box, cache: new Map(), now, waitHours: 48 })).toEqual(
      []
    )
  })

  it('skips messages that are still within the wait time or older than two weeks', async () => {
    const box = new FakeMailbox()
    box.put(sent('s1', 'T1', 10))
    box.put(sent('s2', 'T2', 30 * 24))
    expect(await collectGmailFollowups({ api: box, cache: new Map(), now, waitHours: 48 })).toEqual(
      []
    )
  })

  it('one entry per thread even if I wrote several times', async () => {
    const box = new FakeMailbox()
    box.put(sent('s1', 'T1', 100))
    box.put(sent('s2', 'T1', 60))
    const out = await collectGmailFollowups({ api: box, cache: new Map(), now, waitHours: 48 })
    expect(out).toHaveLength(1)
    expect(out[0].occurredAt).toBe(now - 60 * HOUR)
  })

  it('fetches each sent message only once across runs', async () => {
    const box = new FakeMailbox()
    box.put(sent('s1', 'T1', 72))
    const cache = new Map()
    await collectGmailFollowups({ api: box, cache, now, waitHours: 48 })
    const gets = box.calls.get
    await collectGmailFollowups({ api: box, cache, now, waitHours: 48 })
    expect(box.calls.get).toBe(gets)
  })
})

describe('Gmail module is read-only', () => {
  const dir = join(__dirname, '../src/main/connectors/gmail')
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))

  it('only calls the expected read methods of the Gmail API', () => {
    const api = sources.find((s) => s.file === 'api.ts')!.text
    const used = new Set([...api.matchAll(/gmail\.users\.([a-zA-Z.]+)\(/g)].map((m) => m[1]))
    expect([...used].sort()).toEqual([
      'getProfile',
      'history.list',
      'labels.list',
      'messages.get',
      'messages.list',
      'threads.get'
    ])
  })

  it('has no write verbs or drafts anywhere in the module', () => {
    for (const { file, text } of sources) {
      expect(text, file).not.toMatch(/gmail\.users\.(drafts|settings)/)
      expect(text, file).not.toMatch(/\.(send|batchModify|trash|untrash|batchDelete|insert)\s*\(/)
    }
  })

  it('asks Google only for header metadata, never full bodies', () => {
    const api = sources.find((s) => s.file === 'api.ts')!.text
    expect(api).not.toMatch(/format:\s*'(full|raw)'/)
    expect(api.match(/format:\s*'metadata'/g)).toHaveLength(2) // messages.get + threads.get
  })

  it('requests the narrowest Gmail scope', () => {
    const auth = readFileSync(join(__dirname, '../src/main/connectors/google/auth.ts'), 'utf8')
    expect(auth).toContain('gmail.metadata')
    expect(auth).not.toMatch(/gmail\.(readonly|modify|send|compose)|mail\.google\.com\/'/)
    expect(auth).not.toMatch(/calendar['"]|calendar\.readonly|calendar\.events['"]/)
  })
})
