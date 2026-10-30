import { z } from 'zod'
import {
  BRIEFING_SECTIONS,
  buildContract,
  buildInstructions,
  orderSections
} from '../../shared/briefingPrompt'
import { dayOffset } from '../../shared/calendarWindow'
import { strings } from '../../shared/strings'
import type {
  Briefing,
  BriefingItem,
  BriefingNarrativeSection,
  BriefingSectionKey,
  Settings
} from '../../shared/types'
import { localDate } from '../engine/briefing'
import { askGemini, GeminiError } from './gemini'
import { maskForAi } from './redact'

type AiSettings = Settings['ai']

const hhmm = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// What the AI may read. Meeting and ClickUp titles go by default; the subject of a mail or the
// text of a Slack message only when the user turned that on.
function mayRead(item: BriefingItem, ai: AiSettings): boolean {
  if (item.source === 'gmail') return ai.sendMail
  if (item.source === 'slack') return ai.sendSlack
  return true
}

function itemData(item: BriefingItem, now: number): Record<string, unknown> {
  return {
    id: item.id,
    origen: strings.sources[item.source],
    titulo: maskForAi(item.title),
    ...(item.priority ? { prioridad: strings.panel.priority[item.priority] } : {}),
    ...(item.dueAt !== undefined
      ? { vence: localDate(item.dueAt), diasParaVencer: dayOffset(item.dueAt, now) }
      : {}),
    urgente: item.urgent
  }
}

// The data the AI works from, already masked, and the ids it is allowed to point to. A section
// the user took off the list is not sent at all.
export function buildAiPayload(
  b: Briefing,
  ai: AiSettings,
  now: number
): { data: Record<string, unknown>; ids: Set<string>; hidden: number } {
  const ids = new Set<string>()
  const hiddenIds = new Set<string>()
  const on = new Set<string>(ai.sections)
  const pick = (items: BriefingItem[]): Record<string, unknown>[] =>
    items.flatMap((item) => {
      if (!mayRead(item, ai)) {
        hiddenIds.add(item.id)
        return []
      }
      ids.add(item.id)
      return [itemData(item, now)]
    })

  const meetings = (): Record<string, unknown>[] =>
    b.meetings.map((m) => {
      ids.add(m.id)
      return {
        id: m.id,
        titulo: maskForAi(m.title),
        inicio: m.startsAt !== undefined ? hhmm(m.startsAt) : undefined,
        fin: m.endsAt !== undefined ? hhmm(m.endsAt) : undefined,
        conVideollamada: !!m.meetingUrl
      }
    })

  const data: Record<string, unknown> = { fecha: localDate(now), hora: hhmm(now) }
  if (on.has('meetings')) data['reuniones'] = meetings()
  if (on.has('priorities')) data['prioridades'] = pick(b.priorities)
  if (on.has('nextTasks')) data['proximasTareas'] = pick(b.nextTasks)
  if (on.has('yesterday')) data['pendienteDeAyer'] = pick(b.yesterday)
  if (on.has('waiting')) data['esperandoRespuesta'] = pick(b.waiting)
  if (on.has('since')) {
    data['nuevosDesdeElUltimoResumen'] = {
      correos: b.since.emails,
      mensajesSlack: b.since.messages
    }
  }
  return { data, ids, hidden: hiddenIds.size }
}

// Fixed tone, what the user wants brought, and the fixed answer format.
export function composeSystem(ai: Pick<AiSettings, 'sections' | 'extras'>): string {
  return `${buildInstructions(ai.sections, ai.extras)}\n\n${buildContract(ai.sections)}`
}

const answerSchema = z.object({
  intro: z.string().trim().min(1),
  sections: z
    .array(
      z.object({
        key: z.enum(['meetings', 'priorities', 'nextTasks', 'yesterday', 'waiting', 'since']),
        text: z.string().trim().min(1),
        refs: z.array(z.string()).default([])
      })
    )
    .default([])
})

export class AiAnswerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiAnswerError'
  }
}

const MAX_INTRO = 700
const MAX_TEXT = 700
const MAX_REFS = 5

// The model's answer, checked. A reference to something that was not sent is dropped, a section
// the user did not ask for or that repeats a key is ignored, and what is left is put in the app's
// own order.
export function parseAiAnswer(
  text: string,
  ids: Set<string>,
  allowed: readonly string[] = BRIEFING_SECTIONS
): { intro: string; narrative: BriefingNarrativeSection[] } {
  const body = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let raw: unknown
  try {
    raw = JSON.parse(body)
  } catch {
    throw new AiAnswerError('The answer is not JSON')
  }
  const parsed = answerSchema.safeParse(raw)
  if (!parsed.success) throw new AiAnswerError('The answer does not have the expected shape')

  const seen = new Set<string>()
  const narrative = parsed.data.sections
    .filter((s) => allowed.includes(s.key) && (seen.has(s.key) ? false : (seen.add(s.key), true)))
    .map((s): BriefingNarrativeSection => ({
      key: s.key,
      text: s.text.slice(0, MAX_TEXT),
      refs: [...new Set(s.refs)].filter((id) => ids.has(id)).slice(0, MAX_REFS)
    }))
    .sort((a, b) => BRIEFING_SECTIONS.indexOf(a.key) - BRIEFING_SECTIONS.indexOf(b.key))
  return { intro: parsed.data.intro.slice(0, MAX_INTRO), narrative }
}

// Nothing to say (in the sections the user chose) means no call: the summary says so by itself.
function hasContent(b: Briefing, sections: readonly string[]): boolean {
  const count: Record<BriefingSectionKey, number> = {
    meetings: b.meetings.length,
    priorities: b.priorities.length,
    nextTasks: b.nextTasks.length,
    yesterday: b.yesterday.length,
    waiting: b.waiting.length,
    since: b.since.emails + b.since.messages
  }
  return orderSections(sections).some((k) => count[k] > 0)
}

export type WriteOptions = {
  apiKey: string
  ai: AiSettings
  now: number
  fetchImpl?: typeof fetch
}

// The summary written by the AI from the rules-based one. One request; a second only if the
// answer could not be read. Any other failure is thrown so the caller can fall back.
export async function writeWithAi(base: Briefing, opts: WriteOptions): Promise<Briefing> {
  if (!hasContent(base, opts.ai.sections)) return base
  const { data, ids } = buildAiPayload(base, opts.ai, opts.now)
  const system = composeSystem(opts.ai)
  const user = `Datos de hoy (JSON):\n${JSON.stringify(data)}`

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await askGemini({
      apiKey: opts.apiKey,
      model: opts.ai.model,
      system,
      user,
      json: true,
      fetchImpl: opts.fetchImpl
    })
    try {
      const { intro, narrative } = parseAiAnswer(text, ids, opts.ai.sections)
      return { ...base, mode: 'ai', intro, narrative }
    } catch (error) {
      if (!(error instanceof AiAnswerError)) throw error
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new GeminiError('bad_response', 'Unusable answer')
}
