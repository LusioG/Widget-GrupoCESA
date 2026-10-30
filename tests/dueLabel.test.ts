import { describe, expect, it } from 'vitest'
import { dueLabel } from '../src/shared/dueLabel'

// Thursday 29 Oct 2026, 13:00 local.
const now = new Date(2026, 9, 29, 13).getTime()
const at = (y: number, m: number, d: number, h = 0): number => new Date(y, m, d, h).getTime()

describe('dueLabel', () => {
  it('says today, tomorrow and later, always with the date', () => {
    expect(dueLabel(at(2026, 9, 29, 18), now)).toBe('vence hoy · jue 29 oct')
    expect(dueLabel(at(2026, 9, 30), now)).toBe('vence mañana · vie 30 oct')
    expect(dueLabel(at(2026, 10, 3), now)).toBe('vence el mar 3 nov')
  })

  it('marks overdue tasks with the day they were due, even earlier today', () => {
    expect(dueLabel(at(2026, 9, 27), now)).toBe('vencida · mar 27 oct')
    expect(dueLabel(at(2026, 9, 28, 23), now)).toContain('vencida')
  })

  it('adds the year only when it is not the current one', () => {
    expect(dueLabel(at(2027, 0, 5), now)).toBe('vence el mar 5 ene 2027')
  })
})
