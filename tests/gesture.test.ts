import { describe, expect, it } from 'vitest'
import { DRAG_SLOP_DIP, Gesture } from '../src/main/gesture'

describe('Gesture (click vs drag)', () => {
  it('a press and release without moving is a click', () => {
    const g = new Gesture()
    g.press({ x: 100, y: 100 })
    expect(g.release()).toBe('click')
  })

  it('hand jitter below the slop is still a click', () => {
    const g = new Gesture()
    g.press({ x: 100, y: 100 })
    for (const p of [
      { x: 101, y: 100 },
      { x: 103, y: 102 },
      { x: 104, y: 103 },
      { x: 102, y: 101 }
    ]) {
      expect(g.move(p)).toBeNull()
    }
    expect(g.release()).toBe('click')
  })

  it('the slop is generous enough for a normal click (about 6 DIP)', () => {
    expect(DRAG_SLOP_DIP).toBeGreaterThanOrEqual(6)
    const g = new Gesture()
    g.press({ x: 0, y: 0 })
    expect(g.move({ x: 4, y: 4 })).toBeNull() // ~5.7 px of wobble
  })

  it('moving past the slop starts a drag, reported once as "started"', () => {
    const g = new Gesture()
    g.press({ x: 100, y: 100 })
    expect(g.move({ x: 120, y: 100 })).toEqual({ dx: 20, dy: 0, started: true })
    expect(g.move({ x: 140, y: 110 })).toEqual({ dx: 40, dy: 10, started: false })
    expect(g.release()).toBe('drag')
  })

  it('once dragging, coming back near the start is still a drag (never a click)', () => {
    const g = new Gesture()
    g.press({ x: 100, y: 100 })
    g.move({ x: 160, y: 100 })
    expect(g.move({ x: 101, y: 100 })).toEqual({ dx: 1, dy: 0, started: false })
    expect(g.release()).toBe('drag')
  })

  it('a long press without movement is still a click', () => {
    const g = new Gesture()
    g.press({ x: 5, y: 5 })
    for (let i = 0; i < 200; i++) g.move({ x: 5, y: 5 })
    expect(g.release()).toBe('click')
  })

  it('moves without a press are ignored; a release without a press does nothing', () => {
    const g = new Gesture()
    expect(g.move({ x: 50, y: 50 })).toBeNull()
    expect(g.release()).toBe('none')
  })

  it('can be reused: each press starts fresh', () => {
    const g = new Gesture()
    g.press({ x: 0, y: 0 })
    g.move({ x: 50, y: 0 })
    expect(g.release()).toBe('drag')
    g.press({ x: 200, y: 200 })
    expect(g.move({ x: 202, y: 200 })).toBeNull()
    expect(g.release()).toBe('click')
  })

  it('cancel ends the gesture without producing a click', () => {
    const g = new Gesture()
    g.press({ x: 0, y: 0 })
    expect(g.cancel()).toBe('none')
    expect(g.release()).toBe('none')
    g.press({ x: 0, y: 0 })
    g.move({ x: 30, y: 0 })
    expect(g.cancel()).toBe('drag')
    expect(g.active).toBe(false)
  })

  it('reports activity', () => {
    const g = new Gesture()
    expect(g.active).toBe(false)
    g.press({ x: 0, y: 0 })
    expect(g.active).toBe(true)
    expect(g.isDragging).toBe(false)
    g.move({ x: 40, y: 0 })
    expect(g.isDragging).toBe(true)
  })
})
