import type { ClickUpList, Signal } from '../../../shared/types'
import { deleteSecret, getSecret, hasSecret, setSecret } from '../../auth/secrets'
import { logWarn } from '../../logger'
import { getSettings } from '../../settingsStore'
import { AuthError, type Connector } from '../types'
import { ClickUpClient } from './client'
import { isRelevantTask, mapTask } from './mapper'

const TOKEN_KEY = 'clickup.token'
const MAX_PAGES = 5 // 100 tasks per page

type Identity = { userId: number; teamIds: string[] }

export class ClickUpConnector implements Connector {
  readonly id = 'clickup' as const

  async isConnected(): Promise<boolean> {
    return hasSecret(TOKEN_KEY)
  }

  // The token is stored first (setToken), then validated here.
  setToken(token: string): void {
    setSecret(TOKEN_KEY, token.trim())
  }

  private client(): ClickUpClient {
    const token = getSecret(TOKEN_KEY)
    if (!token) throw new AuthError('No ClickUp token stored')
    return new ClickUpClient(token)
  }

  async connect(): Promise<void> {
    try {
      const client = this.client()
      const user = await client.getUser()
      const teams = await client.getTeams()
      setSecret(
        'clickup.identity',
        JSON.stringify({ userId: user.id, teamIds: teams.map((t) => t.id) })
      )
    } catch (error) {
      deleteSecret(TOKEN_KEY)
      deleteSecret('clickup.identity')
      throw error
    }
  }

  async disconnect(): Promise<void> {
    deleteSecret(TOKEN_KEY)
    deleteSecret('clickup.identity')
  }

  private async identity(client: ClickUpClient): Promise<Identity> {
    const stored = getSecret('clickup.identity')
    if (stored) {
      try {
        return JSON.parse(stored) as Identity
      } catch {
        // fall through and ask the API again
      }
    }
    const user = await client.getUser()
    const teams = await client.getTeams()
    return { userId: user.id, teamIds: teams.map((t) => t.id) }
  }

  // Tasks are re-read in full each time (the window is small), so no cursor is needed.
  async sync(): Promise<Signal[]> {
    const client = this.client()
    const { userId, teamIds } = await this.identity(client)
    const now = Date.now()
    const cfg = getSettings().clickup // the user's choices in "Fuentes y filtros"
    const { listIds, includeSubtasks: subtasks } = cfg

    const signals = new Map<string, Signal>()
    for (const teamId of teamIds) {
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await client.getAssignedTasks(teamId, { userId, listIds, page, subtasks })
        for (const task of result.tasks) {
          if (isRelevantTask(task, now, cfg)) signals.set(`clickup:${task.id}`, mapTask(task, now))
        }
        if (result.lastPage) break
        if (page === MAX_PAGES - 1) {
          logWarn('clickup', `more than ${MAX_PAGES * 100} assigned tasks: reading only the first`)
        }
      }
    }
    return [...signals.values()]
  }

  // Lists the user can choose to watch ("Fuentes y filtros").
  async listWatchable(): Promise<ClickUpList[]> {
    const client = this.client()
    const out: ClickUpList[] = []
    for (const team of await client.getTeams()) {
      for (const space of await client.getSpaces(team.id)) {
        for (const list of await client.getFolderlessLists(space.id)) {
          out.push({ id: list.id, name: list.name, space: space.name, team: team.name })
        }
        for (const folder of await client.getFolders(space.id)) {
          for (const list of folder.lists) {
            out.push({
              id: list.id,
              name: list.name,
              space: space.name,
              folder: folder.name,
              team: team.name
            })
          }
        }
      }
    }
    return out
  }
}
