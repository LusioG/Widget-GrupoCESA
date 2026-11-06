import { z } from 'zod'
import {
  BRIEFING_SECTIONS,
  buildContract,
  buildInstructions,
  orderSections
} from '../../shared/briefingPrompt'
import { dayOffset } from '../../shared/calendarWindow'
import { meetingMove } from '../../shared/meetingMove'
import { strings } from '../../shared/strings'
import type {
  AiLevel,
  AiNoticeKey,
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

// How much of an item the AI may read. Meeting and ClickUp titles always go; of mail, lists and
// Slack only what the user allowed: the counts (nothing of the item), its subject or text, or that
// and who wrote it.
function levelOf(item: BriefingItem, ai: AiSettings): AiLevel {
  if (item.source === 'gmail') return item.listName ? ai.lists : ai.mail
  if (item.source === 'slack') return ai.slack
  return 'people'
}

const mayRead = (item: BriefingItem, ai: AiSettings): boolean => levelOf(item, ai) !== 'counts'

// Which switch a hidden item belongs to, so the summary can say what the AI did not see.
function noticeOf(item: BriefingItem): AiNoticeKey | null {
  if (item.source === 'gmail') return item.listName ? 'lists' : 'mail'
  return item.source === 'slack' ? 'slack' : null
}

function itemData(item: BriefingItem, now: number, ai: AiSettings): Record<string, unknown> {
  return {
    id: item.id,
    origen: strings.sources[item.source],
    titulo: maskForAi(item.title),
    ...(item.listName ? { lista: maskForAi(item.listName) } : {}),
    // Slack: how it reached the user. Who wrote it (a Slack message, a mail) goes only at the top
    // level. The name of the user is never sent.
    ...(item.source === 'slack' && (item.kind === 'dm' || item.kind === 'mention')
      ? { tipo: item.kind === 'dm' ? 'mensaje directo' : 'mención en un canal' }
      : {}),
    ...(levelOf(item, ai) === 'people' && item.from ? { de: maskForAi(item.from) } : {}),
    ...(item.priority ? { prioridad: strings.panel.priority[item.priority] } : {}),
    ...(item.dueAt !== undefined
      ? { vence: localDate(item.dueAt), diasParaVencer: dayOffset(item.dueAt, now) }
      : {}),
    urgente: item.urgent
  }
}

// The data the AI works from, already masked, and the ids it is allowed to point to. A section
// the user took off the list is not sent at all. `notices` are the sources it was NOT allowed to
// read although the summary has something from them.
export function buildAiPayload(
  b: Briefing,
  ai: AiSettings,
  now: number
): { data: Record<string, unknown>; ids: Set<string>; hidden: number; notices: AiNoticeKey[] } {
  const ids = new Set<string>()
  const hiddenIds = new Set<string>()
  const notices = new Set<AiNoticeKey>()
  const on = new Set<string>(ai.sections)
  const pick = (items: BriefingItem[]): Record<string, unknown>[] =>
    items.flatMap((item) => {
      if (!mayRead(item, ai)) {
        hiddenIds.add(item.id)
        const notice = noticeOf(item)
        if (notice) notices.add(notice)
        return []
      }
      ids.add(item.id)
      return [itemData(item, now, ai)]
    })

  const meetings = (): Record<string, unknown>[] =>
    b.meetings.map((m) => {
      ids.add(m.id)
      const move = meetingMove(m.startsAt, m.movedFrom)
      return {
        id: m.id,
        titulo: maskForAi(m.title),
        inicio: m.startsAt !== undefined ? hhmm(m.startsAt) : undefined,
        fin: m.endsAt !== undefined ? hhmm(m.endsAt) : undefined,
        conVideollamada: !!m.meetingUrl,
        // Only when its time was changed: "adelantada" or "atrasada", and the time it had before.
        ...(move
          ? {
              cambioDeHorario: move.direction === 'earlier' ? 'adelantada' : 'atrasada',
              horaAnterior: hhmm(move.before)
            }
          : {})
      }
    })

  // The latest mails: how many there are, and (if allowed) each one's subject and sender.
  const mailSection = (): Record<string, unknown> => {
    const total = b.mailTotal ?? 0
    if (ai.mail === 'counts') {
      if (total > 0) notices.add('mail')
      return { cantidad: total }
    }
    return { cantidad: total, ultimos: pick(b.mail ?? []) }
  }

  // The lists, already grouped: counts for every list, and (if allowed) its name and latest subjects.
  const listsSection = (): Record<string, unknown> => {
    const groups = b.lists ?? []
    const conversations = groups.reduce((sum, g) => sum + g.conversations, 0)
    const unread = groups.reduce((sum, g) => sum + g.unread, 0)
    if (ai.lists === 'counts') {
      if (groups.length > 0) notices.add('lists')
      return { conversacionesNuevas: conversations, mensajesSinLeer: unread }
    }
    return {
      conversacionesNuevas: conversations,
      mensajesSinLeer: unread,
      listas: groups.map((g) => ({
        lista: maskForAi(g.name),
        conversaciones: g.conversations,
        sinLeer: g.unread,
        urgente: g.urgent,
        ultimas: pick(g.items)
      }))
    }
  }

  const data: Record<string, unknown> = { fecha: localDate(now), hora: hhmm(now) }
  if (on.has('meetings')) data['reuniones'] = meetings()
  if (on.has('priorities')) data['prioridades'] = pick(b.priorities)
  if (on.has('nextTasks')) data['proximasTareas'] = pick(b.nextTasks)
  if (on.has('yesterday')) data['pendienteDeAyer'] = pick(b.yesterday)
  if (on.has('waiting')) data['esperandoRespuesta'] = pick(b.waiting)
  if (on.has('mail')) data['correos'] = mailSection()
  if (on.has('lists')) data['listas'] = listsSection()
  if (on.has('since')) {
    data['nuevosDesdeElUltimoResumen'] = {
      correos: b.since.emails,
      mensajesSlack: b.since.messages
    }
  }
  return { data, ids, hidden: hiddenIds.size, notices: [...notices] }
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
        key: z.enum([
          'meetings',
          'priorities',
          'nextTasks',
          'yesterday',
          'waiting',
          'mail',
          'lists',
          'since'
        ]),
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
    mail: b.mailTotal ?? 0,
    lists: (b.lists ?? []).length,
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
  const { data, ids, notices } = buildAiPayload(base, opts.ai, opts.now)
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
      return { ...base, mode: 'ai', intro, narrative, ...(notices.length > 0 ? { notices } : {}) }
    } catch (error) {
      if (!(error instanceof AiAnswerError)) throw error
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new GeminiError('bad_response', 'Unusable answer')
}
