import { describe, expect, it } from 'vitest'
import { byUrgency, scoreSignal } from '../src/main/engine/ranking'
import type { Signal } from '../src/shared/types'

const NOW = 1_800_000_000_000
const DAY = 24 * 3_600_000
const task = (id: string, over: Partial<Signal> = {}): Signal => ({
  id,
  source: 'clickup',
  kind: 'task',
  title: id,
  occurredAt: NOW,
  priority: 'normal',
  ...over
})
const order = (list: Signal[]): string[] =>
  list
    .map((s) => ({ ...s, urgency: scoreSignal(s, { now: NOW, importantSenders: [] }) }))
    .sort(byUrgency)
    .map((s) => s.id)

describe('order of tasks with the same urgency', () => {
  it('puts the one due first on top, and the ones without a date last', () => {
    const list = [
      task('sin-fecha'),
      task('en-3-semanas', { dueAt: NOW + 21 * DAY }),
      task('en-5-dias', { dueAt: NOW + 5 * DAY })
    ]
    expect(order(list)).toEqual(['en-5-dias', 'en-3-semanas', 'sin-fecha'])
  })

  it('does not change who goes first by urgency', () => {
    const list = [
      task('normal-en-5-dias', { dueAt: NOW + 5 * DAY }),
      task('urgente-sin-fecha', { priority: 'urgent' }),
      task('normal-en-2-dias', { dueAt: NOW + 2 * DAY })
    ]
    expect(order(list)).toEqual(['urgente-sin-fecha', 'normal-en-2-dias', 'normal-en-5-dias'])
  })

  it('keeps the arrival order when nothing separates them', () => {
    expect(order([task('a'), task('b'), task('c')])).toEqual(['a', 'b', 'c'])
  })
})
