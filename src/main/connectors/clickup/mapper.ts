import type { ClickUpMinPriority, Signal, TaskPriority } from '../../../shared/types'
import type { ClickUpTask } from './client'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// Tasks due within this many days (or already overdue) are shown.
export const WINDOW_DAYS = 7

export function taskUrgency(dueAt: number | undefined, now: number): number {
  if (dueAt === undefined) return 0.25
  const left = dueAt - now
  if (left < 0) return 0.9 // overdue
  if (left <= DAY) return 0.75 // due within 24 h
  if (left <= 3 * DAY) return 0.5
  return 0.3
}

const PRIORITY_BY_ID: Record<string, TaskPriority> = {
  '1': 'urgent',
  '2': 'high',
  '3': 'normal',
  '4': 'low'
}

// ClickUp sends `{ id: "1", priority: "urgent" }`, or null when the task has no flag.
export function parsePriority(raw: ClickUpTask['priority']): TaskPriority | undefined {
  if (!raw) return undefined
  const name = raw.priority?.toLowerCase()
  if (name === 'urgent' || name === 'high' || name === 'normal' || name === 'low') return name
  return raw.id ? PRIORITY_BY_ID[raw.id] : undefined
}

function dueAtOf(task: ClickUpTask): number | undefined {
  const due = task.due_date ? Number(task.due_date) : NaN
  return Number.isFinite(due) ? due : undefined
}

export type RelevanceConfig = {
  dueWindowDays: number
  minPriority: ClickUpMinPriority
  alwaysShowFlagged: boolean
  ignoredStatuses: string[]
}

export const DEFAULT_RELEVANCE: RelevanceConfig = {
  dueWindowDays: WINDOW_DAYS,
  minPriority: 'any',
  alwaysShowFlagged: true,
  ignoredStatuses: []
}

const RANK: Record<TaskPriority, number> = { low: 1, normal: 2, high: 3, urgent: 4 }
const MIN_RANK: Record<ClickUpMinPriority, number> = { any: 0, normal: 2, high: 3, urgent: 4 }

// Worth showing, according to the user's choices in "Fuentes y filtros":
// not in an ignored status, not below the minimum priority, and either overdue / due within
// the window, or flagged Urgent/High (when that option is on) even with a far or missing date.
export function isRelevantTask(
  task: ClickUpTask,
  now: number,
  cfg: RelevanceConfig = DEFAULT_RELEVANCE
): boolean {
  const status = task.status?.status?.trim().toLowerCase()
  if (status && cfg.ignoredStatuses.some((s) => s.trim().toLowerCase() === status)) return false

  const priority = parsePriority(task.priority)
  if ((priority ? RANK[priority] : 0) < MIN_RANK[cfg.minPriority]) return false

  const dueAt = dueAtOf(task)
  if (dueAt !== undefined && dueAt <= now + cfg.dueWindowDays * DAY) return true
  return cfg.alwaysShowFlagged && (priority === 'urgent' || priority === 'high')
}

export function mapTask(task: ClickUpTask, now: number): Signal {
  const dueAt = dueAtOf(task)
  return {
    id: `clickup:${task.id}`,
    source: 'clickup',
    kind: 'task',
    title: task.name,
    body: task.list?.name,
    url: task.url,
    occurredAt: dueAt ?? now,
    dueAt,
    priority: parsePriority(task.priority),
    urgency: taskUrgency(dueAt, now)
  }
}
