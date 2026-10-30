// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Badge } from '@renderer/badge/Badge'
import { useAppStore } from '@renderer/store/useAppStore'
import { DEFAULT_SETTINGS } from '@shared/settingsSchema'
import type { AppState, BadgeState } from '@shared/types'

const idle = (): (() => void) => () => undefined

const stateWith = (
  badge: Partial<BadgeState>,
  over: Partial<AppState> = {},
  mode: 'popup' | 'tab' = 'popup'
): AppState => ({
  signals: [],
  snoozed: [],
  trash: [],
  widgetHidden: false,
  presenting: false,
  hotkeyFailed: false,
  badge: {
    count: 0,
    urgent: false,
    urgentCount: 0,
    meetingCount: 0,
    messageAlert: false,
    meetingSoon: false,
    ...badge
  },
  paused: false,
  focus: { manual: false, active: false },
  outsideHours: false,
  settings: { ...DEFAULT_SETTINGS, widget: { ...DEFAULT_SETTINGS.widget, mode } },
  accounts: {
    clickup: { status: 'disconnected' },
    calendar: { status: 'disconnected' },
    slack: { status: 'disconnected' },
    gmail: { status: 'disconnected' }
  },
  googleHasCredentials: false,
  aiKeySet: false,
  autostart: false,
  ...over
})

const show = (state: AppState): void => {
  const api = {
    getState: vi.fn(async () => state),
    onState: vi.fn(idle),
    onNavigate: vi.fn(idle),
    onPanelOpen: vi.fn(idle),
    onPlaySound: vi.fn(idle),
    badge: { press: vi.fn(), move: vi.fn(), release: vi.fn() }
  }
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  useAppStore.setState({ state })
  render(<Badge />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('widget counters (popup)', () => {
  it('shows only the green number when there is nothing urgent and no meeting', () => {
    show(stateWith({ count: 3 }))
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.queryByTitle(/urgente/)).toBeNull()
    expect(screen.queryByTitle(/reuni/)).toBeNull()
  })

  it('shows nothing at all when there is nothing', () => {
    show(stateWith({}))
    expect(screen.queryByText('0')).toBeNull()
    expect(document.querySelectorAll('span.rounded-full').length).toBe(0)
  })

  it('adds a red circle for urgent items and a yellow one for meetings', () => {
    show(stateWith({ count: 5, urgent: true, urgentCount: 2, meetingCount: 3 }))
    expect(screen.getByText('5')).toBeTruthy() // the green number is the whole count, not "!"
    expect(screen.getByTitle('2 urgentes').className).toContain('bg-cesa-alert')
    expect(screen.getByTitle('3 reuniones').className).toContain('bg-cesa-meeting')
    expect(screen.queryByText('!')).toBeNull()
  })

  it('shows each circle only when it has something', () => {
    show(stateWith({ count: 1, urgent: true, urgentCount: 1 }))
    expect(screen.getByTitle('1 urgente')).toBeTruthy()
    expect(screen.queryByTitle(/reuni/)).toBeNull()
  })

  it('caps big numbers', () => {
    show(stateWith({ count: 150, urgentCount: 120, urgent: true }))
    expect(screen.getAllByText('99+')).toHaveLength(2)
  })

  it('in focus mode the green number is the urgent count and the red circle is not repeated', () => {
    show(
      stateWith(
        { count: 2, urgent: true, urgentCount: 2, meetingCount: 1 },
        { focus: { manual: true, active: true } }
      )
    )
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.queryByTitle(/urgente/)).toBeNull()
    expect(screen.getByTitle('1 reunión')).toBeTruthy()
  })
})

describe('widget counters (vertical tab)', () => {
  it('shows red, yellow and green from top to bottom, all below the logo', () => {
    show(stateWith({ count: 4, urgent: true, urgentCount: 1, meetingCount: 2 }, {}, 'tab'))
    const urgent = screen.getByTitle('1 urgente')
    const meetings = screen.getByTitle('2 reuniones')
    const green = screen.getByText('4')
    const order = (a: Element, b: Element): boolean =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(order(urgent, meetings)).toBe(true)
    expect(order(meetings, green)).toBe(true)
  })

  it('is the plain tab, with its green number, when there is nothing to add', () => {
    show(stateWith({ count: 7 }, {}, 'tab'))
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.queryByTitle(/urgente|reuni/)).toBeNull()
  })
})

describe('the pulse', () => {
  const pings = (): number => document.querySelectorAll('.animate-cesa-ping').length
  const ping = (): Element | null => document.querySelector('.animate-cesa-ping')

  it('pulses red for a new mail or Slack message', () => {
    show(stateWith({ count: 2, messageAlert: true }))
    expect(ping()?.className).toContain('bg-cesa-alert')
  })

  it('does not pulse for urgent tasks: they only add to the counters', () => {
    show(stateWith({ count: 2, urgent: true, urgentCount: 2, messageAlert: false }))
    expect(pings()).toBe(0)
    expect(screen.getByTitle('2 urgentes')).toBeTruthy() // still counted in the red circle
  })

  it('pulses green for a meeting that is about to start, when no message is new', () => {
    show(stateWith({ meetingCount: 1, meetingSoon: true }))
    expect(ping()?.className).toContain('bg-cesa-green')
  })

  it('red wins over green when both apply', () => {
    show(stateWith({ messageAlert: true, meetingSoon: true, meetingCount: 1 }))
    expect(pings()).toBe(1)
    expect(ping()?.className).toContain('bg-cesa-alert')
  })

  it('does not pulse with alerts paused', () => {
    show(stateWith({ messageAlert: true, meetingSoon: true }, { paused: true }))
    expect(pings()).toBe(0)
  })

  it('the tab glows in red or green by the same rule', () => {
    show(stateWith({ messageAlert: true }, {}, 'tab'))
    expect(document.querySelector('.animate-cesa-glow')).toBeTruthy()
    cleanup()
    show(stateWith({ urgent: true, urgentCount: 1 }, {}, 'tab'))
    expect(document.querySelector('.animate-cesa-glow')).toBeNull()
  })
})
