import { app } from 'electron'
import { existsSync, renameSync } from 'fs'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator'
import { logError, logWarn } from '../logger'
import * as schema from './schema'

// Electron ships Node's built-in `node:sqlite`, so no native module has to be compiled.
// Drizzle talks to it through its `sqlite-proxy` driver.
let sqlite: DatabaseSync | null = null
let database: SqliteRemoteDatabase<typeof schema> | null = null
let wasReset = false

export function getDb(): SqliteRemoteDatabase<typeof schema> {
  if (!database) throw new Error('Database not initialised')
  return database
}

// True when the previous database was unreadable and a fresh one was created.
export function wasDatabaseReset(): boolean {
  return wasReset
}

async function open(file: string): Promise<void> {
  const handle = new DatabaseSync(file)
  sqlite = handle
  handle.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

  database = drizzle<typeof schema>(
    async (sql, params, method) => {
      const stmt = handle.prepare(sql)
      if (method === 'run') {
        stmt.run(...(params as never[]))
        return { rows: [] }
      }
      stmt.setReturnArrays(true)
      if (method === 'get') {
        const row = stmt.get(...(params as never[])) as unknown[] | undefined
        return { rows: row ?? [] }
      }
      // With setReturnArrays(true) each row is an array of column values at runtime.
      return { rows: stmt.all(...(params as never[])) as unknown as unknown[][] }
    },
    { schema }
  )

  await migrate(
    database,
    async (queries) => {
      handle.exec('BEGIN')
      try {
        for (const q of queries) handle.exec(q)
        handle.exec('COMMIT')
      } catch (error) {
        handle.exec('ROLLBACK')
        throw error
      }
    },
    { migrationsFolder: join(app.getAppPath(), 'src/main/db/migrations') }
  )
}

// Keeps an unreadable database for inspection instead of deleting it.
function quarantine(file: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (const suffix of ['', '-wal', '-shm']) {
    const path = `${file}${suffix}`
    if (!existsSync(path)) continue
    try {
      renameSync(path, `${file}.corrupt-${stamp}${suffix}`)
    } catch (error) {
      logWarn('db', `could not move ${suffix || 'main'} file out of the way`, error)
    }
  }
}

export async function initDb(): Promise<void> {
  if (database) return
  const file = join(app.getPath('userData'), 'widget.db')
  try {
    await open(file)
  } catch (error) {
    // A damaged file must not stop the widget from starting: set it aside and begin again.
    logError('db', 'database could not be opened; starting a fresh one', error)
    closeDb()
    quarantine(file)
    wasReset = true
    await open(file)
  }
}

export function closeDb(): void {
  try {
    sqlite?.close()
  } catch {
    // Already closed or never opened properly.
  }
  sqlite = null
  database = null
}
