import { describe, expect, it, vi } from 'vitest'
import {
  buildAiPayload,
  composeSystem,
  parseAiAnswer,
  writeWithAi
} from '../src/main/ai/briefingAi'
import { askGemini, GeminiError, testGemini } from '../src/main/ai/gemini'
import { maskForAi } from '../src/main/ai/redact'
import { buildBriefing } from '../src/main/engine/briefing'
import {
  BRIEFING_SECTIONS,
  buildContract,
  buildInstructions,
  SECTION_TOPICS
} from '../src/shared/briefingPrompt'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Briefing, Signal } from '../src/shared/types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const now = new Date(2026, 9, 28, 9, 30).getTime()
const ai = { ...DEFAULT_SETTINGS.ai, enabled: true }

const sig = (over: Partial<Signal>): Signal => ({
  id: 'clickup:1',
  source: 'clickup',
  kind: 'task',
  title: 'Voicebot de atención',
  url: 'https://example.com/t/1',
  occurredAt: now,
  urgency: 0.5,
  dueAt: now + 2 * DAY,
  ...over
})

const signals: Signal[] = [
  sig({}),
  sig({
    id: 'gmail:9',
    source: 'gmail',
    kind: 'email',
    title: 'Factura de octubre',
    dueAt: undefined
  }),
  sig({
    id: 'slack:7',
    source: 'slack',
    kind: 'dm',
    title: 'Hola, ¿tienes un minuto?',
    dueAt: undefined
  }),
  sig({
    id: 'calendar:5',
    source: 'calendar',
    kind: 'meeting',
    title: 'Daily',
    startsAt: now + HOUR,
    endsAt: now + 2 * HOUR,
    meetingUrl: 'https://meet.google.com/abc',
    dueAt: undefined
  })
]
const base = buildBriefing({ signals, name: 'Ana', now })

// A fake `fetch` that answers with the given JSON and status.
const reply = (status: number, body: unknown): ReturnType<typeof vi.fn<() => Promise<Response>>> =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response)

const answer = (text: string): unknown => ({ candidates: [{ content: { parts: [{ text }] } }] })

describe('what is sent to the AI', () => {
  it('sends meeting and ClickUp titles, but not mail or Slack by default', () => {
    const { data, ids, hidden } = buildAiPayload(base, ai, now)
    const text = JSON.stringify(data)
    expect(text).toContain('Voicebot de atención')
    expect(text).toContain('Daily')
    expect(text).not.toContain('Factura de octubre')
    expect(text).not.toContain('tienes un minuto')
    expect(ids.has('clickup:1')).toBe(true)
    expect(ids.has('gmail:9')).toBe(false)
    expect(hidden).toBe(2)
  })

  it('sends mail and Slack only when the user allows each one', () => {
    const mail = JSON.stringify(buildAiPayload(base, { ...ai, sendMail: true }, now).data)
    expect(mail).toContain('Factura de octubre')
    expect(mail).not.toContain('tienes un minuto')
    const slack = JSON.stringify(buildAiPayload(base, { ...ai, sendSlack: true }, now).data)
    expect(slack).toContain('tienes un minuto')
  })

  it('always sends the counts of new mail and messages, never their text', () => {
    const { data } = buildAiPayload(base, ai, now)
    expect(data['nuevosDesdeElUltimoResumen']).toEqual({ correos: 1, mensajesSlack: 1 })
  })

  it('does not send the name of the user', () => {
    expect(JSON.stringify(buildAiPayload(base, ai, now).data)).not.toContain('Ana')
  })

  it('masks credentials, cards, documents and passwords inside a title', () => {
    expect(maskForAi('clave: hunter2 y la tarjeta 4111 1111 1111 1111')).not.toMatch(/hunter2|4111/)
    expect(maskForAi('DNI 12.345.678')).toContain('[documento]')
    expect(maskForAi('CUIT 20-12345678-9')).toContain('[documento]')
    expect(maskForAi('token xoxp-1234567890-abcdef')).toContain('[slack-token]')
    expect(maskForAi('escribe a ana@empresa.com')).toContain('[email]')
  })

  it('does not send a section the user took off the list', () => {
    const { data, ids } = buildAiPayload(
      base,
      { ...ai, sections: ['priorities'], sendMail: true, sendSlack: true },
      now
    )
    expect(Object.keys(data).sort()).toEqual(['fecha', 'hora', 'prioridades'])
    expect(JSON.stringify(data)).not.toContain('Daily')
    expect(ids.has('calendar:5')).toBe(false)
  })
})

describe('the instructions', () => {
  it('keep the tone and the format fixed and list what to bring, in order', () => {
    const text = composeSystem(ai)
    expect(text).toContain('Incluye, cuando haya datos:')
    for (const key of BRIEFING_SECTIONS) expect(text).toContain(`- ${SECTION_TOPICS[key]}.`)
    expect(text).toContain('Reglas del formato (no negociables)')
    expect(text.indexOf(SECTION_TOPICS.meetings)).toBeLessThan(text.indexOf(SECTION_TOPICS.since))
  })

  it('only list what the user kept, and the format only allows those sections', () => {
    const text = composeSystem({ sections: ['since', 'meetings'], extras: [] })
    expect(text).toContain(`- ${SECTION_TOPICS.meetings}.`)
    expect(text).not.toContain(SECTION_TOPICS.priorities)
    expect(text).toContain('uno de: meetings, since')
  })

  it('add the user’s own items, kept on one line each', () => {
    const text = buildInstructions(['meetings'], ['destaca lo que vence\nesta semana', '  '])
    expect(text).toContain('- destaca lo que vence esta semana')
    expect(text).toContain('Hazlo solo si los datos lo permiten')
  })

  it('say nothing about extras when there are none', () => {
    expect(buildInstructions(['meetings'], [])).not.toContain('Además')
  })

  it('allow no sections at all when the list is empty', () => {
    expect(buildContract([])).toContain('va siempre vacío')
  })
})

describe('reading the answer', () => {
  const ids = new Set(['clickup:1', 'calendar:5'])

  it('keeps the text, drops references to things that were not sent, and orders the sections', () => {
    const out = parseAiAnswer(
      JSON.stringify({
        intro: 'Día tranquilo.',
        sections: [
          {
            key: 'priorities',
            text: 'Empieza por el voicebot.',
            refs: ['clickup:1', 'inventado:3']
          },
          { key: 'meetings', text: 'Daily a las 10:30.', refs: ['calendar:5'] }
        ]
      }),
      ids
    )
    expect(out.intro).toBe('Día tranquilo.')
    expect(out.narrative.map((s) => s.key)).toEqual(['meetings', 'priorities'])
    expect(out.narrative[1].refs).toEqual(['clickup:1'])
  })

  it('accepts an answer wrapped in a code block and ignores a repeated section', () => {
    const body = JSON.stringify({
      intro: 'Hola',
      sections: [
        { key: 'since', text: 'uno' },
        { key: 'since', text: 'dos' }
      ]
    })
    const out = parseAiAnswer(`\`\`\`json\n${body}\n\`\`\``, ids)
    expect(out.narrative).toEqual([{ key: 'since', text: 'uno', refs: [] }])
  })

  it('refuses text that is not the expected JSON', () => {
    expect(() => parseAiAnswer('Claro, aquí tienes tu resumen', ids)).toThrow()
    expect(() => parseAiAnswer(JSON.stringify({ intro: '' }), ids)).toThrow()
    expect(() =>
      parseAiAnswer(JSON.stringify({ intro: 'x', sections: [{ key: 'otra', text: 'y' }] }), ids)
    ).toThrow()
  })
})

describe('writing the summary with the AI', () => {
  const good = JSON.stringify({
    intro: 'Hoy tienes una reunión y una tarea por vencer.',
    sections: [{ key: 'priorities', text: 'Lo primero es el voicebot.', refs: ['clickup:1'] }]
  })

  it('returns the summary in words, keeping the lists as the detail', async () => {
    const fetchImpl = reply(200, answer(good))
    const out = await writeWithAi(base, { apiKey: 'k'.repeat(30), ai, now, fetchImpl })
    expect(out.mode).toBe('ai')
    expect(out.intro).toContain('una reunión')
    expect(out.narrative?.[0].refs).toEqual(['clickup:1'])
    expect(out.priorities).toEqual(base.priorities)
  })

  it('puts the key in a header, not in the address, and asks for JSON', async () => {
    const fetchImpl = reply(200, answer(good))
    await writeWithAi(base, { apiKey: 'secret-key-1234567890abc', ai, now, fetchImpl })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent')
    expect(url).not.toContain('secret-key')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'secret-key-1234567890abc'
    )
    expect(JSON.parse(init.body as string).generationConfig.responseMimeType).toBe(
      'application/json'
    )
  })

  it('sends the instructions and only the allowed data', async () => {
    const fetchImpl = reply(200, answer(good))
    await writeWithAi(base, { apiKey: 'k'.repeat(30), ai, now, fetchImpl })
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.systemInstruction.parts[0].text).toContain('Incluye, cuando haya datos:')
    const sent = JSON.stringify(body.contents)
    expect(sent).toContain('Voicebot de atención')
    expect(sent).not.toContain('Factura de octubre')
  })

  it('ignores a section the user did not ask for', async () => {
    const answerWithExtra = JSON.stringify({
      intro: 'Hola',
      sections: [
        { key: 'meetings', text: 'Daily a las 10:30.', refs: ['calendar:5'] },
        { key: 'priorities', text: 'El voicebot.', refs: ['clickup:1'] }
      ]
    })
    const out = await writeWithAi(base, {
      apiKey: 'k'.repeat(30),
      ai: { ...ai, sections: ['priorities'] },
      now,
      fetchImpl: reply(200, answer(answerWithExtra))
    })
    expect(out.narrative?.map((s) => s.key)).toEqual(['priorities'])
  })

  it('makes no request when the sections kept have nothing to say', async () => {
    const fetchImpl = reply(200, answer(good))
    const onlyWaiting = { ...ai, sections: ['waiting' as const] }
    const out = await writeWithAi(base, { apiKey: 'k'.repeat(30), ai: onlyWaiting, now, fetchImpl })
    expect(out).toBe(base)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('tries once more when the answer cannot be read, then gives up', async () => {
    const fetchImpl = reply(200, answer('no es json'))
    await expect(
      writeWithAi(base, { apiKey: 'k'.repeat(30), ai, now, fetchImpl })
    ).rejects.toBeTruthy()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry when the key or the quota is the problem', async () => {
    const fetchImpl = reply(429, { error: { message: 'quota' } })
    await expect(
      writeWithAi(base, { apiKey: 'k'.repeat(30), ai, now, fetchImpl })
    ).rejects.toMatchObject({ kind: 'quota' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('makes no request when there is nothing to say', async () => {
    const fetchImpl = reply(200, answer(good))
    const empty: Briefing = buildBriefing({ signals: [], name: '', now })
    const out = await writeWithAi(empty, { apiKey: 'k'.repeat(30), ai, now, fetchImpl })
    expect(out).toBe(empty)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('Gemini errors', () => {
  const ask = (status: number, body: unknown = {}): Promise<string> =>
    askGemini({ apiKey: 'k'.repeat(30), model: 'm', user: 'x', fetchImpl: reply(status, body) })

  it('tells apart a refused key, an unknown model and the quota', async () => {
    await expect(
      ask(400, { error: { message: 'API key not valid. Please pass a valid API key.' } })
    ).rejects.toMatchObject({ kind: 'auth' })
    await expect(ask(403)).rejects.toMatchObject({ kind: 'auth' })
    await expect(ask(404)).rejects.toMatchObject({ kind: 'model' })
    await expect(ask(429)).rejects.toMatchObject({ kind: 'quota' })
    await expect(ask(500)).rejects.toMatchObject({ kind: 'network' })
  })

  it('reports a lost connection as a network problem', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(
      askGemini({ apiKey: 'k'.repeat(30), model: 'm', user: 'x', fetchImpl })
    ).rejects.toBeInstanceOf(GeminiError)
  })

  it('treats an empty reply as unusable', async () => {
    await expect(ask(200, { candidates: [] })).rejects.toMatchObject({ kind: 'bad_response' })
  })

  it('the connection test passes when the key works even if the reply has no text', async () => {
    await expect(
      testGemini('k'.repeat(30), 'm', reply(200, { candidates: [] }))
    ).resolves.toBeUndefined()
    await expect(testGemini('k'.repeat(30), 'm', reply(403, {}))).rejects.toMatchObject({
      kind: 'auth'
    })
  })
})
