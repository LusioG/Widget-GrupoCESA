import type { GmailLabel, Signal } from '../../../shared/types'
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
import { collectGmailFollowups, syncEmails, type FollowupCache, type GmailCursor } from './sync'
import type { GmailApi } from './types'

const FOLLOWUP_EVERY_MS = 15 * 60 * 1000 // threads are only re-checked every 15 minutes

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
  }

  private async api(): Promise<GmailApi> {
    return createGoogleGmailApi(await authorizedClient())
  }

  async sync(ctx: ConnectorContext): Promise<Signal[]> {
    try {
      const api = await this.api()
      const settings = getSettings()
      const watched = settings.gmail.labelIds.length > 0 ? settings.gmail.labelIds : ['INBOX']
      const now = Date.now()

      let cursor: GmailCursor | undefined
      try {
        cursor = JSON.parse((await ctx.getCursor()) ?? '') as GmailCursor
      } catch {
        cursor = undefined
      }

      const cached = (await ctx.loadCached()).filter((s) => s.kind === 'email')
      const result = await syncEmails({ api, watched, cursor, cached, now })
      await ctx.setCursor(JSON.stringify(result.cursor))

      if (now - this.followupsAt >= FOLLOWUP_EVERY_MS) {
        this.followups = await collectGmailFollowups({
          api,
          cache: this.sentCache,
          now,
          waitHours: settings.followups.waitHours
        })
        this.followupsAt = now
      }
      return [...result.signals, ...this.followups]
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
