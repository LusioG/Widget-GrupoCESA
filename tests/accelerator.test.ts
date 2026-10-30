import { describe, expect, it } from 'vitest'
import {
  acceleratorFromEvent,
  DEFAULT_ACCELERATOR,
  formatAccelerator,
  isValidAccelerator
} from '../src/shared/accelerator'
import { applyPatch, DEFAULT_SETTINGS, settingsPatchSchema } from '../src/shared/settingsSchema'

const press = (
  code: string,
  mods: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}
): Parameters<typeof acceleratorFromEvent>[0] => ({
  key: code,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods
})

describe('accelerator', () => {
  it('accepts combinations with Control or Alt', () => {
    expect(isValidAccelerator(DEFAULT_ACCELERATOR)).toBe(true)
    expect(isValidAccelerator('Control+Shift+F9')).toBe(true)
    expect(isValidAccelerator('Alt+Space')).toBe(true)
  })

  it('rejects ones that would hijack normal typing or are malformed', () => {
    expect(isValidAccelerator('P')).toBe(false)
    expect(isValidAccelerator('Shift+P')).toBe(false)
    expect(isValidAccelerator('Control+')).toBe(false)
    expect(isValidAccelerator('Control+Alt')).toBe(false)
    expect(isValidAccelerator('Super+P')).toBe(false)
    expect(isValidAccelerator('Alt+Control+P')).toBe(false) // fixed modifier order
    expect(isValidAccelerator('Control+p')).toBe(false)
  })

  it('builds it from a key press', () => {
    expect(acceleratorFromEvent(press('KeyP', { ctrlKey: true, altKey: true }))).toBe(
      'Control+Alt+P'
    )
    expect(acceleratorFromEvent(press('Digit7', { altKey: true, shiftKey: true }))).toBe(
      'Alt+Shift+7'
    )
    expect(acceleratorFromEvent(press('F10', { ctrlKey: true }))).toBe('Control+F10')
    expect(acceleratorFromEvent(press('ArrowUp', { ctrlKey: true, altKey: true }))).toBe(
      'Control+Alt+Up'
    )
  })

  it('ignores presses that are not a usable combination', () => {
    expect(acceleratorFromEvent(press('KeyP'))).toBeNull() // no modifier
    expect(acceleratorFromEvent(press('KeyP', { shiftKey: true }))).toBeNull() // shift only
    expect(acceleratorFromEvent(press('KeyP', { ctrlKey: true, metaKey: true }))).toBeNull()
    expect(acceleratorFromEvent(press('ControlLeft', { ctrlKey: true }))).toBeNull() // only a modifier
    expect(acceleratorFromEvent(press('Comma', { ctrlKey: true }))).toBeNull() // unsupported key
  })

  it('formats it for display', () => {
    expect(formatAccelerator('Control+Alt+P')).toBe('Ctrl + Alt + P')
  })

  it('is validated in the settings and defaults to on', () => {
    expect(DEFAULT_SETTINGS.hotkey).toEqual({ enabled: true, accelerator: DEFAULT_ACCELERATOR })
    expect(settingsPatchSchema.safeParse({ hotkey: { accelerator: 'Control+K' } }).success).toBe(
      true
    )
    expect(settingsPatchSchema.safeParse({ hotkey: { accelerator: 'K' } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ hotkey: { accelerator: 'rm -rf' } }).success).toBe(false)
  })

  it('keeps the other hotkey/presentation values when one changes', () => {
    const next = applyPatch(DEFAULT_SETTINGS, { hotkey: { enabled: false } })
    expect(next.hotkey).toEqual({ enabled: false, accelerator: DEFAULT_ACCELERATOR })
    expect(DEFAULT_SETTINGS.presentation.autoHide).toBe(true)
    expect(
      applyPatch(DEFAULT_SETTINGS, { presentation: { autoHide: false } }).presentation
    ).toEqual({
      autoHide: false,
      hideFromCapture: true
    })
  })
})
