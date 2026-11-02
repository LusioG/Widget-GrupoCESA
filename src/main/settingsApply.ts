import { syncNow } from './accounts'
import { publish } from './appState'
import { onBriefingTimeChanged } from './briefing'
import { applyHotkey } from './hotkey'
import { getSettings, updateSettings } from './settingsStore'
import { applyLayout } from './windows/apply'
import { applyBriefingLayout } from './windows/briefing'
import type { Settings } from '../shared/types'

// Saves a settings patch and makes the running app follow it. The panel and the config file both
// come through here, so a change looks the same whoever made it.
export async function applySettingsPatch(patch: unknown): Promise<Settings> {
  const before = getSettings()
  const next = await updateSettings(patch) // throws on invalid input, rejecting the call
  const layout = (s: typeof next): string => JSON.stringify([s.widget, s.panel])
  if (layout(before) !== layout(next)) applyLayout()
  // Any change to what ClickUp tasks to show re-reads them right away.
  if (JSON.stringify(before.clickup) !== JSON.stringify(next.clickup)) syncNow('clickup')
  if (JSON.stringify(before.gmail.labelIds) !== JSON.stringify(next.gmail.labelIds)) {
    syncNow('gmail')
  }
  if (JSON.stringify(before.hotkey) !== JSON.stringify(next.hotkey)) applyHotkey()
  if (before.briefing.time !== next.briefing.time) void onBriefingTimeChanged(next.briefing.time)
  // The summary window follows the height choice at once, even while it is open.
  if (before.briefing.fullHeight !== next.briefing.fullHeight) applyBriefingLayout()
  // A different number of days starts a new read of the calendar right away.
  if (before.calendar.daysAhead !== next.calendar.daysAhead) syncNow('calendar')
  publish()
  return next
}
