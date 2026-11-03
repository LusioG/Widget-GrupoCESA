import { describe, expect, it } from 'vitest'
import { snoozeUntil } from '../src/main/engine/snooze'
import { itemActionSchema } from '../src/main/ipc/schemas'
import {
  DEFAULT_PANEL,
  DEFAULT_SETTINGS,
  PANEL_WIDTH_RANGE,
  settingsPatchSchema,
  settingsSchema
} from '../src/shared/settingsSchema'
import { isIndefinite, SNOOZE_FOREVER } from '../src/shared/snooze'
import { strings } from '../src/shared/strings'

describe('panel width setting', () => {
  it('defaults to the usual 420 px and accepts the range', () => {
    expect(DEFAULT_PANEL.width).toBe(420)
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true)
    for (const width of [PANEL_WIDTH_RANGE.min, 500, PANEL_WIDTH_RANGE.max]) {
      expect(settingsPatchSchema.safeParse({ panel: { width } }).success).toBe(true)
    }
  })

  it('rejects widths that are too small, too large or not whole', () => {
    for (const width of [100, 359, 761, 2000, 420.5, '500']) {
      expect(settingsPatchSchema.safeParse({ panel: { width } }).success).toBe(false)
    }
  })

  it('says the width in the settings summary only when it is not the usual one', () => {
    expect(strings.settings.summary.panelSize(1, false)).toBe('Tamaño 100 %')
    expect(strings.settings.summary.panelSize(1, false, 420)).toBe('Tamaño 100 %')
    expect(strings.settings.summary.panelSize(1, false, 560)).toBe('Tamaño 100 % · ancho 560 px')
  })
})

describe('snooze with no date', () => {
  const now = new Date(2026, 10, 3, 10, 0)

  it('"forever" never comes back by itself', () => {
    const until = snoozeUntil('forever', now, '09:00')
    expect(until).toBe(SNOOZE_FOREVER)
    expect(until).toBeGreaterThan(now.getTime() + 100 * 365 * 24 * 3_600_000)
    expect(Number.isSafeInteger(until)).toBe(true) // fits an SQLite integer
  })

  it('is accepted as an item action, and unknown options still are not', () => {
    const ok = itemActionSchema.safeParse({ action: 'snooze', ids: ['a'], until: 'forever' })
    expect(ok.success).toBe(true)
    expect(itemActionSchema.safeParse({ action: 'snooze', ids: ['a'], until: 'later' }).success).toBe(
      false
    )
  })

  it('tells indefinite snoozes from normal ones', () => {
    expect(isIndefinite(SNOOZE_FOREVER - now.getTime())).toBe(true)
    expect(isIndefinite(3 * 24 * 3_600_000)).toBe(false)
    expect(strings.panel.returnsIn(SNOOZE_FOREVER - now.getTime())).toBe('sin fecha de regreso')
    expect(strings.panel.returnsIn(2 * 3_600_000)).toBe('vuelve en 2 h')
  })
})
