import { describe, expect, it } from 'vitest'
import { buildBriefing, localDate } from '../src/main/engine/briefing'
import {
  manualOpenCountsAsShown,
  shouldShowBriefing,
  type BriefingGate
} from '../src/main/engine/briefingPolicy'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import { strings } from '../src/shared/strings'
import type { Signal } from '../src/shared/types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const now = new Date(2026, 9, 28, 9, 30).getTime() // Wednesday 28 Oct 2026, 09:30 local

let n = 0
const sig = (over: Partial<Signal>): Signal => ({
  id: `clickup:${++n}`,
  source: 'clickup',
  kind: 'task',
  title: 'Tarea',
  url: 'https://example.com',
  occurredAt: now,
  urgency: 0.3,
  ...over
})

describe('greeting', () => {
  it('follows the time of day and uses the name', () => {
    expect(strings.briefing.greeting(8, 'Ana')).toBe('Buen día, Ana')
    expect(strings.briefing.greeting(15, 'Ana')).toBe('Buenas tardes, Ana')
    expect(strings.briefing.greeting(21, 'Ana')).toBe('Buenas noches, Ana')
  })

  it('works without a name', () => {
    expect(strings.briefing.greeting(8, '')).toBe('Buen día')
  })
})

describe('buildBriefing', () => {
  it('keeps the 5 most urgent as priorities, the soonest to fall due first on a tie', () => {
    const tasks = Array.from({ length: 7 }, (_, i) =>
      sig({ title: `t${i}`, urgency: 0.5, dueAt: now + (7 - i) * DAY })
    )
    const urgent = sig({ title: 'urgente', urgency: 0.95, dueAt: now + 10 * DAY })
    const b = buildBriefing({ signals: [...tasks, urgent], name: 'Ana', now })
    expect(b.priorities).toHaveLength(5)
    expect(b.priorities[0].title).toBe('urgente')
    expect(b.priorities[0].urgent).toBe(true)
    // among the 0.5 ones, the one due first (t6, in 1 day) comes before the one due later
    expect(b.priorities.map((p) => p.title).slice(1)).toEqual(['t6', 't5', 't4', 't3'])
  })

  it('lists the next 3 ordinary tasks apart from the priorities', () => {
    const ordinary = [4, 2, 9, 1, 6].map((d) =>
      sig({ title: `n${d}`, priority: 'normal', urgency: 0.3, dueAt: now + d * DAY })
    )
    const important = Array.from({ length: 5 }, (_, i) =>
      sig({ title: `p${i}`, priority: 'high', urgency: 0.7 })
    )
    const b = buildBriefing({ signals: [...ordinary, ...important], name: '', now })
    expect(b.priorities.map((p) => p.title)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4'])
    expect(b.nextTasks.map((t) => t.title)).toEqual(['n1', 'n2', 'n4'])
  })

  it('does not count high, urgent or low priority tasks as ordinary', () => {
    const signals = [
      ...Array.from({ length: 5 }, (_, i) => sig({ title: `p${i}`, urgency: 0.9 })),
      sig({ title: 'low', priority: 'low', dueAt: now + DAY }),
      sig({ title: 'high', priority: 'high', urgency: 0.5, dueAt: now + DAY }),
      sig({ title: 'plain', dueAt: now + 2 * DAY })
    ]
    const b = buildBriefing({ signals, name: '', now })
    expect(b.nextTasks.map((t) => t.title)).toEqual(['plain'])
  })

  it('shows only the meetings of today that are running or still to come', () => {
    const at = (h: number): number => new Date(2026, 9, 28, h, 0).getTime()
    const m = (title: string, start: number, end: number): Signal =>
      sig({ kind: 'meeting', source: 'calendar', title, startsAt: start, endsAt: end })
    const b = buildBriefing({
      signals: [
        m('tarde', at(15), at(16)),
        m('en curso', at(9), at(10)),
        m('terminada', at(8), at(9)),
        m('mañana', at(24 + 10), at(24 + 11))
      ],
      name: '',
      now
    })
    expect(b.meetings.map((x) => x.title)).toEqual(['en curso', 'tarde'])
  })

  it('collects what stayed pending from yesterday, without repeating other sections', () => {
    const yesterday = now - DAY
    const old = sig({ kind: 'email', source: 'gmail', title: 'ayer', occurredAt: yesterday })
    const older = sig({ kind: 'email', source: 'gmail', title: 'viejo', occurredAt: now - 3 * DAY })
    const b = buildBriefing({ signals: [old, older], name: '', now })
    // both fit in the priorities, so neither is repeated under "yesterday"
    expect(b.yesterday).toEqual([])
    const many = Array.from({ length: 5 }, (_, i) => sig({ title: `p${i}`, urgency: 0.9 }))
    const b2 = buildBriefing({ signals: [...many, old, older], name: '', now })
    expect(b2.yesterday.map((x) => x.title)).toEqual(['ayer'])
  })

  it('keeps the follow-ups out of the priorities and lists them apart', () => {
    const fu = sig({ kind: 'followup', source: 'gmail', title: 'sin respuesta', urgency: 0.9 })
    const b = buildBriefing({ signals: [fu], name: '', now })
    expect(b.priorities).toEqual([])
    expect(b.waiting.map((w) => w.title)).toEqual(['sin respuesta'])
  })

  it('counts the mail and messages that arrived since the previous summary', () => {
    const signals = [
      sig({ kind: 'email', source: 'gmail', occurredAt: now - 2 * HOUR }),
      sig({ kind: 'email', source: 'gmail', occurredAt: now - 30 * HOUR }),
      sig({ kind: 'dm', source: 'slack', occurredAt: now - HOUR }),
      sig({ kind: 'mention', source: 'slack', occurredAt: now - HOUR, seen: true })
    ]
    const b = buildBriefing({ signals, name: '', now, previousAt: now - 3 * HOUR })
    expect(b.since).toEqual({ emails: 1, messages: 1 })
  })

  it('does not count the mail that only invites you to a meeting of today as pending', () => {
    const meeting = sig({
      kind: 'meeting',
      source: 'calendar',
      title: 'Seguimiento de temas y proyectos | Desarrollo',
      startsAt: now + 5 * HOUR,
      endsAt: now + 6 * HOUR
    })
    const invite = sig({
      kind: 'email',
      source: 'gmail',
      title: 'Invitación: Seguimiento de temas y proyectos | Desarrollo Cada semana de 3pm a 4pm',
      occurredAt: now - HOUR
    })
    const other = sig({ kind: 'email', source: 'gmail', title: 'Factura de octubre' })
    const b = buildBriefing({ signals: [meeting, invite, other], name: '', now })
    expect(b.meetings).toHaveLength(1)
    expect(b.priorities.map((p) => p.title)).toEqual(['Factura de octubre'])
    expect(b.since.emails).toBe(1) // only the invoice is new
  })

  it('keeps an invitation to a meeting that is not in today’s list', () => {
    const invite = sig({ kind: 'email', source: 'gmail', title: 'Invitación: Taller de ventas' })
    const b = buildBriefing({ signals: [invite], name: '', now })
    expect(b.priorities).toHaveLength(1)
  })

  it('does not hide ordinary mail just because a short meeting title appears in it', () => {
    const meeting = sig({
      kind: 'meeting',
      source: 'calendar',
      title: 'Daily',
      startsAt: now + HOUR,
      endsAt: now + 2 * HOUR
    })
    const mail = sig({
      kind: 'email',
      source: 'gmail',
      title: 'Invitación: daily report de ventas'
    })
    const b = buildBriefing({ signals: [meeting, mail], name: '', now })
    expect(b.priorities).toHaveLength(1)
  })

  it('says so when there is nothing to do', () => {
    const b = buildBriefing({ signals: [], name: 'Ana', now })
    expect(b.intro).toContain('nada pendiente')
    expect(b.meetings).toEqual([])
    expect(b.date).toBe('2026-10-28')
    expect(b.greeting).toBe('Buen día, Ana')
    expect(b.mode).toBe('rules')
  })

  it('writes the intro from the counts', () => {
    const signals = [
      sig({ kind: 'meeting', source: 'calendar', startsAt: now + HOUR, endsAt: now + 2 * HOUR }),
      sig({ urgency: 0.9 }),
      sig({ urgency: 0.4 })
    ]
    const b = buildBriefing({ signals, name: '', now })
    expect(b.intro).toBe('Hoy tienes 1 reunión y 2 prioridades; 1 es urgente.')
  })
})

describe('localDate', () => {
  it('is the local day, zero padded', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
  })
})

describe('shouldShowBriefing', () => {
  const open: BriefingGate = {
    now: new Date(2026, 9, 28, 9, 30), // Wednesday, work day
    enabled: true,
    time: '09:00',
    schedule: DEFAULT_SETTINGS.schedule,
    alreadyToday: false,
    idleSeconds: 5,
    busy: false,
    ready: true
  }

  it('shows the first time the user is active after the chosen time', () => {
    expect(shouldShowBriefing(open)).toBe(true)
  })

  it('shows once per day', () => {
    expect(shouldShowBriefing({ ...open, alreadyToday: true })).toBe(false)
  })

  it('waits until the chosen time', () => {
    expect(shouldShowBriefing({ ...open, time: '10:00' })).toBe(false)
    expect(shouldShowBriefing({ ...open, time: '09:30' })).toBe(true)
  })

  it('waits for the user to be at the computer', () => {
    expect(shouldShowBriefing({ ...open, idleSeconds: 600 })).toBe(false)
  })

  it('stays away outside work days and work hours', () => {
    expect(shouldShowBriefing({ ...open, now: new Date(2026, 9, 31, 9, 30) })).toBe(false) // Saturday
    expect(shouldShowBriefing({ ...open, now: new Date(2026, 9, 28, 19, 0) })).toBe(false)
  })

  it('waits while alerts are paused, in focus mode or presenting, and for the first sync', () => {
    expect(shouldShowBriefing({ ...open, busy: true })).toBe(false)
    expect(shouldShowBriefing({ ...open, ready: false })).toBe(false)
  })

  it('does nothing when it is turned off', () => {
    expect(shouldShowBriefing({ ...open, enabled: false })).toBe(false)
  })
})

describe('opening the summary by hand', () => {
  it('takes the place of the automatic one only after the chosen time', () => {
    const at = (h: number, m: number): Date => new Date(2026, 9, 28, h, m)
    expect(manualOpenCountsAsShown(at(12, 25), '12:22')).toBe(true) // already past: no repeat
    expect(manualOpenCountsAsShown(at(12, 22), '12:22')).toBe(true)
    expect(manualOpenCountsAsShown(at(12, 0), '12:22')).toBe(false) // just looking: still due
  })
})
