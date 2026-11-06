import { Notification, nativeImage } from 'electron'
import cesaLogo from '../../resources/icon.png?asset'
import calendarIcon from '../../resources/notify/calendar.png?asset'
import clickupIcon from '../../resources/notify/clickup.png?asset'
import gmailIcon from '../../resources/notify/gmail.png?asset'
import slackIcon from '../../resources/notify/slack.png?asset'
import { IPC } from '../shared/ipcChannels'
import { beforeText, meetingMove } from '../shared/meetingMove'
import { notificationText } from '../shared/notifyText'
import { strings } from '../shared/strings'
import type { AppState, Signal, Source } from '../shared/types'
import { getState, onStateChange } from './appState'
import {
  movedKey,
  shouldNotify,
  shouldNotifyMoved,
  shouldSound,
  startupHandledIds,
  startupMovedKeys,
  startupSoundIds
} from './engine/notifyPolicy'
import { getBadgeWindow } from './windows/badge'
import { openPanel } from './windows/panel'

const MAX_INDIVIDUAL = 3

// Each notification carries the logo of the app it comes from (a ring in that app's color, 256 px so
// it stays sharp on high-DPI screens). A summary of several mixes sources, so it uses the CESA logo.
const icon = (path: string): Electron.NativeImage => nativeImage.createFromPath(path)
const SOURCE_ICON: Record<Source | 'cesa', Electron.NativeImage> = {
  slack: icon(slackIcon),
  gmail: icon(gmailIcon),
  calendar: icon(calendarIcon),
  clickup: icon(clickupIcon),
  cesa: icon(cesaLogo)
}
const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

// Ids already handled, so each item notifies at most once.
const handled = new Set<string>()
// Ids that already made a sound.
const soundHandled = new Set<string>()
// Changes of a meeting's time already told (see movedKey).
const movedHandled = new Set<string>()

function show(title: string, body: string, source: Source | 'cesa' = 'cesa'): void {
  if (!Notification.isSupported()) return
  // Silent: the widget plays its own sound (configurable), so Windows must not add a second one.
  const n = new Notification({ title, body, silent: true, icon: SOURCE_ICON[source] })
  n.on('click', () => openPanel())
  n.show()
}

// "Probar avisos" (Ajustes): one example notification of each source, a moment apart, so the
// person can see how they look and that Windows shows them. It ignores the quiet rules on purpose.
const TEST_GAP_MS = 1500
export function showTestNotifications(): void {
  const examples: [string, string, Source][] = [
    [strings.sources.slack, strings.notify.testSlack, 'slack'],
    [strings.sources.gmail, strings.notify.testGmail, 'gmail'],
    [strings.notify.meetingSoon, strings.notify.testMeeting, 'calendar'],
    [strings.sources.clickup, strings.notify.testClickup, 'clickup']
  ]
  examples.forEach(([title, body, source], i) =>
    setTimeout(() => show(title, body, source), i * TEST_GAP_MS)
  )
}

// One sound per batch, however many notifications it holds.
function playSound(): void {
  const win = getBadgeWindow()
  if (win && !win.isDestroyed()) win.webContents.send(IPC.playSound)
}

// "Revisión de presupuesto: atrasada, ahora a las 16:00 (antes 15:00)".
function movedBody(s: Signal, now: number): string {
  const startsAt = s.startsAt ?? s.occurredAt
  const move = meetingMove(startsAt, s.movedFrom)
  if (!move) return s.title
  return strings.notify.meetingMovedBody(
    s.title,
    move.direction,
    clock.format(startsAt),
    beforeText(move, startsAt, now)
  )
}

function onState(state: AppState): void {
  const now = Date.now()
  // The sound has its own switch: it follows the same quiet rules but not "Notificaciones del sistema".
  const ctx = {
    enabled: true,
    paused: state.paused,
    workTime: !state.outsideHours,
    focus: state.focus.active
  }
  // Separate sets: an ordinary mail that already sounded can still notify later if it turns urgent.
  const sounding = state.signals.filter((s) => !soundHandled.has(s.id) && shouldSound(s, ctx, now))
  sounding.forEach((s) => soundHandled.add(s.id))
  const moved = state.signals.filter(
    (s) => !movedHandled.has(movedKey(s)) && shouldNotifyMoved(s, ctx, now)
  )
  moved.forEach((s) => movedHandled.add(movedKey(s)))
  // No sound while the user is presenting or has something full screen.
  if (
    (sounding.length > 0 || moved.length > 0) &&
    state.settings.notifications.sound &&
    !state.presenting
  ) {
    playSound()
  }
  if (moved.length > 0 && state.settings.notifications.enabled) {
    for (const s of moved) show(strings.notify.meetingMoved, movedBody(s, now), s.source)
  }

  const due = state.signals.filter((s) => !handled.has(s.id) && shouldNotify(s, ctx, now))
  if (due.length === 0) return
  due.forEach((s) => handled.add(s.id))
  if (!state.settings.notifications.enabled) return

  // After a quiet period many items can pile up: send one summary instead of a burst.
  if (due.length > MAX_INDIVIDUAL) {
    show(strings.appName, strings.notify.summary(due.length))
    return
  }
  for (const s of due) {
    const { title, body } = notificationText(s)
    show(title, body, s.source)
  }
}

// What was already announceable at startup is not announced again; see startupHandledIds.
export function startNotifier(): void {
  const signals = getState().signals
  startupHandledIds(signals, Date.now()).forEach((id) => handled.add(id))
  startupSoundIds(signals, Date.now()).forEach((id) => soundHandled.add(id))
  startupMovedKeys(signals, Date.now()).forEach((key) => movedHandled.add(key))
  onStateChange(onState)
}
