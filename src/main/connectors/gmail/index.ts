import type {
  AvailableList,
  DistributionList,
  GmailLabel,
  Signal,
  ThreadView
} from '../../../shared/types'
import { logWarn } from '../../logger'
import { getSettings } from '../../settingsStore'
import { ApiDisabledError, AuthError, type Connector, type ConnectorContext } from '../types'
import {
  apiDisabledInfo,
  authorizedClient,
  disableFeature,
  enableFeature,
  isAuthFailure,
  isFeatureConnected
} from '../google/auth'
import { createGoogleGmailApi } from './api'
import { buildThreadView, discoverLists, listQuery, threadToSignal } from './lists'
import { inAccount, threadUrl } from './mapper'
import {
  collectGmailFollowups,
  mapLimit,
  syncEmails,
  type FollowupCache,
  type GmailCursor
} from './sync'
import type { GmailApi, GmailListsApi } from './types'

type Api = GmailApi & GmailListsApi

const FOLLOWUP_EVERY_MS = 15 * 60 * 1000 // threads are only re-checked every 15 minutes
const LIST_THREADS = 15 // conversations read per list on each check
const DISCOVER_DAYS = 90
const DISCOVER_SCAN = 200 // recent messages looked at to find the lists the user receives
const CONCURRENCY = 5

// What was last read of a list conversation. While Gmail reports the same `historyId` (and the
// ignored senders are the same) it is not read again, so a minute-by-minute check stays cheap.
type ThreadCacheEntry = { historyId: string; ignoredKey: string; signal: Signal | null }

// Labels worth offering in the "what to watch" list (system noise is hidden).
const HIDDEN_LABELS = new Set([
  'SENT',
  'DRAFT',
  'SPAM',
  'TRASH',
  'UNREAD',
  'CHAT',
  'CATEGORY_PERSONAL'
])

export class GmailConnector implements Connector {
  readonly id = 'gmail' as const

  private readonly sentCache: FollowupCache = new Map()
  private followups: Signal[] = []
  private followupsAt = 0
  private threadCache = new Map<string, ThreadCacheEntry>()
  private email = '' // the user's own address, to tell which bubbles are theirs

  async isConnected(): Promise<boolean> {
    return isFeatureConnected('gmail')
  }

  async connect(): Promise<void> {
    await enableFeature('gmail')
  }

  async disconnect(): Promise<void> {
    disableFeature('gmail')
    this.sentCache.clear()
    this.followups = []
    this.followupsAt = 0
    this.threadCache.clear()
    this.email = ''
  }

  private async api(): Promise<Api> {
    return createGoogleGmailApi(await authorizedClient())
  }

  // The mailbox the widget reads, once known. Links carry it so Gmail opens this account and not
  // whichever one the browser has first.
  get account(): string {
    return this.email
  }

  private async ensureEmail(api: Api): Promise<void> {
    if (!this.email) this.email = (await api.getProfile()).email
  }

  // Google errors that mean "reconnect" or "turn the API on" become the app's own errors.
  private rethrow(error: unknown): never {
    if (isAuthFailure(error)) throw new AuthError()
    const disabled = apiDisabledInfo(error)
    if (disabled) throw new ApiDisabledError('gmail', disabled.url)
    throw error
  }

  // One item per unread conversation of each followed distribution list.
  private async syncLists(
    api: Api,
    lists: DistributionList[],
    ignoredSenders: string[],
    days: number
  ): Promise<Signal[]> {
    const ignoredKey = ignoredSenders.join('|')
    const next = new Map<string, ThreadCacheEntry>()
    const signals: Signal[] = []
    const taken = new Set<string>() // a conversation sent to two followed lists counts once

    for (const list of lists) {
      let found: { id: string; historyId: string }[]
      try {
        found = await api.searchThreads(listQuery(list.address, days), LIST_THREADS)
      } catch (error) {
        if (isAuthFailure(error) || apiDisabledInfo(error)) this.rethrow(error)
        logWarn('gmail', `could not read the list ${list.address}`, error) // the others still work
        continue
      }
      const entries = await mapLimit(
        found.filter((t) => !taken.has(t.id)),
        CONCURRENCY,
        async ({ id, historyId }): Promise<[string, string, ThreadCacheEntry]> => {
          const key = `${list.address}:${id}`
          const cached = this.threadCache.get(key)
          if (cached && cached.historyId === historyId && cached.ignoredKey === ignoredKey) {
            return [key, id, cached]
          }
          const messages = await api.getThread(id, false)
          const signal = messages
            ? threadToSignal({ threadId: id, messages, list, ignoredSenders })
            : null
          return [key, id, { historyId, ignoredKey, signal }]
        }
      )
      for (const [key, threadId, entry] of entries) {
        next.set(key, entry)
        taken.add(threadId)
        if (entry.signal) signals.push(entry.signal)
      }
    }
    this.threadCache = next
    return signals
  }

  // The lists the user receives mail through (a distribution list says so in its headers), to
  // pick from in Ajustes.
  async listAvailableLists(): Promise<AvailableList[]> {
    try {
      const api = await this.api()
      const ids = await api.searchMessageIds(`newer_than:${DISCOVER_DAYS}d`, DISCOVER_SCAN)
      const messages = await mapLimit(ids, CONCURRENCY, (id) => api.getMessage(id))
      return discoverLists(messages.filter((m): m is NonNullable<typeof m> => m !== null))
    } catch (error) {
      return this.rethrow(error)
    }
  }

  // A conversation with the text of every message, for the window that shows it as a chat. The
  // text is read now, when the user asks, and never stored.
  async readThread(threadId: string): Promise<ThreadView> {
    try {
      const api = await this.api()
      await this.ensureEmail(api)
      const messages = await api.getThread(threadId, true)
      if (!messages || messages.length === 0) {
        return {
          threadId,
          subject: '',
          messages: [],
          gmailUrl: threadUrl(threadId, this.email),
          error: 'failed'
        }
      }
      return buildThreadView({
        threadId,
        messages,
        me: this.email,
        lists: getSettings().gmail.lists
      })
    } catch (error) {
      return this.rethrow(error)
    }
  }

  async sync(ctx: ConnectorContext): Promise<Signal[]> {
    try {
      const api = await this.api()
      await this.ensureEmail(api)
      const settings = getSettings()
      const watched = settings.gmail.labelIds.length > 0 ? settings.gmail.labelIds : ['INBOX']
      const now = Date.now()

      let cursor: GmailCursor | undefined
      try {
        cursor = JSON.parse((await ctx.getCursor()) ?? '') as GmailCursor
      } catch {
        cursor = undefined
      }

      const lists = settings.gmail.lists
      const cached = (await ctx.loadCached()).filter((s) => s.kind === 'email' && !s.list)
      const result = await syncEmails({
        api,
        watched,
        cursor,
        cached,
        now,
        lists: lists.map((l) => l.address)
      })
      await ctx.setCursor(JSON.stringify(result.cursor))
      const listSignals =
        lists.length > 0
          ? await this.syncLists(
              api,
              lists,
              settings.filters.ignoredSenders,
              settings.gmail.listDays
            )
          : []

      if (now - this.followupsAt >= FOLLOWUP_EVERY_MS) {
        this.followups = await collectGmailFollowups({
          api,
          cache: this.sentCache,
          now,
          waitHours: settings.followups.waitHours
        })
        this.followupsAt = now
      }
      // Every link opens the mailbox the widget reads.
      return [...result.signals, ...listSignals, ...this.followups].map((s) => ({
        ...s,
        url: inAccount(s.url, this.email)
      }))
    } catch (error) {
      if (isAuthFailure(error)) throw new AuthError()
      const disabled = apiDisabledInfo(error)
      if (disabled) throw new ApiDisabledError('gmail', disabled.url)
      throw error
    }
  }

  async listWatchableLabels(): Promise<GmailLabel[]> {
    let labels: GmailLabel[]
    try {
      labels = await (await this.api()).listLabels()
    } catch (error) {
      const disabled = apiDisabledInfo(error)
      if (disabled) throw new ApiDisabledError('gmail', disabled.url)
      throw error
    }
    return labels
      .filter((l) => !HIDDEN_LABELS.has(l.id) && !l.id.startsWith('CATEGORY_'))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}
