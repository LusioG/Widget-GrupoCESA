import type { ThreadAttachment } from '../../../shared/types'

// Thin, read-only view of the Gmail API. The sync logic only depends on this interface,
// so it can be tested without Google and without Electron.
export type GmailMessage = {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  internalDate: number // epoch ms
  headers: Record<string, string> // lower-cased header names
  body?: string // plain text; only when a conversation is opened (never stored)
  attachments?: ThreadAttachment[] // only when a conversation is opened
}

export type HistoryResult = {
  historyId: string
  touchedIds: string[] // messages added, deleted or whose labels changed
}

export interface GmailApi {
  getProfile(): Promise<{ historyId: string; email: string }>
  listMessageIds(labelId: string, max: number): Promise<string[]>
  getMessage(id: string): Promise<GmailMessage | null> // null when it no longer exists
  listHistory(startHistoryId: string): Promise<HistoryResult | 'expired'>
  getThreadMessages(threadId: string): Promise<GmailMessage[]>
  listLabels(): Promise<{ id: string; name: string }[]>
}

// What the distribution lists need on top of the above. Searching (`q`) and reading bodies need
// the gmail.readonly permission; the narrower metadata one is not enough.
export interface GmailListsApi {
  // Conversations that match a Gmail search. `historyId` changes whenever one gets a new message
  // or a label change, so an unchanged one does not have to be read again.
  searchThreads(q: string, max: number): Promise<{ id: string; historyId: string }[]>
  searchMessageIds(q: string, max: number): Promise<string[]>
  // Every message of a conversation, oldest first. `withBody`: also their text.
  getThread(threadId: string, withBody: boolean): Promise<GmailMessage[] | null>
}
