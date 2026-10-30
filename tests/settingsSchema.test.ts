import { describe, expect, it } from 'vitest'
import { nextDelay } from '../src/main/scheduler'
import {
  applyPatch,
  DEFAULT_SETTINGS,
  migrateLegacy,
  settingsPatchSchema,
  settingsSchema
} from '../src/shared/settingsSchema'

describe('settings', () => {
  it('defaults are valid', () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
  })

  it('applies a partial patch without touching other fields', () => {
    const next = applyPatch(DEFAULT_SETTINGS, { widget: { opacity: 0.6 } })
    expect(next.widget).toEqual({ ...DEFAULT_SETTINGS.widget, opacity: 0.6 })
    expect(next.panel).toEqual(DEFAULT_SETTINGS.panel)
    expect(next.schedule).toEqual(DEFAULT_SETTINGS.schedule)
  })

  it('has the notification sound on by default and keeps it for settings saved before it existed', () => {
    expect(DEFAULT_SETTINGS.notifications.sound).toBe(true)
    const old = applyPatch(DEFAULT_SETTINGS, { notifications: { enabled: false } })
    expect(old.notifications).toEqual({ ...DEFAULT_SETTINGS.notifications, enabled: false })
  })

  it('lets the sound be turned off on its own', () => {
    const off = applyPatch(DEFAULT_SETTINGS, { notifications: { sound: false } })
    expect(off.notifications).toEqual({ ...DEFAULT_SETTINGS.notifications, sound: false })
    expect(settingsPatchSchema.safeParse({ notifications: { sound: 'no' } }).success).toBe(false)
  })

  it('reads the meetings window from the settings, two days by default', () => {
    expect(DEFAULT_SETTINGS.calendar.daysAhead).toBe(2)
    expect(applyPatch(DEFAULT_SETTINGS, { calendar: { daysAhead: 7 } }).calendar.daysAhead).toBe(7)
    expect(settingsPatchSchema.safeParse({ calendar: { daysAhead: 0 } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ calendar: { daysAhead: 31 } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ calendar: { daysAhead: 2.5 } }).success).toBe(false)
  })

  it('rejects out-of-range appearance values', () => {
    expect(settingsPatchSchema.safeParse({ widget: { scale: 5 } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ widget: { opacity: 0 } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ panel: { scale: 0.1 } }).success).toBe(false)
  })

  it('validates the tab mode settings', () => {
    expect(
      settingsPatchSchema.safeParse({ widget: { mode: 'tab', side: 'left', tabPos: 0.5 } }).success
    ).toBe(true)
    expect(settingsPatchSchema.safeParse({ widget: { mode: 'floating' } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ widget: { side: 'top' } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ widget: { tabPos: 1.5 } }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ appearance: { scale: 1 } }).success).toBe(false)
  })

  it('migrates the old single "appearance" section into widget and panel', () => {
    const migrated = migrateLegacy({
      appearance: { scale: 1.2, opacity: 0.7 },
      onboardingDone: true
    })
    const merged = applyPatch(DEFAULT_SETTINGS, migrated as never)
    expect(merged.widget).toMatchObject({ scale: 1.2, opacity: 0.7, mode: 'popup' })
    expect(merged.panel.scale).toBe(1.2)
    expect(merged.onboardingDone).toBe(true)
    expect(migrateLegacy({ widget: { scale: 1 } })).toEqual({ widget: { scale: 1 } }) // already new
    expect(migrateLegacy(undefined)).toBeUndefined()
  })

  it('rejects unknown keys and bad times', () => {
    expect(settingsPatchSchema.safeParse({ hack: true }).success).toBe(false)
    expect(settingsPatchSchema.safeParse({ schedule: { workStart: '25:00' } }).success).toBe(false)
  })
})

describe('scheduler backoff', () => {
  const base = 60_000

  it('doubles the delay per consecutive failure', () => {
    expect(nextDelay(base, 0)).toBe(base)
    expect(nextDelay(base, 1)).toBe(2 * base)
    expect(nextDelay(base, 3)).toBe(8 * base)
  })

  it('is capped', () => {
    expect(nextDelay(base, 20)).toBe(30 * 60 * 1000)
  })
})
