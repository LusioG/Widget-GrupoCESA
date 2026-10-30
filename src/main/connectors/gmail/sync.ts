import type { Signal } from '../../../shared/types'
import { findFollowups, type IncomingReply, type SentMessage } from '../../engine/followups'
import { emailToSignal, threadUrl } from './mapper'
import type { GmailApi, GmailMessage } from './types'

const DAY = 24 * 60 * 60 * 1000
const MAX_AGE_MS = 14 * DAY // older unread mail is not "news"
const FULL_SYNC_PER_LABEL = 30
const MAX_TOUCHED = 100 // more changes than this: cheaper to start over
const CONCURRENCY = 5

export type GmailCursor = { historyId: string; labels: string }

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

async function fullSync(
  api: GmailApi,
  watched: string[],
  now: number
): Promise<{ signals: Map<string, Signal>; historyId: string }> {
  // Take the history id first: anything that arrives while we list shows up in the next delta.
  const { historyId } = await api.getProfile()
  const ids = new Set<string>()
  for (const label of watched) {
    for (const id of await api.listMessageIds(label, FULL_SYNC_PER_LABEL)) ids.add(id)
  }
  const messages = await mapLimit([...ids], CONCURRENCY, (id) => api.getMessage(id))
  const signals = new Map<string, Signal>()
  for (const msg of messages) {
    const signal = msg && now - msg.internalDate <= MAX_AGE_MS ? emailToSignal(msg, watched) : null
    if (signal) signals.set(signal.id, signal)
  }
  return { signals, historyId }
}

// Partial sync with history.list; falls back to a full sync when Gmail dropped the history.
export async function syncEmails(input: {
  api: GmailApi
  watched: string[]
  cursor: GmailCursor | undefined
  cached: Signal[] // email signals from the previous sync
  now: number
}): Promise<{ signals: Signal[]; cursor: GmailCursor }> {
  const { api, watched, cursor, now } = input
  const labelsKey = [...watched].sort().join(',')
  const start = (): Promise<{ signals: Map<string, Signal>; historyId: string }> =>
    fullSync(api, watched, now)

  let signals: Map<string, Signal>
  let historyId: string

  if (!cursor || cursor.labels !== labelsKey) {
    ;({ signals, historyId } = await start())
  } else {
    const history = await api.listHistory(cursor.historyId)
    if (history === 'expired' || history.touchedIds.length > MAX_TOUCHED) {
      ;({ signals, historyId } = await start())
    } else {
      signals = new Map(input.cached.map((s) => [s.id, s]))
      const touched = [...new Set(history.touchedIds)]
      const messages = await mapLimit(touched, CONCURRENCY, (id) => api.getMessage(id))
      touched.forEach((id, i) => {
        const msg = messages[i]
        const signal = msg ? emailToSignal(msg, watched) : null
        if (signal) signals.set(signal.id, signal)
        else signals.delete(`gmail:${id}`) // read, archived, deleted or no longer relevant
      })
      historyId = history.historyId
    }
  }

  for (const [id, s] of signals) if (now - s.occurredAt > MAX_AGE_MS) signals.delete(id)
  return { signals: [...signals.values()], cursor: { historyId, labels: labelsKey } }
}

type SentInfo = { id: string; threadId: string; sentAt: number; subject: string }

// Remembers sent messages between runs so each one is only fetched once.
export type FollowupCache = Map<string, SentInfo>

const FOLLOWUP_LOOKBACK_MS = 14 * DAY
const SENT_SCAN = 30
const THREADS_CHECKED = 15

// "Waiting for a reply": the last thing the user sent in a thread got no answer after `waitHours`.
export async function collectGmailFollowups(input: {
  api: GmailApi
  cache: FollowupCache
  now: number
  waitHours: number
}): Promise<Signal[]> {
  const { api, cache, now, waitHours } = input

  const ids = await api.listMessageIds('SENT', SENT_SCAN)
  const fresh = ids.filter((id) => !cache.has(id))
  const fetched = await mapLimit(fresh, CONCURRENCY, (id) => api.getMessage(id))
  for (const msg of fetched) {
    if (!msg) continue
    cache.set(msg.id, {
      id: msg.id,
      threadId: msg.threadId,
      sentAt: msg.internalDate,
      subject: msg.headers['subject']?.trim() || '(Sin asunto)'
    })
  }

  // Newest sent message per thread, old enough to be worth a nudge but not ancient.
  const latestByThread = new Map<string, SentInfo>()
  for (const id of ids) {
    const info = cache.get(id)
    if (!info || now - info.sentAt > FOLLOWUP_LOOKBACK_MS) continue
    const current = latestByThread.get(info.threadId)
    if (!current || info.sentAt > current.sentAt) latestByThread.set(info.threadId, info)
  }
  const candidates = [...latestByThread.values()]
    .filter((m) => now - m.sentAt >= waitHours * 60 * 60 * 1000)
    .sort((a, b) => a.sentAt - b.sentAt)
    .slice(0, THREADS_CHECKED)

  const replies: IncomingReply[] = []
  const threads = await mapLimit(candidates, CONCURRENCY, (m) => api.getThreadMessages(m.threadId))
  threads.forEach((messages: GmailMessage[], i) => {
    for (const m of messages) {
      if (!m.labelIds.includes('SENT')) {
        replies.push({ threadId: candidates[i].threadId, at: m.internalDate })
      }
    }
  })

  const sent: SentMessage[] = candidates.map((m) => ({
    externalId: m.threadId,
    source: 'gmail',
    threadId: m.threadId,
    title: m.subject,
    url: threadUrl(m.threadId),
    sentAt: m.sentAt
  }))
  return findFollowups(sent, replies, now, waitHours)
}
