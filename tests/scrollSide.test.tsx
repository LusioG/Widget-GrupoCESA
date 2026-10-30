// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Panel } from '@renderer/panel/Panel'
import { useAppStore } from '@renderer/store/useAppStore'
import { DEFAULT_SETTINGS } from '@shared/settingsSchema'
import type { AppState } from '@shared/types'

const idle = (): (() => void) => () => undefined

const stateFor = (widget: Partial<AppState['settings']['widget']>): AppState => ({
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
    meetingSoon: false
  },
  paused: false,
  focus: { manual: false, active: false },
  outsideHours: false,
  settings: {
    ...DEFAULT_SETTINGS,
    onboardingDone: true,
    widget: { ...DEFAULT_SETTINGS.widget, ...widget }
  },
  accounts: {
    clickup: { status: 'disconnected' },
    calendar: { status: 'disconnected' },
    slack: { status: 'disconnected' },
    gmail: { status: 'disconnected' }
  },
  googleHasCredentials: false,
  autostart: false
})

const show = (widget: Partial<AppState['settings']['widget']>): HTMLElement => {
  const state = stateFor(widget)
  Object.defineProperty(window, 'api', {
    value: {
      getState: vi.fn(async () => state),
      onState: vi.fn(idle),
      onNavigate: vi.fn(idle),
      onPanelOpen: vi.fn(idle),
      onPlaySound: vi.fn(idle),
      panel: { close: vi.fn() }
    },
    configurable: true
  })
  window.matchMedia = window.matchMedia ?? ((() => ({ matches: false })) as never)
  useAppStore.setState({ state, view: 'home' })
  return render(<Panel />).container.firstElementChild as HTMLElement
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('which side the scrollbars are on', () => {
  it('marks the panel with the edge it is docked to, in tab mode', () => {
    expect(show({ mode: 'tab', side: 'left' }).getAttribute('data-dock')).toBe('left')
    cleanup()
    expect(show({ mode: 'tab', side: 'right' }).getAttribute('data-dock')).toBe('right')
  })

  it('has no edge to follow when it is a floating popup', () => {
    expect(show({ mode: 'popup' }).hasAttribute('data-dock')).toBe(false)
  })

  it('the stylesheet moves the scrollbars to the left only for a left dock', () => {
    const css = readFileSync('src/renderer/assets/main.css', 'utf8')
    expect(css).toMatch(/\[data-dock='left'\] \.cesa-scroll\s*\{\s*direction:\s*rtl/)
    expect(css).toMatch(/\[data-dock='left'\] \.cesa-scroll > \*\s*\{\s*direction:\s*ltr/)
    expect(css).not.toMatch(/\[data-dock='right'\]/) // the right edge already has them there
  })
})
