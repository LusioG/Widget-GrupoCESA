import { powerMonitor, screen } from 'electron'
import { restartRealtimeConnectors } from './accounts'
import { checkBriefing } from './briefing'
import { logInfo } from './logger'
import { syncAll } from './scheduler'
import { applyLayout } from './windows/apply'

const NETWORK_SETTLE_MS = 3000 // the network is not ready the instant the PC wakes
const DISPLAY_DEBOUNCE_MS = 600 // plugging a monitor fires several events in a row

let wakeTimer: NodeJS.Timeout | null = null
let displayTimer: NodeJS.Timeout | null = null

// Waking from sleep: check every account again and re-open dead connections.
function onWake(reason: string): void {
  logInfo('system', `${reason}: refreshing accounts`)
  if (wakeTimer) clearTimeout(wakeTimer)
  wakeTimer = setTimeout(() => {
    syncAll()
    void restartRealtimeConnectors()
    applyLayout() // monitors may have changed while it slept
    // A PC that only sleeps may wake on a new day: the daily summary can be due now.
    void checkBriefing()
  }, NETWORK_SETTLE_MS)
}

// A monitor was plugged, unplugged or changed resolution: keep the widget on a visible screen.
function onDisplayChange(): void {
  if (displayTimer) clearTimeout(displayTimer)
  displayTimer = setTimeout(() => {
    logInfo('system', 'display configuration changed: re-applying layout')
    applyLayout()
  }, DISPLAY_DEBOUNCE_MS)
}

export function registerSystemEvents(): void {
  powerMonitor.on('resume', () => onWake('resume from sleep'))
  powerMonitor.on('unlock-screen', () => onWake('screen unlocked'))
  screen.on('display-added', onDisplayChange)
  screen.on('display-removed', onDisplayChange)
  screen.on('display-metrics-changed', onDisplayChange)
}
