import { BrowserWindow, screen } from 'electron'
import { IPC } from '../../shared/ipcChannels'
import type { PanelView } from '../../shared/types'
import { markPanelSeen } from '../appState'
import { drawerLayout, placePanel } from '../geometry'
import { shouldResume } from '../panelResume'
import { refreshStale } from '../scheduler'
import { getSettings } from '../settingsStore'
import { closedTabRect, tabDisplay } from '../windowState'
import { slideWindow, stopSlide } from './animate'
import { panelSize, styleWindow } from './appearance'
import { getBadgeWindow } from './badge'
import { keepAliveOnClose, loadRenderer, pinOnTop, watchHealth, windowPreferences } from './common'

// Pressing the tray icon takes the focus from the panel (hiding it) just before the click is
// delivered; without this guard the same click would immediately reopen it.
const REOPEN_GUARD_MS = 250
// In tab mode the panel is a drawer: the tab slides out with it and back when it closes.
const OPEN_MS = 280
const CLOSE_MS = 220
// Opening the panel re-checks any account not checked in the last 30 s.
const STALE_AFTER_MS = 30_000

let panelWindow: BrowserWindow | null = null
let lastBlurHideAt = 0
let lastHiddenAt = 0
let closing = false
let closeTimer: NodeJS.Timeout | null = null

export function getPanelWindow(): BrowserWindow | null {
  return panelWindow
}

function notifyOpen(open: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.panelOpenChanged, open)
  }
}

export function createPanelWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...panelSize(),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: windowPreferences('widget-panel')
  })
  pinOnTop(win)
  keepAliveOnClose(win)
  watchHealth(win, 'panel')
  win.webContents.on('did-finish-load', () => styleWindow(win, 'panel'))

  win.on('blur', () => {
    if (win.isVisible() && !closing) {
      lastBlurHideAt = Date.now()
      closePanel()
    }
  })
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault()
      closePanel()
    }
  })
  win.on('closed', () => {
    panelWindow = null
  })

  loadRenderer(win, 'panel')
  panelWindow = win
  return win
}

// Open and not on its way out.
export function isPanelOpen(): boolean {
  return !!panelWindow && panelWindow.isVisible() && !closing
}

// Panel size for the screen it opens on: never larger than the work area.
function fittedPanel(area: { width: number; height: number }): { width: number; height: number } {
  const size = panelSize()
  return {
    width: Math.min(size.width, area.width - 16),
    height: Math.min(size.height, area.height - 16)
  }
}

// Tab mode: where the panel and the tab sit while the drawer is open.
function drawer(): ReturnType<typeof drawerLayout> {
  const area = tabDisplay().workArea
  return drawerLayout(getSettings().widget.side, closedTabRect(), fittedPanel(area), area)
}

// Places the open panel without animation (also used when a setting changes while it is open).
export function repositionPanel(): void {
  const win = panelWindow
  const badge = getBadgeWindow()
  if (!win || !badge) return
  if (getSettings().widget.mode === 'tab') {
    const layout = drawer()
    stopSlide()
    win.setBounds(layout.panel)
    badge.setBounds(layout.tab)
    return
  }
  const badgeBounds = badge.getBounds()
  const area = screen.getDisplayMatching(badgeBounds).workArea
  win.setBounds(placePanel(badgeBounds, fittedPanel(area), area))
}

// `view` forces a page (e.g. Ajustes from the tray). Without it the panel resumes where it was
// left if it was hidden recently, so clicking elsewhere does not throw away what you were typing.
export function openPanel(view?: PanelView): void {
  const win = panelWindow
  const badge = getBadgeWindow()
  if (!win) return
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
  closing = false

  if (getSettings().widget.mode === 'tab' && badge) {
    const layout = drawer()
    win.setBounds(layout.panel)
    slideWindow(badge, layout.tab, OPEN_MS) // the tab rides out on the panel's outer edge
  } else {
    repositionPanel()
  }
  const target = view ?? (shouldResume(lastHiddenAt, Date.now()) ? undefined : 'home')
  if (target) win.webContents.send(IPC.navigate, target)
  notifyOpen(true)
  win.show()
  win.focus()
  refreshStale(STALE_AFTER_MS) // what the panel shows is never older than this
  markPanelSeen() // what it shows is no longer "new"
}

function finishClose(): void {
  closeTimer = null
  closing = false
  lastHiddenAt = Date.now()
  panelWindow?.hide()
  markPanelSeen() // anything that arrived while it was open was seen
}

// `instant` hides it at once and leaves the tab where it is (used when the user grabs the tab).
export function closePanel(options: { instant?: boolean } = {}): void {
  const win = panelWindow
  if (!win || !win.isVisible() || (closing && !options.instant)) return
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null

  notifyOpen(false)
  const badge = getBadgeWindow()
  if (options.instant || !badge || getSettings().widget.mode !== 'tab') {
    stopSlide()
    finishClose()
    return
  }
  closing = true
  slideWindow(badge, closedTabRect(), CLOSE_MS) // the tab slides back to the screen edge
  closeTimer = setTimeout(finishClose, CLOSE_MS + 20)
}

// `pressedAt` is when the click started; see REOPEN_GUARD_MS.
export function togglePanel(pressedAt: number = Date.now()): void {
  if (isPanelOpen()) {
    closePanel()
  } else if (pressedAt - lastBlurHideAt > REOPEN_GUARD_MS) {
    openPanel()
  }
}
