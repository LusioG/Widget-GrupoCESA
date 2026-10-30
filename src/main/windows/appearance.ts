import type { BrowserWindow } from 'electron'
import type { Size } from '../geometry'
import { getSettings } from '../settingsStore'

// Base sizes at scale 1.0. The widget and panel scales (Ajustes) multiply them independently,
// and the page zoom keeps each window's content proportional to its size.
export const POPUP_BASE: Size = { width: 56, height: 56 }
export const TAB_BASE: Size = { width: 44, height: 120 }
export const PANEL_BASE: Size = { width: 420, height: 620 }

export function scaled(base: Size, scale: number): Size {
  return { width: Math.round(base.width * scale), height: Math.round(base.height * scale) }
}

// The floating widget is a small round popup (resizable) or a vertical tab (fixed size).
export function widgetScale(): number {
  const { mode, scale } = getSettings().widget
  return mode === 'tab' ? 1 : scale
}

// Height of one extra row of the vertical tab: a 24 px circle and the gap above it.
export const TAB_ROW = 32
let tabRows = 0

export function getTabRows(): number {
  return tabRows
}

export function setTabRows(rows: number): void {
  tabRows = rows
}

// Extra height the tab has right now, because of the circles it shows.
export function tabExtraPx(): number {
  return tabRows * TAB_ROW
}

export function badgeSize(): Size {
  const { mode } = getSettings().widget
  if (mode === 'tab') return { width: TAB_BASE.width, height: TAB_BASE.height + tabExtraPx() }
  return scaled(POPUP_BASE, widgetScale())
}

// The vertical tab without its extra rows.
export function usualTabSize(): Size {
  return TAB_BASE
}

export function panelSize(): Size {
  return scaled(PANEL_BASE, getSettings().panel.scale)
}

// Applies zoom (and, for the widget, transparency) from the settings to one window.
export function styleWindow(win: BrowserWindow, kind: 'widget' | 'panel'): void {
  if (win.isDestroyed()) return
  const { widget, panel } = getSettings()
  win.webContents.setZoomFactor(kind === 'widget' ? widgetScale() : panel.scale)
  win.setOpacity(kind === 'widget' ? widget.opacity : 1)
}
