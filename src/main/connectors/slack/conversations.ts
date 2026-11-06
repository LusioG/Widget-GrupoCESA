import type { ConversationMessage, Signal } from '../../../shared/types'

// Direct messages of Slack reach the widget one by one, but the person thinks in conversations: seven
// messages from the same colleague are one thing to answer, not seven. So each conversation becomes
// ONE signal, the way the distribution lists do: the latest message is the card, `unread` counts the
// new ones and `messages` keeps the latest ones so the card can unfold. Pure functions, tested.

export const MAX_CONVERSATION_MESSAGES = 20

// The id of a message is `slack:<channel>:<ts>`; Slack's ids have no ":" inside.
export function parseMessageId(id: string): { channel: string; ts: string } | null {
  const parts = id.split(':')
  return parts.length === 3 && parts[0] === 'slack' && parts[1] && parts[2]
    ? { channel: parts[1], ts: parts[2] }
    : null
}

export const messageId = (channel: string, ts: string): string => `slack:${channel}:${ts}`

// Slack's "1730000000.000100" as milliseconds.
export const tsToMs = (ts: string): number => Math.round(Number(ts) * 1000)

const lineOf = (s: Signal, ts: string): ConversationMessage => ({
  ts,
  at: s.occurredAt,
  text: s.title,
  ...(s.sender ? { sender: s.sender } : {})
})

// The conversations of `signals` (direct messages and group chats) as one signal each; everything
// else (mentions in channels, mail...) passes through untouched. `seenUpTo` says, for each
// conversation, up to when the person has read it (ms).
export function groupConversations(
  signals: Signal[],
  seenUpTo: Record<string, number>
): Signal[] {
  const groups = new Map<string, { signal: Signal; ts: string }[]>()
  const others: Signal[] = []
  for (const s of signals) {
    const parsed = s.kind === 'dm' ? parseMessageId(s.id) : null
    if (!parsed) {
      others.push(s)
      continue
    }
    groups.set(parsed.channel, [...(groups.get(parsed.channel) ?? []), { signal: s, ts: parsed.ts }])
  }

  const conversations = [...groups.entries()].map(([channel, members]) => {
    const sorted = [...members].sort((a, b) => b.signal.occurredAt - a.signal.occurredAt)
    const latest = sorted[0].signal
    const lines = sorted.slice(0, MAX_CONVERSATION_MESSAGES).map((m) => lineOf(m.signal, m.ts))
    const readUpTo = seenUpTo[channel] ?? 0
    const group: Signal = {
      ...latest,
      unread: sorted.filter((m) => m.signal.occurredAt > readUpTo).length,
      messages: lines
    }
    return group
  })
  return [...conversations, ...others]
}

// What was kept of a conversation, back as the separate messages the connector works with (the
// local copy keeps conversations, not messages).
export function splitConversation(signal: Signal): Signal[] {
  const parsed = signal.kind === 'dm' ? parseMessageId(signal.id) : null
  if (!parsed || !signal.messages || signal.messages.length === 0) return [signal]
  const { unread: _unread, messages: _messages, ...base } = signal
  void [_unread, _messages]
  return signal.messages.map((m) => ({
    ...base,
    id: messageId(parsed.channel, m.ts),
    title: m.text,
    occurredAt: m.at,
    ...(m.sender ? { sender: m.sender } : {})
  }))
}
