import type { Settings } from '../../shared/types'
import { isWorkTime } from './quiet'

// The summary waits for you to be at the computer, not just for the PC to be on.
export const ACTIVE_WITHIN_S = 120

export type BriefingGate = {
  now: Date
  enabled: boolean
  time: string // HH:MM, not before this
  schedule: Settings['schedule']
  alreadyToday: boolean // today's summary already came up by itself (or the user already saw it)
  idleSeconds: number // how long the user has not touched the keyboard or mouse
  busy: boolean // alerts paused, focus mode, or presenting
  ready: boolean // the first sync after launch has had time to finish
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Opening the summary by hand only takes the automatic one's place when the chosen time has
// already passed: it would pop up again a minute later with what the user has just read. Opening
// it earlier (to look, or to try it) leaves the automatic one for its time.
export function manualOpenCountsAsShown(now: Date, time: string): boolean {
  return now.getHours() * 60 + now.getMinutes() >= toMinutes(time)
}

// Once per day: the first time the user is active on a work day, in work hours, after `time`.
export function shouldShowBriefing(gate: BriefingGate): boolean {
  if (!gate.enabled || gate.alreadyToday || gate.busy || !gate.ready) return false
  if (!isWorkTime(gate.now, gate.schedule)) return false
  if (gate.now.getHours() * 60 + gate.now.getMinutes() < toMinutes(gate.time)) return false
  return gate.idleSeconds < ACTIVE_WITHIN_S
}
