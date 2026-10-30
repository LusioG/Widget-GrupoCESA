import { getSettings } from '../settingsStore'
import { getBadgeWindow } from './badge'
import { getBriefingWindow } from './briefing'
import { getPanelWindow } from './panel'

// Windows can exclude a window from screen capture (Meet, Zoom, Teams, OBS...): you still see it,
// the people you share with do not. Applied to every window; cheap to call on every change.
export function applyCaptureProtection(): void {
  const protect = getSettings().presentation.hideFromCapture
  for (const win of [getBadgeWindow(), getPanelWindow(), getBriefingWindow()]) {
    if (win && !win.isDestroyed()) win.setContentProtection(protect)
  }
}
