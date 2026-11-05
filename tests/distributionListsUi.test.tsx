// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from '@renderer/panel/views/Home'
import { DistributionLists } from '@renderer/panel/views/settings/DistributionLists'
import { useAppStore } from '@renderer/store/useAppStore'
import { Thread } from '@renderer/thread/Thread'
import { DEFAULT_SETTINGS } from '@shared/settingsSchema'
import { strings } from '@shared/strings'
import type {
  AccountInfo,
  AppState,
  AvailableList,
  Signal,
  Source,
  ThreadView
} from '@shared/types'

const DAY = 24 * 60 * 60 * 1000

let shown: ((view: ThreadView) => void) | null = null
const api = {
  openExternal: vi.fn(async () => undefined),
  settings: { update: vi.fn(async () => undefined) },
  items: { act: vi.fn(async () => undefined), undo: vi.fn(async () => true) },
  sync: { refresh: vi.fn(async () => undefined) },
  briefing: { list: vi.fn(async () => []), open: vi.fn(async () => undefined) },
  accounts: { listGmailLists: vi.fn(async (): Promise<AvailableList[]> => []) },
  threads: {
    open: vi.fn(async () => undefined),
    close: vi.fn(),
    current: vi.fn(async (): Promise<ThreadView | null> => null),
    onShow: vi.fn((cb: (view: ThreadView) => void) => {
      shown = cb
      return () => {
        shown = null
      }
    })
  },
  panel: { close: vi.fn() }
}

const accounts = (over: Partial<Record<Source, AccountInfo>> = {}): Record<Source, AccountInfo> => ({
  clickup: { status: 'disconnected' },
  calendar: { status: 'disconnected' },
  slack: { status: 'disconnected' },
  gmail: { status: 'disconnected' },
  ...over
})

const setState = (over: Partial<AppState> = {}): void =>
  useAppStore.setState({
    view: 'home',
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
      accounts: accounts({ gmail: { status: 'connected' } }),
      googleHasCredentials: true,
      slackOAuth: false,
      aiKeySet: false,
      appVersion: '1.2.0',
      updateReady: null,
      autostart: false,
      ...over
    }
  })

const listItem = (over: Partial<Signal> = {}): Signal => ({
  id: 'gmail:list:abc123:m2',
  source: 'gmail',
  kind: 'email',
  title: 'Falla en la sede',
  body: 'Ana Pérez · Se cayó el sistema en la sede norte',
  url: 'https://mail.google.com/mail/u/0/#all/abc123',
  occurredAt: Date.now(),
  list: { address: 'soporte@cesa.com', name: 'Soporte CESA' },
  threadId: 'abc123',
  unread: 2,
  urgency: 0.3,
  ...over
})

const meeting: Signal = {
  id: 'calendar:1',
  source: 'calendar',
  kind: 'meeting',
  title: 'Reunión de equipo',
  url: 'https://calendar.google.com',
  occurredAt: Date.now() + DAY / 24,
  startsAt: Date.now() + DAY / 24,
  endsAt: Date.now() + DAY / 12
}

const mail: Signal = {
  id: 'gmail:m9',
  source: 'gmail',
  kind: 'email',
  title: 'Contrato',
  url: 'https://mail.google.com',
  occurredAt: Date.now(),
  urgency: 0.3
}

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  Element.prototype.scrollIntoView = vi.fn()
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('panel: distribution lists section', () => {
  it('sits above the events, apart from the other pending items', () => {
    setState({ signals: [mail, listItem(), meeting] })
    render(<Home />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual([strings.panel.lists, strings.panel.meetings, strings.panel.pending])
    // The list conversation is in its own section only, not repeated under "Pendientes".
    expect(screen.getAllByText('Falla en la sede')).toHaveLength(1)
  })

  it('calls the events section "Próximos eventos"', () => {
    setState({ signals: [meeting] })
    render(<Home />)
    expect(screen.getByRole('heading', { name: 'Próximos eventos' })).toBeTruthy()
    expect(screen.queryByText(/Próximas reuniones/)).toBeNull()
  })

  it('has no section when no list has anything unread', () => {
    setState({ signals: [mail] })
    render(<Home />)
    expect(screen.queryByText(strings.panel.lists)).toBeNull()
  })

  it('shows the list, the first message and a sign of unread messages', () => {
    setState({ signals: [listItem()] })
    render(<Home />)
    expect(screen.getByText('Soporte CESA')).toBeTruthy()
    expect(screen.getByText(/Se cayó el sistema en la sede norte/)).toBeTruthy()
    expect(screen.getByLabelText('2 sin leer').textContent).toBe('2')
  })

  it('drops the unread sign once the conversation has been opened', () => {
    setState({ signals: [listItem({ seen: true })] })
    render(<Home />)
    expect(screen.queryByLabelText(/sin leer/)).toBeNull()
  })

  it('opens the conversation in its own window instead of the browser', () => {
    setState({ signals: [listItem()] })
    render(<Home />)
    fireEvent.click(screen.getByText('Falla en la sede'))
    expect(api.threads.open).toHaveBeenCalledWith({
      threadId: 'abc123',
      signalId: 'gmail:list:abc123:m2',
      title: 'Falla en la sede'
    })
    expect(api.openExternal).not.toHaveBeenCalled()
  })

  it('marks an urgent list conversation like any urgent item', () => {
    setState({ signals: [listItem({ urgency: 0.9 })] })
    render(<Home />)
    expect(screen.getByText(strings.panel.urgent)).toBeTruthy()
  })

  it('keeps "Seleccionar" on the line of "Pendientes y novedades", not on the lists', () => {
    setState({ signals: [mail, listItem(), meeting] })
    render(<Home />)
    const row = (title: string): HTMLElement =>
      screen.getByRole('heading', { name: title }).parentElement as HTMLElement
    expect(within(row(strings.panel.pending)).getByText(strings.panel.select)).toBeTruthy()
    expect(within(row(strings.panel.lists)).queryByText(strings.panel.select)).toBeNull()
  })

  it('moves "Seleccionar" to the lists only when there is nothing under "Pendientes"', () => {
    setState({ signals: [listItem()] })
    render(<Home />)
    const row = screen.getByRole('heading', { name: strings.panel.lists }).parentElement as HTMLElement
    expect(within(row).getByText(strings.panel.select)).toBeTruthy()
  })

  it('counts list conversations in the summary', () => {
    setState({ signals: [listItem(), mail] })
    render(<Home />)
    expect(screen.getByText(strings.panel.summary(2, 0))).toBeTruthy()
  })
})

describe('conversation window', () => {
  const view: ThreadView = {
    threadId: 'abc123',
    subject: 'Falla en la sede',
    list: { address: 'soporte@cesa.com', name: 'Soporte CESA' },
    gmailUrl: 'https://mail.google.com/mail/u/0/#all/abc123',
    messages: [
      {
        id: 'm1',
        from: { name: 'Ana Pérez', address: 'ana@cliente.com' },
        at: new Date(2026, 10, 3, 9, 5).getTime(),
        text: 'Se cayó el sistema',
        mine: false,
        unread: false
      },
      {
        id: 'm2',
        from: { name: 'Luis Gómez', address: 'luis@cesa.com' },
        at: new Date(2026, 10, 3, 9, 20).getTime(),
        text: 'Lo reviso ahora',
        mine: false,
        unread: true,
        replyTo: { name: 'Ana Pérez', snippet: 'Se cayó el sistema' }
      },
      {
        id: 'm3',
        from: { name: 'Yo', address: 'yo@cesa.com' },
        at: new Date(2026, 10, 3, 9, 30).getTime(),
        text: 'Gracias Luis',
        mine: true,
        unread: false,
        replyTo: { name: 'Luis Gómez', snippet: 'Lo reviso ahora' }
      }
    ]
  }

  it('asks for the conversation when it starts, in case it missed the first one', async () => {
    api.threads.current.mockResolvedValueOnce(view)
    await act(async () => void render(<Thread />))
    expect(screen.getByText('Gracias Luis')).toBeTruthy()
  })

  it('draws each message as a bubble with who wrote it, at what time and who it answers', async () => {
    await act(async () => void render(<Thread />))
    await act(async () => shown?.(view))

    expect(screen.getByRole('heading', { name: 'Falla en la sede' })).toBeTruthy()
    expect(screen.getByText('Soporte CESA')).toBeTruthy()
    expect(screen.getByText('3 mensajes')).toBeTruthy()

    // Names of the others, "Tú" never printed above one's own bubble.
    expect(screen.getByText('Ana Pérez')).toBeTruthy()
    expect(screen.getByText('Luis Gómez')).toBeTruthy()

    // The time each one was written.
    expect(screen.getByText('09:05')).toBeTruthy()
    expect(screen.getByText('09:20')).toBeTruthy()
    expect(screen.getByText('09:30')).toBeTruthy()

    // Replies say who they answer and quote it.
    expect(screen.getByText('En respuesta a Ana Pérez')).toBeTruthy()
    expect(screen.getByText('En respuesta a Luis Gómez')).toBeTruthy()

    // Mine on the right, the others on the left.
    const mine = screen.getByText('Gracias Luis').closest('li')!
    // (the first match is Luis's own bubble; the second is the quote inside the reply to him)
    const theirs = screen.getAllByText('Lo reviso ahora')[0].closest('li')!
    expect(mine.className).toContain('justify-end')
    expect(theirs.className).toContain('justify-start')
  })

  it('marks where the new messages start', async () => {
    await act(async () => void render(<Thread />))
    await act(async () => shown?.(view))
    expect(screen.getAllByText(strings.thread.newMessage)).toHaveLength(1)
  })

  it('shows a loading state, then explains a failure', async () => {
    await act(async () => void render(<Thread />))
    await act(async () => shown?.({ ...view, messages: [], loading: true }))
    expect(screen.getByText(strings.thread.loading)).toBeTruthy()
    await act(async () => shown?.({ ...view, messages: [], error: 'auth' }))
    expect(within(screen.getByRole('alert')).getByText(strings.thread.errors.auth)).toBeTruthy()
  })

  it('closes and opens the original in Gmail', async () => {
    await act(async () => void render(<Thread />))
    await act(async () => shown?.(view))
    fireEvent.click(screen.getByRole('button', { name: strings.thread.close }))
    expect(api.threads.close).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: strings.thread.openInGmail }))
    expect(api.openExternal).toHaveBeenCalledWith(view.gmailUrl)
  })
})

describe('settings: choosing the lists', () => {
  const found: AvailableList[] = [
    { address: 'soporte@cesa.com', name: 'Soporte CESA', count: 12 },
    { address: 'ventas@cesa.com', name: 'Ventas', count: 3 }
  ]

  it('asks to connect Gmail first', () => {
    setState({ accounts: accounts() })
    render(<DistributionLists />)
    expect(screen.getByText(strings.settings.watch.needLists)).toBeTruthy()
  })

  it('searches the lists the user receives and follows one', async () => {
    api.accounts.listGmailLists.mockResolvedValueOnce(found)
    setState()
    render(<DistributionLists />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: strings.settings.watch.listsSearch })))
    expect(screen.getByText(/soporte@cesa.com · 12 correos/)).toBeTruthy()
    const row = screen.getByText('Ventas').closest('div')!
    fireEvent.click(within(row).getByRole('button', { name: strings.settings.watch.listsFollow }))
    expect(api.settings.update).toHaveBeenCalledWith({
      gmail: { lists: [{ address: 'ventas@cesa.com', name: 'Ventas', urgent: false }] }
    })
  })

  it('says so when no list is found', async () => {
    setState()
    render(<DistributionLists />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: strings.settings.watch.listsSearch })))
    expect(screen.getByText(strings.settings.watch.listsNone)).toBeTruthy()
  })

  it('marks a followed list as urgent and stops following it', () => {
    const lists = [{ address: 'soporte@cesa.com', name: 'Soporte CESA', urgent: false }]
    setState({ settings: { ...DEFAULT_SETTINGS, gmail: { ...DEFAULT_SETTINGS.gmail, lists } } })
    render(<DistributionLists />)
    fireEvent.click(screen.getByRole('switch', { name: /Soporte CESA/ }))
    expect(api.settings.update).toHaveBeenLastCalledWith({
      gmail: { lists: [{ ...lists[0], urgent: true }] }
    })
    fireEvent.click(screen.getByRole('button', { name: /Dejar de seguir: Soporte CESA/ }))
    expect(api.settings.update).toHaveBeenLastCalledWith({ gmail: { lists: [] } })
  })

  it('adds a list by its address, and rejects an invalid one', () => {
    setState()
    render(<DistributionLists />)
    const field = screen.getByLabelText(strings.settings.watch.listsAddLabel)
    fireEvent.change(field, { target: { value: 'esto no es un correo' } })
    fireEvent.click(screen.getByRole('button', { name: strings.settings.watch.listsAdd }))
    expect(screen.getByRole('alert').textContent).toBe(strings.settings.watch.listsInvalid)
    expect(api.settings.update).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: 'Compras@CESA.com' } })
    fireEvent.click(screen.getByRole('button', { name: strings.settings.watch.listsAdd }))
    expect(api.settings.update).toHaveBeenCalledWith({
      gmail: { lists: [{ address: 'compras@cesa.com', name: 'compras', urgent: false }] }
    })
  })

  it('chooses how many days back the list mail is shown (7 by default)', () => {
    setState()
    render(<DistributionLists />)
    const group = screen.getByRole('group', { name: strings.settings.watch.listsDaysLabel })
    expect(within(group).getByRole('button', { name: '7 días' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(group).getByRole('button', { name: '3 días' }))
    expect(api.settings.update).toHaveBeenLastCalledWith({ gmail: { listDays: 3 } })
    fireEvent.click(within(group).getByRole('button', { name: '1 día' }))
    expect(api.settings.update).toHaveBeenLastCalledWith({ gmail: { listDays: 1 } })
  })
})
