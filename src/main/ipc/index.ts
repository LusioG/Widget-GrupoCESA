import { app, ipcMain, shell } from 'electron'
import { IPC } from '../../shared/ipcChannels'
import { strings } from '../../shared/strings'
import type { ActionResult } from '../../shared/types'
import { GeminiError, testGemini } from '../ai/gemini'
import { GEMINI_KEY } from '../ai/key'
import {
  connectClickUp,
  connectGoogle,
  connectSlack,
  disconnectAccount,
  listClickUpLists,
  listGmailLabels,
  listSlackChannels,
  saveGoogleClient,
  syncNow
} from '../accounts'
import {
  applyItemAction,
  getState,
  publish,
  setManualFocus,
  setManualHidden,
  undoLastChange
} from '../appState'
import { setAutostart } from '../autostart'
import { deleteSecret, getSecret, setSecret } from '../auth/secrets'
import {
  getBriefing,
  listBriefings,
  onBriefingTimeChanged,
  openBriefing,
  regenerateBriefing
} from '../briefing'
import { applyHotkey } from '../hotkey'
import { refreshAll } from '../scheduler'
import { checkForUpdatesNow, installUpdateNow } from '../updater'
import { getSettings, updateSettings } from '../settingsStore'
import { applyLayout } from '../windows/apply'
import { registerBadgeGestures } from '../windows/badge'
import { closeBriefingWindow, fitBriefingWindow } from '../windows/briefing'
import { closePanel, isPanelOpen, openPanel, togglePanel } from '../windows/panel'
import {
  briefingDateSchema,
  briefingHeightSchema,
  clickupTokenSchema,
  externalUrlSchema,
  geminiKeySchema,
  googleCredentialsSchema,
  googleFeatureSchema,
  itemActionSchema,
  slackTokensSchema,
  sourceSchema
} from './schemas'

const invalid: ActionResult = { ok: false, error: 'Datos no válidos.' }

// Asks Gemini a tiny question (no user data) to see that the key and the model are accepted.
async function checkGemini(key: string, model: string): Promise<ActionResult> {
  const e = strings.settings.briefing.ai.errors
  try {
    await testGemini(key, model)
    return { ok: true }
  } catch (error) {
    if (!(error instanceof GeminiError)) return { ok: false, error: e.generic }
    return { ok: false, error: error.kind === 'bad_response' ? e.generic : e[error.kind] }
  }
}

export function registerIpc(): void {
  ipcMain.handle(IPC.getState, () => getState())

  ipcMain.handle(IPC.openExternal, async (_event, raw) => {
    const url = externalUrlSchema.safeParse(raw)
    if (url.success) await shell.openExternal(url.data)
  })

  ipcMain.handle(IPC.settingsUpdate, async (_event, patch) => {
    const before = getSettings()
    const next = await updateSettings(patch) // throws on invalid input, rejecting the call
    const layout = (s: typeof next): string => JSON.stringify([s.widget, s.panel])
    if (layout(before) !== layout(next)) applyLayout()
    // Any change to what ClickUp tasks to show re-reads them right away.
    if (JSON.stringify(before.clickup) !== JSON.stringify(next.clickup)) syncNow('clickup')
    if (JSON.stringify(before.gmail.labelIds) !== JSON.stringify(next.gmail.labelIds)) {
      syncNow('gmail')
    }
    if (JSON.stringify(before.hotkey) !== JSON.stringify(next.hotkey)) applyHotkey()
    if (before.briefing.time !== next.briefing.time) void onBriefingTimeChanged(next.briefing.time)
    // A different number of days starts a new read of the calendar right away.
    if (before.calendar.daysAhead !== next.calendar.daysAhead) syncNow('calendar')
    publish()
  })

  ipcMain.handle(IPC.clickupConnect, async (_event, raw): Promise<ActionResult> => {
    const token = clickupTokenSchema.safeParse(raw)
    return token.success ? connectClickUp(token.data) : invalid
  })

  ipcMain.handle(IPC.googleSaveCredentials, (_event, raw): ActionResult => {
    const creds = googleCredentialsSchema.safeParse(raw)
    return creds.success ? saveGoogleClient(creds.data.clientId, creds.data.clientSecret) : invalid
  })

  ipcMain.handle(IPC.googleConnect, async (_event, raw): Promise<ActionResult> => {
    const feature = googleFeatureSchema.safeParse(raw)
    if (!feature.success) return invalid
    const result = await connectGoogle(feature.data)
    openPanel('settings') // the browser stole the focus and hid the panel
    return result
  })

  ipcMain.handle(IPC.accountDisconnect, async (_event, raw) => {
    const source = sourceSchema.safeParse(raw)
    if (source.success) await disconnectAccount(source.data)
  })

  ipcMain.handle(IPC.slackConnect, async (_event, raw): Promise<ActionResult> => {
    const tokens = slackTokensSchema.safeParse(raw)
    return tokens.success ? connectSlack(tokens.data.appToken, tokens.data.userToken) : invalid
  })

  ipcMain.handle(IPC.clickupLists, () => listClickUpLists())
  ipcMain.handle(IPC.gmailLabels, () => listGmailLabels())
  ipcMain.handle(IPC.slackChannels, () => listSlackChannels())

  ipcMain.handle(IPC.autostartSet, (_event, raw) => {
    if (typeof raw !== 'boolean') return
    setAutostart(raw)
    publish() // re-reads the real state from the system
  })

  ipcMain.handle(IPC.focusSet, (_event, raw) => {
    if (typeof raw === 'boolean') setManualFocus(raw)
  })

  ipcMain.handle(IPC.itemAction, async (_event, raw) => {
    const request = itemActionSchema.safeParse(raw)
    if (request.success) await applyItemAction(request.data)
  })

  ipcMain.handle(IPC.itemUndo, () => undoLastChange())

  ipcMain.handle(IPC.syncRefresh, () => refreshAll())

  ipcMain.handle(IPC.quitApp, () => {
    app.quit()
  })

  ipcMain.handle(IPC.widgetHide, (_event, raw) => {
    if (typeof raw === 'boolean') setManualHidden(raw)
  })

  ipcMain.on(IPC.panelClose, () => closePanel())

  ipcMain.handle(IPC.updateCheck, () => checkForUpdatesNow())
  ipcMain.handle(IPC.updateInstall, () => installUpdateNow())

  ipcMain.handle(IPC.briefingList, () => listBriefings())
  ipcMain.handle(IPC.briefingGet, (_event, raw) => {
    const date = briefingDateSchema.safeParse(raw)
    return date.success ? getBriefing(date.data) : null
  })
  ipcMain.handle(IPC.briefingOpen, async (_event, raw) => {
    const date = briefingDateSchema.safeParse(raw)
    if (date.success) await openBriefing(date.data)
  })
  ipcMain.handle(IPC.briefingRegenerate, () => regenerateBriefing())

  // The key is checked first and only stored if Google accepts it; it never goes back to a page.
  ipcMain.handle(IPC.aiSaveKey, async (_event, raw): Promise<ActionResult> => {
    const key = geminiKeySchema.safeParse(raw)
    if (!key.success) return invalid
    const checked = await checkGemini(key.data, getSettings().ai.model)
    if (!checked.ok) return checked
    try {
      setSecret(GEMINI_KEY, key.data)
    } catch {
      return { ok: false, error: strings.settings.briefing.ai.errors.secure }
    }
    publish()
    return { ok: true }
  })
  ipcMain.handle(IPC.aiRemoveKey, () => {
    // Only the key goes. The user's choice to have the summary written by the AI stays as it was,
    // so putting a new key (changing it) works at once; without a key nothing is sent anyway.
    deleteSecret(GEMINI_KEY)
    publish()
  })
  ipcMain.handle(IPC.aiTest, async (): Promise<ActionResult> => {
    const key = getSecret(GEMINI_KEY)
    return key ? checkGemini(key, getSettings().ai.model) : invalid
  })
  ipcMain.on(IPC.briefingClose, () => closeBriefingWindow())
  ipcMain.on(IPC.briefingFit, (_event, raw) => {
    const height = briefingHeightSchema.safeParse(raw)
    if (height.success) fitBriefingWindow(height.data)
  })

  registerBadgeGestures({
    onClick: (pressedAt) => togglePanel(pressedAt),
    // Grabbing and moving the widget while the panel is open closes the panel (no animation).
    onDragStart: () => {
      if (isPanelOpen()) closePanel({ instant: true })
    }
  })
}
