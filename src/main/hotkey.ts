import { globalShortcut } from 'electron'
import { setHotkeyFailed } from './appState'
import { logInfo, logWarn } from './logger'
import { getSettings } from './settingsStore'
import { togglePanel } from './windows/panel'

let registered: string | null = null

function unregister(): void {
  if (registered) globalShortcut.unregister(registered)
  registered = null
}

// (Re)registers the shortcut from the settings. If another program already owns the combination
// Windows refuses it: the widget keeps working and the settings page says so.
export function applyHotkey(): void {
  unregister()
  const { enabled, accelerator } = getSettings().hotkey
  if (!enabled) {
    setHotkeyFailed(false)
    return
  }
  let ok = false
  try {
    ok = globalShortcut.register(accelerator, () => togglePanel())
  } catch (error) {
    logWarn('hotkey', 'could not register the shortcut', error)
  }
  if (ok) {
    registered = accelerator
    logInfo('hotkey', `shortcut ${accelerator} registered`)
  } else {
    logWarn('hotkey', `shortcut ${accelerator} is unavailable (used by another program?)`)
  }
  setHotkeyFailed(!ok)
}

export function releaseHotkey(): void {
  unregister()
}
