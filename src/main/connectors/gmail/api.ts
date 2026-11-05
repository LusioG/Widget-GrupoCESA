import type { Auth as GoogleAuth, gmail_v1 } from 'googleapis'
import { extractText, listAttachments } from './body'
import type { GmailApi, GmailListsApi, GmailMessage } from './types'

// Ordinary mail: headers only, no bodies and no attachments. The list headers tell which
// distribution list a message came through.
const HEADERS = [
  'From',
  'To',
  'Cc',
  'Subject',
  'Date',
  'List-Unsubscribe',
  'List-Id',
  'List-Post',
  'Precedence',
  'Auto-Submitted'
]
// The conversation of a distribution list: who wrote, to whom, and which message it answers.
const THREAD_HEADERS = [
  'From',
  'To',
  'Cc',
  'Subject',
  'Date',
  'List-Id',
  'List-Post',
  'Message-ID',
  'In-Reply-To'
]

function toMessage(m: gmail_v1.Schema$Message, withBody = false): GmailMessage | null {
  if (!m.id || !m.threadId) return null
  const headers: Record<string, string> = {}
  for (const h of m.payload?.headers ?? []) {
    if (h.name && h.value) headers[h.name.toLowerCase()] = h.value
  }
  return {
    id: m.id,
    threadId: m.threadId,
    labelIds: m.labelIds ?? [],
    snippet: m.snippet ?? '',
    internalDate: Number(m.internalDate ?? 0),
    headers,
    ...(withBody && {
      body: extractText(m.payload ?? undefined),
      attachments: listAttachments(m.payload ?? undefined)
    })
  }
}

const notFound = (error: unknown): boolean => {
  const e = error as { code?: number; status?: number; response?: { status?: number } }
  return (e?.response?.status ?? e?.status ?? e?.code) === 404
}

// Only read methods (get / list) are used here.
export async function createGoogleGmailApi(
  auth: GoogleAuth.OAuth2Client,
  options: { rootUrl?: string } = {} // only tests point this at a local mock
): Promise<GmailApi & GmailListsApi> {
  const { google } = await import('googleapis')
  const gmail = google.gmail({ version: 'v1', auth, ...options })

  return {
    async getProfile() {
      const { data } = await gmail.users.getProfile({ userId: 'me' })
      return { historyId: String(data.historyId), email: data.emailAddress ?? '' }
    },

    async listMessageIds(labelId, max) {
      const { data } = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [labelId],
        maxResults: max
      })
      return (data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id)
    },

    async getMessage(id) {
      try {
        const { data } = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: HEADERS
        })
        return toMessage(data)
      } catch (error) {
        if (notFound(error)) return null
        throw error
      }
    },

    async listHistory(startHistoryId) {
      const touched: string[] = []
      let pageToken: string | undefined
      let historyId = startHistoryId
      try {
        do {
          const { data } = await gmail.users.history.list({
            userId: 'me',
            startHistoryId,
            historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
            maxResults: 500,
            pageToken
          })
          for (const h of data.history ?? []) {
            for (const list of [
              h.messagesAdded,
              h.messagesDeleted,
              h.labelsAdded,
              h.labelsRemoved
            ]) {
              for (const item of list ?? []) if (item.message?.id) touched.push(item.message.id)
            }
          }
          if (data.historyId) historyId = String(data.historyId)
          pageToken = data.nextPageToken ?? undefined
        } while (pageToken)
      } catch (error) {
        if (notFound(error)) return 'expired' // history too old: a full sync is required
        throw error
      }
      return { historyId, touchedIds: touched }
    },

    async getThreadMessages(threadId) {
      const { data } = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['From']
      })
      return (data.messages ?? [])
        .map((m) => toMessage(m))
        .filter((m): m is GmailMessage => m !== null)
    },

    async searchThreads(q, max) {
      const { data } = await gmail.users.threads.list({ userId: 'me', q, maxResults: max })
      return (data.threads ?? [])
        .filter((t) => t.id)
        .map((t) => ({ id: t.id as string, historyId: String(t.historyId ?? '') }))
    },

    async searchMessageIds(q, max) {
      const { data } = await gmail.users.messages.list({ userId: 'me', q, maxResults: max })
      return (data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id)
    },

    async getThread(threadId, withBody) {
      try {
        const { data } = await gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          ...(withBody ? { format: 'full' } : { format: 'metadata', metadataHeaders: THREAD_HEADERS })
        })
        return (data.messages ?? [])
          .map((m) => toMessage(m, withBody))
          .filter((m): m is GmailMessage => m !== null)
          .sort((a, b) => a.internalDate - b.internalDate)
      } catch (error) {
        if (notFound(error)) return null
        throw error
      }
    },

    async listLabels() {
      const { data } = await gmail.users.labels.list({ userId: 'me' })
      return (data.labels ?? [])
        .filter((l) => l.id && l.name)
        .map((l) => ({ id: l.id as string, name: l.name as string }))
    }
  }
}
