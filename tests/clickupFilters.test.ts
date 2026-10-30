import { describe, expect, it } from 'vitest'
import type { ClickUpTask } from '../src/main/connectors/clickup/client'
import {
  DEFAULT_RELEVANCE,
  isRelevantTask,
  type RelevanceConfig
} from '../src/main/connectors/clickup/mapper'
import { DEFAULT_SETTINGS, settingsPatchSchema } from '../src/shared/settingsSchema'

const DAY = 86_400_000
const now = 1_800_000_000_000

const task = (over: Partial<ClickUpTask> = {}): ClickUpTask => ({
  id: 't',
  name: 'Tarea',
  url: 'u',
  ...over
})
const prio = (name: 'urgent' | 'high' | 'normal' | 'low'): ClickUpTask['priority'] => ({
  id: String({ urgent: 1, high: 2, normal: 3, low: 4 }[name]),
  priority: name
})
const due = (days: number): Partial<ClickUpTask> => ({ due_date: String(now + days * DAY) })
const cfg = (over: Partial<RelevanceConfig> = {}): RelevanceConfig => ({
  ...DEFAULT_RELEVANCE,
  ...over
})

describe('due window', () => {
  it('uses the number of days the user chose', () => {
    const t = task(due(10))
    expect(isRelevantTask(t, now, cfg({ dueWindowDays: 7 }))).toBe(false)
    expect(isRelevantTask(t, now, cfg({ dueWindowDays: 14 }))).toBe(true)
    expect(isRelevantTask(task(due(2)), now, cfg({ dueWindowDays: 1 }))).toBe(false)
    expect(isRelevantTask(task(due(0.5)), now, cfg({ dueWindowDays: 1 }))).toBe(true)
  })

  it('overdue tasks are always inside the window', () => {
    expect(isRelevantTask(task(due(-40)), now, cfg({ dueWindowDays: 1 }))).toBe(true)
  })
})

describe('minimum priority', () => {
  const overdue = due(-1)

  it('"any" keeps every priority and tasks with none', () => {
    for (const p of [undefined, prio('low'), prio('normal'), prio('high'), prio('urgent')]) {
      expect(
        isRelevantTask(task({ ...overdue, priority: p }), now, cfg({ minPriority: 'any' }))
      ).toBe(true)
    }
  })

  it('"normal" hides Low and tasks without a priority', () => {
    const c = cfg({ minPriority: 'normal' })
    expect(isRelevantTask(task({ ...overdue, priority: prio('low') }), now, c)).toBe(false)
    expect(isRelevantTask(task({ ...overdue }), now, c)).toBe(false)
    expect(isRelevantTask(task({ ...overdue, priority: prio('normal') }), now, c)).toBe(true)
  })

  it('"high" keeps only High and Urgent', () => {
    const c = cfg({ minPriority: 'high' })
    expect(isRelevantTask(task({ ...overdue, priority: prio('normal') }), now, c)).toBe(false)
    expect(isRelevantTask(task({ ...overdue, priority: prio('high') }), now, c)).toBe(true)
    expect(isRelevantTask(task({ ...overdue, priority: prio('urgent') }), now, c)).toBe(true)
  })

  it('"urgent" keeps only Urgent, even overdue ones of lower priority are hidden', () => {
    const c = cfg({ minPriority: 'urgent' })
    expect(isRelevantTask(task({ ...overdue, priority: prio('high') }), now, c)).toBe(false)
    expect(isRelevantTask(task({ priority: prio('urgent') }), now, c)).toBe(true)
  })
})

describe('always show Urgent/High', () => {
  it('on: flagged tasks show even with no date or a far date', () => {
    expect(
      isRelevantTask(task({ priority: prio('urgent') }), now, cfg({ alwaysShowFlagged: true }))
    ).toBe(true)
    expect(
      isRelevantTask(
        task({ ...due(60), priority: prio('high') }),
        now,
        cfg({ alwaysShowFlagged: true })
      )
    ).toBe(true)
  })

  it('off: they must also be overdue or inside the due window', () => {
    const c = cfg({ alwaysShowFlagged: false })
    expect(isRelevantTask(task({ priority: prio('urgent') }), now, c)).toBe(false)
    expect(isRelevantTask(task({ ...due(60), priority: prio('high') }), now, c)).toBe(false)
    expect(isRelevantTask(task({ ...due(3), priority: prio('urgent') }), now, c)).toBe(true)
  })

  it('never shows Normal/Low tasks that have no date, whatever the option', () => {
    expect(
      isRelevantTask(task({ priority: prio('normal') }), now, cfg({ alwaysShowFlagged: true }))
    ).toBe(false)
  })
})

describe('ignored statuses', () => {
  const inStatus = (s: string): Partial<ClickUpTask> => ({ ...due(-1), status: { status: s } })

  it('hides tasks in an ignored status, ignoring case and spaces', () => {
    const c = cfg({ ignoredStatuses: ['en espera', ' Bloqueado '] })
    expect(isRelevantTask(task(inStatus('EN ESPERA')), now, c)).toBe(false)
    expect(isRelevantTask(task(inStatus('bloqueado')), now, c)).toBe(false)
  })

  it('requires the whole status name, so similar names are not hidden by mistake', () => {
    const c = cfg({ ignoredStatuses: ['complete'] })
    expect(isRelevantTask(task(inStatus('incomplete')), now, c)).toBe(true)
  })

  it('an empty list ignores nothing; a task with no status is kept', () => {
    expect(isRelevantTask(task(inStatus('en espera')), now, cfg({ ignoredStatuses: [] }))).toBe(
      true
    )
    expect(isRelevantTask(task(due(-1)), now, cfg({ ignoredStatuses: ['en espera'] }))).toBe(true)
  })

  it('hides an ignored status even for an Urgent task', () => {
    const t = task({ priority: prio('urgent'), status: { status: 'en espera' } })
    expect(isRelevantTask(t, now, cfg({ ignoredStatuses: ['en espera'] }))).toBe(false)
  })
})

describe('defaults and validation', () => {
  it('the defaults keep the behaviour from before (7 days, everything, flagged always)', () => {
    expect(DEFAULT_SETTINGS.clickup).toMatchObject({
      listIds: [],
      dueWindowDays: 7,
      minPriority: 'any',
      alwaysShowFlagged: true,
      includeSubtasks: true,
      ignoredStatuses: []
    })
  })

  it('accepts valid ClickUp settings', () => {
    expect(
      settingsPatchSchema.safeParse({
        clickup: {
          dueWindowDays: 14,
          minPriority: 'high',
          alwaysShowFlagged: false,
          ignoredStatuses: ['en espera']
        }
      }).success
    ).toBe(true)
  })

  it('rejects out-of-range or invalid values', () => {
    for (const clickup of [
      { dueWindowDays: 0 },
      { dueWindowDays: 500 },
      { dueWindowDays: 1.5 },
      { minPriority: 'critical' },
      { alwaysShowFlagged: 'yes' },
      { ignoredStatuses: [''] }
    ]) {
      expect(settingsPatchSchema.safeParse({ clickup }).success, JSON.stringify(clickup)).toBe(
        false
      )
    }
  })
})
