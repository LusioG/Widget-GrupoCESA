import type { Signal, Source } from '../../shared/types'

const HOUR = 60 * 60 * 1000

// Something the user sent (an email or a Slack message) that may be waiting for an answer.
export type SentMessage = {
  externalId: string
  source: Source
  threadId: string
  title: string
  url: string
  sentAt: number
}

// A message from someone else in a thread.
export type IncomingReply = { threadId: string; at: number }

// "Waiting for a reply": sent at least `waitHours` ago and nobody answered in that thread since.
export function findFollowups(
  sent: SentMessage[],
  replies: IncomingReply[],
  now: number,
  waitHours: number
): Signal[] {
  const waitMs = waitHours * HOUR
  return sent
    .filter((m) => now - m.sentAt >= waitMs)
    .filter((m) => !replies.some((r) => r.threadId === m.threadId && r.at > m.sentAt))
    .map((m) => ({
      id: `${m.source}:followup-${m.externalId}`,
      source: m.source,
      kind: 'followup' as const,
      title: m.title,
      url: m.url,
      occurredAt: m.sentAt
    }))
    .sort((a, b) => a.occurredAt - b.occurredAt) // oldest first
}
