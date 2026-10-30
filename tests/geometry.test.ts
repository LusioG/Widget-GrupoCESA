import { describe, expect, it } from 'vitest'
import {
  clampToArea,
  defaultBadgePosition,
  isVisibleOnSomeDisplay,
  placePanel
} from '../src/main/geometry'

const screen1 = { x: 0, y: 0, width: 1920, height: 1040 }
const screen2 = { x: 1920, y: 0, width: 1280, height: 1000 }
const badge = { width: 48, height: 48 }

describe('isVisibleOnSomeDisplay', () => {
  it('accepts a rect on a connected display', () => {
    expect(isVisibleOnSomeDisplay({ x: 2000, y: 100, ...badge }, [screen1, screen2])).toBe(true)
  })

  it('rejects a rect left on a disconnected display', () => {
    expect(isVisibleOnSomeDisplay({ x: 2000, y: 100, ...badge }, [screen1])).toBe(false)
  })
})

describe('defaultBadgePosition', () => {
  it('sits in the bottom-right corner', () => {
    const r = defaultBadgePosition(screen1, badge)
    expect(r.x + r.width).toBeLessThanOrEqual(screen1.width)
    expect(r.y + r.height).toBeLessThanOrEqual(screen1.height)
    expect(r.x).toBeGreaterThan(screen1.width / 2)
  })
})

describe('placePanel', () => {
  const panel = { width: 360, height: 540 }

  it('opens to the left and upwards for a badge in the bottom-right corner', () => {
    const b = { x: 1850, y: 970, ...badge }
    const r = placePanel(b, panel, screen1)
    expect(r.x + r.width).toBeLessThanOrEqual(b.x)
    expect(r.y + r.height).toBe(b.y + b.height)
  })

  it('opens to the right for a badge on the left edge', () => {
    const b = { x: 0, y: 10, ...badge }
    const r = placePanel(b, panel, screen1)
    expect(r.x).toBeGreaterThanOrEqual(b.x + b.width)
    expect(r.y).toBe(10)
  })

  it('never leaves the work area', () => {
    const b = { x: 1000, y: 1000, ...badge }
    const r = placePanel(b, panel, screen1)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.width).toBeLessThanOrEqual(screen1.width)
    expect(r.y + r.height).toBeLessThanOrEqual(screen1.height)
  })
})

describe('clampToArea', () => {
  it('pulls an overflowing rect back inside', () => {
    const r = clampToArea({ x: 1900, y: -50, width: 100, height: 100 }, screen1)
    expect(r).toEqual({ x: 1820, y: 0, width: 100, height: 100 })
  })
})
