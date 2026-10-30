import { describe, expect, it } from 'vitest'
import { shouldKeep } from '../src/main/engine/filters'
import { findFollowups } from '../src/main/engine/followups'
import { shouldNotify } from '../src/main/engine/notifyPolicy'
import { isFocusActive, isWorkTime } from '../src/main/engine/quiet'
import { scoreSignal } from '../src/main/engine/ranking'
import { snoozeUntil } from '../src/main/engine/snooze'
import { computeBadge } from '../src/shared/badgeState'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Signal } from '../src/shared/types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const now = new Date(2026, 9, 28, 12, 0).getTime() // Wednesday 28 Oct 2026, 12:00 local

const sig = (over: Partial<Signal>): Signal => ({
  id: 'slack:1',
  source: 'slack',
  kind: 'mention',
  title: '¿Puedes revisar el informe de ventas?',
  url: 'https://example.com',
  occurredAt: now,
  ...over
})

describe('filters', () => {
  const cfg = DEFAULT_SETTINGS.filters

  it('keeps a normal message', () => {
    expect(shouldKeep(sig({}), cfg)).toBe(true)
  })

  it('never filters tasks or meetings', () => {
    expect(shouldKeep(sig({ kind: 'task', title: 'ok' }), { ...cfg, minLength: 50 })).toBe(true)
    expect(shouldKeep(sig({ kind: 'meeting', title: 'a' }), { ...cfg, minLength: 50 })).toBe(true)
  })

  it('drops bots and no-reply senders', () => {
    expect(shouldKeep(sig({ isBot: true }), cfg)).toBe(false)
    expect(shouldKeep(sig({ kind: 'email', sender: 'no-reply@shop.com' }), cfg)).toBe(false)
    expect(shouldKeep(sig({ kind: 'email', sender: 'notifications@github.com' }), cfg)).toBe(false)
  })

  it('drops acknowledgements and reactions', () => {
    for (const t of ['ok', 'Gracias!', 'thanks', '👍', 'Listo.']) {
      expect(shouldKeep(sig({ title: t }), { ...cfg, minLength: 0 }), t).toBe(false)
    }
    expect(shouldKeep(sig({ title: 'Ana reaccionó con 👍 a tu mensaje' }), cfg)).toBe(false)
  })

  it('does not drop a longer message that merely contains "gracias"', () => {
    expect(shouldKeep(sig({ title: 'Gracias, ¿me envías el contrato hoy?' }), cfg)).toBe(true)
  })

  it('applies the minimum length', () => {
    expect(shouldKeep(sig({ title: 'hi' }), { ...cfg, minLength: 3 })).toBe(false)
  })

  it('applies configurable ignored senders and muted channels', () => {
    expect(
      shouldKeep(sig({ sender: 'Boletin Semanal' }), { ...cfg, ignoredSenders: ['boletin'] })
    ).toBe(false)
    expect(shouldKeep(sig({ channel: '#random' }), { ...cfg, mutedChannels: ['#random'] })).toBe(
      false
    )
    expect(shouldKeep(sig({ channel: '#ventas' }), { ...cfg, mutedChannels: ['#random'] })).toBe(
      true
    )
  })

  it('ignores empty entries in the lists', () => {
    expect(shouldKeep(sig({ sender: 'Ana' }), { ...cfg, ignoredSenders: [''] })).toBe(true)
  })
})

describe('ranking', () => {
  const ctx = { now, importantSenders: [] as string[] }

  it('ranks an overdue task as urgent', () => {
    expect(scoreSignal(sig({ kind: 'task', dueAt: now - HOUR }), ctx)).toBeGreaterThanOrEqual(0.8)
  })

  it('orders: overdue > due today > due in 2 days > no date', () => {
    const s = (due?: number): number => scoreSignal(sig({ kind: 'task', dueAt: due }), ctx)
    expect(s(now - HOUR)).toBeGreaterThan(s(now + 5 * HOUR))
    expect(s(now + 5 * HOUR)).toBeGreaterThan(s(now + 2 * DAY))
    expect(s(now + 2 * DAY)).toBeGreaterThan(s(undefined))
  })

  it('ranks direct messages above plain emails', () => {
    expect(scoreSignal(sig({ kind: 'dm' }), ctx)).toBeGreaterThan(
      scoreSignal(sig({ kind: 'email' }), ctx)
    )
  })

  it('boosts important senders and channels', () => {
    const base = scoreSignal(sig({ sender: 'Jefe' }), ctx)
    const boosted = scoreSignal(sig({ sender: 'Jefe' }), { ...ctx, importantSenders: ['jefe'] })
    expect(boosted).toBeGreaterThan(base)
    expect(
      scoreSignal(sig({ channel: '#urgente' }), { ...ctx, importantSenders: ['#urgente'] })
    ).toBeGreaterThan(scoreSignal(sig({ channel: '#urgente' }), ctx))
  })

  it('makes anything from a priority sender urgent', () => {
    const vip = { ...ctx, importantSenders: ['Sofía Pérez'] }
    const mail = sig({ kind: 'email', sender: 'Sofia Perez <lider.soporte@cesa.com>' })
    expect(scoreSignal(mail, ctx)).toBeLessThan(0.8)
    expect(scoreSignal(mail, vip)).toBeGreaterThanOrEqual(0.8)
    // by e-mail address too, ignoring case
    const byAddress = { ...ctx, importantSenders: ['LIDER.SOPORTE@cesa.com'] }
    expect(scoreSignal(mail, byAddress)).toBeGreaterThanOrEqual(0.8)
    // other people are untouched
    expect(scoreSignal(sig({ kind: 'email', sender: 'Otro <otro@x.com>' }), vip)).toBeLessThan(0.8)
  })

  it('notifies for a priority sender even in focus mode', () => {
    const mail = sig({ kind: 'email', sender: 'Lider', urgency: 0.9 })
    const focus = { enabled: true, paused: false, workTime: true, focus: true }
    expect(shouldNotify(mail, focus, now)).toBe(true)
  })

  it('raises the score of old unattended messages, with a cap', () => {
    const fresh = scoreSignal(sig({ kind: 'email', occurredAt: now }), ctx)
    const old = scoreSignal(sig({ kind: 'email', occurredAt: now - 2 * DAY }), ctx)
    const ancient = scoreSignal(sig({ kind: 'email', occurredAt: now - 60 * DAY }), ctx)
    expect(old).toBeGreaterThan(fresh)
    expect(Number((ancient - fresh).toFixed(2))).toBeLessThanOrEqual(0.15)
  })

  it('stays within 0..1', () => {
    const s = scoreSignal(sig({ kind: 'task', dueAt: now - DAY, sender: 'jefe' }), {
      ...ctx,
      importantSenders: ['jefe']
    })
    expect(s).toBeLessThanOrEqual(1)
    expect(s).toBeGreaterThanOrEqual(0)
  })
})

describe('snoozeUntil', () => {
  const at = (d: number, h = 9): number => new Date(2026, 9, d, h, 0).getTime()

  it('one hour', () => {
    expect(snoozeUntil('hour', new Date(now), '09:00')).toBe(now + HOUR)
  })

  it('tomorrow at the start of the work day', () => {
    expect(snoozeUntil('tomorrow', new Date(now), '09:00')).toBe(at(29))
  })

  it('Monday from a Wednesday', () => {
    expect(snoozeUntil('monday', new Date(now), '08:30')).toBe(
      new Date(2026, 10, 2, 8, 30).getTime()
    )
  })

  it('Monday from a Monday goes to next week, not today', () => {
    const monday = new Date(2026, 9, 26, 10, 0)
    expect(snoozeUntil('monday', monday, '09:00')).toBe(new Date(2026, 10, 2, 9, 0).getTime())
  })

  it('Monday from a Sunday is the next day', () => {
    expect(snoozeUntil('monday', new Date(2026, 9, 25, 20, 0), '09:00')).toBe(at(26))
  })
})

describe('work time and focus', () => {
  const schedule = DEFAULT_SETTINGS.schedule

  it('is work time on a weekday inside the hours', () => {
    expect(isWorkTime(new Date(2026, 9, 28, 10, 0), schedule)).toBe(true)
  })

  it('is not work time before/after the hours or on weekends', () => {
    expect(isWorkTime(new Date(2026, 9, 28, 8, 59), schedule)).toBe(false)
    expect(isWorkTime(new Date(2026, 9, 28, 18, 0), schedule)).toBe(false)
    expect(isWorkTime(new Date(2026, 9, 31, 11, 0), schedule)).toBe(false) // Saturday
  })

  const focusBlock = sig({
    kind: 'meeting',
    title: 'Focus time',
    startsAt: now - HOUR,
    endsAt: now + HOUR
  })

  it('detects an ongoing calendar Focus block', () => {
    expect(isFocusActive([focusBlock], now, false, true)).toBe(true)
  })

  it('ignores the block when the option is off or it is not running', () => {
    expect(isFocusActive([focusBlock], now, false, false)).toBe(false)
    expect(
      isFocusActive(
        [{ ...focusBlock, startsAt: now + HOUR, endsAt: now + 2 * HOUR }],
        now,
        false,
        true
      )
    ).toBe(false)
  })

  it('manual focus always wins', () => {
    expect(isFocusActive([], now, true, false)).toBe(true)
  })
})

describe('notification policy', () => {
  const open = { enabled: true, paused: false, workTime: true, focus: false }
  const urgentTask = sig({ kind: 'task', urgency: 0.9 })
  const dm = sig({ kind: 'dm', urgency: 0.6 })
  const soonMeeting = sig({ kind: 'meeting', startsAt: now + 5 * 60_000, endsAt: now + HOUR })

  it('notifies urgent items, direct messages and imminent meetings', () => {
    expect(shouldNotify(urgentTask, open, now)).toBe(true)
    expect(shouldNotify(dm, open, now)).toBe(true)
    expect(shouldNotify(soonMeeting, open, now)).toBe(true)
  })

  it('stays silent when paused, disabled or outside work hours', () => {
    expect(shouldNotify(urgentTask, { ...open, paused: true }, now)).toBe(false)
    expect(shouldNotify(urgentTask, { ...open, enabled: false }, now)).toBe(false)
    expect(shouldNotify(urgentTask, { ...open, workTime: false }, now)).toBe(false)
  })

  it('in focus mode only urgent items break through', () => {
    const focus = { ...open, focus: true }
    expect(shouldNotify(urgentTask, focus, now)).toBe(true)
    expect(shouldNotify(dm, focus, now)).toBe(false)
    expect(shouldNotify(soonMeeting, focus, now)).toBe(false)
  })

  it('does not notify ordinary low-urgency items or far-away meetings', () => {
    expect(shouldNotify(sig({ kind: 'task', urgency: 0.4 }), open, now)).toBe(false)
    expect(shouldNotify({ ...soonMeeting, startsAt: now + 3 * HOUR }, open, now)).toBe(false)
    expect(shouldNotify({ ...soonMeeting, startsAt: now - 5 * 60_000 }, open, now)).toBe(false)
  })
})

describe('followups ("esperando respuesta")', () => {
  const sent = (
    over: Partial<Parameters<typeof findFollowups>[0][number]> = {}
  ): Parameters<typeof findFollowups>[0][number] => ({
    externalId: 'm1',
    source: 'gmail',
    threadId: 't1',
    title: 'Propuesta comercial',
    url: 'https://mail.google.com/x',
    sentAt: now - 3 * DAY,
    ...over
  })

  it('returns messages with no reply after the wait time', () => {
    const out = findFollowups([sent()], [], now, 48)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: 'gmail:followup-m1',
      kind: 'followup',
      occurredAt: now - 3 * DAY
    })
  })

  it('skips messages that are still within the wait time', () => {
    expect(findFollowups([sent({ sentAt: now - 10 * HOUR })], [], now, 48)).toEqual([])
  })

  it('skips threads that got a reply after the message', () => {
    expect(findFollowups([sent()], [{ threadId: 't1', at: now - DAY }], now, 48)).toEqual([])
  })

  it('a reply in another thread, or before the message, does not count', () => {
    expect(findFollowups([sent()], [{ threadId: 'other', at: now - DAY }], now, 48)).toHaveLength(1)
    expect(findFollowups([sent()], [{ threadId: 't1', at: now - 5 * DAY }], now, 48)).toHaveLength(
      1
    )
  })

  it('lists the oldest first', () => {
    const out = findFollowups(
      [
        sent({ externalId: 'new', threadId: 'a', sentAt: now - 3 * DAY }),
        sent({ externalId: 'old', threadId: 'b', sentAt: now - 9 * DAY })
      ],
      [],
      now,
      48
    )
    expect(out.map((s) => s.id)).toEqual(['gmail:followup-old', 'gmail:followup-new'])
  })
})

describe('badge in focus mode', () => {
  const items = [
    sig({ id: 'a', kind: 'task', urgency: 0.9 }),
    sig({ id: 'b', kind: 'dm', urgency: 0.5 })
  ]
  const meeting = sig({ id: 'm', kind: 'meeting', startsAt: now + 5 * 60_000, endsAt: now + HOUR })

  it('counts everything normally', () => {
    expect(computeBadge([...items, meeting], now).count).toBe(2)
  })

  it('counts only urgent items and silences the meeting highlight in focus', () => {
    const b = computeBadge([...items, meeting], now, { focus: true })
    expect(b.count).toBe(1)
    expect(b.meetingSoon).toBe(false)
    expect(b.urgent).toBe(true)
  })
})
