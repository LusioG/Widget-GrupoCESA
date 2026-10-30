import { systemPreferences, type BrowserWindow } from 'electron'
import type { Rect } from '../geometry'

function prefersReducedMotion(): boolean {
  try {
    return systemPreferences.getAnimationSettings().prefersReducedMotion
  } catch {
    return false
  }
}

const FRAME_MS = 12
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

let timer: NodeJS.Timeout | null = null

export function stopSlide(): void {
  if (timer) clearInterval(timer)
  timer = null
}

// Moves a window to `to` over `ms`, easing out. Only one slide runs at a time.
export function slideWindow(win: BrowserWindow, to: Rect, ms: number): void {
  stopSlide()
  if (win.isDestroyed()) return
  const from = win.getBounds()
  // Windows "Show animations" turned off: jump straight to the end.
  if (ms <= 0 || prefersReducedMotion() || (from.x === to.x && from.y === to.y)) {
    win.setBounds(to)
    return
  }
  const startedAt = Date.now()
  timer = setInterval(() => {
    if (win.isDestroyed()) return stopSlide()
    const t = Math.min(1, (Date.now() - startedAt) / ms)
    const e = easeOutCubic(t)
    win.setBounds({
      x: Math.round(from.x + (to.x - from.x) * e),
      y: Math.round(from.y + (to.y - from.y) * e),
      width: to.width,
      height: to.height
    })
    if (t >= 1) stopSlide()
  }, FRAME_MS)
}
