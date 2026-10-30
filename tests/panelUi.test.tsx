// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from '@renderer/panel/views/Home'
import { Settings } from '@renderer/panel/views/Settings'
import { CalendarHorizon } from '@renderer/panel/views/settings/CalendarHorizon'
import { General } from '@renderer/panel/views/settings/General'
import { Trash } from '@renderer/panel/views/settings/Trash'
import { useAppStore } from '@renderer/store/useAppStore'
import { DEFAULT_SETTINGS } from '@shared/settingsSchema'
import { strings } from '@shared/strings'
import type { AccountInfo, AppState, Signal, Source } from '@shared/types'

const api = {
  openExternal: vi.fn(async () => undefined),
  settings: { update: vi.fn(async () => undefined) },
  items: { act: vi.fn(async () => undefined), undo: vi.fn(async () => true) },
  sync: { refresh: vi.fn(async () => undefined) },
  system: {
    setAutostart: vi.fn(async () => undefined),
    setFocus: vi.fn(async () => undefined),
    setWidgetHidden: vi.fn(async () => undefined),
    quitApp: vi.fn(async () => undefined)
  },
  panel: { close: vi.fn() }
}

const accounts = (
  over: Partial<Record<Source, AccountInfo>> = {}
): Record<Source, AccountInfo> => ({
  clickup: { status: 'disconnected' },
  calendar: { status: 'disconnected' },
  slack: { status: 'disconnected' },
  gmail: { status: 'disconnected' },
  ...over
})

const task = (id: string): Signal => ({
  id: `clickup:${id}`,
  source: 'clickup',
  kind: 'task',
  title: `Tarea ${id}`,
  url: 'https://app.clickup.com/t/1',
  occurredAt: Date.now()
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
      settings: DEFAULT_SETTINGS,
      accounts: accounts(),
      googleHasCredentials: false,
      autostart: false,
      ...over
    }
  })

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('panel: updated-ago and refresh', () => {
  it('says how long ago the data was updated', () => {
    setState({
      accounts: accounts({ gmail: { status: 'connected', lastSyncAt: Date.now() - 3 * 60_000 } })
    })
    render(<Home />)
    expect(screen.getByText('Actualizado hace 3 min')).toBeTruthy()
  })

  it('hides the bar when no account is connected', () => {
    setState()
    render(<Home />)
    expect(screen.queryByTitle(strings.panel.refresh)).toBeNull()
  })

  it('refreshes on click and shows that it is working', async () => {
    setState({ accounts: accounts({ clickup: { status: 'connected', lastSyncAt: Date.now() } }) })
    render(<Home />)
    await act(async () => {
      fireEvent.click(screen.getByTitle(strings.panel.refresh))
    })
    expect(api.sync.refresh).toHaveBeenCalledTimes(1)
    expect(screen.getByText(strings.panel.refreshing)).toBeTruthy()
  })

  it('warns when an account could not be reached', () => {
    setState({
      accounts: accounts({ slack: { status: 'connected', lastSyncAt: 1, error: 'offline' } })
    })
    render(<Home />)
    expect(screen.getByText(strings.panel.syncProblem('Slack'))).toBeTruthy()
  })
})

describe('panel: Google API not enabled', () => {
  const url =
    'https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=571708439320'

  it('explains it and opens the page that fixes it', () => {
    setState({
      accounts: accounts({ gmail: { status: 'connected', error: 'api_disabled', errorUrl: url } })
    })
    render(<Home />)
    expect(screen.getByRole('alert').textContent).toContain(strings.errors.apiDisabled('Gmail'))
    fireEvent.click(screen.getByText(strings.errors.apiDisabledAction))
    expect(api.openExternal).toHaveBeenCalledWith(url)
  })

  it('falls back to the API library page when Google gave no link', () => {
    setState({ accounts: accounts({ calendar: { status: 'connected', error: 'api_disabled' } }) })
    render(<Home />)
    fireEvent.click(screen.getByText(strings.errors.apiDisabledAction))
    expect(api.openExternal).toHaveBeenCalledWith(
      'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com'
    )
  })

  it('is not shown as a plain connection problem', () => {
    setState({ accounts: accounts({ gmail: { status: 'connected', error: 'api_disabled' } }) })
    render(<Home />)
    expect(screen.queryByText(strings.panel.syncProblem('Gmail'))).toBeNull()
  })
})

describe('panel: undo and snoozed', () => {
  it('offers to undo a dismiss and calls undo', async () => {
    setState({ signals: [task('1')] })
    render(<Home />)
    fireEvent.click(screen.getByTitle(strings.panel.dismiss))
    expect(api.items.act).toHaveBeenCalledWith({ ids: ['clickup:1'], action: 'dismiss' })
    expect(screen.getByText('Descartado')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByText(strings.panel.undo))
    })
    expect(api.items.undo).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Descartado')).toBeNull()
  })

  it('lists snoozed items and brings one back', () => {
    const snoozed = { ...task('2'), snoozedUntil: Date.now() + 2 * 3_600_000 }
    setState({ snoozed: [snoozed] })
    render(<Home />)
    fireEvent.click(screen.getByText(strings.panel.snoozedSection(1)))
    expect(screen.getByText('Tarea 2')).toBeTruthy()
    fireEvent.click(screen.getByText(strings.panel.bringBack))
    expect(api.items.act).toHaveBeenCalledWith({ ids: ['clickup:2'], action: 'restore' })
  })

  it('has no snoozed section when nothing is snoozed', () => {
    setState({ signals: [task('1')] })
    render(<Home />)
    expect(screen.queryByText(/Pospuestos/)).toBeNull()
  })
})

describe('settings: shortcut and hiding', () => {
  const press = (init: KeyboardEventInit): void => {
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
      )
    })
  }

  it('shows the current shortcut', () => {
    setState()
    render(<General />)
    expect(screen.getByText('Ctrl + Alt + P')).toBeTruthy()
  })

  it('records a new combination as soon as it is valid', () => {
    setState()
    render(<General />)
    fireEvent.click(screen.getByText(strings.settings.general.hotkeyChange))
    expect(screen.getByText(strings.settings.general.hotkeyPress)).toBeTruthy()
    press({ key: 'Control', code: 'ControlLeft', ctrlKey: true }) // only a modifier: keeps waiting
    expect(api.settings.update).not.toHaveBeenCalled()
    press({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true })
    expect(api.settings.update).toHaveBeenCalledWith({ hotkey: { accelerator: 'Control+Alt+K' } })
  })

  it('asks for Ctrl or Alt when the key has no modifier', () => {
    setState()
    render(<General />)
    fireEvent.click(screen.getByText(strings.settings.general.hotkeyChange))
    press({ key: 'k', code: 'KeyK' })
    expect(screen.getByText(strings.settings.general.hotkeyNeedsModifier)).toBeTruthy()
    expect(api.settings.update).not.toHaveBeenCalled()
  })

  it('says when another program already uses the shortcut', () => {
    setState({ hotkeyFailed: true })
    render(<General />)
    expect(screen.getByRole('alert').textContent).toContain(strings.settings.general.hotkeyTaken)
  })

  it('does not warn when the shortcut works, or when it is off', () => {
    setState()
    const { unmount } = render(<General />)
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()
    setState({
      hotkeyFailed: true,
      settings: { ...DEFAULT_SETTINGS, hotkey: { ...DEFAULT_SETTINGS.hotkey, enabled: false } }
    })
    render(<General />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('switches auto-hide and manual hide', () => {
    setState()
    render(<General />)
    fireEvent.click(screen.getByRole('switch', { name: strings.settings.general.autoHide }))
    expect(api.settings.update).toHaveBeenCalledWith({ presentation: { autoHide: false } })
    fireEvent.click(screen.getByRole('switch', { name: strings.settings.general.hideNow }))
    expect(api.system.setWidgetHidden).toHaveBeenCalledWith(true)
  })
})

describe('panel: summary, urgency and empty states', () => {
  it('summarizes pending and urgent counts', () => {
    expect(strings.panel.summary(0, 0)).toBe('Todo al día')
    expect(strings.panel.summary(1, 0)).toBe('1 pendiente')
    expect(strings.panel.summary(4, 1)).toBe('4 pendientes · 1 urgente')
    expect(strings.panel.summary(5, 3)).toBe('5 pendientes · 3 urgentes')
  })

  it('does not say "all clear" when no account is connected', () => {
    setState()
    render(<Home />)
    expect(screen.getByText(strings.panel.noAccountsShort)).toBeTruthy()
    expect(screen.queryByText('Todo al día')).toBeNull()
  })

  it('shows the count in the header', () => {
    setState({
      accounts: accounts({ clickup: { status: 'connected', lastSyncAt: Date.now() } }),
      signals: [
        { ...task('1'), urgency: 0.9 },
        { ...task('2'), urgency: 0.3 }
      ]
    })
    render(<Home />)
    expect(screen.getByText('2 pendientes · 1 urgente')).toBeTruthy()
  })

  it('labels urgent items with text, not only a colored dot', () => {
    setState({
      signals: [
        { ...task('1'), urgency: 0.9 },
        { ...task('2'), urgency: 0.3 }
      ]
    })
    render(<Home />)
    expect(screen.getAllByText(strings.panel.urgent)).toHaveLength(1)
  })

  it('gives the icon actions of each item a name a screen reader can use', () => {
    setState({ signals: [task('1')] })
    render(<Home />)
    // The visible word is part of the accessible name, followed by which item it acts on.
    expect(screen.getByRole('button', { name: 'Posponer: Tarea 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Descartar: Tarea 1' })).toBeTruthy()
  })

  it('keeps the full title available when it is cut to two lines', () => {
    const long = 'Preparar la propuesta comercial completa para el cliente de Santiago'
    setState({ signals: [{ ...task('1'), title: long }] })
    render(<Home />)
    expect(screen.getByTitle(long)).toBeTruthy()
  })

  it('offers a button to connect accounts when none is connected', () => {
    setState()
    render(<Home />)
    fireEvent.click(screen.getByText(strings.panel.connectAccounts))
    expect(useAppStore.getState().view).toBe('settings')
    expect(useAppStore.getState().openSection).toBe('accounts')
  })

  it('has no connect button once an account is connected, just the all-clear message', () => {
    setState({ accounts: accounts({ clickup: { status: 'connected', lastSyncAt: Date.now() } }) })
    render(<Home />)
    expect(screen.getByText(strings.panel.empty)).toBeTruthy()
    expect(screen.queryByText(strings.panel.connectAccounts)).toBeNull()
  })

  it('puts select and refresh together in one toolbar, and select only when there is something', () => {
    setState({ accounts: accounts({ clickup: { status: 'connected', lastSyncAt: Date.now() } }) })
    const { unmount } = render(<Home />)
    expect(screen.queryByText(strings.panel.select)).toBeNull()
    unmount()
    setState({
      signals: [task('1')],
      accounts: accounts({ clickup: { status: 'connected', lastSyncAt: Date.now() } })
    })
    render(<Home />)
    const select = screen.getByText(strings.panel.select).closest('button')!
    const refresh = screen.getByTitle(strings.panel.refresh)
    expect(select.parentElement).toBe(refresh.parentElement)
  })
})

describe('panel: undo bar stays while it is being used', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('closes by itself after a few seconds', () => {
    setState({ signals: [task('1')] })
    render(<Home />)
    fireEvent.click(screen.getByTitle(strings.panel.dismiss))
    expect(screen.getByText('Descartado')).toBeTruthy()
    act(() => void vi.advanceTimersByTime(6100))
    expect(screen.queryByText('Descartado')).toBeNull()
  })

  it('waits while the pointer is on it and restarts the count when it leaves', () => {
    setState({ signals: [task('1')] })
    render(<Home />)
    fireEvent.click(screen.getByTitle(strings.panel.dismiss))
    const bar = screen.getByRole('status')
    fireEvent.mouseEnter(bar)
    act(() => void vi.advanceTimersByTime(20_000))
    expect(screen.getByText('Descartado')).toBeTruthy()
    fireEvent.mouseLeave(bar)
    act(() => void vi.advanceTimersByTime(3000))
    expect(screen.getByText('Descartado')).toBeTruthy()
    act(() => void vi.advanceTimersByTime(3200))
    expect(screen.queryByText('Descartado')).toBeNull()
  })

  it('a new toast after a held one still closes on its own', () => {
    setState({ signals: [task('1'), task('2')] })
    render(<Home />)
    fireEvent.click(screen.getAllByTitle(strings.panel.dismiss)[0])
    fireEvent.mouseEnter(screen.getByRole('status'))
    fireEvent.click(screen.getAllByTitle(strings.panel.dismiss)[0]) // new action while held
    act(() => void vi.advanceTimersByTime(6100))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('settings list', () => {
  it('shows an icon and a summary for every section', () => {
    setState({
      accounts: accounts({ clickup: { status: 'connected' }, gmail: { status: 'connected' } })
    })
    useAppStore.setState({ openSection: null })
    render(<Settings />)
    expect(screen.getByText('Popup flotante')).toBeTruthy()
    expect(screen.getByText('Tamaño 100 %')).toBeTruthy()
    expect(screen.getByText('2 de 4 conectadas')).toBeTruthy()
    expect(screen.getByText('09:00–18:00 · avisos activos')).toBeTruthy()
    expect(screen.getByText('Atajo Ctrl + Alt + P')).toBeTruthy()
    expect(screen.getByText(strings.settings.summary.ai)).toBeTruthy()
    expect(document.querySelectorAll('button svg').length).toBeGreaterThanOrEqual(7)
  })

  it('reflects the real settings', () => {
    setState({
      settings: {
        ...DEFAULT_SETTINGS,
        widget: { ...DEFAULT_SETTINGS.widget, mode: 'tab', side: 'left' },
        panel: { scale: 1.2 },
        hotkey: { ...DEFAULT_SETTINGS.hotkey, enabled: false },
        notifications: { ...DEFAULT_SETTINGS.notifications, enabled: false }
      }
    })
    useAppStore.setState({ openSection: null })
    render(<Settings />)
    expect(screen.getByText('Solapa vertical · izquierda')).toBeTruthy()
    expect(screen.getByText('Tamaño 120 %')).toBeTruthy()
    expect(screen.getByText('Atajo apagado')).toBeTruthy()
    expect(screen.getByText('09:00–18:00 · avisos apagados')).toBeTruthy()
    expect(screen.getByText('Ninguna conectada')).toBeTruthy()
  })
})

describe('settings: close the widget', () => {
  it('has a close button at the bottom of the settings list', () => {
    setState()
    useAppStore.setState({ openSection: null })
    render(<Settings />)
    expect(screen.getByText(strings.settings.quit.title)).toBeTruthy()
    expect(screen.getByText(strings.settings.quit.hint)).toBeTruthy()
  })

  it('asks once more before closing, and closes only after confirming', () => {
    setState()
    useAppStore.setState({ openSection: null })
    render(<Settings />)
    fireEvent.click(screen.getByText(strings.settings.quit.button))
    expect(api.system.quitApp).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(strings.settings.quit.confirm))
    expect(api.system.quitApp).toHaveBeenCalledTimes(1)
  })

  it('can be cancelled', () => {
    setState()
    useAppStore.setState({ openSection: null })
    render(<Settings />)
    fireEvent.click(screen.getByText(strings.settings.quit.button))
    fireEvent.click(screen.getByText(strings.settings.quit.cancel))
    expect(api.system.quitApp).not.toHaveBeenCalled()
    expect(screen.getByText(strings.settings.quit.button)).toBeTruthy()
  })

  it('is not shown inside a settings page', () => {
    setState()
    useAppStore.setState({ openSection: 'general' })
    render(<Settings />)
    expect(screen.queryByText(strings.settings.quit.title)).toBeNull()
  })
})

describe('panel: meetings by day', () => {
  const NOW = new Date(2026, 9, 29, 10, 0).getTime() // Thursday 29 Oct, 10:00
  beforeEach(() => vi.useFakeTimers({ now: NOW }))
  afterEach(() => vi.useRealTimers())

  const meet = (id: string, start: Date, minutes = 30): Signal => ({
    id: `calendar:${id}`,
    source: 'calendar',
    kind: 'meeting',
    title: id,
    url: 'https://calendar.google.com',
    occurredAt: start.getTime(),
    startsAt: start.getTime(),
    endsAt: start.getTime() + minutes * 60_000
  })

  it('has no day heading when every meeting is today', () => {
    setState({ signals: [meet('daily', new Date(2026, 9, 29, 11))] })
    render(<Home />)
    expect(screen.getByText('daily')).toBeTruthy()
    expect(screen.queryByText('Hoy')).toBeNull()
    expect(screen.getByText('en 1 h')).toBeTruthy() // relative time for today
  })

  it('groups by day with "Hoy", "Mañana" and the weekday after that', () => {
    setState({
      signals: [
        meet('today', new Date(2026, 9, 29, 15)),
        meet('tomorrow', new Date(2026, 9, 30, 9)),
        meet('later', new Date(2026, 10, 3, 9)) // Tuesday 3 Nov
      ]
    })
    render(<Home />)
    expect(screen.getByText('Hoy')).toBeTruthy()
    expect(screen.getByText('Mañana')).toBeTruthy()
    expect(screen.getByText(/martes,? 3 nov/i)).toBeTruthy()
  })

  it('the Unirse button is yellow for today and green for later days', () => {
    setState({
      signals: [
        { ...meet('today', new Date(2026, 9, 29, 15)), meetingUrl: 'https://meet.google.com/a' },
        { ...meet('tomorrow', new Date(2026, 9, 30, 9)), meetingUrl: 'https://meet.google.com/b' }
      ]
    })
    render(<Home />)
    const [first, second] = screen.getAllByText(strings.panel.join)
    expect(first.className).toContain('bg-cesa-meeting')
    expect(first.className).not.toContain('bg-cesa-green')
    expect(second.className).toContain('bg-cesa-green')
  })

  it('a meeting already running also gets the yellow button', () => {
    setState({
      signals: [
        { ...meet('running', new Date(2026, 9, 29, 9, 30), 60), meetingUrl: 'https://zoom.us/j/1' }
      ]
    })
    render(<Home />)
    expect(screen.getByText(strings.panel.join).className).toContain('bg-cesa-meeting')
  })

  it('shows until when a meeting on another day lasts, instead of "en N h"', () => {
    setState({ signals: [meet('tomorrow', new Date(2026, 9, 30, 9, 0), 90)] })
    render(<Home />)
    expect(screen.getByText('Mañana')).toBeTruthy() // heading even with a single day, as it is not today
    expect(screen.getByText(/hasta 10:30/)).toBeTruthy()
    expect(screen.queryByText(/^en \d+ h$/)).toBeNull()
  })

  it('a meeting already running counts as today', () => {
    setState({
      signals: [
        meet('running', new Date(2026, 9, 29, 9, 30), 60),
        meet('next', new Date(2026, 9, 30, 9))
      ]
    })
    render(<Home />)
    expect(screen.getByText('Hoy')).toBeTruthy()
    expect(screen.getByText('ahora')).toBeTruthy()
  })
})

describe('settings: how many days of meetings', () => {
  it('asks to connect Calendar first when it is not connected', () => {
    setState()
    render(<CalendarHorizon connected={false} />)
    expect(screen.getByText(strings.settings.watch.needCalendar)).toBeTruthy()
    expect(screen.queryByText('1 semana')).toBeNull()
  })

  it('shows the choices with the current one selected and says what it means', () => {
    setState()
    render(<CalendarHorizon connected />)
    for (const label of ['Hoy', '2 días', '3 días', '1 semana', '2 semanas']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('2 días').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Se muestran las reuniones de hoy y de mañana.')).toBeTruthy()
  })

  it('saves the choice', () => {
    setState()
    render(<CalendarHorizon connected />)
    fireEvent.click(screen.getByText('1 semana'))
    expect(api.settings.update).toHaveBeenCalledWith({ calendar: { daysAhead: 7 } })
  })

  it('describes a longer stretch', () => {
    setState({ settings: { ...DEFAULT_SETTINGS, calendar: { daysAhead: 14, show: 'all' } } })
    render(<CalendarHorizon connected />)
    expect(screen.getByText('Se muestran las reuniones de los próximos 14 días.')).toBeTruthy()
  })
})

describe('settings: the section formerly called "Qué vigilar"', () => {
  it('is called "Fuentes y filtros" in the list', () => {
    setState()
    useAppStore.setState({ openSection: null })
    render(<Settings />)
    expect(screen.getByText('Fuentes y filtros')).toBeTruthy()
    expect(screen.queryByText('Qué vigilar')).toBeNull()
  })
})

describe('meetings: dismiss, filter and trash', () => {
  const meeting: Signal = {
    id: 'calendar:m1',
    source: 'calendar',
    kind: 'meeting',
    title: 'Reunión de equipo',
    url: 'https://calendar.google.com',
    occurredAt: Date.now() + 3_600_000,
    startsAt: Date.now() + 3_600_000,
    endsAt: Date.now() + 7_200_000
  }

  it('a meeting has an X that dismisses it and offers to undo', () => {
    setState({ signals: [meeting] })
    render(<Home />)
    fireEvent.click(screen.getByLabelText(`${strings.panel.dismiss}: ${meeting.title}`))
    expect(api.items.act).toHaveBeenCalledWith({ ids: [meeting.id], action: 'dismiss' })
    expect(screen.getByText(strings.panel.dismissedToast(1))).toBeTruthy()
  })

  it('the calendar settings choose which events to show', () => {
    setState({ accounts: accounts({ calendar: { status: 'connected' } }) })
    render(<CalendarHorizon connected />)
    fireEvent.click(screen.getByText(strings.settings.watch.calendarShow.meets))
    expect(api.settings.update).toHaveBeenCalledWith({ calendar: { show: 'meets' } })
  })

  it('the trash lists what was dismissed and can restore or empty it', () => {
    setState({ trash: [task('1'), task('2')] })
    render(<Trash />)
    fireEvent.click(screen.getByLabelText(`${strings.settings.trash.restore}: Tarea 1`))
    expect(api.items.act).toHaveBeenCalledWith({ ids: ['clickup:1'], action: 'restore' })

    fireEvent.click(screen.getByText(strings.settings.trash.emptyAction))
    expect(api.items.act).toHaveBeenCalledTimes(1) // it asks first
    fireEvent.click(screen.getByText(strings.settings.trash.emptyConfirm(2)))
    expect(api.items.act).toHaveBeenLastCalledWith({
      ids: ['clickup:1', 'clickup:2'],
      action: 'purge'
    })
  })

  it('an empty trash says so', () => {
    setState()
    render(<Trash />)
    expect(screen.getByText(strings.settings.trash.empty)).toBeTruthy()
  })
})
