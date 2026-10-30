import { spawn, type ChildProcess } from 'node:child_process'
import { onStateChange, setPresenting } from './appState'
import { logInfo, logWarn } from './logger'
import { isHidingState, PRESENCE_SCRIPT_ENCODED } from './presenceScript'
import { getSettings } from './settingsStore'
import { applyLayout } from './windows/apply'
import { getBadgeWindow } from './windows/badge'
import { applyCaptureProtection } from './windows/capture'
import { closePanel } from './windows/panel'

let watcher: ChildProcess | null = null
// If the watcher cannot run (PowerShell blocked, say) it is not restarted in a tight loop.
const RESTART_AFTER_MS = 60_000
let retryAt = 0

function stopWatching(): void {
  watcher?.kill()
  watcher = null
  setPresenting(false)
}

function startWatching(): void {
  if (watcher || process.platform !== 'win32' || Date.now() < retryAt) return
  retryAt = Date.now() + RESTART_AFTER_MS
  try {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        PRESENCE_SCRIPT_ENCODED
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    )
    watcher = child
    let buffer = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const state = Number(line.trim())
        if (Number.isInteger(state) && state > 0) setPresenting(isHidingState(state))
      }
    })
    child.on('error', (error) => {
      logWarn('presence', 'could not watch full-screen state', error)
      watcher = null
    })
    child.on('exit', () => {
      if (watcher === child) watcher = null
      setPresenting(false)
    })
    logInfo('presence', 'watching for full-screen apps and presentations')
  } catch (error) {
    logWarn('presence', 'could not start the full-screen watcher', error)
  }
}

// Shows or hides the floating widget from the state: hidden by hand or while presenting.
let shown = true
function applyVisibility(hide: boolean): void {
  const badge = getBadgeWindow()
  if (!badge || badge.isDestroyed() || shown === !hide) return
  shown = !hide
  if (hide) {
    closePanel({ instant: true })
    badge.hide()
  } else {
    applyLayout() // a tab that was riding out with the panel goes back to its edge
    badge.showInactive()
  }
}

// Starts following the settings and the state. Call once, after the windows exist.
export function startPresence(): void {
  const sync = (): void => {
    if (getSettings().presentation.autoHide) startWatching()
    else stopWatching()
    applyCaptureProtection()
  }
  sync()
  onStateChange((state) => {
    sync()
    applyVisibility(state.widgetHidden || state.presenting)
  })
}

export function stopPresence(): void {
  watcher?.kill()
  watcher = null
}
