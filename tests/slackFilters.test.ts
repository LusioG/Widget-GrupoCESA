import { describe, expect, it } from 'vitest'
import { scoreSignal } from '../src/main/engine/ranking'
import { shouldKeep } from '../src/main/engine/filters'
import { DEFAULT_SETTINGS, settingsPatchSchema } from '../src/shared/settingsSchema'
import { personRule, setPersonRule } from '../src/shared/personRule'
import type { Signal } from '../src/shared/types'

const NOW = 1_800_000_000_000
const mention = (over: Partial<Signal> = {}): Signal => ({
  id: 'slack:C1:1',
  source: 'slack',
  kind: 'mention',
  title: '¿Puedes revisar esto?',
  occurredAt: NOW,
  sender: 'Ana Pérez',
  channel: '#ventas',
  ...over
})
const ctx = { now: NOW, importantSenders: [] as string[] }

describe('urgent Slack channels', () => {
  it('a mention in a channel marked urgent is urgent; in another channel it is not', () => {
    const urgent = { ...ctx, importantChannels: ['#ventas'] }
    expect(scoreSignal(mention(), urgent)).toBeGreaterThanOrEqual(0.9)
    expect(scoreSignal(mention({ channel: '#general' }), urgent)).toBeLessThan(0.8)
    expect(scoreSignal(mention(), ctx)).toBeLessThan(0.8)
  })

  it('ignores case, accents and the # of the channel name', () => {
    for (const saved of ['ventas', '#VENTAS', '#Véntas']) {
      expect(scoreSignal(mention(), { ...ctx, importantChannels: [saved] })).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('matches the whole name, not part of it', () => {
    const list = { ...ctx, importantChannels: ['#ventas'] }
    expect(scoreSignal(mention({ channel: '#ventas-eu' }), list)).toBeLessThan(0.8)
  })

  it('is an accepted setting, empty by default', () => {
    expect(DEFAULT_SETTINGS.filters.importantChannels).toEqual([])
    expect(
      settingsPatchSchema.safeParse({ filters: { importantChannels: ['#soporte'] } }).success
    ).toBe(true)
  })

  it('a muted channel is still dropped by the filters', () => {
    const filters = { ...DEFAULT_SETTINGS.filters, mutedChannels: ['#ventas'] }
    expect(shouldKeep(mention(), filters)).toBe(false)
  })
})

describe('rule of a person of Slack', () => {
  const none = { important: [] as string[], ignored: [] as string[] }

  it('starts normal and moves between urgent, ignored and normal', () => {
    expect(personRule('Ana Pérez', none)).toBe('normal')
    const urgent = setPersonRule('Ana Pérez', 'urgent', none)
    expect(urgent).toEqual({ important: ['Ana Pérez'], ignored: [] })
    expect(personRule('Ana Pérez', urgent)).toBe('urgent')
    const ignored = setPersonRule('Ana Pérez', 'ignore', urgent)
    expect(ignored).toEqual({ important: [], ignored: ['Ana Pérez'] })
    expect(setPersonRule('Ana Pérez', 'normal', ignored)).toEqual(none)
  })

  it('finds a person whatever the case or accents, and keeps other entries', () => {
    const lists = { important: ['soporte@cesa.com', 'ana perez'], ignored: [] }
    expect(personRule('Ana Pérez', lists)).toBe('urgent')
    const next = setPersonRule('Ana Pérez', 'ignore', lists)
    expect(next.important).toEqual(['soporte@cesa.com'])
    expect(next.ignored).toEqual(['Ana Pérez'])
  })

  it('an ignored person is dropped and an urgent one is raised, by the same name', () => {
    const filters = { ...DEFAULT_SETTINGS.filters, ignoredSenders: ['Ana Pérez'] }
    expect(shouldKeep(mention({ channel: undefined, kind: 'dm' }), filters)).toBe(false)
    const raised = scoreSignal(mention({ kind: 'dm', channel: undefined }), {
      ...ctx,
      importantSenders: ['Ana Pérez']
    })
    expect(raised).toBeGreaterThanOrEqual(0.9)
  })
})

describe('Slack channels with the same three options', () => {
  // Channels are written "#name" in the two lists the old separate sections used.
  const none = { important: [], ignored: [] }

  it('moves a channel between normal, urgent and ignored, never in two lists at once', () => {
    const urgent = setPersonRule('#soporte', 'urgent', none)
    expect(urgent).toEqual({ important: ['#soporte'], ignored: [] })
    const ignored = setPersonRule('#soporte', 'ignore', urgent)
    expect(ignored).toEqual({ important: [], ignored: ['#soporte'] })
    expect(personRule('#soporte', ignored)).toBe('ignore')
    expect(setPersonRule('#soporte', 'normal', ignored)).toEqual(none)
  })

  it('leaves the other channels of the lists alone', () => {
    const lists = { important: ['#ventas'], ignored: ['#random'] }
    expect(setPersonRule('#soporte', 'urgent', lists)).toEqual({
      important: ['#ventas', '#soporte'],
      ignored: ['#random']
    })
  })

  it('an ignored channel is dropped and an urgent one raises its mentions', () => {
    const filters = { ...DEFAULT_SETTINGS.filters, mutedChannels: ['#ventas'] }
    expect(shouldKeep(mention({ channel: '#ventas' }), filters)).toBe(false)
    const raised = scoreSignal(mention({ channel: '#soporte' }), { ...ctx, importantChannels: ['#soporte'] })
    expect(raised).toBeGreaterThanOrEqual(0.9)
  })
})
