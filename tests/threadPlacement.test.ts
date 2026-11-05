import { describe, expect, it } from 'vitest'
import { placeThread, THREAD_SIZE } from '../src/main/windows/threadPlacement'

const screen = { x: 0, y: 0, width: 1920, height: 1040 }
const panelAt = (x: number, width: number): { x: number; y: number; width: number; height: number } => ({
  x,
  y: 100,
  width,
  height: 800
})

const overlaps = (
  a: { x: number; width: number },
  b: { x: number; width: number }
): boolean => a.x < b.x + b.width && b.x < a.x + a.width

describe('where the conversation window goes', () => {
  it('sits to the left of a panel docked at the right edge, clearly apart', () => {
    const panel = panelAt(1920 - 16 - 420, 420)
    const chat = placeThread(panel, screen)
    expect(chat.x + chat.width).toBeLessThanOrEqual(panel.x - 48)
    expect(chat.width).toBe(THREAD_SIZE.width)
    expect(overlaps(chat, panel)).toBe(false)
  })

  it('sits to the right of a panel docked at the left edge', () => {
    const panel = panelAt(16, 420)
    const chat = placeThread(panel, screen)
    expect(chat.x).toBeGreaterThanOrEqual(panel.x + panel.width + 48)
    expect(overlaps(chat, panel)).toBe(false)
  })

  it('keeps clear of the panel when the panel is made bigger, narrowing the chat if it must', () => {
    for (const width of [420, 600, 760, 1000, 1300]) {
      const panel = panelAt(1920 - 16 - width, width)
      const chat = placeThread(panel, screen)
      expect(overlaps(chat, panel), `panel ${width}`).toBe(false)
      expect(chat.width).toBeGreaterThanOrEqual(340)
      expect(chat.x).toBeGreaterThanOrEqual(0)
    }
  })

  it('narrows the chat on a small screen instead of covering the panel', () => {
    const small = { x: 0, y: 0, width: 1366, height: 728 }
    const panel = panelAt(1366 - 16 - 900, 900) // leaves less at its left than the chat needs
    const chat = placeThread(panel, small)
    expect(overlaps(chat, panel)).toBe(false)
    expect(chat.width).toBeLessThan(THREAD_SIZE.width)
    expect(chat.width).toBeGreaterThanOrEqual(340)
    expect(chat.height).toBeLessThanOrEqual(728 - 32)
  })

  it('goes in the middle when there is no panel, or no room beside it', () => {
    const alone = placeThread(null, screen)
    expect(alone.x).toBe(Math.round((1920 - THREAD_SIZE.width) / 2))
    const tiny = { x: 0, y: 0, width: 800, height: 600 }
    const crowded = placeThread(panelAt(100, 600), tiny)
    expect(crowded.x).toBe(Math.round((800 - THREAD_SIZE.width) / 2))
  })

  it('works on a second monitor with its own origin', () => {
    const second = { x: 1920, y: 0, width: 1920, height: 1040 }
    const panel = panelAt(1920 + 1920 - 16 - 420, 420)
    const chat = placeThread(panel, second)
    expect(chat.x).toBeGreaterThanOrEqual(second.x)
    expect(overlaps(chat, panel)).toBe(false)
  })
})
