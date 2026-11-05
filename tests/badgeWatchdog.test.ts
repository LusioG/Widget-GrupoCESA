import { describe, expect, it } from 'vitest'
import { RESCUE_AFTER_START_MS, shouldRescueBadge } from '../src/main/badgeWatchdog'

describe('the widget must not stay out of sight', () => {
  const lost = { visible: false, hiddenOnPurpose: false, sinceStartMs: RESCUE_AFTER_START_MS }

  it('is shown again when it is not on screen and nobody hid it', () => {
    expect(shouldRescueBadge(lost)).toBe(true)
  })

  it('leaves it alone when it is visible', () => {
    expect(shouldRescueBadge({ ...lost, visible: true })).toBe(false)
  })

  it('respects hiding it by hand and hiding it while presenting', () => {
    expect(shouldRescueBadge({ ...lost, hiddenOnPurpose: true })).toBe(false)
  })

  it('waits for the page to load at startup, so a blank window does not flash', () => {
    expect(shouldRescueBadge({ ...lost, sinceStartMs: 1_000 })).toBe(false)
    expect(shouldRescueBadge({ ...lost, sinceStartMs: RESCUE_AFTER_START_MS - 1 })).toBe(false)
  })
})
