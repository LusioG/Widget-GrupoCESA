import { screen } from 'electron'
import { clampToArea } from '../geometry'
import { getSettings } from '../settingsStore'
import { closedTabRect, loadBadgeRect } from '../windowState'
import { badgeSize, styleWindow } from './appearance'
import { getBadgeWindow } from './badge'
import { getPanelWindow, isPanelOpen, repositionPanel } from './panel'

// Re-applies mode, position, size and transparency to both windows after the user changes them.
export function applyLayout(): void {
  const badge = getBadgeWindow()
  if (badge) {
    const { mode } = getSettings().widget
    const size = badgeSize()
    const old = badge.getBounds()
    // A tab is much taller than wide; a popup is square.
    const wasTab = old.height > old.width * 1.5

    if (mode === 'tab') {
      badge.setBounds(closedTabRect())
    } else if (wasTab) {
      badge.setBounds(loadBadgeRect(size)) // coming back from tab mode: use the saved popup spot
    } else {
      // Resizing a popup: grow/shrink around its center so it does not jump, and keep it on screen.
      const area = screen.getDisplayMatching(old).workArea
      badge.setBounds(
        clampToArea(
          {
            x: Math.round(old.x + old.width / 2 - size.width / 2),
            y: Math.round(old.y + old.height / 2 - size.height / 2),
            ...size
          },
          area
        )
      )
    }
    styleWindow(badge, 'widget')
  }

  const panel = getPanelWindow()
  if (panel) {
    styleWindow(panel, 'panel')
    if (isPanelOpen()) repositionPanel()
  }
}
