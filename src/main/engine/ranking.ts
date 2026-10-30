import { URGENT_THRESHOLD } from '../../shared/badgeState'
import type { Signal, TaskPriority } from '../../shared/types'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// The priority flag set in ClickUp. Urgent alone reaches the urgent threshold.
const PRIORITY_BONUS: Record<TaskPriority, number> = {
  urgent: 0.5,
  high: 0.25,
  normal: 0,
  low: -0.1
}

// A priority sender always lands above the urgent threshold, a bit above plain urgent items.
const PRIORITY_SENDER_SCORE = 0.9

export type RankingContext = {
  now: number
  importantSenders: string[]
}

const BASE: Record<Signal['kind'], number> = {
  meeting: 0,
  task: 0.3,
  email: 0.3,
  followup: 0.35,
  mention: 0.5,
  dm: 0.55
}

// Case and accent insensitive, so "Sofía" also matches "sofia@…".
const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const matches = (value: string | undefined, list: string[]): boolean => {
  if (!value) return false
  const v = fold(value)
  return list.some((n) => n.trim() !== '' && v.includes(fold(n.trim())))
}

// Urgency 0..1 from simple, explainable rules. 0.8 or more is "urgent".
export function scoreSignal(signal: Signal, ctx: RankingContext): number {
  let score = BASE[signal.kind]

  if (signal.dueAt !== undefined) {
    const left = signal.dueAt - ctx.now
    if (left < 0)
      score += 0.5 // overdue
    else if (left <= DAY)
      score += 0.35 // due today / within 24 h
    else if (left <= 3 * DAY) score += 0.15
  }

  if (signal.priority) score += PRIORITY_BONUS[signal.priority]

  // Priority senders (e.g. the support lead): anything from them is urgent.
  const fromPriority =
    matches(signal.sender, ctx.importantSenders) || matches(signal.channel, ctx.importantSenders)

  // Things left waiting get a little more attention each day (max +0.15).
  const ageDays = Math.max(0, (ctx.now - signal.occurredAt) / DAY)
  if (signal.kind !== 'task') score += Math.min(0.15, ageDays * 0.05)

  // An overdue task is always urgent, even with a low priority.
  if (signal.dueAt !== undefined && signal.dueAt < ctx.now)
    score = Math.max(score, URGENT_THRESHOLD)
  if (fromPriority) score = Math.max(score, PRIORITY_SENDER_SCORE)

  return Math.min(1, Math.max(0, Math.round(score * 100) / 100))
}
