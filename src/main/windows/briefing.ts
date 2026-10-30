import { BrowserWindow, screen } from 'electron'
import { IPC } from '../../shared/ipcChannels'
import type { Briefing } from '../../shared/types'
import { getSettings } from '../settingsStore'
import { briefingHeight, BRIEFING_MAX_HEIGHT } from './briefingHeight'
import { keepAliveOnClose, loadRenderer, watchHealth, windowPreferences } from './common'

// The daily summary opens in the middle of the screen, on the monitor where the pointer is.
const BASE = { width: 620, height: BRIEFING_MAX_HEIGHT }
const MARGIN = 16

let briefingWindow: BrowserWindow | null = null
// The height the page last asked for: the next time the window opens it starts there, so it does
// not flash tall and then shrink.
let contentHeight: number | null = null

// The window's height on this screen (see briefingHeight): its content, or the whole screen when
// the user chose that in Ajustes.
const heightFor = (area: Electron.Rectangle): number =>
  briefingHeight(contentHeight, area.height, getSettings().briefing.fullHeight)

export function getBriefingWindow(): BrowserWindow | null {
  return briefingWindow
}

export function createBriefingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...BASE,
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
    webPreferences: windowPreferences('widget-briefing')
  })
  keepAliveOnClose(win)
  watchHealth(win, 'briefing')
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault()
      closeBriefingWindow()
    }
  })
  win.on('closed', () => {
    briefingWindow = null
  })
  loadRenderer(win, 'briefing')
  briefingWindow = win
  return win
}

function centered(): Electron.Rectangle {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = Math.min(BASE.width, area.width - MARGIN * 2)
  const height = heightFor(area)
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height
  }
}

// `focus: false` is for the one that appears by itself: it must not take the keyboard from
// whatever the user is typing. When the user asked for it, it takes the focus.
export function showBriefingWindow(briefing: Briefing, options: { focus: boolean }): void {
  const win = briefingWindow
  if (!win || win.isDestroyed()) return
  win.setBounds(centered())
  win.webContents.send(IPC.briefingShown, briefing)
  if (options.focus) {
    win.show()
    win.focus()
  } else {
    win.showInactive()
  }
}

// The page tells how tall its content is, and the window follows (a lot of empty space under a
// short summary looked unfinished). With "toda la altura" on, it keeps the whole screen instead.
export function fitBriefingWindow(height: number): void {
  contentHeight = height
  applyBriefingLayout()
}

// Puts the window at the height it should have now, centered on its screen. Also used when the
// user changes the setting while the summary is open.
export function applyBriefingLayout(): void {
  const win = briefingWindow
  if (!win || win.isDestroyed()) return
  const area = screen.getDisplayMatching(win.getBounds()).workArea
  const height = heightFor(area)
  const { x, width } = win.getBounds()
  win.setBounds({ x, y: Math.round(area.y + (area.height - height) / 2), width, height })
}

export function closeBriefingWindow(): void {
  if (briefingWindow && briefingWindow.isVisible()) briefingWindow.hide()
}
