import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClickUpClient, type ClickUpTask } from '../src/main/connectors/clickup/client'
import { mapTask, taskUrgency } from '../src/main/connectors/clickup/mapper'
import { AuthError } from '../src/main/connectors/types'

const dir = join(__dirname, '../src/main/connectors/clickup')
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))

describe('ClickUp module is read-only', () => {
  it('never mentions a write HTTP method', () => {
    for (const { file, text } of sources) {
      expect(text, file).not.toMatch(/method\s*:\s*['"`](?!GET['"`])/i)
      expect(text, file).not.toMatch(/['"`](POST|PUT|PATCH|DELETE)['"`]/)
      expect(text, file).not.toMatch(/\.(post|put|patch|delete)\s*\(/)
    }
  })

  it('performs every request with an explicit GET', () => {
    const client = sources.find((s) => s.file === 'client.ts')!.text
    expect(client.match(/fetch\(/g)).toHaveLength(1)
    expect(client).toMatch(/method:\s*'GET'/)
  })
})

describe('ClickUpClient requests', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stub = (body: unknown, status = 200): ReturnType<typeof vi.fn> => {
    const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }))
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('sends GET with the raw token (no Bearer) and array params', async () => {
    const fetchMock = stub({ tasks: [], last_page: true })
    await new ClickUpClient('pk_123', 'https://mock.test/api/v2').getAssignedTasks('9', {
      userId: 7,
      listIds: ['a', 'b'],
      page: 0
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(init.method).toBe('GET')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('pk_123')
    expect(url.pathname).toBe('/api/v2/team/9/task')
    expect(url.searchParams.getAll('assignees[]')).toEqual(['7'])
    expect(url.searchParams.getAll('list_ids[]')).toEqual(['a', 'b'])
    // No due-date filter: flagged tasks without a date must still come back.
    expect(url.searchParams.has('due_date_lt')).toBe(false)
    expect(url.searchParams.get('order_by')).toBe('due_date')
    expect(url.searchParams.get('include_closed')).toBe('false')
  })

  it('accepts tasks with a priority object, a null priority, or none at all', async () => {
    stub({
      tasks: [
        {
          id: '1',
          name: 'a',
          url: 'u',
          priority: { id: '1', priority: 'urgent', color: '#f50000' }
        },
        { id: '2', name: 'b', url: 'u', priority: null },
        { id: '3', name: 'c', url: 'u' }
      ],
      last_page: true
    })
    const r = await new ClickUpClient('t', 'https://mock.test').getAssignedTasks('9', {
      userId: 7,
      listIds: [],
      page: 0
    })
    expect(r.tasks).toHaveLength(3)
  })

  it('turns 401 into an AuthError', async () => {
    stub({ err: 'Token invalid' }, 401)
    await expect(new ClickUpClient('bad', 'https://mock.test').getUser()).rejects.toBeInstanceOf(
      AuthError
    )
  })

  it('rejects responses that do not match the expected shape', async () => {
    stub({ unexpected: true })
    await expect(new ClickUpClient('t', 'https://mock.test').getTeams()).rejects.toThrow()
  })
})

describe('task mapping', () => {
  const now = Date.UTC(2026, 9, 28, 12)
  const HOUR = 3_600_000
  const task = (due?: number): ClickUpTask => ({
    id: 'abc',
    name: 'Enviar propuesta',
    url: 'https://app.clickup.com/t/abc',
    due_date: due === undefined ? null : String(due),
    list: { id: 'l1', name: 'Ventas' }
  })

  it('maps fields to a Signal', () => {
    expect(mapTask(task(now + 2 * HOUR), now)).toMatchObject({
      id: 'clickup:abc',
      source: 'clickup',
      kind: 'task',
      title: 'Enviar propuesta',
      body: 'Ventas',
      dueAt: now + 2 * HOUR
    })
  })

  it('ranks overdue above due-soon above later', () => {
    expect(taskUrgency(now - HOUR, now)).toBeGreaterThan(taskUrgency(now + 2 * HOUR, now))
    expect(taskUrgency(now + 2 * HOUR, now)).toBeGreaterThan(taskUrgency(now + 2 * 24 * HOUR, now))
    expect(taskUrgency(now + 2 * 24 * HOUR, now)).toBeGreaterThan(
      taskUrgency(now + 6 * 24 * HOUR, now)
    )
  })

  it('handles tasks without a due date', () => {
    expect(mapTask(task(), now).dueAt).toBeUndefined()
  })
})
