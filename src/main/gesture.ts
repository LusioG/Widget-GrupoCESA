export type Point = { x: number; y: number }

// Movement smaller than this while the button is down is hand jitter, not a drag (in DIP).
export const DRAG_SLOP_DIP = 6

// Tells a click from a drag on the floating widget, from the real cursor position.
export class Gesture {
  private start: Point | null = null
  private dragging = false

  get active(): boolean {
    return this.start !== null
  }

  get isDragging(): boolean {
    return this.dragging
  }

  press(at: Point): void {
    this.start = at
    this.dragging = false
  }

  // Offset from where the button went down, once the movement counts as a drag; otherwise null.
  // `started` is true on the first move that crosses the slop.
  move(at: Point): { dx: number; dy: number; started: boolean } | null {
    if (!this.start) return null
    const dx = at.x - this.start.x
    const dy = at.y - this.start.y
    if (!this.dragging) {
      if (Math.hypot(dx, dy) < DRAG_SLOP_DIP) return null
      this.dragging = true
      return { dx, dy, started: true }
    }
    return { dx, dy, started: false }
  }

  // Ends the gesture. A press that never crossed the slop is a click, however long it lasted.
  release(): 'click' | 'drag' | 'none' {
    const wasActive = this.start !== null
    const wasDragging = this.dragging
    this.start = null
    this.dragging = false
    if (!wasActive) return 'none'
    return wasDragging ? 'drag' : 'click'
  }

  cancel(): 'drag' | 'none' {
    const wasDragging = this.dragging
    this.start = null
    this.dragging = false
    return wasDragging ? 'drag' : 'none'
  }
}
