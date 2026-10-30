import { describe, expect, it } from 'vitest'
import { describeClickUpRule } from '../src/shared/describeFilters'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'

const base = DEFAULT_SETTINGS.clickup
const with_ = (over: Partial<typeof base>): typeof base => ({ ...base, ...over })

describe('describeClickUpRule', () => {
  it('describes the defaults', () => {
    expect(describeClickUpRule(base)).toBe(
      'Verás tus tareas asignadas en todas tus listas que estén vencidas o venzan en los próximos 7 días, o que tengan prioridad Urgente o Alta aunque no tengan fecha. Incluye subtareas.'
    )
  })

  it('mentions how many lists are selected, with the total when known', () => {
    expect(describeClickUpRule(with_({ listIds: ['a', 'b', 'c'] }), 40)).toContain('3 de 40 listas')
    expect(describeClickUpRule(with_({ listIds: ['a'] }), 1)).toContain('1 de 1 lista ')
    expect(describeClickUpRule(with_({ listIds: ['a', 'b'] }))).toContain('2 listas')
  })

  it('uses the singular for one day', () => {
    expect(describeClickUpRule(with_({ dueWindowDays: 1 }))).toContain('próximos 1 día')
  })

  it('drops the flagged clause when the option is off', () => {
    expect(describeClickUpRule(with_({ alwaysShowFlagged: false }))).not.toContain(
      'aunque no tengan fecha'
    )
  })

  it('states the minimum priority only when there is one', () => {
    expect(describeClickUpRule(with_({ minPriority: 'any' }))).not.toContain('Solo con prioridad')
    expect(describeClickUpRule(with_({ minPriority: 'high' }))).toContain(
      'Solo con prioridad Alta o superior.'
    )
    expect(describeClickUpRule(with_({ minPriority: 'urgent' }))).toContain(
      'Solo con prioridad Urgente.'
    )
    expect(describeClickUpRule(with_({ minPriority: 'normal' }))).toContain('Normal o superior')
  })

  it('lists the ignored statuses', () => {
    expect(describeClickUpRule(with_({ ignoredStatuses: ['en espera', 'bloqueado'] }))).toContain(
      'Sin las que estén en: en espera, bloqueado.'
    )
    expect(describeClickUpRule(base)).not.toContain('Sin las que')
  })

  it('says whether subtasks are included', () => {
    expect(describeClickUpRule(with_({ includeSubtasks: false }))).toContain('Sin subtareas.')
  })
})
