import { describe, expect, it } from 'vitest'
import { RESUME_WINDOW_MS, shouldResume } from '../src/main/panelResume'

describe('shouldResume (keep the page and typed text after the panel is hidden)', () => {
  const now = 1_800_000_000_000

  it('never resumes the very first time', () => {
    expect(shouldResume(0, now)).toBe(false)
  })

  it('resumes when it was hidden a moment ago', () => {
    expect(shouldResume(now - 5_000, now)).toBe(true)
    expect(shouldResume(now - 60_000, now)).toBe(true)
  })

  it('starts from the home page again after a longer break', () => {
    expect(shouldResume(now - RESUME_WINDOW_MS - 1, now)).toBe(false)
    expect(shouldResume(now - 60 * 60_000, now)).toBe(false)
  })

  it('the window is generous enough to copy a value from another app (minutes, not seconds)', () => {
    expect(RESUME_WINDOW_MS).toBeGreaterThanOrEqual(5 * 60_000)
  })
})
