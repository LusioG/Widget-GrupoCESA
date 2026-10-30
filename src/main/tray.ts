import { app, Menu, nativeImage, Tray } from 'electron'
import trayIcon from '../../resources/tray.png?asset'
import { strings } from '../shared/strings'
import {
  isManualFocus,
  isManualHidden,
  isPaused,
  setManualFocus,
  setManualHidden,
  setPaused
} from './appState'
import { openBriefing } from './briefing'
import { openPanel, togglePanel } from './windows/panel'

let tray: Tray | null = null

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: strings.tray.openPanel, click: () => openPanel() },
    { label: strings.tray.briefing, click: () => void openBriefing() },
    {
      label: strings.tray.pauseAlerts,
      type: 'checkbox',
      checked: isPaused(),
      click: (item) => setPaused(item.checked)
    },
    {
      label: strings.tray.focusMode,
      type: 'checkbox',
      checked: isManualFocus(),
      click: (item) => setManualFocus(item.checked)
    },
    {
      label: strings.tray.hideWidget,
      type: 'checkbox',
      checked: isManualHidden(),
      click: (item) => setManualHidden(item.checked)
    },
    { label: strings.tray.settings, click: () => openPanel('settings') },
    { type: 'separator' },
    { label: strings.tray.quit, click: () => app.quit() }
  ])
}

export function createTray(): Tray {
  const icon = nativeImage.createFromPath(trayIcon).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip(strings.tray.tooltip)
  tray.setContextMenu(buildMenu())
  tray.on('click', () => togglePanel())
  return tray
}

// Rebuild so the checkbox mirrors the real state (it can also change from elsewhere).
export function refreshTrayMenu(): void {
  tray?.setContextMenu(buildMenu())
}
