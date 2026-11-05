// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Accounts } from '@renderer/panel/views/settings/Accounts'
import { useAppStore } from '@renderer/store/useAppStore'
import { DEFAULT_SETTINGS } from '@shared/settingsSchema'
import { strings } from '@shared/strings'
import type { AccountInfo, ActionResult, AppState, Source } from '@shared/types'

const s = strings.settings.accounts

const api = {
  accounts: {
    connectSlackOAuth: vi.fn(async (): Promise<ActionResult> => ({ ok: true })),
    connectSlack: vi.fn(async (): Promise<ActionResult> => ({ ok: true })),
    disconnect: vi.fn(async () => undefined)
  }
}

const accounts = (slack: AccountInfo): Record<Source, AccountInfo> => ({
  clickup: { status: 'disconnected' },
  calendar: { status: 'disconnected' },
  slack,
  gmail: { status: 'disconnected' }
})

const setState = (over: Partial<AppState> & { slack?: AccountInfo }): void =>
  useAppStore.setState({
    view: 'settings',
    state: {
      signals: [],
      snoozed: [],
      trash: [],
      widgetHidden: false,
      presenting: false,
      hotkeyFailed: false,
      badge: { count: 0, urgent: false, urgentCount: 0, meetingCount: 0, messageAlert: false, meetingSoon: false },
      paused: false,
      focus: { manual: false, active: false },
      outsideHours: false,
      settings: DEFAULT_SETTINGS,
      accounts: accounts(over.slack ?? { status: 'disconnected' }),
      googleHasCredentials: false,
      slackOAuth: false,
      aiKeySet: false,
      appVersion: '1.2.0',
      updateReady: null,
      autostart: false,
      ...over
    }
  })

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('Slack card: sign in with your own account', () => {
  it('offers the button when the company app is set up, and the manual token only folded away', () => {
    setState({ slackOAuth: true })
    render(<Accounts />)
    expect(screen.getByRole('button', { name: s.slackOAuthConnect })).toBeTruthy()
    expect(screen.getByText(s.slackOAuthHelp)).toBeTruthy()
    const manual = screen.getByText(s.slackManualTitle).closest('details')!
    expect(manual.hasAttribute('open')).toBe(false)
    expect(within(manual).getByPlaceholderText(s.slackUserToken)).toBeTruthy()
  })

  it('opens Slack in the browser when pressed, and says it is waiting', async () => {
    let finish: (r: ActionResult) => void = () => undefined
    api.accounts.connectSlackOAuth.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    setState({ slackOAuth: true })
    render(<Accounts />)
    fireEvent.click(screen.getByRole('button', { name: s.slackOAuthConnect }))
    expect(api.accounts.connectSlackOAuth).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: s.slackOAuthWaiting })).toBeTruthy()
    await act(async () => finish({ ok: true }))
    expect(screen.getByRole('button', { name: s.slackOAuthConnect })).toBeTruthy()
  })

  it('says why when the person said no or it timed out', async () => {
    api.accounts.connectSlackOAuth.mockResolvedValueOnce({ ok: false, error: 'La autorización fue cancelada.' })
    setState({ slackOAuth: true })
    render(<Accounts />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: s.slackOAuthConnect })))
    expect(screen.getByText('La autorización fue cancelada.')).toBeTruthy()
  })

  it('asks to reconnect with the same button when the connection was lost', () => {
    setState({ slackOAuth: true, slack: { status: 'needs_reconnect' } })
    render(<Accounts />)
    // The first is the main button; the one in the folded "token by hand" has the same name.
    const [main] = screen.getAllByRole('button', { name: s.reconnect })
    expect(main.closest('details')).toBeNull()
    fireEvent.click(main)
    expect(api.accounts.connectSlackOAuth).toHaveBeenCalledTimes(1)
  })

  it('keeps asking for the token by hand while the company app is not set up', () => {
    setState({ slackOAuth: false })
    render(<Accounts />)
    expect(screen.queryByRole('button', { name: s.slackOAuthConnect })).toBeNull()
    expect(screen.getByPlaceholderText(s.slackUserToken)).toBeTruthy()
  })

  it('shows only "disconnect" once connected', () => {
    setState({ slackOAuth: true, slack: { status: 'connected' } })
    render(<Accounts />)
    expect(screen.queryByRole('button', { name: s.slackOAuthConnect })).toBeNull()
  })

  it('says who Slack is connected as, so a wrong account is noticed at once', () => {
    setState({ slack: { status: 'connected', label: 'luciano · Grupo Cesa' } })
    render(<Accounts />)
    expect(screen.getByText(s.connectedAs('luciano · Grupo Cesa'))).toBeTruthy()
  })

  it('shows no "connected as" line when the name is not known', () => {
    setState({ slack: { status: 'connected' } })
    render(<Accounts />)
    expect(screen.queryByText(/Conectado como/)).toBeNull()
  })
})
