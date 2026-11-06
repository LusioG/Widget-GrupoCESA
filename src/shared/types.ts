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
  // Meetings: the start time before its last change, when it was moved earlier or later. Kept
  // until the meeting takes place, so the change is not missed.
  movedFrom?: number
  meetingUrl?: string
  dueAt?: number // tasks
  priority?: TaskPriority // tasks that have one set in ClickUp
  sender?: string // messages and emails: address or name
  channel?: string // chat messages
  // Mail from a distribution list is one item per conversation (not per message). `list` is the
  // list's address; `threadId` opens the conversation; `unread` is how many of its messages the
  // user has not read yet.
  list?: { address: string; name: string }
  threadId?: string
  unread?: number
  isBot?: boolean
  seen?: boolean // the user already opened it
  snoozedUntil?: number // only on the "snoozed" list: when it comes back
  urgency?: number // 0..1, computed by the ranking rules
  raw?: unknown // never sent to the LLM, never persisted
}

export type BadgeState = {
  count: number // pending items that are NOT urgent (the green number); in focus mode only the urgent ones
  urgent: boolean
  urgentCount: number // pending items that are urgent (the red circle)
  meetingCount: number // meetings ongoing or within 12 h (the yellow circle)
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
  label?: string // who it is connected as ("luciano · Grupo Cesa"), when the account says so
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
  // fullHeight: the panel takes the whole usable height of the screen instead of its usual height.
  // width: the panel's width in pixels at 100 % size (the size slider scales it together with the height).
  panel: { scale: number; fullHeight: boolean; width: number }
  schedule: { workStart: string; workEnd: string; workDays: number[] }
  notifications: { enabled: boolean; focusFromCalendar: boolean; sound: boolean }
  filters: {
    minLength: number
    ignoredSenders: string[]
    mutedChannels: string[]
    importantSenders: string[]
    importantChannels: string[] // Slack channels (as "#name") whose mentions are always urgent
  }
  followups: { waitHours: number }
  // labels to watch (INBOX by default), the distribution lists that get their own section, and
  // how many days back the unread mail of those lists is shown
  gmail: { labelIds: string[]; lists: DistributionList[]; listDays: ListDays }
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
  // Who the daily summary greets ("Buen día, Ana"). Empty: it greets without a name.
  profile: { name: string }
  // The daily summary: it opens the first time you are active on a work day after `time`.
  // fullHeight: the summary window takes the whole height of the screen, to read it calmly.
  briefing: { enabled: boolean; time: string; fullHeight: boolean }
  // The AI writes the daily summary. The key itself is never a setting: it lives encrypted.
  ai: {
    enabled: boolean
    model: string
    // What the summary brings: the built-in sections that are on (all, by default), and anything
    // else the user added. The tone and the answer format are fixed in the app.
    sections: BriefingSectionKey[]
    extras: string[]
    // How much of each source the AI may read (see AiLevel). Counts only, unless the user raises it.
    mail: AiLevel
    lists: AiLevel
    slack: AiLevel
  }
  onboardingDone: boolean
}

// What the AI may read of a source: only how many there are, the subject / text of each one, or
// that and who wrote it. The text of the messages themselves is never sent.
export type AiLevel = 'counts' | 'titles' | 'people'

export type BriefingSectionKey =
  | 'meetings'
  | 'priorities'
  | 'nextTasks'
  | 'yesterday'
  | 'waiting'
  | 'mail'
  | 'lists'
  | 'since'

// A section of the summary written in words by the AI; `refs` are the items it talks about.
export type BriefingNarrativeSection = {
  key: BriefingSectionKey
  text: string
  refs: string[]
}

// One line of the daily summary: a meeting, task, mail or message, as it was when it was made.
export type BriefingItem = {
  id: string
  source: Source
  kind: Signal['kind']
  title: string
  url: string
  startsAt?: number
  endsAt?: number
  movedFrom?: number // meetings: the start time before it was changed
  meetingUrl?: string
  dueAt?: number
  priority?: TaskPriority
  from?: string // who wrote it: the author of a Slack message, the sender of a mail, a list's voices
  listName?: string // a conversation of a distribution list: which one
  threadId?: string // ... and its Gmail conversation, to open it in the chat window
  urgent: boolean
  note?: string // written by the AI: why it matters
}

// What is new in one distribution list: how many conversations and unread messages, and the latest.
export type BriefingList = {
  address: string
  name: string
  conversations: number
  unread: number
  urgent: boolean
  items: BriefingItem[] // the most recent conversations
}

// One entry of the list of past summaries.
export type BriefingSummary = { date: string; createdAt: number; mode: Briefing['mode'] }

// A daily summary, saved as it was shown so it can be opened again later.
export type Briefing = {
  date: string // the local day, YYYY-MM-DD
  createdAt: number
  name: string
  mode: 'rules' | 'ai'
  greeting: string // "Buen día, Ana"
  intro: string
  meetings: BriefingItem[] // today's
  priorities: BriefingItem[] // the 5 that matter most
  nextTasks: BriefingItem[] // the next 3 ordinary tasks to fall due
  yesterday: BriefingItem[] // still pending from yesterday
  waiting: BriefingItem[] // sent and not answered
  // The two below came later: a summary saved before them does not have them.
  mail?: BriefingItem[] // the latest individual mails that are still unread
  mailTotal?: number // how many of those there are in all
  lists?: BriefingList[] // what is new in each distribution list
  since: { emails: number; messages: number } // new since the last summary
  // Only when the AI wrote it: the summary in words, with links to the items it mentions. The
  // lists above stay as the detail behind it.
  narrative?: BriefingNarrativeSection[]
  // Only when the AI wrote it: what it could not see and why (a source set to "counts only").
  notices?: AiNoticeKey[]
}

export type AiNoticeKey = 'mail' | 'lists' | 'slack'

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
  slackOAuth: boolean // the company's Slack app is set up: "Conectar con Slack" can be offered
  aiKeySet: boolean // a Gemini key is stored (its value never reaches the pages)
  appVersion: string
  updateReady: string | null // a newer version is downloaded and waits for a restart
  autostart: boolean
}

// forever: no return date; it stays in "Pospuestos" until it is brought back by hand.
export type SnoozeOption = 'hour' | 'tomorrow' | 'monday' | 'forever'

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

// How far back the mail of the distribution lists is shown.
export type ListDays = 1 | 3 | 7

// A distribution list (a group address such as soporte@empresa.com) whose mail is followed.
// urgent: everything that arrives through it counts as urgent, like a priority sender.
export type DistributionList = { address: string; name: string; urgent: boolean }
// A list found in the user's mail, offered in Ajustes to pick from.
export type AvailableList = { address: string; name: string; count: number }

// A file attached to a message (only its name and size: the file itself is never downloaded).
export type ThreadAttachment = { name: string; size: number; mime: string }

// One message of a conversation, ready to be drawn as a chat bubble.
export type ThreadMessage = {
  id: string
  from: { name: string; address: string }
  at: number
  text: string
  // The signature, apart from the text so it can be folded away (nothing is deleted).
  signature?: string
  attachments?: ThreadAttachment[]
  mine: boolean // written by the user
  // The message this one answers (from the In-Reply-To header), when it is in the conversation.
  replyTo?: { name: string; snippet: string }
  unread: boolean
}

// A whole conversation, as the thread window shows it. `error`: it could not be read.
export type ThreadView = {
  threadId: string
  subject: string
  list?: { address: string; name: string }
  messages: ThreadMessage[]
  gmailUrl: string
  loading?: boolean // the window is open and the messages are still being read
  error?: 'auth' | 'failed'
}
export type SlackChannel = { id: string; name: string; isPrivate: boolean }
// A person of the Slack workspace, named the way their messages show up in the widget.
export type SlackPerson = { id: string; name: string }

// The Google login is shared; each feature is switched on separately.
export type GoogleFeature = 'calendar' | 'gmail'

export type ActionResult = { ok: true } | { ok: false; error: string }

// The answer to "Buscar actualizaciones". `unavailable`: this copy is not an installed one.
export type UpdateCheckResult = 'latest' | 'downloading' | 'ready' | 'error' | 'unavailable'

export type PanelView = 'home' | 'settings'

export type Point = { x: number; y: number }
