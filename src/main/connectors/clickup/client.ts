import { z } from 'zod'
import { AuthError } from '../types'

// Read-only client: the only HTTP verb used in this module is GET.
const DEFAULT_BASE = 'https://api.clickup.com/api/v2'

type Query = Record<string, string | number | boolean | string[] | undefined>

const userSchema = z.object({ user: z.object({ id: z.number(), username: z.string().optional() }) })
const teamsSchema = z.object({ teams: z.array(z.object({ id: z.string(), name: z.string() })) })
const spacesSchema = z.object({ spaces: z.array(z.object({ id: z.string(), name: z.string() })) })
const listSchema = z.object({ id: z.string(), name: z.string() })
const listsSchema = z.object({ lists: z.array(listSchema) })
const foldersSchema = z.object({
  folders: z.array(z.object({ id: z.string(), name: z.string(), lists: z.array(listSchema) }))
})

export const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  due_date: z.string().nullable().optional(),
  // null when the task has no priority flag; ids: 1 urgent, 2 high, 3 normal, 4 low
  priority: z
    .object({ id: z.string().optional(), priority: z.string().optional() })
    .nullable()
    .optional(),
  status: z.object({ status: z.string() }).partial().optional(),
  list: z.object({ id: z.string(), name: z.string().optional() }).optional(),
  space: z.object({ id: z.string() }).optional()
})
export type ClickUpTask = z.infer<typeof taskSchema>

const tasksSchema = z.object({
  tasks: z.array(taskSchema),
  last_page: z.boolean().optional()
})

export class ClickUpClient {
  private readonly base: string

  constructor(
    private readonly token: string,
    base?: string
  ) {
    this.base = base ?? process.env['CLICKUP_API_BASE'] ?? DEFAULT_BASE
  }

  private async get<T>(path: string, schema: z.ZodType<T>, query: Query = {}): Promise<T> {
    const url = new URL(this.base + path)
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(`${key}[]`, v))
      else url.searchParams.set(key, String(value))
    }

    // Personal tokens go in the header as-is, without a "Bearer" prefix.
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: this.token, Accept: 'application/json' }
    })

    if (response.status === 401 || response.status === 403)
      throw new AuthError('ClickUp token rejected')
    if (!response.ok) throw new Error(`ClickUp responded ${response.status}`)
    return schema.parse(await response.json())
  }

  async getUser(): Promise<{ id: number; username?: string }> {
    return (await this.get('/user', userSchema)).user
  }

  async getTeams(): Promise<{ id: string; name: string }[]> {
    return (await this.get('/team', teamsSchema)).teams
  }

  async getSpaces(teamId: string): Promise<{ id: string; name: string }[]> {
    return (
      await this.get(`/team/${encodeURIComponent(teamId)}/space`, spacesSchema, { archived: false })
    ).spaces
  }

  async getFolderlessLists(spaceId: string): Promise<{ id: string; name: string }[]> {
    return (
      await this.get(`/space/${encodeURIComponent(spaceId)}/list`, listsSchema, { archived: false })
    ).lists
  }

  async getFolders(spaceId: string): Promise<z.infer<typeof foldersSchema>['folders']> {
    return (
      await this.get(`/space/${encodeURIComponent(spaceId)}/folder`, foldersSchema, {
        archived: false
      })
    ).folders
  }

  async getAssignedTasks(
    teamId: string,
    opts: { userId: number; listIds: string[]; page: number; subtasks?: boolean }
  ): Promise<{ tasks: ClickUpTask[]; lastPage: boolean }> {
    // The API cannot filter by priority, and filtering by due date would drop flagged tasks
    // that have no date, so everything assigned and open is read and sorted by due date; the
    // relevant ones are picked locally.
    const result = await this.get(`/team/${encodeURIComponent(teamId)}/task`, tasksSchema, {
      assignees: [String(opts.userId)],
      list_ids: opts.listIds.length > 0 ? opts.listIds : undefined,
      order_by: 'due_date',
      include_closed: false,
      subtasks: opts.subtasks ?? true,
      page: opts.page
    })
    return { tasks: result.tasks, lastPage: result.last_page ?? result.tasks.length < 100 }
  }
}
