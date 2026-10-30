import { describe, expect, it } from 'vitest'
import { drawerLayout, panelSizeFor, placePanel, tabRect } from '../src/main/geometry'
import { DEFAULT_PANEL, DEFAULT_SETTINGS, settingsSchema } from '../src/shared/settingsSchema'

const area = { x: 0, y: 0, width: 1920, height: 1032 } // a 1080 px screen without the taskbar
const usual = { width: 441, height: 651 }

describe('panel size on a screen', () => {
  it('keeps its usual size, never larger than the screen', () => {
    expect(panelSizeFor(usual, area, false)).toEqual(usual)
    expect(panelSizeFor({ width: 441, height: 2000 }, area, false).height).toBe(1032 - 16)
  })

  it('takes the whole usable height when asked, and keeps the width', () => {
    expect(panelSizeFor(usual, area, true)).toEqual({ width: 441, height: 1032 })
    expect(panelSizeFor({ width: 5000, height: 651 }, area, true).width).toBe(1920 - 16)
  })
})

describe('placing a full-height panel', () => {
  const full = panelSizeFor(usual, area, true)

  it('popup: it opens beside the widget, from the top to the bottom of the screen', () => {
    const badge = { x: 1784, y: 922, width: 56, height: 56 } // bottom-right corner
    const rect = placePanel(badge, full, area)
    expect(rect.y).toBe(0)
    expect(rect.height).toBe(1032)
    expect(rect.x + rect.width).toBeLessThanOrEqual(badge.x)
  })

  it('tab: the drawer is flush with the edge and as tall as the screen', () => {
    const tab = tabRect('right', 0.49, { width: 44, height: 120 }, area)
    const { panel, tab: riding } = drawerLayout('right', tab, full, area)
    expect(panel.y).toBe(0)
    expect(panel.height).toBe(1032)
    expect(panel.x + panel.width).toBe(area.x + area.width)
    // the tab rides on the panel's outer side and stays inside its height
    expect(riding.x).toBe(panel.x - tab.width)
    expect(riding.y).toBeGreaterThanOrEqual(panel.y)
    expect(riding.y + riding.height).toBeLessThanOrEqual(panel.y + panel.height)
  })
})

describe('the "toda la altura" setting of the panel', () => {
  it('is off by default and accepted by the settings', () => {
    expect(DEFAULT_PANEL.fullHeight).toBe(false)
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
  })

  it('settings saved before it existed get it off', () => {
    const old = { ...DEFAULT_SETTINGS, panel: { scale: 1.2 } }
    const merged = { ...old, panel: { ...DEFAULT_PANEL, ...old.panel } }
    expect(settingsSchema.parse(merged).panel).toEqual({ scale: 1.2, fullHeight: false })
  })
})
