import type { Signal } from '../../shared/types'
import { MEETING_SOON_MS, URGENT_THRESHOLD } from '../../shared/badgeState'

export type NotifyContext = {
  enabled: boolean
  paused: boolean // "Pausar alertas" / do not disturb
  workTime: boolean
  focus: boolean
}

// At startup, what would notify right now counts as already announced (it was announced in the
// previous session, so it is not repeated at every launch). Anything that cannot notify yet, such
// as a meeting more than 10 minutes away or a message that is not urgent, stays eligible and
// still notifies when its time comes.
export function startupHandledIds(signals: Signal[], now: number): string[] {
  const open: NotifyContext = { enabled: true, paused: false, workTime: true, focus: false }
  return signals.filter((s) => shouldNotify(s, open, now)).map((s) => s.id)
}

// The sound is wider than the system notification: besides everything that notifies, it also
// covers ordinary (not urgent) mail and Slack messages. It stays quiet when paused, outside work
// hours and in focus mode, where only what breaks through (see shouldNotify) may sound.
export function shouldSound(signal: Signal, ctx: NotifyContext, now: number): boolean {
  if (shouldNotify(signal, ctx, now)) return true
  if (!ctx.enabled || ctx.paused || !ctx.workTime || ctx.focus) return false
  return signal.kind === 'email' || signal.kind === 'mention' || signal.kind === 'dm'
}

// Same idea as startupHandledIds, for the sound: the mail and messages already there at launch
// do not make a sound; only what arrives afterwards does.
export function startupSoundIds(signals: Signal[], now: number): string[] {
  const open: NotifyContext = { enabled: true, paused: false, workTime: true, focus: false }
  return signals.filter((s) => shouldSound(s, open, now)).map((s) => s.id)
}

// A meeting that changed time and starts within the next day: worth telling, once per change. A
// change for a meeting far ahead only shows as a tag in the panel.
export const MOVED_NOTIFY_WINDOW_MS = 24 * 60 * 60 * 1000

// One change of one meeting: if it moves again it is a new key and tells again.
export const movedKey = (s: Signal): string => `${s.id}@${s.startsAt}<${s.movedFrom}`

export function shouldNotifyMoved(signal: Signal, ctx: NotifyContext, now: number): boolean {
  if (!ctx.enabled || ctx.paused || !ctx.workTime || ctx.focus) return false
  if (signal.kind !== 'meeting' || signal.movedFrom === undefined) return false
  if (signal.startsAt === undefined || signal.startsAt === signal.movedFrom) return false
  const startsIn = signal.startsAt - now
  return startsIn > 0 && startsIn <= MOVED_NOTIFY_WINDOW_MS
}

// At startup, the changes already there were announced in the previous session. A change that
// shows up afterwards (the meeting moved while the widget was closed) still tells.
export function startupMovedKeys(signals: Signal[], now: number): string[] {
  const open: NotifyContext = { enabled: true, paused: false, workTime: true, focus: false }
  return signals.filter((s) => shouldNotifyMoved(s, open, now)).map(movedKey)
}

// Few notifications on purpose: urgent items, people writing to you, and meetings about to start.
export function shouldNotify(signal: Signal, ctx: NotifyContext, now: number): boolean {
  if (!ctx.enabled || ctx.paused || !ctx.workTime) return false

  if (signal.kind === 'meeting') {
    if (ctx.focus || signal.startsAt === undefined) return false
    const startsIn = signal.startsAt - now
    return startsIn >= 0 && startsIn <= MEETING_SOON_MS
  }

  const urgency = signal.urgency ?? 0
  if (urgency >= URGENT_THRESHOLD) return true // urgent breaks through focus mode
  if (ctx.focus) return false
  return (signal.kind === 'mention' || signal.kind === 'dm') && urgency >= 0.5
}
