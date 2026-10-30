import type { SocketModeClient } from '@slack/socket-mode'
import type { WebClient } from '@slack/web-api'
import type { Signal, SlackChannel } from '../../../shared/types'
import { deleteSecret, getSecret, hasSecret, setSecret } from '../../auth/secrets'
import { nextDelay } from '../../engine/backoff'
import { getSettings } from '../../settingsStore'
import { AuthError, type Connector, type ConnectorContext, type RealtimeHandlers } from '../types'
import {
  classifyMessage,
  type ConversationKind,
  type SlackLookups,
  type SlackMessageEvent
} from './events'
import { emptyDmState, parseDmState, pruneDmState, slackFollowups, type DmState } from './followups'

const KEYS = {
  appToken: 'slack.appToken',
  userToken: 'slack.userToken',
  identity: 'slack.identity'
} as const

const DAY = 24 * 60 * 60 * 1000
const KEEP_MS = 3 * DAY // how long a mention/DM stays in the list
const KEEP_MAX = 100
const FOLLOWUP_REFRESH_MS = 10 * 60 * 1000
const RECONNECT_WATCHDOG_MS = 90_000

const AUTH_ERRORS =
  /invalid_auth|not_authed|token_revoked|token_expired|account_inactive|not_allowed_token_type/i

function isSlackAuthError(error: unknown): boolean {
  const e = error as { data?: { error?: string }; message?: string }
  return AUTH_ERRORS.test(`${e?.data?.error ?? ''} ${e?.message ?? ''}`)
}

// Tests point both SDK clients at a local mock through this variable.
const apiUrl = (): string | undefined => process.env['SLACK_API_URL']

type Identity = { userId: string; workspaceUrl: string }

export class SlackConnector implements Connector {
  readonly id = 'slack' as const

  private web?: WebClient
  private socket?: SocketModeClient
  private identity?: Identity
  private handlers?: RealtimeHandlers
  private ctx?: ConnectorContext
  private stopped = true
  private watchdog?: NodeJS.Timeout
  private followupTimer?: NodeJS.Timeout

  private readonly buffer = new Map<string, Signal>()
  private dm: DmState = emptyDmState()
  private readonly users = new Map<string, { name: string; isBot: boolean }>()
  private readonly channels = new Map<
    string,
    { kind: ConversationKind; name?: string; peerId?: string }
  >()

  async isConnected(): Promise<boolean> {
    return hasSecret(KEYS.userToken) && hasSecret(KEYS.appToken)
  }

  // Tokens are stored first, then validated by `connect()`.
  setTokens(appToken: string, userToken: string): void {
    setSecret(KEYS.appToken, appToken.trim())
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
    } catch (error) {
      this.clearSecrets()
      throw isSlackAuthError(error) ? new AuthError('Slack rejected the tokens') : error
    }
  }

  private clearSecrets(): void {
    deleteSecret(KEYS.appToken)
    deleteSecret(KEYS.userToken)
    deleteSecret(KEYS.identity)
  }

  async disconnect(): Promise<void> {
    await this.stop()
    this.clearSecrets()
    this.buffer.clear()
    this.users.clear()
    this.channels.clear()
    this.dm = emptyDmState()
  }

  // Slack is push-based; the heartbeat just reports what is currently known.
  async sync(): Promise<Signal[]> {
    return this.snapshot()
  }

  // ---- realtime ----

  async start(ctx: ConnectorContext, handlers: RealtimeHandlers): Promise<void> {
    await this.stop()
    this.stopped = false
    this.ctx = ctx
    this.handlers = handlers

    try {
      this.identity = JSON.parse(getSecret(KEYS.identity) ?? '') as Identity
    } catch {
      this.identity = undefined
    }
    if (!this.identity || !getSecret(KEYS.appToken)) {
      handlers.onAuthError()
      return
    }

    this.web = await this.newWebClient()
    this.dm = pruneDmState(parseDmState(await ctx.getCursor()), Date.now())
    for (const s of await ctx.loadCached()) {
      if (s.kind === 'mention' || s.kind === 'dm') this.buffer.set(s.id, s)
    }
    this.emit()
    this.followupTimer = setInterval(() => this.emit(), FOLLOWUP_REFRESH_MS)

    await this.openSocket()
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.watchdog) clearTimeout(this.watchdog)
    if (this.followupTimer) clearInterval(this.followupTimer)
    this.watchdog = this.followupTimer = undefined
    const socket = this.socket
    this.socket = undefined
    if (socket) await socket.disconnect().catch(() => undefined)
  }

  private async openSocket(): Promise<void> {
    const appToken = getSecret(KEYS.appToken)
    if (!appToken) {
      this.handlers?.onAuthError()
      return
    }
    const { SocketModeClient } = await import('@slack/socket-mode')
    const socket = new SocketModeClient({
      appToken,
      autoReconnectEnabled: true,
      clientOptions: { slackApiUrl: apiUrl() }
    })
    this.socket = socket

    socket.on('connected', () => {
      if (this.watchdog) clearTimeout(this.watchdog)
      this.handlers?.onStatus(true)
    })
    // A dropped socket emits "close" right away; "reconnecting" only comes after the retry delay.
    const onDown = (): void => {
      if (this.stopped || this.socket !== socket) return
      this.handlers?.onStatus(false)
      // The SDK keeps retrying by itself; if it has not recovered in time, start over from scratch.
      if (this.watchdog) clearTimeout(this.watchdog)
      this.watchdog = setTimeout(() => void this.restartSocket(), RECONNECT_WATCHDOG_MS)
    }
    socket.on('close', onDown)
    socket.on('reconnecting', onDown)
    socket.on('disconnected', onDown)
    socket.on(
      'message',
      async ({ event, ack }: { event: SlackMessageEvent; ack: () => Promise<void> }) => {
        await ack() // Slack retries unacknowledged events
        try {
          await this.onMessage(event)
        } catch {
          // One bad event must never break the connection; never log message content.
        }
      }
    )

    let failures = 0
    while (!this.stopped && this.socket === socket) {
      try {
        await socket.start()
        return
      } catch (error) {
        if (isSlackAuthError(error)) {
          this.handlers?.onAuthError()
          return
        }
        failures += 1
        await new Promise((r) => setTimeout(r, nextDelay(2000, failures, 60_000)))
      }
    }
  }

  private async restartSocket(): Promise<void> {
    if (this.stopped) return
    const old = this.socket
    this.socket = undefined
    if (old) await old.disconnect().catch(() => undefined)
    await this.openSocket()
  }

  // ---- events ----

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
      conversation: async (channel, hint) => {
        const cached = this.channels.get(channel)
        if (cached) return cached
        const prefixKind: ConversationKind = channel.startsWith('D') ? 'im' : 'channel'
        let info: { kind: ConversationKind; name?: string; peerId?: string } = {
          kind: hint ?? prefixKind
        }
        try {
          const res = await web.conversations.info({ channel })
          const c = res.channel as
            | {
                is_im?: boolean
                is_mpim?: boolean
                is_private?: boolean
                name?: string
                user?: string
              }
            | undefined
          if (c) {
            const kind: ConversationKind = c.is_im
              ? 'im'
              : c.is_mpim
                ? 'mpim'
                : c.is_private
                  ? 'group'
                  : 'channel'
            info = { kind, name: c.name, peerId: c.user }
          }
        } catch {
          // Keep the hinted kind.
        }
        this.channels.set(channel, info)
        return info
      }
    }
  }

  private async onMessage(event: SlackMessageEvent): Promise<void> {
    if (!this.web || !this.identity) return
    const result = await classifyMessage(event, this.lookups())

    if (result.type === 'signal') {
      this.buffer.set(result.signal.id, result.signal)
      if (result.isDm) this.dm.lastIncoming[result.channel] = result.at
    } else if (result.type === 'sent') {
      this.dm.sentByChannel[result.channel] = {
        at: result.at,
        text: result.text,
        to: result.to,
        url: result.url
      }
    } else {
      return
    }
    await this.ctx?.setCursor(JSON.stringify(pruneDmState(this.dm, Date.now())))
    this.emit()
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

  private emit(): void {
    this.handlers?.onSignals(this.snapshot())
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
