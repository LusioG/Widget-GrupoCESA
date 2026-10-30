import { eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  applyPatch,
  DEFAULT_SETTINGS,
  migrateLegacy,
  settingsPatchSchema,
  settingsSchema,
  type SettingsPatch
} from '../shared/settingsSchema'
import type { Settings } from '../shared/types'
import { getDb } from './db/client'
import { settings as settingsTable } from './db/schema'

const SETTINGS_KEY = 'app'
const BADGE_POSITION_KEY = 'badgePosition'
const TAB_DISPLAY_KEY = 'tabDisplay'
const positionSchema = z.object({ x: z.number().finite(), y: z.number().finite() })

// In-memory copy so reads are synchronous; every write goes through to SQLite.
let current: Settings = DEFAULT_SETTINGS
let badgePosition: { x: number; y: number } | null = null
let tabDisplayId: number | null = null // monitor the tab is docked to

async function readKey(key: string): Promise<unknown> {
  const rows = await getDb().select().from(settingsTable).where(eq(settingsTable.key, key))
  const row = rows[0]
  if (!row) return undefined
  try {
    return JSON.parse(row.value)
  } catch {
    return undefined
  }
}

async function writeKey(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value)
  await getDb()
    .insert(settingsTable)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: json } })
}

export async function initSettings(): Promise<void> {
  const stored = migrateLegacy(await readKey(SETTINGS_KEY))
  // Stored values are merged over the defaults so new settings never break old installs.
  const merged = applyPatch(DEFAULT_SETTINGS, (stored ?? {}) as SettingsPatch)
  const parsed = settingsSchema.safeParse(merged)
  current = parsed.success ? parsed.data : DEFAULT_SETTINGS

  const pos = positionSchema.safeParse(await readKey(BADGE_POSITION_KEY))
  badgePosition = pos.success ? pos.data : null

  const display = z
    .number()
    .int()
    .safeParse(await readKey(TAB_DISPLAY_KEY))
  tabDisplayId = display.success ? display.data : null
}

export function getSettings(): Settings {
  return current
}

export async function updateSettings(rawPatch: unknown): Promise<Settings> {
  const patch = settingsPatchSchema.parse(rawPatch)
  const next = settingsSchema.parse(applyPatch(current, patch))
  current = next
  await writeKey(SETTINGS_KEY, next)
  return next
}

export function getBadgePosition(): { x: number; y: number } | null {
  return badgePosition
}

export function getTabDisplayId(): number | null {
  return tabDisplayId
}

export async function saveTabDisplayId(id: number): Promise<void> {
  tabDisplayId = id
  await writeKey(TAB_DISPLAY_KEY, id)
}

export async function saveBadgePosition(pos: { x: number; y: number }): Promise<void> {
  badgePosition = pos
  await writeKey(BADGE_POSITION_KEY, pos)
}
