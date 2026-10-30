import { screen, type Display } from 'electron'
import {
  defaultBadgePosition,
  isVisibleOnSomeDisplay,
  stretchedTabRect,
  type Rect,
  type Size
} from './geometry'
import { getBadgePosition, getSettings, getTabDisplayId } from './settingsStore'
import { badgeSize, tabExtraPx, usualTabSize } from './windows/appearance'

// Saved popup position, validated against the monitors that are connected right now.
export function loadBadgeRect(size: Size): Rect {
  const workAreas = screen.getAllDisplays().map((d) => d.workArea)
  const saved = getBadgePosition()
  if (saved) {
    const rect = { x: Math.round(saved.x), y: Math.round(saved.y), ...size }
    if (isVisibleOnSomeDisplay(rect, workAreas)) return rect
  }
  return defaultBadgePosition(screen.getPrimaryDisplay().workArea, size)
}

// The monitor the tab is docked to; falls back to the primary one if it was unplugged.
export function tabDisplay(): Display {
  const id = getTabDisplayId()
  return screen.getAllDisplays().find((d) => d.id === id) ?? screen.getPrimaryDisplay()
}

// The tab docked at its screen edge (panel closed), with the extra rows it is showing.
export function closedTabRect(): Rect {
  const { side, tabPos } = getSettings().widget
  return stretchedTabRect(side, tabPos, usualTabSize(), tabExtraPx(), tabDisplay().workArea)
}

// Where the floating widget belongs right now, according to its mode.
export function widgetRect(): Rect {
  return getSettings().widget.mode === 'tab' ? closedTabRect() : loadBadgeRect(badgeSize())
}
