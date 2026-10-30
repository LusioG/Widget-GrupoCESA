import { app, BrowserWindow, session, WebPreferences } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { logError, logInfo, logWarn } from '../logger'

const secureWebPreferences: WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

// Each window gets its own (in-memory) session. Chromium stores the page zoom per origin, and in
// development both pages come from the same origin (localhost): with a shared session, changing
// the panel size also zoomed the widget, which then looked unscaled or cropped.
export function windowPreferences(partition: string): WebPreferences {
  const ses = session.fromPartition(partition)
  // These windows only show the app's own pages: browser permissions are always denied.
  ses.setPermissionRequestHandler((_contents, _permission, allow) => allow(false))
  ses.setPermissionCheckHandler(() => false)
  return { ...secureWebPreferences, partition }
}

let quitting = false
app.on('before-quit', () => {
  quitting = true
})

export function isQuitting(): boolean {
  return quitting
}

// Floating windows are hidden, never closed, except when the app quits.
export function keepAliveOnClose(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      win.hide()
    }
  })
}

// A crashed or failed page must never leave a blank window: log it and load the page again.
export function watchHealth(win: BrowserWindow, label: string): void {
  let loadRetries = 0
  const reload = (delayMs: number): void => {
    setTimeout(() => {
      if (!quitting && !win.isDestroyed()) win.webContents.reload()
    }, delayMs)
  }

  win.webContents.on('render-process-gone', (_event, details) => {
    logError('window', `${label}: renderer process gone (${details.reason}), reloading`)
    reload(500)
  })
  win.webContents.on('unresponsive', () => logWarn('window', `${label}: page is unresponsive`))
  win.webContents.on('responsive', () => logInfo('window', `${label}: page responds again`))
  win.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return // -3 = a load that was simply aborted
    logError('window', `${label}: page failed to load (${code} ${description})`)
    if (loadRetries < 3) {
      loadRetries += 1
      reload(1000 * loadRetries)
    }
  })
  win.webContents.on('did-finish-load', () => {
    loadRetries = 0
  })
}

// Other always-on-top windows (and the taskbar) can end up above ours after being used, so the
// widget re-asserts its place at the top every moment. This never takes the focus.
const RAISE_EVERY_MS = 1500

export function pinOnTop(win: BrowserWindow): void {
  win.setAlwaysOnTop(true, 'screen-saver')
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  const timer = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(timer)
      return
    }
    if (!win.isVisible()) return
    win.setAlwaysOnTop(true, 'screen-saver')
    win.moveTop()
  }, RAISE_EVERY_MS)
  win.on('closed', () => clearInterval(timer))
}

export function loadRenderer(win: BrowserWindow, page: 'badge' | 'panel'): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${page}.html`)
  }
  return win.loadFile(join(__dirname, `../renderer/${page}.html`))
}
