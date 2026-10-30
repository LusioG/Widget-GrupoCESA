import type { Signal } from '../../../shared/types'
import { findFollowups } from '../../engine/followups'

const DAY = 24 * 60 * 60 * 1000
export const FOLLOWUP_LOOKBACK_MS = 14 * DAY

export type SentRecord = { at: number; text: string; to: string; url: string }

// What is remembered about direct messages, to detect "I wrote and nobody answered".
export type DmState = {
  sentByChannel: Record<string, SentRecord> // the user's latest message per DM
  lastIncoming: Record<string, number> // when someone else last wrote in that DM
}

export const emptyDmState = (): DmState => ({ sentByChannel: {}, lastIncoming: {} })

export function parseDmState(raw: string | undefined): DmState {
  try {
    const parsed = JSON.parse(raw ?? '') as Partial<DmState>
    return {
      sentByChannel: parsed.sentByChannel ?? {},
      lastIncoming: parsed.lastIncoming ?? {}
    }
  } catch {
    return emptyDmState()
  }
}

export function pruneDmState(state: DmState, now: number): DmState {
  const sentByChannel = Object.fromEntries(
    Object.entries(state.sentByChannel).filter(([, s]) => now - s.at <= FOLLOWUP_LOOKBACK_MS)
  )
  const lastIncoming = Object.fromEntries(
    Object.entries(state.lastIncoming).filter(([, at]) => now - at <= FOLLOWUP_LOOKBACK_MS)
  )
  return { sentByChannel, lastIncoming }
}

export function slackFollowups(state: DmState, now: number, waitHours: number): Signal[] {
  const sent = Object.entries(state.sentByChannel).map(([channel, s]) => ({
    externalId: channel,
    source: 'slack' as const,
    threadId: channel,
    title: `Mensaje a ${s.to}: ${s.text}`.slice(0, 160),
    url: s.url,
    sentAt: s.at
  }))
  const replies = Object.entries(state.lastIncoming).map(([channel, at]) => ({
    threadId: channel,
    at
  }))
  return findFollowups(sent, replies, now, waitHours)
}
