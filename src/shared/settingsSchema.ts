import { z } from 'zod'
import { DEFAULT_ACCELERATOR, isValidAccelerator } from './accelerator'
import { BRIEFING_SECTIONS, MAX_EXTRA_LENGTH, MAX_EXTRAS } from './briefingPrompt'
import { MAX_CALENDAR_DAYS } from './calendarWindow'
import type { Settings } from './types'

export const SCALE_RANGE = { min: 0.8, max: 1.4 } as const
export const OPACITY_RANGE = { min: 0.35, max: 1 } as const
export const PANEL_WIDTH_RANGE = { min: 360, max: 760, default: 420 } as const

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const wordList = z.array(z.string().trim().min(1).max(120)).max(200)
const scale = z.number().min(SCALE_RANGE.min).max(SCALE_RANGE.max)

const widget = z.object({
  mode: z.enum(['popup', 'tab']),
  side: z.enum(['left', 'right']),
  tabPos: z.number().min(0).max(1),
  scale,
  opacity: z.number().min(OPACITY_RANGE.min).max(OPACITY_RANGE.max)
})
const panel = z.object({
  scale,
  fullHeight: z.boolean(),
  width: z.number().int().min(PANEL_WIDTH_RANGE.min).max(PANEL_WIDTH_RANGE.max)
})
const schedule = z.object({
  workStart: hhmm,
  workEnd: hhmm,
  workDays: z.array(z.number().int().min(0).max(6)).max(7)
})
const notifications = z.object({
  enabled: z.boolean(),
  focusFromCalendar: z.boolean(),
  sound: z.boolean()
})
const filters = z.object({
  minLength: z.number().int().min(0).max(100),
  ignoredSenders: wordList,
  mutedChannels: wordList,
  importantSenders: wordList,
  importantChannels: wordList
})
const followups = z.object({ waitHours: z.number().int().min(1).max(720) })
const clickup = z.object({
  listIds: z.array(z.string().max(64)).max(500),
  dueWindowDays: z.number().int().min(1).max(90),
  minPriority: z.enum(['any', 'normal', 'high', 'urgent']),
  alwaysShowFlagged: z.boolean(),
  includeSubtasks: z.boolean(),
  ignoredStatuses: wordList
})
const hotkey = z.object({
  enabled: z.boolean(),
  accelerator: z.string().refine(isValidAccelerator, 'Invalid shortcut')
})
const presentation = z.object({ autoHide: z.boolean(), hideFromCapture: z.boolean() })
const calendar = z.object({
  daysAhead: z.number().int().min(1).max(MAX_CALENDAR_DAYS),
  show: z.enum(['all', 'meets', 'plain'])
})
const listAddress = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid address')
  .max(200)
const distributionList = z.object({
  address: listAddress,
  name: z.string().trim().min(1).max(120),
  urgent: z.boolean()
})
const gmail = z.object({
  labelIds: z.array(z.string().min(1).max(128)).max(100),
  lists: z.array(distributionList).max(50),
  listDays: z.union([z.literal(1), z.literal(3), z.literal(7)])
})
const profile = z.object({ name: z.string().trim().max(40) })
const briefing = z.object({ enabled: z.boolean(), time: hhmm, fullHeight: z.boolean() })
const aiLevel = z.enum(['counts', 'titles', 'people'])
const ai = z.object({
  enabled: z.boolean(),
  model: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/),
  sections: z
    .array(
      z.enum(['meetings', 'priorities', 'nextTasks', 'yesterday', 'waiting', 'mail', 'lists', 'since'])
    )
    .max(8),
  extras: z.array(z.string().trim().min(1).max(MAX_EXTRA_LENGTH)).max(MAX_EXTRAS),
  mail: aiLevel,
  lists: aiLevel,
  slack: aiLevel
})

export const settingsSchema = z.object({
  widget,
  panel,
  schedule,
  notifications,
  filters,
  followups,
  gmail,
  clickup,
  hotkey,
  presentation,
  calendar,
  profile,
  briefing,
  ai,
  onboardingDone: z.boolean()
})

// Each section can be updated partially; unknown keys are rejected.
export const settingsPatchSchema = z
  .object({
    widget: widget.partial(),
    panel: panel.partial(),
    schedule: schedule.partial(),
    notifications: notifications.partial(),
    filters: filters.partial(),
    followups: followups.partial(),
    gmail: gmail.partial(),
    clickup: clickup.partial(),
    hotkey: hotkey.partial(),
    presentation: presentation.partial(),
    calendar: calendar.partial(),
    profile: profile.partial(),
    briefing: briefing.partial(),
    ai: ai.partial(),
    onboardingDone: z.boolean()
  })
  .partial()
  .strict()

export type SettingsPatch = z.infer<typeof settingsPatchSchema>

export const DEFAULT_WIDGET: Settings['widget'] = {
  mode: 'popup',
  side: 'right',
  tabPos: 0.4,
  scale: 1,
  opacity: 1
}
export const DEFAULT_PANEL: Settings['panel'] = {
  scale: 1,
  fullHeight: false,
  width: PANEL_WIDTH_RANGE.default
}

export const DEFAULT_SETTINGS: Settings = {
  widget: DEFAULT_WIDGET,
  panel: DEFAULT_PANEL,
  schedule: { workStart: '09:00', workEnd: '18:00', workDays: [1, 2, 3, 4, 5] },
  notifications: { enabled: true, focusFromCalendar: true, sound: true },
  filters: {
    minLength: 3,
    ignoredSenders: [],
    mutedChannels: [],
    importantSenders: [],
    importantChannels: []
  },
  followups: { waitHours: 48 },
  gmail: { labelIds: ['INBOX'], lists: [], listDays: 7 },
  clickup: {
    listIds: [],
    dueWindowDays: 7,
    minPriority: 'any',
    alwaysShowFlagged: true,
    includeSubtasks: true,
    ignoredStatuses: []
  },
  hotkey: { enabled: true, accelerator: DEFAULT_ACCELERATOR },
  presentation: { autoHide: true, hideFromCapture: true },
  calendar: { daysAhead: 2, show: 'all' }, // today and tomorrow
  profile: { name: '' },
  briefing: { enabled: true, time: '09:00', fullHeight: false }, // 09:00 = the default work start
  // Off until a key is added. Of mail, lists and Slack the AI only gets the counts unless asked.
  ai: {
    enabled: false,
    model: 'gemini-3.5-flash-lite',
    sections: [...BRIEFING_SECTIONS],
    extras: [],
    mail: 'counts',
    lists: 'counts',
    slack: 'counts'
  },
  onboardingDone: false
}

export function applyPatch(base: Settings, patch: SettingsPatch): Settings {
  return {
    widget: { ...base.widget, ...patch.widget },
    panel: { ...base.panel, ...patch.panel },
    schedule: { ...base.schedule, ...patch.schedule },
    notifications: { ...base.notifications, ...patch.notifications },
    filters: { ...base.filters, ...patch.filters },
    followups: { ...base.followups, ...patch.followups },
    gmail: { ...base.gmail, ...patch.gmail },
    clickup: { ...base.clickup, ...patch.clickup },
    hotkey: { ...base.hotkey, ...patch.hotkey },
    presentation: { ...base.presentation, ...patch.presentation },
    calendar: { ...base.calendar, ...patch.calendar },
    profile: { ...base.profile, ...patch.profile },
    briefing: { ...base.briefing, ...patch.briefing },
    ai: { ...base.ai, ...patch.ai },
    onboardingDone: patch.onboardingDone ?? base.onboardingDone
  }
}

// Settings saved before the widget/panel split had a single `appearance` section.
export function migrateLegacy(stored: unknown): unknown {
  return migrateAiSwitches(migrateAppearance(stored))
}

function migrateAppearance(stored: unknown): unknown {
  if (!stored || typeof stored !== 'object') return stored
  const s = stored as Record<string, unknown>
  const old = s['appearance'] as { scale?: number; opacity?: number } | undefined
  if (!old || s['widget']) return stored
  const { appearance: _dropped, ...rest } = s
  void _dropped
  return {
    ...rest,
    widget: { scale: old.scale, opacity: old.opacity },
    panel: { scale: old.scale }
  }
}

// Before, two on/off switches (`sendMail`, `sendSlack`) said what the AI could read; now each source
// has a level. What a person had allowed stays allowed: mail (and the lists, which were mail) at
// "titles"; Slack at "people", since it already sent who wrote the message.
function migrateAiSwitches(stored: unknown): unknown {
  if (!stored || typeof stored !== 'object') return stored
  const s = stored as Record<string, unknown>
  const old = s['ai']
  if (!old || typeof old !== 'object') return stored
  const ai = old as Record<string, unknown>
  if (!('sendMail' in ai) && !('sendSlack' in ai)) return stored
  const { sendMail, sendSlack, ...rest } = ai
  return {
    ...s,
    ai: {
      ...rest,
      mail: rest['mail'] ?? (sendMail === true ? 'titles' : 'counts'),
      lists: rest['lists'] ?? (sendMail === true ? 'titles' : 'counts'),
      slack: rest['slack'] ?? (sendSlack === true ? 'people' : 'counts')
    }
  }
}
