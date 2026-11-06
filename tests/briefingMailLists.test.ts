import { describe, expect, it, vi } from 'vitest'
import { buildAiPayload, composeSystem, writeWithAi } from '../src/main/ai/briefingAi'
import { buildBriefing, MAX_MAIL } from '../src/main/engine/briefing'
import { BRIEFING_SECTIONS } from '../src/shared/briefingPrompt'
import { senderNames } from '../src/shared/personName'
import {
  DEFAULT_SETTINGS,
  migrateLegacy,
  settingsPatchSchema,
  settingsSchema
} from '../src/shared/settingsSchema'
import type { Settings, Signal } from '../src/shared/types'

const HOUR = 3_600_000
const now = new Date(2026, 10, 6, 9, 0).getTime()
const ai: Settings['ai'] = { ...DEFAULT_SETTINGS.ai, enabled: true }

const mail = (n: number, over: Partial<Signal> = {}): Signal => ({
  id: `gmail:m${n}`,
  source: 'gmail',
  kind: 'email',
  title: `Asunto ${n}`,
  url: 'https://mail.google.com',
  occurredAt: now - n * HOUR,
  sender: `Persona ${n} <p${n}@empresa.com>`,
  urgency: 0.3,
  ...over
})

const conversation = (
  id: string,
  list: { address: string; name: string },
  over: Partial<Signal> = {}
): Signal => ({
  id: `gmail:list:${id}:m1`,
  source: 'gmail',
  kind: 'email',
  title: `Tema ${id}`,
  url: 'https://mail.google.com',
  occurredAt: now - HOUR,
  sender: 'Ana Pérez <ana@sedenorte.com> | Luis Gómez <luis@cesa.com>',
  list,
  threadId: id,
  unread: 2,
  urgency: 0.3,
  ...over
})

const SOPORTE = { address: 'soporte@cesa.com', name: 'Soporte CESA' }
const VENTAS = { address: 'ventas@cesa.com', name: 'Ventas' }

const signals: Signal[] = [
  mail(1),
  mail(2),
  mail(3),
  mail(4),
  mail(5, { seen: true }), // opened: not "unread" any more
  conversation('a1', SOPORTE),
  conversation('a2', SOPORTE, { occurredAt: now - 2 * HOUR, unread: 4 }),
  conversation('b1', VENTAS, { urgency: 0.9 }),
  conversation('c1', VENTAS, { seen: true })
]
const base = buildBriefing({ signals, name: 'Luciano', now })

const text = (settings: Settings['ai']): string =>
  JSON.stringify(buildAiPayload(base, settings, now).data)

describe('the summary has a section for the latest mails and one for the lists', () => {
  it('brings the latest unread individual mails, newest first, and how many there are in all', () => {
    expect(MAX_MAIL).toBe(3)
    expect(base.mail?.map((m) => m.title)).toEqual(['Asunto 1', 'Asunto 2', 'Asunto 3'])
    expect(base.mailTotal).toBe(4) // the opened one and the list conversations are not counted
  })

  it('groups the lists in code: counts per list, the urgent one first', () => {
    expect(base.lists?.map((l) => l.name)).toEqual(['Ventas', 'Soporte CESA'])
    const [ventas, soporte] = base.lists!
    expect(ventas).toMatchObject({ conversations: 1, unread: 2, urgent: true })
    expect(soporte).toMatchObject({ conversations: 2, unread: 6, urgent: false })
    expect(soporte.items.map((i) => i.title)).toEqual(['Tema a1', 'Tema a2']) // newest first
  })

  it('names who wrote, without addresses', () => {
    expect(base.mail?.[0].from).toBe('Persona 1')
    expect(base.lists?.[1].items[0].from).toBe('Ana Pérez, Luis Gómez')
    expect(senderNames('"Ana, la jefa" <a@x.com>')).toBe('Ana, la jefa')
    expect(senderNames('soporte@cesa.com')).toBe('soporte')
    expect(senderNames(undefined)).toBe('')
  })

  it('are two more sections, on by default, before "since"', () => {
    expect(BRIEFING_SECTIONS.indexOf('mail')).toBeLessThan(BRIEFING_SECTIONS.indexOf('lists'))
    expect(BRIEFING_SECTIONS.indexOf('lists')).toBeLessThan(BRIEFING_SECTIONS.indexOf('since'))
    expect(DEFAULT_SETTINGS.ai.sections).toEqual(expect.arrayContaining(['mail', 'lists']))
    expect(composeSystem(ai)).toContain('Los últimos 3 correos sin leer')
    expect(composeSystem(ai)).toContain('Lo nuevo en tus listas de distribución')
  })

  it('a summary saved before them still opens: they are optional', () => {
    const { mail: _mail, mailTotal: _total, lists: _lists, ...old } = base
    void [_mail, _total, _lists]
    expect(() => buildAiPayload(old, { ...ai, mail: 'titles', lists: 'titles' }, now)).not.toThrow()
  })
})

describe('what the AI reads of each source depends on its level', () => {
  it('counts only (the default): how many, and nothing of what they say or who sent them', () => {
    const sent = text(ai)
    expect(sent).toContain('"correos":{"cantidad":4}')
    expect(sent).toContain('"listas":{"conversacionesNuevas":3,"mensajesSinLeer":8}')
    for (const secret of ['Asunto', 'Tema', 'Soporte', 'Ventas', 'Persona', 'Ana', 'empresa.com']) {
      expect(sent).not.toContain(secret)
    }
  })

  it('titles: the subjects and the name of the list, not who wrote', () => {
    const sent = text({ ...ai, mail: 'titles', lists: 'titles' })
    expect(sent).toContain('Asunto 1')
    expect(sent).toContain('"lista":"Soporte CESA"')
    expect(sent).toContain('Tema a1')
    expect(sent).not.toContain('"de"')
    expect(sent).not.toContain('Persona')
  })

  it('people: also who wrote, as names only', () => {
    const sent = text({ ...ai, mail: 'people', lists: 'people' })
    expect(sent).toContain('"de":"Persona 1"')
    expect(sent).toContain('"de":"Ana Pérez, Luis Gómez"')
    expect(sent).not.toMatch(/@/)
  })

  it('each source has its own level: mail can be open while the lists stay at counts', () => {
    const sent = text({ ...ai, mail: 'titles' })
    expect(sent).toContain('Asunto 1')
    expect(sent).not.toContain('Tema a1')
    expect(sent).not.toContain('Soporte')
  })

  it('a section taken off the list is not sent at all', () => {
    const { data } = buildAiPayload(base, { ...ai, sections: ['meetings'], mail: 'people' }, now)
    expect(Object.keys(data)).not.toContain('correos')
    expect(Object.keys(data)).not.toContain('listas')
  })

  it('a list conversation in the priorities follows the level of the lists, not the mail one', () => {
    const only = buildBriefing({
      signals: [conversation('z9', SOPORTE, { urgency: 0.9 })],
      name: '',
      now
    })
    const sent = JSON.stringify(
      buildAiPayload(only, { ...ai, sections: ['priorities'], mail: 'people' }, now).data
    )
    expect(sent).not.toContain('Tema z9') // lists are still at counts
  })
})

describe('the summary says what the AI could not see', () => {
  it('names each source that is at counts although the summary has something from it', () => {
    expect(buildAiPayload(base, ai, now).notices.sort()).toEqual(['lists', 'mail'])
  })

  it('has none once the sources are opened', () => {
    expect(buildAiPayload(base, { ...ai, mail: 'titles', lists: 'titles' }, now).notices).toEqual(
      []
    )
  })

  it('says it for Slack too, when its messages were among the priorities', () => {
    const slack: Signal = {
      id: 'slack:1',
      source: 'slack',
      kind: 'dm',
      title: 'hola',
      url: 'https://slack.com',
      occurredAt: now,
      sender: 'Pablo',
      urgency: 0.9
    }
    const b = buildBriefing({ signals: [slack], name: '', now })
    expect(buildAiPayload(b, ai, now).notices).toEqual(['slack'])
    expect(buildAiPayload(b, { ...ai, slack: 'titles' }, now).notices).toEqual([])
  })

  it('says nothing about a source the user did not ask for', () => {
    const { notices } = buildAiPayload(base, { ...ai, sections: ['meetings'] }, now)
    expect(notices).toEqual([])
  })

  it('goes with the summary the AI writes', async () => {
    const answer = {
      candidates: [
        { content: { parts: [{ text: JSON.stringify({ intro: 'Hola.', sections: [] }) }] } }
      ]
    }
    const fetchImpl = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => answer }) as Response
    )
    const out = await writeWithAi(base, { apiKey: 'k'.repeat(30), ai, now, fetchImpl })
    expect(out.notices?.slice().sort()).toEqual(['lists', 'mail'])
    const opened = await writeWithAi(base, {
      apiKey: 'k'.repeat(30),
      ai: { ...ai, mail: 'titles', lists: 'titles' },
      now,
      fetchImpl
    })
    expect(opened.notices).toBeUndefined()
  })
})

describe('settings of the AI levels', () => {
  // The AI settings as an older version stored them: two switches, no levels.
  const { mail: _m, lists: _l, slack: _s, ...withoutLevels } = DEFAULT_SETTINGS.ai
  void [_m, _l, _s]
  const levelOf = (stored: unknown): Settings['ai'] =>
    settingsSchema.parse({ ...DEFAULT_SETTINGS, ...(migrateLegacy(stored) as object) }).ai

  it('start at counts only', () => {
    expect(DEFAULT_SETTINGS.ai).toMatchObject({ mail: 'counts', lists: 'counts', slack: 'counts' })
  })

  it('keep what a person had allowed: mail and lists at titles, Slack at people', () => {
    const migrated = levelOf({ ai: { ...withoutLevels, sendMail: true, sendSlack: true } })
    expect(migrated).toMatchObject({ mail: 'titles', lists: 'titles', slack: 'people' })
    expect(migrated).not.toHaveProperty('sendMail')
  })

  it('keep what was off off', () => {
    const migrated = levelOf({ ai: { ...withoutLevels, sendMail: false, sendSlack: false } })
    expect(migrated).toMatchObject({ mail: 'counts', lists: 'counts', slack: 'counts' })
  })

  it('leave alone a level that was already chosen', () => {
    const stored = {
      ai: { ...DEFAULT_SETTINGS.ai, mail: 'people', lists: 'counts', slack: 'titles' }
    }
    expect(levelOf(stored)).toMatchObject({ mail: 'people', lists: 'counts', slack: 'titles' })
  })

  it('accept only the three levels, from the panel and from the file', () => {
    expect(settingsPatchSchema.safeParse({ ai: { mail: 'titles' } }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ ai: { mail: 'everything' } }).success).toBe(false)
    expect(settingsPatchSchema.parse({ ai: { sendMail: true } }).ai).toEqual({}) // an old key does nothing
    expect(settingsPatchSchema.safeParse({ ai: { sections: ['mail', 'lists'] } }).success).toBe(
      true
    )
  })
})
