import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult } from '../shared/types'
import { setUpdateReady } from './appState'
import { logInfo, logWarn } from './logger'

// Updates come from the releases of the installers repository (see electron-builder.yml). A new
// version is downloaded in the background and never interrupts the user: it is applied when the
// user chooses to restart, or by itself the next time the widget closes.
const FIRST_CHECK_MS = 60_000 // let the widget finish starting first
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

let ready: string | null = null
let timer: NodeJS.Timeout | null = null

// "HTTP 404", "ENOTFOUND"…: what failed, without the response or any address.
function brief(error: unknown): string {
  const e = error as { statusCode?: number; code?: string; name?: string } | null
  if (e?.statusCode) return `HTTP ${e.statusCode}`
  return e?.code ?? e?.name ?? 'unknown error'
}

// Only an installed copy can update itself: the development one is not an installed app, and the
// demo mode has no real data to protect.
function canUpdate(): boolean {
  return app.isPackaged && process.env['WIDGET_FAKE_DATA'] !== '1'
}

async function check(): Promise<UpdateCheckResult> {
  if (!canUpdate()) return 'unavailable'
  if (ready) return 'ready'
  try {
    const result = await autoUpdater.checkForUpdates()
    return result?.isUpdateAvailable ? 'downloading' : 'latest'
  } catch {
    return 'error' // the failure is logged by the 'error' event below
  }
}

export function startUpdater(): void {
  if (!canUpdate() || timer) return
  autoUpdater.logger = null // the library's own log is not used; ours is redacted
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) =>
    logInfo('updater', `version ${info.version} found, downloading`)
  )
  autoUpdater.on('update-downloaded', (info) => {
    logInfo('updater', `version ${info.version} is ready to install`)
    ready = info.version
    setUpdateReady(info.version)
  })
  // No connection, or no release yet: not an error for the user, only a line in the log. Only the
  // kind of failure is written: the library's message carries the whole HTTP response.
  autoUpdater.on('error', (error) => logWarn('updater', `update check failed (${brief(error)})`))

  setTimeout(() => void check(), FIRST_CHECK_MS)
  timer = setInterval(() => void check(), CHECK_EVERY_MS)
}

export function stopUpdater(): void {
  if (timer) clearInterval(timer)
  timer = null
}

// "Buscar actualizaciones" in Ajustes.
export const checkForUpdatesNow = check

// Closes the widget, installs the new version without showing anything, and opens it again.
export function installUpdateNow(): void {
  if (ready) autoUpdater.quitAndInstall(true, true)
}
