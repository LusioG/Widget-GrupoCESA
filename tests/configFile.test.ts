import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONFIG_GUIDE } from '../src/shared/configGuide'
import { DEFAULT_SETTINGS, settingsPatchSchema } from '../src/shared/settingsSchema'

describe('config guide', () => {
  it('docs/CONFIGURAR.md is the same text the app writes and copies', () => {
    const doc = readFileSync('docs/CONFIGURAR.md', 'utf8').replace(/\r\n/g, '\n')
    expect(doc).toBe(CONFIG_GUIDE)
  })

  it('mentions every top-level setting the file can change', () => {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      expect(CONFIG_GUIDE, key).toContain(`\`${key}`)
    }
  })

  it('never asks for or contains secrets', () => {
    expect(CONFIG_GUIDE).not.toMatch(/xox[bpa]-[A-Za-z0-9]{6,}|AIza[A-Za-z0-9_-]{10,}/)
  })
})

describe('config file contents', () => {
  it('the default settings are a valid patch (what the app writes can be read back)', () => {
    expect(settingsPatchSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
  })

  it('rejects unknown keys and out-of-range values, so a bad edit applies nothing', () => {
    expect(settingsPatchSchema.safeParse({ inventado: 1 }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ widget: { opacity: 5 } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ widget: { mode: 'tab', side: 'left' } }).success).toBe(
      true
    )
  })
})
