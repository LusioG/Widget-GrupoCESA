import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '../src/main/db/schema'
import { writeWithAi } from '../src/main/ai/briefingAi'
import { buildBriefing } from '../src/main/engine/briefing'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Signal } from '../src/shared/types'

// A real (in-memory) SQLite, with the table of the migration, so the SQL of the history is tested.
const sqlite = new DatabaseSync(':memory:')
sqlite.exec(
  'CREATE TABLE ai_audit_log (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, at integer NOT NULL, provider text NOT NULL, payload text NOT NULL)'
)
const db = drizzle<typeof schema>(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql)
    if (method === 'run') {
      stmt.run(...(params as never[]))
      return { rows: [] }
    }
    stmt.setReturnArrays(true)
    if (method === 'get') return { rows: (stmt.get(...(params as never[])) as unknown[]) ?? [] }
    return { rows: stmt.all(...(params as never[])) as unknown as unknown[][] }
  },
  { schema }
)
vi.mock('../src/main/db/client', () => ({ getDb: () => db }))
vi.mock('../src/main/logger', () => ({ logWarn: () => undefined, logError: () => undefined }))

const { clearAiAuditLog, listAiAudit, recordAiRequest } = await import('../src/main/ai/auditLog')
const { AI_AUDIT_KEEP } = await import('../src/main/db/repos')

const sent = (n: number): { model: string; system: string; user: string } => ({
  model: 'gemini-test',
  system: `instrucciones ${n}`,
  user: `Datos de hoy (JSON):\n{"n":${n}}`
})

beforeEach(async () => {
  await clearAiAuditLog()
})

describe('the history of what was sent to the AI', () => {
  it('keeps each request as it left, newest first', async () => {
    await recordAiRequest(sent(1), 1_000)
    await recordAiRequest(sent(2), 2_000)
    const entries = await listAiAudit()
    expect(entries.map((e) => e.system)).toEqual(['instrucciones 2', 'instrucciones 1'])
    expect(entries[0]).toMatchObject({ at: 2_000, provider: 'gemini', model: 'gemini-test' })
    expect(entries[0].user).toBe('Datos de hoy (JSON):\n{"n":2}')
  })

  it('keeps only the last 30', async () => {
    for (let n = 1; n <= AI_AUDIT_KEEP + 5; n++) await recordAiRequest(sent(n))
    const entries = await listAiAudit()
    expect(AI_AUDIT_KEEP).toBe(30)
    expect(entries).toHaveLength(30)
    expect(entries[0].system).toBe('instrucciones 35')
    expect(entries.at(-1)?.system).toBe('instrucciones 6') // the first five are gone
    expect(sqlite.prepare('select count(*) as n from ai_audit_log').get()).toEqual({ n: 30 })
  })

  it('can be emptied', async () => {
    await recordAiRequest(sent(1))
    await clearAiAuditLog()
    expect(await listAiAudit()).toEqual([])
  })

  it('leaves out a damaged row instead of breaking the list', async () => {
    await recordAiRequest(sent(1))
    sqlite.exec(
      "INSERT INTO ai_audit_log (at, provider, payload) VALUES (5, 'gemini', 'no es json')"
    )
    const entries = await listAiAudit()
    expect(entries).toHaveLength(1)
    expect(entries[0].system).toBe('instrucciones 1')
  })

  it('stores only the model, the instructions and the data: never a key', async () => {
    await recordAiRequest(sent(1))
    const row = sqlite.prepare('select payload from ai_audit_log').get() as { payload: string }
    expect(Object.keys(JSON.parse(row.payload)).sort()).toEqual(['model', 'system', 'user'])
  })
})

describe('writing the summary leaves its trace', () => {
  const now = new Date(2026, 10, 6, 9, 0).getTime()
  const task: Signal = {
    id: 'clickup:1',
    source: 'clickup',
    kind: 'task',
    title: 'Voicebot de atención',
    url: 'https://example.com',
    occurredAt: now,
    dueAt: now + 86_400_000,
    urgency: 0.5
  }
  const base = buildBriefing({ signals: [task], name: 'Ana', now })
  const ai = { ...DEFAULT_SETTINGS.ai, enabled: true }
  const answer = (text: string): unknown => ({ candidates: [{ content: { parts: [{ text }] } }] })
  const good = JSON.stringify({ intro: 'Hola.', sections: [] })
  const reply = (body: unknown): typeof fetch =>
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response) as never

  it('reports what is about to go, exactly as it goes, and never the key', async () => {
    const onRequest = vi.fn()
    await writeWithAi(base, {
      apiKey: 'secret-key-1234567890abc',
      ai,
      now,
      fetchImpl: reply(answer(good)),
      onRequest
    })
    expect(onRequest).toHaveBeenCalledTimes(1)
    const [request] = onRequest.mock.calls[0]
    expect(request.model).toBe(ai.model)
    expect(request.user).toContain('Voicebot de atención')
    expect(JSON.stringify(request)).not.toContain('secret-key')
  })

  it('reports each request it makes, also the second try', async () => {
    const onRequest = vi.fn()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => answer('no es json') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => answer(good) })
    await writeWithAi(base, { apiKey: 'k'.repeat(30), ai, now, fetchImpl, onRequest })
    expect(onRequest).toHaveBeenCalledTimes(2)
  })

  it('does not fail the summary when the history cannot be written', async () => {
    const onRequest = vi.fn(async () => {
      throw new Error('disk full')
    })
    const out = await writeWithAi(base, {
      apiKey: 'k'.repeat(30),
      ai,
      now,
      fetchImpl: reply(answer(good)),
      onRequest
    })
    expect(out.mode).toBe('ai')
  })
})
