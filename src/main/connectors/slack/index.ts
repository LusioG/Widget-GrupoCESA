import type { WebClient } from '@slack/web-api'
import type { Signal, SlackChannel } from '../../../shared/types'
import { deleteSecret, getSecret, hasSecret, setSecret } from '../../auth/secrets'
import { getSettings } from '../../settingsStore'
import { AuthError, type Connector, type ConnectorContext } from '../types'
import {
  classifyMessage,
  type ConversationKind,
  type SlackLookups,
  type SlackMessageEvent
} from './events'
import { emptyDmState, parseDmState, pruneDmState, slackFollowups, type DmState } from './followups'

const KEYS = {
  userToken: 'slack.userToken',
  identity: 'slack.identity'
} as const

const DAY = 24 * 60 * 60 * 1000
const KEEP_MS = 3 * DAY // how long a mention/DM stays in the list
const KEEP_MAX = 100
const SEARCH_COUNT = 50 // newest matches per query and per check

const AUTH_ERRORS =
  /invalid_auth|not_authed|token_revoked|token_expired|account_inactive|not_allowed_token_type|missing_scope|no_permission/i

function isSlackAuthError(error: unknown): boolean {
  const e = error as { data?: { error?: string }; message?: string }
  return AUTH_ERRORS.test(`${e?.data?.error ?? ''} ${e?.message ?? ''}`)
}

// Tests point the SDK client at a local mock through this variable.
const apiUrl = (): string | undefined => process.env['SLACK_API_URL']

type Identity = { userId: string; workspaceUrl: string }

type SearchMatch = {
  type?: string
  subtype?: string
  bot_id?: string
  user?: string
  text?: string
  ts?: string
  channel?: {
    id?: string
    name?: string
    is_im?: boolean
    is_mpim?: boolean
    is_private?: boolean
  }
}

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

// Polled (not push-based): every check asks Slack's search for the newest direct messages and
// mentions with the user token alone, so no app-level token or Socket Mode is needed.
export class SlackConnector implements Connector {
  readonly id = 'slack' as const

  private web?: WebClient
  private identity?: Identity
  private loaded = false
  private since = 0 // only messages newer than the moment Slack was connected are news

  private readonly buffer = new Map<string, Signal>()
  private dm: DmState = emptyDmState()
  private readonly users = new Map<string, { name: string; isBot: boolean }>()
  private readonly channels = new Map<
    string,
    { kind: ConversationKind; name?: string; peerId?: string }
  >()

  async isConnected(): Promise<boolean> {
    return hasSecret(KEYS.userToken)
  }

  // The token is stored first, then validated by `connect()`.
  setToken(userToken: string): void {
    setSecret(KEYS.userToken, userToken.trim())
  }

  private async newWebClient(): Promise<WebClient> {
    const token = getSecret(KEYS.userToken)
    if (!token) throw new AuthError('No Slack user token stored')
    const { WebClient } = await import('@slack/web-api')
    return new WebClient(token, { slackApiUrl: apiUrl() })
  }

  async connect(): Promise<void> {
    try {
      const web = await this.newWebClient()
      const auth = await web.auth.test() // read-only; also tells us who "me" is
      if (!auth.user_id || !auth.url) throw new Error('Unexpected auth.test response')
      setSecret(KEYS.identity, JSON.stringify({ userId: auth.user_id, workspaceUrl: auth.url }))
      this.reset()
    } catch (error) {
      this.clearSecrets()
      throw isSlackAuthError(error) ? new AuthError('Slack rejected the token') : error
    }
  }

  private clearSecrets(): void {
    deleteSecret(KEYS.userToken)
    deleteSecret(KEYS.identity)
  }

  private reset(): void {
    this.web = undefined
    this.identity = undefined
    this.loaded = false
    this.since = 0
    this.buffer.clear()
    this.users.clear()
    this.channels.clear()
    this.dm = emptyDmState()
  }

  async disconnect(): Promise<void> {
    this.clearSecrets()
    this.reset()
  }

  // ---- polling ----

  private async load(ctx: ConnectorContext): Promise<void> {
    try {
      this.identity = JSON.parse(getSecret(KEYS.identity) ?? '') as Identity
    } catch {
      throw new AuthError('Slack identity missing')
    }
    this.web = await this.newWebClient()
    const raw = await ctx.getCursor()
    this.dm = pruneDmState(parseDmState(raw), Date.now())
    try {
      const since = (JSON.parse(raw ?? '') as { since?: unknown }).since
      if (typeof since === 'number') this.since = since
    } catch {
      // No cursor yet.
    }
    if (!this.since) {
      this.since = Date.now()
      await this.saveCursor(ctx)
    }
    for (const s of await ctx.loadCached()) {
      if (s.kind === 'mention' || s.kind === 'dm') this.buffer.set(s.id, s)
    }
    this.loaded = true
  }

  private saveCursor(ctx: ConnectorContext): Promise<void> {
    return ctx.setCursor(JSON.stringify({ ...pruneDmState(this.dm, Date.now()), since: this.since }))
  }

  async sync(ctx: ConnectorContext): Promise<Signal[]> {
    if (!this.loaded) await this.load(ctx)
    const web = this.web!
    const me = this.identity!.userId
    const after = isoDay(this.since - DAY) // search filters by whole days; `since` does the rest

    try {
      const matches: SearchMatch[] = []
      for (const query of [`is:dm after:${after}`, `<@${me}> after:${after}`]) {
        const res = await web.search.messages({
          query,
          sort: 'timestamp',
          sort_dir: 'desc',
          count: SEARCH_COUNT
        })
        matches.push(...((res.messages?.matches ?? []) as SearchMatch[]))
      }

      // Oldest first, so the latest message of each conversation is the one that is kept.
      const seen = new Set<string>()
      const fresh = matches
        .filter((m) => m.ts && m.channel?.id && Number(m.ts) * 1000 > this.since)
        .filter((m) => {
          const key = `${m.channel!.id}:${m.ts}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .sort((a, b) => Number(a.ts) - Number(b.ts))

      let changed = false
      for (const match of fresh) {
        changed = (await this.apply(match)) || changed
      }
      if (changed) await this.saveCursor(ctx)
    } catch (error) {
      throw isSlackAuthError(error) ? new AuthError('Slack rejected the token') : error
    }
    return this.snapshot()
  }

  // ---- messages ----

  private lookups(): SlackLookups {
    const web = this.web!
    return {
      me: this.identity!,
      userName: (id) => this.users.get(id)?.name,
      channelName: (id) => this.channels.get(id)?.name,
      user: async (id) => {
        const cached = this.users.get(id)
        if (cached) return cached
        let info = { name: id, isBot: false }
        try {
          const res = await web.users.info({ user: id })
          const u = res.user
          info = {
            name: u?.profile?.display_name || u?.real_name || u?.name || id,
            isBot: !!u?.is_bot
          }
        } catch {
          // Missing scope or network: fall back to the raw id.
        }
        this.users.set(id, info)
        return info
      },
      // Search results already say what each conversation is (seeded in `apply`).
      conversation: async (channel, hint) =>
        this.channels.get(channel) ?? { kind: hint ?? (channel.startsWith('D') ? 'im' : 'channel') }
    }
  }

  // Returns true when the message changed what is remembered.
  private async apply(match: SearchMatch): Promise<boolean> {
    const c = match.channel!
    const kind: ConversationKind = c.is_im
      ? 'im'
      : c.is_mpim
        ? 'mpim'
        : c.is_private
          ? 'group'
          : 'channel'
    // For a direct message the "name" Slack gives is the id of the other person.
    this.channels.set(c.id!, {
      kind,
      name: kind === 'im' ? undefined : c.name,
      peerId: kind === 'im' ? c.name : undefined
    })
    const event: SlackMessageEvent = {
      type: 'message',
      subtype: match.subtype,
      channel: c.id,
      channel_type: kind,
      user: match.user,
      bot_id: match.bot_id,
      text: match.text,
      ts: match.ts
    }
    const result = await classifyMessage(event, this.lookups())

    if (result.type === 'signal') {
      this.buffer.set(result.signal.id, result.signal)
      if (result.isDm) {
        this.dm.lastIncoming[result.channel] = Math.max(
          this.dm.lastIncoming[result.channel] ?? 0,
          result.at
        )
      }
      return true
    }
    if (result.type === 'sent') {
      const known = this.dm.sentByChannel[result.channel]
      if (!known || result.at >= known.at) {
        this.dm.sentByChannel[result.channel] = {
          at: result.at,
          text: result.text,
          to: result.to,
          url: result.url
        }
      }
      return true
    }
    return false
  }

  private snapshot(): Signal[] {
    const now = Date.now()
    const recent = [...this.buffer.values()]
      .filter((s) => now - s.occurredAt <= KEEP_MS)
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, KEEP_MAX)
    this.buffer.clear()
    recent.forEach((s) => this.buffer.set(s.id, s))
    return [...recent, ...slackFollowups(this.dm, now, getSettings().followups.waitHours)]
  }

  // Channels the user is in, to choose which ones to ignore.
  async listChannels(): Promise<SlackChannel[]> {
    const web = this.web ?? (await this.newWebClient())
    const out: SlackChannel[] = []
    let cursor: string | undefined
    for (let page = 0; page < 3; page++) {
      const res = await web.users.conversations({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
        cursor
      })
      for (const c of res.channels ?? []) {
        if (c.id && c.name) out.push({ id: c.id, name: c.name, isPrivate: !!c.is_private })
      }
      cursor = res.response_metadata?.next_cursor || undefined
      if (!cursor) break
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }
}
