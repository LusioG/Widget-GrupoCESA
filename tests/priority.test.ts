import { describe, expect, it } from 'vitest'
import type { ClickUpTask } from '../src/main/connectors/clickup/client'
import { isRelevantTask, mapTask, parsePriority } from '../src/main/connectors/clickup/mapper'
import { scoreSignal } from '../src/main/engine/ranking'
import { URGENT_THRESHOLD } from '../src/shared/badgeState'
import type { Signal, TaskPriority } from '../src/shared/types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const now = 1_800_000_000_000

const task = (over: Partial<ClickUpTask> = {}): ClickUpTask => ({
  id: 't1',
  name: 'Tarea',
  url: 'https://app.clickup.com/t/t1',
  ...over
})

describe('parsePriority', () => {
  it.each([
    ['urgent', { id: '1', priority: 'urgent' }],
    ['high', { id: '2', priority: 'high' }],
    ['normal', { id: '3', priority: 'normal' }],
    ['low', { id: '4', priority: 'low' }]
  ] as const)('reads %s from the name', (expected, raw) => {
    expect(parsePriority(raw)).toBe(expected)
  })

  it('is not case sensitive', () => {
    expect(parsePriority({ priority: 'Urgent' })).toBe('urgent')
  })

  it('falls back to the numeric id when the name is missing or unknown', () => {
    expect(parsePriority({ id: '2' })).toBe('high')
    expect(parsePriority({ id: '1', priority: 'urgente' })).toBe('urgent')
  })

  it('returns undefined when the task has no priority', () => {
    expect(parsePriority(null)).toBeUndefined()
    expect(parsePriority(undefined)).toBeUndefined()
    expect(parsePriority({})).toBeUndefined()
    expect(parsePriority({ id: '9', priority: 'whatever' })).toBeUndefined()
  })
})

describe('isRelevantTask', () => {
  const due = (ms: number): Partial<ClickUpTask> => ({ due_date: String(now + ms) })

  it('keeps overdue tasks and tasks due within 7 days', () => {
    expect(isRelevantTask(task(due(-3 * DAY)), now)).toBe(true)
    expect(isRelevantTask(task(due(2 * DAY)), now)).toBe(true)
    expect(isRelevantTask(task(due(7 * DAY)), now)).toBe(true)
  })

  it('drops tasks due later with no important priority', () => {
    expect(isRelevantTask(task(due(30 * DAY)), now)).toBe(false)
    expect(isRelevantTask(task(), now)).toBe(false)
    expect(isRelevantTask(task({ priority: { id: '3', priority: 'normal' } }), now)).toBe(false)
    expect(isRelevantTask(task({ priority: { id: '4', priority: 'low' } }), now)).toBe(false)
  })

  it('keeps Urgent and High tasks even without a due date, or due far away', () => {
    expect(isRelevantTask(task({ priority: { id: '1', priority: 'urgent' } }), now)).toBe(true)
    expect(isRelevantTask(task({ priority: { id: '2', priority: 'high' } }), now)).toBe(true)
    expect(
      isRelevantTask(task({ ...due(60 * DAY), priority: { id: '1', priority: 'urgent' } }), now)
    ).toBe(true)
  })
})

describe('mapTask keeps the priority', () => {
  it('copies it onto the signal', () => {
    expect(mapTask(task({ priority: { id: '1', priority: 'urgent' } }), now).priority).toBe(
      'urgent'
    )
    expect(mapTask(task({ priority: null }), now).priority).toBeUndefined()
  })
})

describe('ranking with ClickUp priority', () => {
  const ctx = { now, importantSenders: [] as string[] }
  const signal = (over: Partial<Signal> = {}): Signal => ({
    id: 'clickup:1',
    source: 'clickup',
    kind: 'task',
    title: 't',
    url: 'u',
    occurredAt: now,
    ...over
  })
  const score = (priority?: TaskPriority, dueIn?: number): number =>
    scoreSignal(signal({ priority, dueAt: dueIn === undefined ? undefined : now + dueIn }), ctx)

  it('an Urgent task is urgent on its own, even with no due date', () => {
    expect(score('urgent')).toBeGreaterThanOrEqual(URGENT_THRESHOLD)
  })

  it('a High task is not urgent by itself but ranks above a Normal one', () => {
    expect(score('high')).toBeLessThan(URGENT_THRESHOLD)
    expect(score('high')).toBeGreaterThan(score('normal'))
  })

  it('orders Urgent > High > Normal > none > Low for tasks with the same date', () => {
    const due = 2 * DAY
    const order = [
      score('urgent', due),
      score('high', due),
      score('normal', due),
      score(undefined, due),
      score('low', due)
    ]
    for (let i = 1; i < order.length; i++) expect(order[i - 1]).toBeGreaterThanOrEqual(order[i])
    expect(order[0]).toBeGreaterThan(order[4])
  })

  it('combines with the due date: High and due today is urgent', () => {
    expect(score('high', 5 * HOUR)).toBeGreaterThanOrEqual(URGENT_THRESHOLD)
  })

  it('a Normal task due today is still not urgent (as before)', () => {
    expect(score('normal', 5 * HOUR)).toBeLessThan(URGENT_THRESHOLD)
  })

  it('an overdue task is ALWAYS urgent, whatever its priority', () => {
    for (const p of ['urgent', 'high', 'normal', 'low', undefined] as const) {
      expect(score(p, -HOUR), String(p)).toBeGreaterThanOrEqual(URGENT_THRESHOLD)
    }
  })

  it('stays within 0..1', () => {
    expect(score('urgent', -DAY)).toBeLessThanOrEqual(1)
    expect(score('low')).toBeGreaterThanOrEqual(0)
  })

  it('does not change messages or emails (they have no priority)', () => {
    const dm = scoreSignal(signal({ kind: 'dm', source: 'slack' }), ctx)
    expect(dm).toBe(0.55)
  })
})
