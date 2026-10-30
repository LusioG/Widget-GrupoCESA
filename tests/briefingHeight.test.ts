import { describe, expect, it } from 'vitest'
import {
  BRIEFING_MAX_HEIGHT,
  BRIEFING_MIN_HEIGHT,
  briefingHeight
} from '../src/main/windows/briefingHeight'
import { DEFAULT_SETTINGS, settingsSchema } from '../src/shared/settingsSchema'

describe('summary window height', () => {
  const screen = 1040 // usable height of a 1080 px screen without the taskbar

  it('follows the content, between a minimum and the usual maximum', () => {
    expect(briefingHeight(500, screen, false)).toBe(500)
    expect(briefingHeight(100, screen, false)).toBe(BRIEFING_MIN_HEIGHT)
    expect(briefingHeight(2000, screen, false)).toBe(BRIEFING_MAX_HEIGHT)
  })

  it('starts at the usual height until the page says how tall its content is', () => {
    expect(briefingHeight(null, screen, false)).toBe(BRIEFING_MAX_HEIGHT)
  })

  it('never goes beyond a small screen, leaving some air', () => {
    expect(briefingHeight(2000, 700, false)).toBe(700 - 32)
  })

  it('takes the whole height of the screen when the user asks for it, whatever the content', () => {
    expect(briefingHeight(500, screen, true)).toBe(screen)
    expect(briefingHeight(null, screen, true)).toBe(screen)
    expect(briefingHeight(5000, 700, true)).toBe(700)
  })
})

describe('the "toda la altura" setting', () => {
  it('is off by default and accepted by the settings', () => {
    expect(DEFAULT_SETTINGS.briefing.fullHeight).toBe(false)
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
  })
})
