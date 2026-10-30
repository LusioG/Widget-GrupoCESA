import { describe, expect, it } from 'vitest'
import { drawerLayout, snapTab, stretchedTabRect, tabRect, usualTabPos } from '../src/main/geometry'

const area = { x: 0, y: 0, width: 1536, height: 816 }
const second = { x: 1536, y: 0, width: 1280, height: 1000 }
const tab = { width: 44, height: 120 }
const panel = { width: 420, height: 620 }

describe('tabRect', () => {
  it('sits flush against the right edge', () => {
    const r = tabRect('right', 0.5, tab, area)
    expect(r.x + r.width).toBe(area.width)
    expect(r).toMatchObject({ width: 44, height: 120 })
  })

  it('sits flush against the left edge', () => {
    expect(tabRect('left', 0.5, tab, area).x).toBe(0)
  })

  it('pos 0 is the top and pos 1 is the bottom, always on screen', () => {
    expect(tabRect('right', 0, tab, area).y).toBe(0)
    expect(tabRect('right', 1, tab, area).y + tab.height).toBe(area.height)
    expect(tabRect('right', 5, tab, area).y + tab.height).toBe(area.height) // out of range is clamped
    expect(tabRect('right', -3, tab, area).y).toBe(0)
  })

  it('respects the work area offset of another monitor', () => {
    const r = tabRect('left', 0, tab, second)
    expect(r.x).toBe(1536)
    const right = tabRect('right', 1, tab, second)
    expect(right.x + right.width).toBe(1536 + 1280)
    expect(right.y + right.height).toBe(1000)
  })

  it('does not break when the screen is shorter than the tab', () => {
    expect(tabRect('right', 0.5, tab, { x: 0, y: 0, width: 800, height: 100 }).y).toBe(0)
  })
})

describe('snapTab', () => {
  it('sticks to the nearest edge by the center of the tab', () => {
    expect(snapTab({ x: 300, y: 100, ...tab }, area).side).toBe('left')
    expect(snapTab({ x: 1000, y: 100, ...tab }, area).side).toBe('right')
  })

  it('keeps the vertical position as a 0..1 fraction of the travel', () => {
    const travel = area.height - tab.height
    expect(snapTab({ x: 0, y: 0, ...tab }, area).pos).toBe(0)
    expect(snapTab({ x: 0, y: travel, ...tab }, area).pos).toBe(1)
    expect(snapTab({ x: 0, y: travel / 4, ...tab }, area).pos).toBeCloseTo(0.25)
  })

  it('clamps a tab dropped partly off screen', () => {
    expect(snapTab({ x: 0, y: -50, ...tab }, area).pos).toBe(0)
    expect(snapTab({ x: 0, y: 5000, ...tab }, area).pos).toBe(1)
  })

  it('round-trips with tabRect', () => {
    const dropped = { x: 1400, y: 333, ...tab }
    const { side, pos } = snapTab(dropped, area)
    const docked = tabRect(side, pos, tab, area)
    expect(docked.y).toBe(333)
    expect(docked.x + docked.width).toBe(area.width)
  })
})

describe('drawerLayout (tab mode)', () => {
  const closed = (side: 'left' | 'right', pos = 0.5, a = area): ReturnType<typeof tabRect> =>
    tabRect(side, pos, tab, a)

  it('right edge: the panel is flush with the screen edge and the tab rides on its outer side', () => {
    const l = drawerLayout('right', closed('right'), panel, area)
    expect(l.panel.x + l.panel.width).toBe(area.width) // flush with the screen edge
    expect(l.tab.x + l.tab.width).toBe(l.panel.x) // tab touches the panel's outer edge
  })

  it('left edge: panel flush with the left edge, tab on its right side', () => {
    const l = drawerLayout('left', closed('left'), panel, area)
    expect(l.panel.x).toBe(0)
    expect(l.tab.x).toBe(l.panel.x + l.panel.width)
  })

  it('the tab keeps its own height and size while it moves sideways', () => {
    const c = closed('left', 0.3)
    const l = drawerLayout('left', c, panel, area)
    expect(l.tab.y).toBe(c.y)
    expect(l.tab).toMatchObject({ width: tab.width, height: tab.height })
  })

  it('the panel is centered on the tab when there is room', () => {
    const big = { x: 0, y: 0, width: 1536, height: 1400 }
    const c = closed('right', 0.5, big)
    const l = drawerLayout('right', c, panel, big)
    expect(l.panel.y + l.panel.height / 2).toBeCloseTo(c.y + c.height / 2)
  })

  it('the panel never leaves the screen, even with the tab at the very top or bottom', () => {
    for (const pos of [0, 1]) {
      const l = drawerLayout('right', closed('right', pos), panel, area)
      expect(l.panel.y).toBeGreaterThanOrEqual(0)
      expect(l.panel.y + l.panel.height).toBeLessThanOrEqual(area.height)
      // and the tab stays inside the panel's vertical span, so they visibly connect
      expect(l.tab.y).toBeGreaterThanOrEqual(l.panel.y)
      expect(l.tab.y + l.tab.height).toBeLessThanOrEqual(l.panel.y + l.panel.height)
    }
  })

  it('a tab stretched by extra circles at the bottom still sits fully beside the panel, clear of its corners', () => {
    const stretched = stretchedTabRect('right', 1, tab, 64, area)
    const l = drawerLayout('right', stretched, panel, area)
    expect(l.tab.height).toBe(stretched.height)
    expect(l.tab.y).toBeGreaterThan(l.panel.y)
    expect(l.tab.y + l.tab.height).toBeLessThan(l.panel.y + l.panel.height)
  })

  it('panel plus tab always fit on a narrow screen', () => {
    const narrow = { x: 0, y: 0, width: 400, height: 816 }
    const l = drawerLayout('left', closed('left', 0.5, narrow), panel, narrow)
    expect(l.tab.x + l.tab.width).toBeLessThanOrEqual(narrow.width)
    expect(l.panel.width).toBe(narrow.width - tab.width)
  })

  it('stays on the same monitor as the tab', () => {
    const l = drawerLayout('left', closed('left', 0.3, second), panel, second)
    expect(l.panel.x).toBe(second.x)
    expect(l.tab.x + l.tab.width).toBeLessThanOrEqual(second.x + second.width)
  })
})

describe('stretchedTabRect', () => {
  it('is the usual tab when there are no extra rows', () => {
    expect(stretchedTabRect('right', 0.5, tab, 0, area)).toEqual(tabRect('right', 0.5, tab, area))
  })

  it('keeps its top (so the logo does not move) and grows downward', () => {
    const usual = tabRect('right', 0.5, tab, area)
    const r = stretchedTabRect('right', 0.5, tab, 64, area)
    expect(r.height).toBe(184)
    expect(r.y).toBe(usual.y)
    expect(r.x).toBe(usual.x)
  })

  it('moves up only as far as needed to stay on screen at the bottom', () => {
    const r = stretchedTabRect('right', 1, tab, 64, area)
    expect(r.y + r.height).toBe(area.y + area.height)
    expect(r.y).toBeGreaterThanOrEqual(area.y)
  })

  it('stays on screen at the top', () => {
    const r = stretchedTabRect('left', 0, tab, 64, area)
    expect(r.y).toBe(area.y)
    expect(r.height).toBe(184)
  })

  it('saves the usual position after a drag, not the stretched one', () => {
    for (const pos of [0.2, 0.5, 0.8]) {
      const stretched = stretchedTabRect('right', pos, tab, 64, area)
      expect(usualTabPos(stretched, tab.height, area)).toBeCloseTo(pos, 2) // whole pixels
    }
  })
})
