// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { trackMove } from '../src/main/connectors/calendar/mapper'
import {
  movedKey,
  shouldNotifyMoved,
  startupMovedKeys,
  type NotifyContext
} from '../src/main/engine/notifyPolicy'
import { buildAiPayload } from '../src/main/ai/briefingAi'
import { buildBriefing } from '../src/main/engine/briefing'
import { MeetingCard } from '../src/renderer/panel/components/MeetingCard'
import { beforeText, meetingMove, moveLabel } from '../src/shared/meetingMove'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Signal } from '../src/shared/types'

afterEach(cleanup)

const HOUR = 3_600_000
const at = (day: number, h: number, m = 0): number => new Date(2026, 9, day, h, m).getTime()
const now = at(28, 9, 30) // Wednesday 28 Oct 2026, 09:30

const meeting = (over: Partial<Signal> = {}): Signal => ({
  id: 'calendar:1',
  source: 'calendar',
  kind: 'meeting',
  title: 'Revisión de presupuesto',
  url: 'https://calendar.google.com',
  occurredAt: at(28, 15),
  startsAt: at(28, 15),
  endsAt: at(28, 16),
  ...over
})

describe('meetingMove', () => {
  it('tells a meeting moved earlier from one moved later', () => {
    expect(meetingMove(at(28, 14), at(28, 15))?.direction).toBe('earlier')
    expect(meetingMove(at(28, 16), at(28, 15))?.direction).toBe('later')
  })

  it('is nothing when it was never moved, or is back where it was', () => {
    expect(meetingMove(at(28, 15), undefined)).toBeNull()
    expect(meetingMove(at(28, 15), at(28, 15))).toBeNull()
    expect(meetingMove(undefined, at(28, 15))).toBeNull()
  })

  it('says the old time, and the day only when the day changed too', () => {
    const sameDay = meetingMove(at(28, 16), at(28, 15))!
    expect(moveLabel(sameDay, at(28, 16), now)).toBe('Atrasada · antes 15:00')
    const otherDay = meetingMove(at(29, 15), at(28, 15))!
    expect(beforeText(otherDay, at(29, 15), now)).toContain('mié 28 oct')
    expect(moveLabel(meetingMove(at(28, 14), at(28, 15))!, at(28, 14), now)).toBe(
      'Adelantada · antes 15:00'
    )
  })
})

describe('trackMove (reading the calendar)', () => {
  it('does not call a meeting moved the first time it is seen', () => {
    expect(trackMove(undefined, meeting()).movedFrom).toBeUndefined()
  })

  it('remembers the old start when the start changed', () => {
    const before = meeting()
    const after = meeting({ startsAt: at(28, 16), endsAt: at(28, 17), occurredAt: at(28, 16) })
    expect(trackMove(before, after).movedFrom).toBe(at(28, 15))
  })

  it('keeps the change on the next readings, when the time stays the same', () => {
    const moved = meeting({ startsAt: at(28, 16), movedFrom: at(28, 15) })
    expect(trackMove(moved, meeting({ startsAt: at(28, 16) })).movedFrom).toBe(at(28, 15))
  })

  it('uses the latest change when it moves again', () => {
    const moved = meeting({ startsAt: at(28, 16), movedFrom: at(28, 15) })
    expect(trackMove(moved, meeting({ startsAt: at(28, 17) })).movedFrom).toBe(at(28, 16))
  })

  it('does not flag a change of the end alone', () => {
    const next = meeting({ endsAt: at(28, 17) })
    expect(trackMove(meeting(), next).movedFrom).toBeUndefined()
  })
})

describe('telling about a moved meeting', () => {
  const open: NotifyContext = { enabled: true, paused: false, workTime: true, focus: false }
  const moved = meeting({ startsAt: at(28, 16), movedFrom: at(28, 15) })

  it('tells when it starts within the next day', () => {
    expect(shouldNotifyMoved(moved, open, now)).toBe(true)
    expect(
      shouldNotifyMoved(meeting({ startsAt: at(29, 8), movedFrom: at(29, 7) }), open, now)
    ).toBe(true)
  })

  it('stays quiet for a meeting far ahead, one already started, or one never moved', () => {
    expect(
      shouldNotifyMoved(meeting({ startsAt: at(31, 10), movedFrom: at(31, 9) }), open, now)
    ).toBe(false)
    expect(shouldNotifyMoved({ ...moved, startsAt: now - HOUR }, open, now)).toBe(false)
    expect(shouldNotifyMoved(meeting(), open, now)).toBe(false)
  })

  it('respects pause, work hours and focus mode', () => {
    expect(shouldNotifyMoved(moved, { ...open, paused: true }, now)).toBe(false)
    expect(shouldNotifyMoved(moved, { ...open, workTime: false }, now)).toBe(false)
    expect(shouldNotifyMoved(moved, { ...open, focus: true }, now)).toBe(false)
  })

  it('tells again when it moves again, but not twice for the same change', () => {
    const again = meeting({ startsAt: at(28, 17), movedFrom: at(28, 16) })
    expect(movedKey(moved)).not.toBe(movedKey(again))
    expect(movedKey(moved)).toBe(movedKey({ ...moved }))
  })

  it('does not repeat at launch what was already there', () => {
    expect(startupMovedKeys([moved, meeting({ id: 'calendar:2' })], now)).toEqual([movedKey(moved)])
  })
})

describe('where the change shows', () => {
  it('on the meeting card, in words', () => {
    render(
      <MeetingCard meeting={meeting({ startsAt: at(28, 16), movedFrom: at(28, 15) })} now={now} />
    )
    expect(screen.getByText('Atrasada · antes 15:00')).toBeTruthy()
  })

  it('and not on a meeting that was never moved', () => {
    render(<MeetingCard meeting={meeting()} now={now} />)
    expect(screen.queryByText(/antes/)).toBeNull()
  })

  it('in the summary, and in what the AI is given', () => {
    const b = buildBriefing({
      signals: [meeting({ startsAt: at(28, 16), movedFrom: at(28, 15) })],
      name: '',
      now
    })
    expect(b.meetings[0].movedFrom).toBe(at(28, 15))
    const { data } = buildAiPayload(b, { ...DEFAULT_SETTINGS.ai, enabled: true }, now)
    const sent = JSON.stringify(data)
    expect(sent).toContain('"cambioDeHorario":"atrasada"')
    expect(sent).toContain('"horaAnterior":"15:00"')
  })
})
