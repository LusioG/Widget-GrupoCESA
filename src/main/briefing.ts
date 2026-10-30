import { powerMonitor } from 'electron'
import type { Briefing, BriefingSummary } from '../shared/types'
import { writeWithAi } from './ai/briefingAi'
import { GeminiError } from './ai/gemini'
import { GEMINI_KEY } from './ai/key'
import { getState } from './appState'
import { getSecret } from './auth/secrets'
import {
  loadBriefingAutoDate,
  loadBriefings,
  saveBriefing,
  saveBriefingAutoDate,
  BRIEFING_KEEP
} from './db/repos'
import { buildBriefing, localDate } from './engine/briefing'
import { manualOpenCountsAsShown, shouldShowBriefing } from './engine/briefingPolicy'
import { logError, logWarn } from './logger'
import { showBriefingWindow } from './windows/briefing'

const CHECK_EVERY_MS = 60_000
// The first sync runs ~15 s after launch; wait a little longer so the summary is not built on the
// cache alone.
const READY_AFTER_S = 45

let saved: Briefing[] = [] // newest day first
// The day the summary last came up by itself. A summary that exists is not enough to know: one
// made by opening it by hand must not stop the automatic one.
let autoDate: string | null = null
let timer: NodeJS.Timeout | null = null
let working = false

export async function initBriefings(): Promise<void> {
  saved = await loadBriefings()
  autoDate = await loadBriefingAutoDate()
}

async function markAutoShown(now: Date): Promise<void> {
  autoDate = localDate(now.getTime())
  await saveBriefingAutoDate(autoDate)
}

const forDate = (date?: string): Briefing | null =>
  (date ? saved.find((b) => b.date === date) : saved[0]) ?? null

export function listBriefings(): BriefingSummary[] {
  return saved.map(({ date, createdAt, mode }) => ({ date, createdAt, mode }))
}

export function getBriefing(date?: string): Briefing | null {
  return forDate(date)
}

// The AI is the only thing that makes a summary "written". If it is off, has no key, or fails
// for any reason, the summary stays the one built by rules: it never shows an error.
async function withAi(base: Briefing, now: number): Promise<Briefing> {
  const { ai } = getState().settings
  const apiKey = ai.enabled ? getSecret(GEMINI_KEY) : undefined
  if (!apiKey) return base
  try {
    return await writeWithAi(base, { apiKey, ai, now })
  } catch (error) {
    // Only the kind of failure is logged, never what was sent or received.
    logWarn(
      'briefing',
      `AI summary failed (${error instanceof GeminiError ? error.kind : 'unusable answer'}); using the rules summary`
    )
    return base
  }
}

// Builds today's summary from what the panel shows now, and keeps it. A previous one of the same
// day is replaced.
async function generate(now: number): Promise<Briefing> {
  const state = getState()
  const previous = saved.find((b) => b.date !== localDate(now))
  const base = buildBriefing({
    signals: state.signals,
    name: state.settings.profile.name,
    now,
    previousAt: previous?.createdAt
  })
  const briefing = await withAi(base, now)
  await saveBriefing(briefing)
  saved = [briefing, ...saved.filter((b) => b.date !== briefing.date)].slice(0, BRIEFING_KEEP)
  return briefing
}

// "Actualizar": today's summary again, with the data of now.
export async function regenerateBriefing(): Promise<Briefing | null> {
  try {
    return await generate(Date.now())
  } catch (error) {
    logError('briefing', 'could not rebuild the summary', error)
    return null
  }
}

// Asked by the user (panel, tray, settings): shows that day's, or today's, making it if missing.
export async function openBriefing(date?: string): Promise<void> {
  try {
    const now = new Date()
    const today = localDate(now.getTime())
    const wanted = date ?? today
    const briefing = forDate(wanted) ?? (date ? null : await generate(now.getTime()))
    if (!briefing) return
    showBriefingWindow(briefing, { focus: true })
    // Read by hand after its time: the automatic one has nothing left to say today.
    if (wanted === today && manualOpenCountsAsShown(now, getState().settings.briefing.time)) {
      await markAutoShown(now)
    }
  } catch (error) {
    logError('briefing', 'could not open the summary', error)
  }
}

// The user changed the time. A time still to come arms the automatic summary again for today, so
// it can be tried (or moved) after it already came up; a time already past leaves it as it was.
export async function onBriefingTimeChanged(time: string): Promise<void> {
  if (manualOpenCountsAsShown(new Date(), time) || autoDate === null) return
  autoDate = null
  await saveBriefingAutoDate('')
}

// Once per day, by itself: the first time the user is active after the chosen time.
export async function checkBriefing(): Promise<void> {
  if (working) return
  working = true
  try {
    const state = getState()
    const now = new Date()
    const gate = {
      now,
      enabled: state.settings.briefing.enabled && state.settings.onboardingDone,
      time: state.settings.briefing.time,
      schedule: state.settings.schedule,
      alreadyToday: autoDate === localDate(now.getTime()),
      idleSeconds: powerMonitor.getSystemIdleTime(),
      busy: state.paused || state.focus.active || state.presenting,
      ready: process.uptime() >= READY_AFTER_S
    }
    if (!shouldShowBriefing(gate)) return
    showBriefingWindow(await generate(now.getTime()), { focus: false })
    await markAutoShown(now)
  } catch (error) {
    logError('briefing', 'could not show the daily summary', error)
  } finally {
    working = false
  }
}

export function startBriefing(): void {
  if (timer) return
  timer = setInterval(() => void checkBriefing(), CHECK_EVERY_MS)
}

export function stopBriefing(): void {
  if (timer) clearInterval(timer)
  timer = null
}
