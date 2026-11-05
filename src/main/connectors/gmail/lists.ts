import type {
  AvailableList,
  DistributionList,
  Signal,
  ThreadMessage,
  ThreadView
} from '../../../shared/types'
import { parseFrom, threadUrl } from './mapper'
import { cleanMessageText } from './body'
import type { GmailMessage } from './types'

const SNIPPET_MAX = 160
const BLOCKED_LABELS = ['SPAM', 'TRASH', 'DRAFT']

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim()

// Every address that appears in a header value ("Ana <a@x.com>, b@y.com" -> a@x.com, b@y.com).
function addressesIn(value: string | undefined): string[] {
  if (!value) return []
  return (value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).map((a) => a.toLowerCase())
}

// The list a message came through, as the address in its List-Post header ("<mailto:a@x.com>").
export function listAddressOf(msg: GmailMessage): string | undefined {
  return addressesIn(msg.headers['list-post'])[0]
}

// "Soporte CESA" <soporte.cesa.net> -> Soporte CESA
function listNameOf(msg: GmailMessage, address: string): string {
  const id = msg.headers['list-id'] ?? ''
  const phrase = /^\s*"?([^"<]+?)"?\s*</.exec(id)?.[1]?.trim()
  return phrase || address.split('@')[0]
}

// Was this message sent to (or through) one of the followed lists?
export function belongsToList(msg: GmailMessage, addresses: readonly string[]): boolean {
  if (addresses.length === 0) return false
  const wanted = new Set(addresses.map((a) => a.toLowerCase()))
  const seen = [
    ...addressesIn(msg.headers['list-post']),
    ...addressesIn(msg.headers['to']),
    ...addressesIn(msg.headers['cc'])
  ]
  return seen.some((a) => wanted.has(a))
}

// The Gmail search that finds the unread conversations of one list.
export function listQuery(address: string, days: number): string {
  return `(list:${address} OR to:${address} OR cc:${address}) is:unread newer_than:${days}d`
}

// Lists found in recent mail, to pick from in Ajustes. Only mail that says which list it came
// through (List-Post) counts: a newsletter has no such address.
export function discoverLists(messages: GmailMessage[]): AvailableList[] {
  const found = new Map<string, AvailableList>()
  for (const msg of messages) {
    const address = listAddressOf(msg)
    if (!address) continue
    const entry = found.get(address)
    if (entry) entry.count += 1
    else found.set(address, { address, name: listNameOf(msg, address), count: 1 })
  }
  return [...found.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

const fold = (text: string): string => text.toLowerCase()

// One item per conversation: the first message of the thread is what the panel previews, and the
// unread count tells how much is new. Null when there is nothing unread (or it is all from people
// the user ignores).
export function threadToSignal(input: {
  threadId: string
  messages: GmailMessage[]
  list: DistributionList
  ignoredSenders: readonly string[]
}): Signal | null {
  const { threadId, list } = input
  const messages = input.messages
    .filter((m) => !m.labelIds.some((l) => BLOCKED_LABELS.includes(l)))
    .sort((a, b) => a.internalDate - b.internalDate)
  if (messages.length === 0) return null

  const ignored = input.ignoredSenders.map((n) => n.trim()).filter(Boolean)
  const unread = messages.filter(
    (m) =>
      m.labelIds.includes('UNREAD') &&
      !m.labelIds.includes('SENT') &&
      !ignored.some((n) => fold(m.headers['from'] ?? '').includes(fold(n)))
  )
  if (unread.length === 0) return null

  const first = messages[0]
  const last = unread[unread.length - 1]
  const starter = parseFrom(first.headers['from'])
  const snippet = clean(first.snippet).slice(0, SNIPPET_MAX)
  const who = starter.name || starter.address
  const senders = [...new Set(unread.map((m) => m.headers['from']).filter((f): f is string => !!f))]

  return {
    id: `gmail:list:${threadId}:${last.id}`, // a new reply is a new item: it comes back as news
    source: 'gmail',
    kind: 'email',
    title: first.headers['subject']?.trim() || '(Sin asunto)',
    body: snippet ? `${who} · ${snippet}` : who,
    url: threadUrl(threadId),
    occurredAt: last.internalDate,
    sender: senders.join(' | '),
    list: { address: list.address, name: list.name },
    threadId,
    unread: unread.length
  }
}

// ---- the conversation, as chat bubbles ----

const REPLY_SNIPPET_MAX = 90

const messageKey = (id: string | undefined): string => (id ?? '').trim().toLowerCase()

export function buildThreadView(input: {
  threadId: string
  messages: GmailMessage[]
  me: string
  lists: readonly DistributionList[]
}): ThreadView {
  const me = input.me.toLowerCase()
  const messages = [...input.messages].sort((a, b) => a.internalDate - b.internalDate)

  const byMessageId = new Map<string, GmailMessage>()
  for (const m of messages) {
    const key = messageKey(m.headers['message-id'])
    if (key) byMessageId.set(key, m)
  }
  const textOf = (m: GmailMessage): string => cleanMessageText(m.body ?? m.snippet).text

  const bubbles = messages.map((m): ThreadMessage => {
    const from = parseFrom(m.headers['from'])
    const parent = byMessageId.get(messageKey(m.headers['in-reply-to']))
    const parentFrom = parent ? parseFrom(parent.headers['from']) : undefined
    const { text, signature } = cleanMessageText(m.body ?? m.snippet)
    return {
      id: m.id,
      from,
      at: m.internalDate,
      text,
      ...(signature && { signature }),
      ...(m.attachments && m.attachments.length > 0 && { attachments: m.attachments }),
      mine: m.labelIds.includes('SENT') || from.address.toLowerCase() === me,
      unread: m.labelIds.includes('UNREAD'),
      ...(parent &&
        parent !== m &&
        parentFrom && {
          replyTo: {
            name: parentFrom.name || parentFrom.address,
            snippet: clean(textOf(parent)).slice(0, REPLY_SNIPPET_MAX)
          }
        })
    }
  })

  const first = messages[0]
  const followed = input.lists.find((l) => first && belongsToList(first, [l.address]))
  const subject = first?.headers['subject']?.trim() || '(Sin asunto)'
  return {
    threadId: input.threadId,
    subject,
    ...(followed && { list: { address: followed.address, name: followed.name } }),
    messages: bubbles,
    gmailUrl: threadUrl(input.threadId, input.me)
  }
}
