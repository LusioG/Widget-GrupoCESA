export type Source = 'slack' | 'gmail' | 'calendar' | 'clickup'

// ClickUp's four task priorities (a task may also have none).
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low'

export type Signal = {
  id: string // stable: `${source}:${externalId}`
  source: Source
  kind: 'mention' | 'dm' | 'email' | 'meeting' | 'task' | 'followup'
  title: string
  body?: string
  url: string // link to the original
  occurredAt: number
  startsAt?: number // meetings
  endsAt?: number
  meetingUrl?: string
  dueAt?: number // tasks
  priority?: TaskPriority // tasks that have one set in ClickUp
  sender?: string // messages and emails: address or name
  channel?: string // chat messages
  isBot?: boolean
  seen?: boolean // the user already opened it
  snoozedUntil?: number // only on the "snoozed" list: when it comes back
  urgency?: number // 0..1, computed by the ranking rules
  raw?: unknown // never sent to the LLM, never persisted
}

export type BadgeState = {
  count: number // pending items (the green number); in focus mode only the urgent ones
  urgent: boolean
  urgentCount: number // pending items that are urgent (the red circle)
  meetingCount: number // meetings shown in the panel: ongoing or within 24 h (the yellow circle)
  // A mail or Slack message arrived since the panel was last looked at: the red pulse. Tasks never
  // cause it; they only add to the counters.
  messageAlert: boolean
  meetingSoon: boolean
}

export type AccountStatus = 'disconnected' | 'connected' | 'needs_reconnect'

export type AccountInfo = {
  status: AccountStatus
  lastSyncAt?: number
  // 'auth' | 'sync' | 'offline' | 'api_disabled' (the Google API is off in the user's project)
  error?: string
  errorUrl?: string // where to fix it (api_disabled: the page that enables the API)
}

export type CalendarShow = 'all' | 'meets' | 'plain'

export type WidgetMode = 'popup' | 'tab'
export type DockSide = 'left' | 'right'

export type Settings = {
  // The floating widget: a round popup, or a vertical tab docked to a screen edge.
  widget: {
    mode: WidgetMode
    side: DockSide // tab mode: which edge
    tabPos: number // tab mode: 0 = top of the screen, 1 = bottom
    scale: number
    opacity: number
  }
  // The container that opens with all the information.
  panel: { scale: number }
  schedule: { workStart: string; workEnd: string; workDays: number[] }
  notifications: { enabled: boolean; focusFromCalendar: boolean; sound: boolean }
  filters: {
    minLength: number
    ignoredSenders: string[]
    mutedChannels: string[]
    importantSenders: string[]
  }
  followups: { waitHours: number }
  gmail: { labelIds: string[] } // labels to watch; INBOX by default
  clickup: {
    listIds: string[] // empty = every list
    dueWindowDays: number // show tasks overdue or due within this many days
    minPriority: ClickUpMinPriority // hide tasks below this priority
    alwaysShowFlagged: boolean // Urgent/High tasks are shown even with a far or missing due date
    includeSubtasks: boolean
    ignoredStatuses: string[] // hide tasks in these statuses (e.g. "en espera")
  }
  // How many calendar days ahead (counting today) the meetings are read and shown.
  // show narrows which events appear: all, only the ones with a video call, or only the rest.
  calendar: { daysAhead: number; show: CalendarShow }
  // Global keyboard shortcut that opens/closes the panel from anywhere.
  hotkey: { enabled: boolean; accelerator: string }
  // Hide the widget (and mute its sound) while something is shown full screen or presented.
  presentation: { autoHide: boolean; hideFromCapture: boolean }
  onboardingDone: boolean
}

export type AppState = {
  signals: Signal[]
  snoozed: Signal[] // postponed items, soonest to come back first
  trash: Signal[] // dismissed items that can still be restored or emptied for good
  widgetHidden: boolean // the user hid the widget by hand
  presenting: boolean // something is full screen / being presented, so the widget steps aside
  hotkeyFailed: boolean // the shortcut is enabled but another program already uses it
  badge: BadgeState
  paused: boolean
  focus: { manual: boolean; active: boolean } // active = manual or a calendar "Focus" block
  outsideHours: boolean
  settings: Settings
  accounts: Record<Source, AccountInfo>
  googleHasCredentials: boolean
  autostart: boolean
}

export type SnoozeOption = 'hour' | 'tomorrow' | 'monday'

export type ItemAction =
  // restore: bring a snoozed or dismissed item back; purge: empty it from the trash for good
  | { ids: string[]; action: 'dismiss' | 'seen' | 'restore' | 'purge' }
  | { ids: string[]; action: 'snooze'; until: SnoozeOption }

export type InboxStatus = 'new' | 'seen' | 'snoozed' | 'dismissed' | 'purged'

// "any" shows every priority; otherwise tasks with a lower (or no) priority are hidden.
export type ClickUpMinPriority = 'any' | 'normal' | 'high' | 'urgent'

export type ClickUpList = {
  id: string
  name: string // the list itself
  space: string
  folder?: string // absent for lists that sit directly in the space
  team?: string // workspace name
}
export type GmailLabel = { id: string; name: string }
export type SlackChannel = { id: string; name: string; isPrivate: boolean }

// The Google login is shared; each feature is switched on separately.
export type GoogleFeature = 'calendar' | 'gmail'

export type ActionResult = { ok: true } | { ok: false; error: string }

export type PanelView = 'home' | 'settings'

export type Point = { x: number; y: number }
