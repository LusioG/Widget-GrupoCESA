// Thin, read-only view of the Gmail API. The sync logic only depends on this interface,
// so it can be tested without Google and without Electron.
export type GmailMessage = {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  internalDate: number // epoch ms
  headers: Record<string, string> // lower-cased header names
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
