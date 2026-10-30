import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'
import { IPC } from '../shared/ipcChannels'
import type { AppState, Briefing, PanelView } from '../shared/types'

// Fixed, minimal surface: the renderer never gets raw ipcRenderer.
const api: Api = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  onState: (cb) => {
    const listener = (_: unknown, state: AppState): void => cb(state)
    ipcRenderer.on(IPC.stateChanged, listener)
    return () => ipcRenderer.removeListener(IPC.stateChanged, listener)
  },
  onNavigate: (cb) => {
    const listener = (_: unknown, view: PanelView): void => cb(view)
    ipcRenderer.on(IPC.navigate, listener)
    return () => ipcRenderer.removeListener(IPC.navigate, listener)
  },
  onPanelOpen: (cb) => {
    const listener = (_: unknown, open: boolean): void => cb(open)
    ipcRenderer.on(IPC.panelOpenChanged, listener)
    return () => ipcRenderer.removeListener(IPC.panelOpenChanged, listener)
  },
  onPlaySound: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.playSound, listener)
    return () => ipcRenderer.removeListener(IPC.playSound, listener)
  },
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  settings: {
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  accounts: {
    connectClickUp: (token) => ipcRenderer.invoke(IPC.clickupConnect, token),
    saveGoogleCredentials: (clientId, clientSecret) =>
      ipcRenderer.invoke(IPC.googleSaveCredentials, { clientId, clientSecret }),
    connectGoogle: (feature) => ipcRenderer.invoke(IPC.googleConnect, feature),
    connectSlack: (appToken, userToken) =>
      ipcRenderer.invoke(IPC.slackConnect, { appToken, userToken }),
    disconnect: (source) => ipcRenderer.invoke(IPC.accountDisconnect, source),
    listClickUpLists: () => ipcRenderer.invoke(IPC.clickupLists),
    listGmailLabels: () => ipcRenderer.invoke(IPC.gmailLabels),
    listSlackChannels: () => ipcRenderer.invoke(IPC.slackChannels)
  },
  items: {
    act: (request) => ipcRenderer.invoke(IPC.itemAction, request),
    undo: () => ipcRenderer.invoke(IPC.itemUndo)
  },
  sync: {
    refresh: () => ipcRenderer.invoke(IPC.syncRefresh)
  },
  system: {
    setAutostart: (enabled) => ipcRenderer.invoke(IPC.autostartSet, enabled),
    setFocus: (enabled) => ipcRenderer.invoke(IPC.focusSet, enabled),
    setWidgetHidden: (hidden) => ipcRenderer.invoke(IPC.widgetHide, hidden),
    quitApp: () => ipcRenderer.invoke(IPC.quitApp)
  },
  badge: {
    press: () => ipcRenderer.send(IPC.badgePress),
    move: () => ipcRenderer.send(IPC.badgeMove),
    release: (cancelled = false) => ipcRenderer.send(IPC.badgeRelease, cancelled)
  },
  panel: {
    close: () => ipcRenderer.send(IPC.panelClose)
  },
  briefing: {
    list: () => ipcRenderer.invoke(IPC.briefingList),
    get: (date) => ipcRenderer.invoke(IPC.briefingGet, date),
    open: (date) => ipcRenderer.invoke(IPC.briefingOpen, date),
    regenerate: () => ipcRenderer.invoke(IPC.briefingRegenerate),
    close: () => ipcRenderer.send(IPC.briefingClose),
    fit: (height) => ipcRenderer.send(IPC.briefingFit, height),
    onShow: (cb) => {
      const listener = (_: unknown, briefing: Briefing): void => cb(briefing)
      ipcRenderer.on(IPC.briefingShown, listener)
      return () => ipcRenderer.removeListener(IPC.briefingShown, listener)
    }
  },
  update: {
    check: () => ipcRenderer.invoke(IPC.updateCheck),
    install: () => ipcRenderer.invoke(IPC.updateInstall)
  },
  ai: {
    saveKey: (key) => ipcRenderer.invoke(IPC.aiSaveKey, key),
    removeKey: () => ipcRenderer.invoke(IPC.aiRemoveKey),
    test: () => ipcRenderer.invoke(IPC.aiTest)
  }
}

contextBridge.exposeInMainWorld('api', api)
