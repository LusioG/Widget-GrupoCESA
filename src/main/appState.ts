import { BrowserWindow } from 'electron'
import { IPC } from '../shared/ipcChannels'
import { computeBadge } from '../shared/badgeState'
import { horizonEnd } from '../shared/calendarWindow'
import type {
  AccountInfo,
  AppState,
  CalendarShow,
  ItemAction,
  Signal,
  Source
} from '../shared/types'
import { GEMINI_KEY } from './ai/key'
import { getAutostart } from './autostart'
import { hasSecret } from './auth/secrets'
import { hasGoogleCredentials } from './connectors/google/auth'
import { loadInbox, saveInbox, type InboxRow } from './db/repos'
import { shouldKeep } from './engine/filters'
import { isFocusActive, isWorkTime } from './engine/quiet'
import { scoreSignal } from './engine/ranking'
import { snoozeUntil } from './engine/snooze'
import { getSettings } from './settingsStore'

const bySource = new Map<Source, Signal[]>()
const inbox = new Map<string, InboxRow>() // what the user did with each item
const accounts: Record<Source, AccountInfo> = {
  clickup: { status: 'disconnected' },
  calendar: { status: 'disconnected' },
  slack: { status: 'disconnected' },
  gmail: { status: 'disconnected' }
}
let paused = false
let manualFocus = false
// When the panel was last opened or closed: mail and Slack messages newer than this are "new".
let lastSeenAt = Date.now()
let manualHidden = false
let presenting = false
let hotkeyFailed = false
let updateReady: string | null = null // the version waiting for a restart, if any
let appVersion = '' // set once at startup (see index.ts)
// The rows as they were before the last dismiss/snooze, so it can be undone for a few seconds.
const UNDO_WINDOW_MS = 15_000
let lastChange: { at: number; rows: InboxRow[] } | null = null
const listeners = new Set<(state: AppState) => void>()

// Meetings only matter while they are ongoing or start before the end of the chosen window
// (Ajustes: how many calendar days ahead, counting today).
function relevant(signal: Signal, now: number, meetingsUntil: number, show: CalendarShow): boolean {
  if (signal.kind !== 'meeting') return true
  if (show === 'meets' && !signal.meetingUrl) return false
  if (show === 'plain' && signal.meetingUrl) return false
  const start = signal.startsAt ?? signal.occurredAt
  const end = signal.endsAt ?? start
  return end > now && start < meetingsUntil
}

// Dismissed items stay hidden (in the trash until it is emptied); snoozed ones come back once
// their time has passed.
function isVisible(row: InboxRow | undefined, now: number): boolean {
  if (!row) return true
  if (row.status === 'dismissed' || row.status === 'purged') return false
  if (row.status === 'snoozed') return (row.snoozedUntil ?? 0) <= now
  return true
}

// raw signals -> filters -> user state -> ranking -> order
export function getState(): AppState {
  const now = Date.now()
  const settings = getSettings()
  const raw = [...bySource.values()].flat()

  const meetingsUntil = horizonEnd(now, settings.calendar.daysAhead)
  const show = settings.calendar.show
  const wanted = raw.filter(
    (s) => relevant(s, now, meetingsUntil, show) && shouldKeep(s, settings.filters)
  )
  const visible = wanted.filter((s) => isVisible(inbox.get(s.id), now))

  const ranking = { now, importantSenders: settings.filters.importantSenders }
  const signals = visible
    .map((s): Signal =>
      s.kind === 'meeting'
        ? s
        : { ...s, urgency: scoreSignal(s, ranking), seen: inbox.get(s.id)?.status === 'seen' }
    )
    .sort((a, b) => (b.urgency ?? 0) - (a.urgency ?? 0))

  const trash = wanted
    .filter((s) => inbox.get(s.id)?.status === 'dismissed')
    .sort((a, b) => b.occurredAt - a.occurredAt)

  const snoozed = wanted
    .filter((s) => s.kind !== 'meeting')
    .flatMap((s): Signal[] => {
      const row = inbox.get(s.id)
      if (row?.status !== 'snoozed' || (row.snoozedUntil ?? 0) <= now) return []
      return [{ ...s, snoozedUntil: row.snoozedUntil ?? undefined }]
    })
    .sort((a, b) => (a.snoozedUntil ?? 0) - (b.snoozedUntil ?? 0))

  const focusActive = isFocusActive(raw, now, manualFocus, settings.notifications.focusFromCalendar)

  return {
    signals,
    snoozed,
    trash,
    widgetHidden: manualHidden,
    presenting,
    hotkeyFailed,
    badge: computeBadge(signals, now, { focus: focusActive, lastSeenAt }),
    paused,
    focus: { manual: manualFocus, active: focusActive },
    outsideHours: !isWorkTime(new Date(now), settings.schedule),
    settings,
    accounts: { ...accounts },
    googleHasCredentials: hasGoogleCredentials(),
    aiKeySet: hasSecret(GEMINI_KEY),
    appVersion,
    updateReady,
    autostart: getAutostart()
  }
}

export function publish(): void {
  const state = getState()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.stateChanged, state)
  }
  listeners.forEach((cb) => cb(state))
}

export function onStateChange(cb: (state: AppState) => void): void {
  listeners.add(cb)
}

export async function initInbox(): Promise<void> {
  for (const row of await loadInbox()) inbox.set(row.signalId, row)
}

// Open/dismiss/snooze/restore/purge, for one item or a batch. Only known item ids are accepted.
export async function applyItemAction(request: ItemAction): Promise<void> {
  const known = new Set([...bySource.values()].flat().map((s) => s.id))
  const now = Date.now()
  const before: InboxRow[] = []

  for (const id of request.ids) {
    if (!known.has(id)) continue
    const current: InboxRow = inbox.get(id) ?? {
      signalId: id,
      status: 'new',
      snoozedUntil: null,
      score: 0
    }
    let next: InboxRow = current
    if (request.action === 'dismiss') {
      next = { ...current, status: 'dismissed', snoozedUntil: null }
    } else if (request.action === 'snooze') {
      const until = snoozeUntil(request.until, new Date(now), getSettings().schedule.workStart)
      next = { ...current, status: 'snoozed', snoozedUntil: until }
    } else if (request.action === 'restore') {
      // Bring a snoozed or dismissed item back right now.
      if (current.status === 'snoozed' || current.status === 'dismissed') {
        next = { ...current, status: 'new', snoozedUntil: null }
      }
    } else if (request.action === 'purge') {
      if (current.status === 'dismissed') next = { ...current, status: 'purged' } // gone from the trash
    } else if (current.status === 'new') {
      next = { ...current, status: 'seen' } // opening never undoes a dismiss or snooze
    }
    if (next !== current) {
      if (request.action === 'dismiss' || request.action === 'snooze') before.push(current)
      inbox.set(id, next)
      await saveInbox(next)
    }
  }
  if (before.length > 0) lastChange = { at: now, rows: before }
  publish()
}

// Puts back what the last dismiss/snooze changed. Too late (or nothing to undo) returns false.
export async function undoLastChange(): Promise<boolean> {
  const change = lastChange
  lastChange = null
  if (!change || Date.now() - change.at > UNDO_WINDOW_MS) return false
  for (const row of change.rows) {
    inbox.set(row.signalId, row)
    await saveInbox(row)
  }
  publish()
  return true
}

export function setSourceSignals(source: Source, signals: Signal[]): void {
  bySource.set(source, signals)
  publish()
}

export function clearSourceSignals(source: Source): void {
  bySource.delete(source)
  for (const id of [...inbox.keys()]) if (id.startsWith(`${source}:`)) inbox.delete(id)
  publish()
}

export function setAccount(source: Source, info: AccountInfo): void {
  accounts[source] = info
  publish()
}

export function getAccount(source: Source): AccountInfo {
  return accounts[source]
}

export function setPaused(value: boolean): void {
  paused = value
  publish()
}

export function isPaused(): boolean {
  return paused
}

export function setManualFocus(value: boolean): void {
  manualFocus = value
  publish()
}

export function isManualFocus(): boolean {
  return manualFocus
}

// The user looked at the panel: whatever arrived before now is no longer "new" (the red pulse stops).
export function markPanelSeen(): void {
  lastSeenAt = Date.now()
  publish()
}

export function setManualHidden(value: boolean): void {
  manualHidden = value
  publish()
}

export function isManualHidden(): boolean {
  return manualHidden
}

export function setPresenting(value: boolean): void {
  if (presenting === value) return
  presenting = value
  publish()
}

export function setAppVersion(version: string): void {
  appVersion = version
}

export function setUpdateReady(version: string): void {
  updateReady = version
  publish()
}

export function getUpdateReady(): string | null {
  return updateReady
}

export function setHotkeyFailed(value: boolean): void {
  if (hotkeyFailed === value) return
  hotkeyFailed = value
  publish()
}

// Re-publish every 30 s so countdowns, snoozes coming back and "meeting soon" stay current.
export function startTicker(): void {
  setInterval(publish, 30_000)
}
