import type { Signal } from '../../../shared/types'
import type { GmailMessage } from './types'

const NOISE_CATEGORIES = [
  'CATEGORY_PROMOTIONS',
  'CATEGORY_SOCIAL',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS'
]
const BLOCKED_LABELS = ['SPAM', 'TRASH', 'DRAFT']
const AUTOMATED_SENDER =
  /(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|notifications?@|newsletter@)/i

const SNIPPET_MAX = 140

// `u/0` is the FIRST account signed in to the browser, which is not always the one the widget
// reads (someone whose main Google account is a personal one). With `account` the link names the
// mailbox, so Gmail opens that one.
export function threadUrl(threadId: string, account?: string): string {
  const base = account
    ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}`
    : 'https://mail.google.com/mail/u/0/'
  return `${base}#all/${threadId}`
}

// The same link, pointing at the given account.
export function inAccount(url: string, account: string): string {
  const generic = 'https://mail.google.com/mail/u/0/#'
  return account && url.startsWith(generic)
    ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#${url.slice(generic.length)}`
    : url
}

export function parseFrom(from: string | undefined): { name: string; address: string } {
  if (!from) return { name: '', address: '' }
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (match) return { name: match[1].trim(), address: match[2].trim() }
  return { name: '', address: from.trim() }
}

// Newsletters, bulk mail and automatic notifications.
export function isAutomated(msg: GmailMessage): boolean {
  const h = msg.headers
  if (h['list-unsubscribe']) return true
  if (/^(bulk|list|junk)$/i.test(h['precedence'] ?? '')) return true
  const auto = h['auto-submitted']
  if (auto && auto.toLowerCase() !== 'no') return true
  return AUTOMATED_SENDER.test(h['from'] ?? '')
}

// An unread, personal email in a watched label becomes a signal; anything else does not.
export function emailToSignal(msg: GmailMessage, watchedLabels: string[]): Signal | null {
  const labels = msg.labelIds
  if (!labels.includes('UNREAD')) return null
  if (labels.some((l) => BLOCKED_LABELS.includes(l))) return null
  if (labels.some((l) => NOISE_CATEGORIES.includes(l))) return null
  if (labels.includes('SENT') && !labels.includes('INBOX')) return null // sent by the user
  if (!labels.some((l) => watchedLabels.includes(l))) return null
  if (isAutomated(msg)) return null

  const from = msg.headers['from']
  const { name, address } = parseFrom(from)
  const who = name || address
  const snippet = msg.snippet.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX)

  return {
    id: `gmail:${msg.id}`,
    source: 'gmail',
    kind: 'email',
    title: msg.headers['subject']?.trim() || '(Sin asunto)',
    body: snippet ? `${who} · ${snippet}` : who,
    url: threadUrl(msg.threadId),
    occurredAt: msg.internalDate,
    sender: from
  }
}
