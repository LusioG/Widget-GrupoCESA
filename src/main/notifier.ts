import { Notification } from 'electron'
import { IPC } from '../shared/ipcChannels'
import { strings } from '../shared/strings'
import type { AppState, Signal } from '../shared/types'
import { getState, onStateChange } from './appState'
import { shouldNotify, startupHandledIds } from './engine/notifyPolicy'
import { getBadgeWindow } from './windows/badge'
import { openPanel } from './windows/panel'

const MAX_INDIVIDUAL = 3

// Ids already handled, so each item notifies at most once.
const handled = new Set<string>()

function show(title: string, body: string): void {
  if (!Notification.isSupported()) return
  // Silent: the widget plays its own sound (configurable), so Windows must not add a second one.
  const n = new Notification({ title, body, silent: true })
  n.on('click', () => openPanel())
  n.show()
}

// One sound per batch, however many notifications it holds.
function playSound(): void {
  const win = getBadgeWindow()
  if (win && !win.isDestroyed()) win.webContents.send(IPC.playSound)
}

function describe(s: Signal): { title: string; body: string } {
  if (s.kind === 'meeting') return { title: strings.notify.meetingSoon, body: s.title }
  return { title: strings.sources[s.source], body: s.title }
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
  const due = state.signals.filter((s) => !handled.has(s.id) && shouldNotify(s, ctx, now))
  if (due.length === 0) return
  due.forEach((s) => handled.add(s.id))
  // No sound while the user is presenting or has something full screen.
  if (state.settings.notifications.sound && !state.presenting) playSound()
  if (!state.settings.notifications.enabled) return

  // After a quiet period many items can pile up: send one summary instead of a burst.
  if (due.length > MAX_INDIVIDUAL) {
    show(strings.appName, strings.notify.summary(due.length))
    return
  }
  for (const s of due) {
    const { title, body } = describe(s)
    show(title, body)
  }
}

// What was already announceable at startup is not announced again; see startupHandledIds.
export function startNotifier(): void {
  startupHandledIds(getState().signals, Date.now()).forEach((id) => handled.add(id))
  onStateChange(onState)
}
