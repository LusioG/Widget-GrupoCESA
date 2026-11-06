// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MeetingCard } from '../src/renderer/panel/components/MeetingCard'
import { isMeetingNear } from '../src/shared/badgeState'
import { strings } from '../src/shared/strings'
import type { Signal } from '../src/shared/types'

afterEach(cleanup)

const HOUR = 3_600_000
const now = new Date(2026, 9, 28, 9, 30).getTime()

const meeting = (startsInH: number, lastsH = 1): Signal => ({
  id: 'calendar:1',
  source: 'calendar',
  kind: 'meeting',
  title: 'Revisión de presupuesto',
  url: 'https://calendar.google.com',
  occurredAt: now + startsInH * HOUR,
  startsAt: now + startsInH * HOUR,
  endsAt: now + (startsInH + lastsH) * HOUR
})

describe('the yellow "!" on a meeting card', () => {
  const dot = (): HTMLElement | null => screen.queryByLabelText(strings.panel.meetingNear)

  it('shows when the meeting is less than 12 hours away', () => {
    render(<MeetingCard meeting={meeting(3)} now={now} />)
    expect(dot()?.textContent).toBe('!')
    expect(dot()?.className).toContain('bg-cesa-meeting') // yellow, not the green of messages
  })

  it('shows while the meeting is running', () => {
    render(<MeetingCard meeting={meeting(-0.5)} now={now} />)
    expect(dot()).not.toBeNull()
  })

  it('is not there for a meeting 12 hours or more away', () => {
    render(<MeetingCard meeting={meeting(13)} now={now} />)
    expect(dot()).toBeNull()
  })

  it('goes when the meeting has ended', () => {
    const ended = meeting(-2) // started 2 h ago, lasted 1 h
    expect(isMeetingNear(ended, now)).toBe(false)
    render(<MeetingCard meeting={ended} now={now} />)
    expect(dot()).toBeNull()
  })

  it('stays all the way to the end, then goes with the clock', () => {
    const m = meeting(-0.5) // ends in 30 minutes
    expect(isMeetingNear(m, now)).toBe(true)
    expect(isMeetingNear(m, now + 29 * 60_000)).toBe(true)
    expect(isMeetingNear(m, now + 30 * 60_000)).toBe(false)
  })

  it('is the same rule as the yellow circle of the widget', () => {
    expect(isMeetingNear(meeting(11.9), now)).toBe(true)
    expect(isMeetingNear(meeting(12), now)).toBe(false)
  })
})
