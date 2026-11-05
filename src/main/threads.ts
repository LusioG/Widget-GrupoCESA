import type { ThreadView } from '../shared/types'
import { gmailAccount, readGmailThread } from './accounts'
import { applyItemAction } from './appState'
import { threadUrl } from './connectors/gmail/mapper'
import { buildFakeThread } from './fakeData'
import { showThreadWindow } from './windows/thread'

// Opening a conversation of a distribution list: the item counts as seen, the window opens at once
// ("loading") and then fills with the messages.
export async function openThread(request: {
  threadId: string
  signalId?: string
  title?: string
}): Promise<void> {
  const { threadId } = request
  if (request.signalId) await applyItemAction({ ids: [request.signalId], action: 'seen' })

  const loading: ThreadView = {
    threadId,
    subject: request.title ?? '',
    messages: [],
    gmailUrl: threadUrl(threadId, gmailAccount()),
    loading: true
  }
  await showThreadWindow(loading)
  // Demo mode (tests only): conversations made up, so the window can be seen without Gmail.
  const fake = process.env['WIDGET_FAKE_DATA'] === '1' ? buildFakeThread(threadId, Date.now()) : null
  await showThreadWindow(fake ?? (await readGmailThread(threadId)), { focus: false })
}
