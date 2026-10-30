import type { Signal } from '../../../shared/types'
import { cleanSlackText, mentionsUser, permalink } from './text'

export type SlackMessageEvent = {
  type?: string
  subtype?: string
  channel?: string
  channel_type?: string
  user?: string
  bot_id?: string
  text?: string
  ts?: string
}

export type ConversationKind = 'channel' | 'group' | 'im' | 'mpim'

export type SlackLookups = {
  me: { userId: string; workspaceUrl: string }
  conversation(
    channel: string,
    hintedType?: ConversationKind
  ): Promise<{ kind: ConversationKind; name?: string; peerId?: string }>
  user(id: string): Promise<{ name: string; isBot: boolean }>
  userName(id: string): string | undefined
  channelName(id: string): string | undefined
}

export type Classified =
  | { type: 'ignore' }
  | { type: 'sent'; channel: string; at: number; text: string; to: string; url: string }
  | { type: 'signal'; signal: Signal; channel: string; at: number; isDm: boolean }

// Subtypes that carry a real, new message from a person.
const ALLOWED_SUBTYPES = new Set([undefined, 'thread_broadcast', 'file_share'])

const toKind = (t: string | undefined): ConversationKind | undefined =>
  t === 'im' || t === 'mpim' || t === 'group' || t === 'channel' ? t : undefined

// Decides what a raw `message` event means for the widget. Read-only: nothing is sent back.
export async function classifyMessage(
  event: SlackMessageEvent,
  lookups: SlackLookups
): Promise<Classified> {
  const { channel, ts, user } = event
  if (event.type !== 'message' || !channel || !ts || !user) return { type: 'ignore' }
  if (!ALLOWED_SUBTYPES.has(event.subtype) || event.bot_id) return { type: 'ignore' }

  const conversation = await lookups.conversation(channel, toKind(event.channel_type))
  const isDm = conversation.kind === 'im' || conversation.kind === 'mpim'
  const at = Math.round(Number(ts) * 1000)
  const text = event.text ?? ''
  const url = permalink(lookups.me.workspaceUrl, channel, ts)

  // Messages written by the user: only DMs matter, as possible "waiting for a reply".
  if (user === lookups.me.userId) {
    if (!isDm) return { type: 'ignore' }
    const peer = conversation.peerId ? (await lookups.user(conversation.peerId)).name : 'grupo'
    return {
      type: 'sent',
      channel,
      at,
      text: cleanSlackText(text, lookups),
      to: peer,
      url
    }
  }

  const sender = await lookups.user(user)
  if (sender.isBot) return { type: 'ignore' }

  if (!isDm && !mentionsUser(text, lookups.me.userId)) return { type: 'ignore' }

  // Resolve the names that appear as <@U123> so the title reads "@Ana" instead of an id.
  const mentioned = [...text.matchAll(/<@([A-Z0-9]+)/g)].map((m) => m[1]).slice(0, 5)
  await Promise.all(mentioned.map((id) => lookups.user(id)))

  const title = cleanSlackText(text, lookups) || '(archivo adjunto)'
  const channelLabel = conversation.name ? `#${conversation.name}` : undefined
  const signal: Signal = {
    id: `slack:${channel}:${ts}`,
    source: 'slack',
    kind: isDm ? 'dm' : 'mention',
    title,
    body: isDm
      ? conversation.kind === 'mpim'
        ? 'Mensaje de grupo'
        : 'Mensaje directo'
      : channelLabel,
    url,
    occurredAt: at,
    sender: sender.name,
    channel: isDm ? undefined : channelLabel
  }
  return { type: 'signal', signal, channel, at, isDm }
}
