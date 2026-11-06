import type { AiAuditEntry } from '../../shared/types'
import { addAiAudit, clearAiAudit, loadAiAudit } from '../db/repos'
import { logWarn } from '../logger'

// The history of what went to the AI: each request is kept exactly as it was sent (the data is
// already masked by then; the key is never part of it), so the person can look at it in Ajustes
// and delete it. The last 30 are kept. A failure here never stops the summary.

export type SentRequest = { model: string; system: string; user: string }

export async function recordAiRequest(sent: SentRequest, at = Date.now()): Promise<void> {
  try {
    await addAiAudit({ at, provider: 'gemini', payload: JSON.stringify(sent) })
  } catch (error) {
    logWarn('ai', 'could not keep a record of what was sent', error)
  }
}

export async function listAiAudit(): Promise<AiAuditEntry[]> {
  const entries: AiAuditEntry[] = []
  for (const row of await loadAiAudit()) {
    try {
      const sent = JSON.parse(row.payload) as Partial<SentRequest>
      entries.push({
        id: row.id,
        at: row.at,
        provider: row.provider,
        model: String(sent.model ?? ''),
        system: String(sent.system ?? ''),
        user: String(sent.user ?? '')
      })
    } catch {
      // A damaged row is left out rather than breaking the list.
    }
  }
  return entries
}

export const clearAiAuditLog = clearAiAudit
