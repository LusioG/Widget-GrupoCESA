import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull() // JSON
})

// Last known signals per source, so the panel is not empty while the first sync runs.
// `raw` is never stored.
export const signalsCache = sqliteTable('signals_cache', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  data: text('data').notNull(), // JSON
  updatedAt: integer('updated_at').notNull()
})

export const inboxItems = sqliteTable('inbox_items', {
  signalId: text('signal_id').primaryKey(),
  status: text('status').notNull().default('new'),
  snoozedUntil: integer('snoozed_until'),
  score: real('score').notNull().default(0)
})

// Reserved for the daily-summary phase (on hold). Nothing writes here yet.
export const aiAuditLog = sqliteTable('ai_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: integer('at').notNull(),
  provider: text('provider').notNull(),
  payload: text('payload').notNull()
})

export const syncState = sqliteTable('sync_state', {
  source: text('source').primaryKey(),
  status: text('status').notNull().default('disconnected'),
  cursor: text('cursor'),
  lastSyncAt: integer('last_sync_at'),
  error: text('error')
})
