import { describe, expect, it } from 'vitest'
import { URGENT_THRESHOLD } from '../src/shared/badgeState'
import { DEFAULT_SETTINGS, settingsPatchSchema } from '../src/shared/settingsSchema'
import type { DistributionList, Signal } from '../src/shared/types'
import { extractText, htmlToText, stripQuoted } from '../src/main/connectors/gmail/body'
import {
  belongsToList,
  buildThreadView,
  discoverLists,
  listQuery,
  threadToSignal
} from '../src/main/connectors/gmail/lists'
import { inAccount, threadUrl } from '../src/main/connectors/gmail/mapper'
import { syncEmails } from '../src/main/connectors/gmail/sync'
import type { GmailApi, GmailMessage } from '../src/main/connectors/gmail/types'
import { shouldKeep } from '../src/main/engine/filters'
import { scoreSignal } from '../src/main/engine/ranking'

const HOUR = 3_600_000
const now = 1_800_000_000_000
const LIST: DistributionList = { address: 'soporte@cesa.com', name: 'Soporte', urgent: false }

const msg = (
  id: string,
  over: Partial<GmailMessage> & { h?: Record<string, string> } = {}
): GmailMessage => {
  const { h, ...rest } = over
  return {
    id,
    threadId: 'abc123',
    labelIds: ['INBOX', 'UNREAD'],
    snippet: `texto de ${id}`,
    internalDate: now - 5 * HOUR,
    headers: {
      from: 'Ana Pérez <ana@cliente.com>',
      to: 'Soporte <soporte@cesa.com>',
      subject: 'Falla en la sede',
      'list-post': '<mailto:soporte@cesa.com>',
      'list-id': '"Soporte CESA" <soporte.cesa.com>',
      ...h
    },
    ...rest
  }
}

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64url')

describe('message text', () => {
  it('takes the plain-text part of a multipart message', () => {
    const text = extractText({
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64('Hola, ¿cómo están?') } },
        { mimeType: 'text/html', body: { data: b64('<p>otra cosa</p>') } }
      ]
    })
    expect(text).toBe('Hola, ¿cómo están?')
  })

  it('falls back to HTML turned into text, without styles or quoted replies', () => {
    const html =
      '<style>p{color:red}</style><div>Hola&nbsp;equipo<br>Gracias &amp; saludos</div>' +
      '<blockquote>mensaje anterior</blockquote>'
    expect(htmlToText(html).trim()).toBe('Hola equipo\nGracias & saludos')
    expect(extractText({ mimeType: 'text/html', body: { data: b64(html) } }).trim()).toBe(
      'Hola equipo\nGracias & saludos'
    )
  })

  it('returns nothing for a message without text', () => {
    expect(extractText(undefined)).toBe('')
    expect(extractText({ mimeType: 'image/png', body: { data: 'xx' } })).toBe('')
  })
})

describe('stripQuoted', () => {
  it('cuts the quoted earlier message (Spanish, English, wrapped, ">" lines)', () => {
    expect(stripQuoted('Ya lo revisé.\n\nEl lun, 3 nov 2026 a las 10:15, Ana <a@x.com> escribió:\n> hola')).toBe(
      'Ya lo revisé.'
    )
    expect(stripQuoted('Done.\n\nOn Mon, Nov 3, 2026 at 10:15 AM Ana <a@x.com> wrote:\n> hi')).toBe('Done.')
    expect(
      stripQuoted('Listo.\n\nEl lun, 3 nov 2026 a las 10:15, Ana Pérez\n<ana@cliente.com> escribió:\n> hola')
    ).toBe('Listo.')
    expect(stripQuoted('Sí\n> no\nsigo')).toBe('Sí\nsigo')
  })

  it('keeps an ordinary line that starts with "De:"', () => {
    expect(stripQuoted('Atendemos\nDe: lunes a viernes')).toBe('Atendemos\nDe: lunes a viernes')
  })

  it('never leaves an empty bubble', () => {
    expect(stripQuoted('> todo es cita')).toBe('> todo es cita')
  })
})

describe('which list a message belongs to', () => {
  it('matches the address in To, Cc or List-Post, ignoring case', () => {
    expect(belongsToList(msg('1'), ['soporte@cesa.com'])).toBe(true)
    expect(belongsToList(msg('1', { h: { to: 'x@y.com', cc: 'SOPORTE@cesa.com' } }), ['soporte@cesa.com'])).toBe(true)
    expect(belongsToList(msg('1', { h: { to: 'x@y.com', 'list-post': '' } }), ['soporte@cesa.com'])).toBe(false)
    expect(belongsToList(msg('1'), [])).toBe(false)
  })

  it('builds a search that finds the unread conversations of that list only', () => {
    expect(listQuery('soporte@cesa.com', 14)).toBe(
      '(list:soporte@cesa.com OR to:soporte@cesa.com OR cc:soporte@cesa.com) is:unread newer_than:14d'
    )
  })
})

describe('finding the lists the user receives', () => {
  it('groups by list address, names them from List-Id and ignores newsletters', () => {
    const found = discoverLists([
      msg('1'),
      msg('2'),
      msg('3', { h: { 'list-post': '<mailto:ventas@cesa.com>', 'list-id': '<ventas.cesa.com>' } }),
      msg('4', { h: { 'list-post': '', 'list-unsubscribe': '<mailto:x@y.com>' } }) // a newsletter
    ])
    expect(found).toEqual([
      { address: 'soporte@cesa.com', name: 'Soporte CESA', count: 2 },
      { address: 'ventas@cesa.com', name: 'ventas', count: 1 }
    ])
  })
})

describe('a list conversation as one panel item', () => {
  const thread = [
    msg('m1', { internalDate: now - 5 * HOUR, snippet: 'Se cayó el sistema en la sede norte' }),
    msg('m2', {
      internalDate: now - 3 * HOUR,
      labelIds: ['INBOX', 'UNREAD'],
      h: { from: 'Luis Gómez <luis@cesa.com>' }
    }),
    msg('m3', { internalDate: now - HOUR, labelIds: ['INBOX', 'SENT'], h: { from: 'yo@cesa.com' } })
  ]

  it('previews the first message and counts what is unread', () => {
    const s = threadToSignal({ threadId: 'abc123', messages: thread, list: LIST, ignoredSenders: [] })
    expect(s).toMatchObject({
      source: 'gmail',
      kind: 'email',
      title: 'Falla en la sede',
      body: 'Ana Pérez · Se cayó el sistema en la sede norte',
      list: { address: 'soporte@cesa.com', name: 'Soporte' },
      threadId: 'abc123',
      unread: 2,
      occurredAt: now - 3 * HOUR
    })
    expect(s?.sender).toContain('ana@cliente.com')
    expect(s?.sender).toContain('luis@cesa.com')
  })

  it('is a new item when a reply arrives, so it comes back as news', () => {
    const before = threadToSignal({ threadId: 'abc123', messages: thread.slice(0, 1), list: LIST, ignoredSenders: [] })
    const after = threadToSignal({ threadId: 'abc123', messages: thread.slice(0, 2), list: LIST, ignoredSenders: [] })
    expect(before?.id).not.toBe(after?.id)
    expect(before?.id.startsWith('gmail:')).toBe(true) // so disconnecting Gmail clears it too
  })

  it('has nothing to show once everything is read, or in spam and trash', () => {
    const read = thread.map((m) => ({ ...m, labelIds: ['INBOX'] }))
    expect(threadToSignal({ threadId: 't', messages: read, list: LIST, ignoredSenders: [] })).toBeNull()
    const trash = thread.map((m) => ({ ...m, labelIds: ['TRASH', 'UNREAD'] }))
    expect(threadToSignal({ threadId: 't', messages: trash, list: LIST, ignoredSenders: [] })).toBeNull()
  })

  it('skips unread messages from ignored senders, but keeps the conversation for the rest', () => {
    const s = threadToSignal({ threadId: 't', messages: thread, list: LIST, ignoredSenders: ['ana@'] })
    expect(s?.unread).toBe(1)
    expect(s?.sender).not.toContain('ana@cliente.com')
    expect(
      threadToSignal({ threadId: 't', messages: thread.slice(0, 1), list: LIST, ignoredSenders: ['Ana'] })
    ).toBeNull()
  })

  it('never carries the message text, only the short preview', () => {
    const withBody = thread.map((m) => ({ ...m, body: 'TEXTO PRIVADO COMPLETO' }))
    const s = threadToSignal({ threadId: 't', messages: withBody, list: LIST, ignoredSenders: [] })
    expect(JSON.stringify(s)).not.toContain('TEXTO PRIVADO')
  })
})

describe('the conversation as chat bubbles', () => {
  const messages: GmailMessage[] = [
    msg('m1', {
      internalDate: now - 5 * HOUR,
      body: 'Se cayó el sistema',
      h: { 'message-id': '<a1@mail>' }
    }),
    msg('m2', {
      internalDate: now - 3 * HOUR,
      body: 'Lo reviso ahora\n\nEl lun, 3 nov a las 10:15, Ana <ana@cliente.com> escribió:\n> Se cayó el sistema',
      labelIds: ['INBOX', 'UNREAD'],
      h: { from: 'Luis Gómez <luis@cesa.com>', 'message-id': '<l2@mail>', 'in-reply-to': '<a1@mail>' }
    }),
    msg('m3', {
      internalDate: now - HOUR,
      body: 'Gracias Luis',
      labelIds: ['INBOX', 'SENT'],
      h: { from: 'Yo <yo@cesa.com>', 'message-id': '<y3@mail>', 'in-reply-to': '<l2@mail>' }
    })
  ]

  it('orders them, tells whose each one is and who it answers', () => {
    const view = buildThreadView({ threadId: 'abc123', messages: [...messages].reverse(), me: 'YO@cesa.com', lists: [LIST] })
    expect(view.subject).toBe('Falla en la sede')
    expect(view.list).toEqual({ address: 'soporte@cesa.com', name: 'Soporte' })
    expect(view.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(view.messages.map((m) => m.mine)).toEqual([false, false, true])
    expect(view.messages[0].replyTo).toBeUndefined()
    expect(view.messages[1].replyTo).toEqual({ name: 'Ana Pérez', snippet: 'Se cayó el sistema' })
    expect(view.messages[2].replyTo?.name).toBe('Luis Gómez')
    expect(view.messages[1].at).toBe(now - 3 * HOUR)
    expect(view.messages.map((m) => m.unread)).toEqual([true, true, false])
    expect(view.gmailUrl).toBe('https://mail.google.com/mail/?authuser=YO%40cesa.com#all/abc123')
  })

  it('shows only what each person wrote, without the quoted earlier message', () => {
    const view = buildThreadView({ threadId: 'abc123', messages, me: 'yo@cesa.com', lists: [] })
    expect(view.messages[1].text).toBe('Lo reviso ahora')
    expect(view.list).toBeUndefined() // not a followed list
  })

  it('does not invent who a message answers when the header is missing', () => {
    const view = buildThreadView({ threadId: 't', messages: [msg('x1', { body: 'a' }), msg('x2', { body: 'b', internalDate: now })], me: 'yo@cesa.com', lists: [] })
    expect(view.messages.every((m) => m.replyTo === undefined)).toBe(true)
  })
})

describe('mail from a followed list is not also an individual email', () => {
  const api = (messages: GmailMessage[]): GmailApi => ({
    getProfile: async () => ({ historyId: '10', email: 'yo@cesa.com' }),
    listMessageIds: async () => messages.map((m) => m.id),
    getMessage: async (id) => messages.find((m) => m.id === id) ?? null,
    listHistory: async () => 'expired',
    getThreadMessages: async () => [],
    listLabels: async () => []
  })
  const personal = msg('p1', { h: { to: 'yo@cesa.com', 'list-post': '', 'list-id': '' } })
  const viaList = msg('l1')

  it('keeps list mail out of the individual list only when its list is followed', async () => {
    const without = await syncEmails({ api: api([personal, viaList]), watched: ['INBOX'], cursor: undefined, cached: [], now })
    expect(without.signals.map((s) => s.id).sort()).toEqual(['gmail:l1', 'gmail:p1'])
    const withList = await syncEmails({ api: api([personal, viaList]), watched: ['INBOX'], cursor: undefined, cached: [], now, lists: ['soporte@cesa.com'] })
    expect(withList.signals.map((s) => s.id)).toEqual(['gmail:p1'])
  })

  it('starts over when the followed lists change, so old items do not linger', async () => {
    const first = await syncEmails({ api: api([viaList]), watched: ['INBOX'], cursor: undefined, cached: [], now })
    const second = await syncEmails({
      api: api([viaList]),
      watched: ['INBOX'],
      cursor: first.cursor,
      cached: first.signals,
      now,
      lists: ['soporte@cesa.com']
    })
    expect(second.cursor.labels).not.toBe(first.cursor.labels)
    expect(second.signals).toEqual([])
  })
})

describe('urgency of list mail', () => {
  const item = (over: Partial<Signal> = {}): Signal => ({
    id: 'gmail:list:t:m',
    source: 'gmail',
    kind: 'email',
    title: 'Falla en la sede',
    url: 'https://mail.google.com',
    occurredAt: now - HOUR,
    sender: 'Ana Pérez <ana@cliente.com>',
    list: { address: 'soporte@cesa.com', name: 'Soporte' },
    threadId: 't',
    unread: 1,
    ...over
  })
  const ctx = { now, importantSenders: [] as string[] }

  it('is an ordinary email unless the list or the sender is marked urgent', () => {
    expect(scoreSignal(item(), ctx)).toBeLessThan(URGENT_THRESHOLD)
  })

  it('is urgent when the whole list is marked urgent', () => {
    expect(scoreSignal(item(), { ...ctx, importantLists: ['soporte@cesa.com'] })).toBeGreaterThanOrEqual(URGENT_THRESHOLD)
    expect(scoreSignal(item(), { ...ctx, importantLists: ['ventas@cesa.com'] })).toBeLessThan(URGENT_THRESHOLD)
  })

  it('is urgent when any unread message is from a priority sender, like individual mail', () => {
    const s = item({ sender: 'Ana Pérez <ana@cliente.com> | Luis Gómez <luis@cesa.com>' })
    expect(scoreSignal(s, { ...ctx, importantSenders: ['luis'] })).toBeGreaterThanOrEqual(URGENT_THRESHOLD)
  })

  it('goes through the same filters as other mail', () => {
    const filters = DEFAULT_SETTINGS.filters
    expect(shouldKeep(item(), filters)).toBe(true)
    expect(shouldKeep(item({ sender: 'soporte-no-reply@x.com' }), filters)).toBe(false)
  })
})

describe('settings: followed lists', () => {
  it('accepts a valid list and lowercases its address', () => {
    const parsed = settingsPatchSchema.safeParse({
      gmail: { lists: [{ address: ' Soporte@CESA.com ', name: 'Soporte', urgent: true }] }
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.gmail?.lists?.[0].address).toBe('soporte@cesa.com')
  })

  it.each(['soporte', 'a b@c.com', 'x"y@c.com', '(a)@c.com', 'a@b'])('rejects the address %s', (address) => {
    expect(settingsPatchSchema.safeParse({ gmail: { lists: [{ address, name: 'X', urgent: false }] } }).success).toBe(false)
  })

  it('follows no list by default', () => {
    expect(DEFAULT_SETTINGS.gmail.lists).toEqual([])
  })
})

describe('links open the right Gmail account', () => {
  it('names the mailbox instead of "the first account of the browser"', () => {
    expect(threadUrl('abc123')).toBe('https://mail.google.com/mail/u/0/#all/abc123')
    expect(threadUrl('abc123', 'luciano@grupocesa.net')).toBe(
      'https://mail.google.com/mail/?authuser=luciano%40grupocesa.net#all/abc123'
    )
  })

  it('rewrites a generic link to the account, and leaves other links alone', () => {
    expect(inAccount(threadUrl('t9'), 'a+b@cesa.com')).toBe(
      'https://mail.google.com/mail/?authuser=a%2Bb%40cesa.com#all/t9'
    )
    expect(inAccount('https://app.clickup.com/t/1', 'a@cesa.com')).toBe('https://app.clickup.com/t/1')
    expect(inAccount(threadUrl('t9'), '')).toBe(threadUrl('t9')) // account not known yet
  })

  it('the conversation window links to the same account', () => {
    const view = buildThreadView({
      threadId: 'abc123',
      messages: [msg('m1', { body: 'hola' })],
      me: 'luciano@grupocesa.net',
      lists: []
    })
    expect(view.gmailUrl).toBe(
      'https://mail.google.com/mail/?authuser=luciano%40grupocesa.net#all/abc123'
    )
  })
})

describe('settings: how many days of list mail', () => {
  it('is 7 by default and accepts only 1, 3 or 7', () => {
    expect(DEFAULT_SETTINGS.gmail.listDays).toBe(7)
    for (const days of [1, 3, 7]) {
      expect(settingsPatchSchema.safeParse({ gmail: { listDays: days } }).success).toBe(true)
    }
    for (const days of [0, 2, 14, '7']) {
      expect(settingsPatchSchema.safeParse({ gmail: { listDays: days } }).success).toBe(false)
    }
  })

  it('the search covers exactly that many days', () => {
    expect(listQuery('soporte@cesa.com', 1)).toContain('newer_than:1d')
    expect(listQuery('soporte@cesa.com', 3)).toContain('newer_than:3d')
  })
})
