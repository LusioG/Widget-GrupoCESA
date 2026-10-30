import { eq, like } from 'drizzle-orm'
import type { InboxStatus, Signal, Source } from '../../shared/types'
import { getDb } from './client'
import { inboxItems, signalsCache, syncState } from './schema'

export type SyncStateRow = {
  source: Source
  status: string
  cursor: string | null
  lastSyncAt: number | null
  error: string | null
}

// `raw` is dropped on purpose: it may hold full message bodies.
function toStored(signal: Signal): string {
  const stored: Signal = { ...signal }
  delete stored.raw
  return JSON.stringify(stored)
}

export async function loadCachedSignals(source?: Source): Promise<Signal[]> {
  const db = getDb()
  const rows = source
    ? await db.select().from(signalsCache).where(eq(signalsCache.source, source))
    : await db.select().from(signalsCache)
  const signals: Signal[] = []
  for (const row of rows) {
    try {
      signals.push(JSON.parse(row.data) as Signal)
    } catch {
      // Skip a corrupt row; the next sync rewrites it.
    }
  }
  return signals
}

export async function replaceCachedSignals(source: Source, signals: Signal[]): Promise<void> {
  const db = getDb()
  const now = Date.now()
  await db.delete(signalsCache).where(eq(signalsCache.source, source))
  for (const signal of signals) {
    await db
      .insert(signalsCache)
      .values({ id: signal.id, source, data: toStored(signal), updatedAt: now })
      .onConflictDoUpdate({
        target: signalsCache.id,
        set: { source, data: toStored(signal), updatedAt: now }
      })
  }
}

export type InboxRow = {
  signalId: string
  status: InboxStatus
  snoozedUntil: number | null
  score: number
}

export async function loadInbox(): Promise<InboxRow[]> {
  const rows = await getDb().select().from(inboxItems)
  return rows.map((r) => ({ ...r, status: r.status as InboxStatus }))
}

export async function saveInbox(row: InboxRow): Promise<void> {
  await getDb()
    .insert(inboxItems)
    .values(row)
    .onConflictDoUpdate({
      target: inboxItems.signalId,
      set: { status: row.status, snoozedUntil: row.snoozedUntil, score: row.score }
    })
}

export async function getSyncState(source: Source): Promise<SyncStateRow | undefined> {
  const rows = await getDb().select().from(syncState).where(eq(syncState.source, source))
  const row = rows[0]
  return row && { ...row, source }
}

export async function saveSyncState(
  source: Source,
  patch: Partial<Omit<SyncStateRow, 'source'>>
): Promise<void> {
  await getDb()
    .insert(syncState)
    .values({ source, ...patch })
    .onConflictDoUpdate({ target: syncState.source, set: patch })
}

// Disconnecting wipes everything that belongs to the source.
export async function clearSource(source: Source): Promise<void> {
  const db = getDb()
  await db.delete(signalsCache).where(eq(signalsCache.source, source))
  await db.delete(inboxItems).where(like(inboxItems.signalId, `${source}:%`))
  await db.delete(syncState).where(eq(syncState.source, source))
}
