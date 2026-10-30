import { app, BrowserWindow, Notification, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { strings } from '../shared/strings'
import { initAccounts, startRealtimeConnectors } from './accounts'
import { initInbox, onStateChange, setAppVersion, setSourceSignals, startTicker } from './appState'
import { initBriefings, startBriefing, stopBriefing } from './briefing'
import { closeDb, initDb, wasDatabaseReset } from './db/client'
import { buildFakeSignals } from './fakeData'
import { applyHotkey, releaseHotkey } from './hotkey'
import { registerIpc } from './ipc'
import { logError, logInfo, logWarn } from './logger'
import { startNotifier } from './notifier'
import { startPresence, stopPresence } from './presence'
import { startScheduler } from './scheduler'
import { getSettings, initSettings } from './settingsStore'
import { registerSystemEvents } from './system'
import { createTray, refreshTrayMenu } from './tray'
import { startUpdater, stopUpdater } from './updater'
import { createBadgeWindow, getBadgeWindow } from './windows/badge'
import { createBriefingWindow } from './windows/briefing'
import { startTabRows } from './windows/tabRows'
import { createPanelWindow, openPanel } from './windows/panel'

// Wait a little after launch before the first sync so startup stays quiet.
const FIRST_SYNC_DELAY_MS = 15_000

// Where each person's accounts, settings and summaries live. It is fixed to %APPDATA%\widget
// instead of following the product name, so the installer, an update or a rename of the product can
// never leave the data behind. Tests pass their own `--user-data-dir`, which is respected.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'widget'))
}

// An unexpected error must not take the widget down or leave it in a broken state: log it
// (without sensitive data) and keep running.
process.on('uncaughtException', (error) => logError('main', 'uncaught exception', error))
process.on('unhandledRejection', (reason) => logError('main', 'unhandled rejection', reason))

const devUrl = process.env['ELECTRON_RENDERER_URL']
const isInternalUrl = (url: string): boolean =>
  url.startsWith('file://') || (!!devUrl && url.startsWith(devUrl))

// The windows only ever show the app's own pages: no navigation, no pop-ups, no permissions.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return
    event.preventDefault()
    logWarn('security', 'blocked a navigation away from the app')
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

// Single instance: a second launch shows the panel of the running one and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openPanel())

  app
    .whenReady()
    .then(async () => {
      electronApp.setAppUserModelId('com.grupocesa.widget')
      session.defaultSession.setPermissionRequestHandler((_contents, _permission, allow) =>
        allow(false)
      )
      session.defaultSession.setPermissionCheckHandler(() => false)
      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      setAppVersion(app.getVersion())
      logInfo('app', `starting v${app.getVersion()}`)
      await initDb()
      await initSettings()

      registerIpc()
      createPanelWindow()
      createBadgeWindow()
      createBriefingWindow()
      createTray()
      onStateChange(() => refreshTrayMenu())
      registerSystemEvents()

      if (wasDatabaseReset() && Notification.isSupported()) {
        new Notification({ title: strings.appName, body: strings.notify.databaseReset }).show()
      }

      await initInbox()
      await initBriefings()
      await initAccounts()
      if (process.env['WIDGET_FAKE_DATA'] === '1') {
        // Development aid: demo signals instead of real accounts.
        const fake = buildFakeSignals(Date.now())
        for (const source of ['calendar', 'clickup', 'slack', 'gmail'] as const) {
          setSourceSignals(
            source,
            fake.filter((s) => s.source === source)
          )
        }
      } else {
        startScheduler(FIRST_SYNC_DELAY_MS)
        startRealtimeConnectors(FIRST_SYNC_DELAY_MS)
      }
      startNotifier()
      startBriefing()
      startUpdater()
      startTicker()
      applyHotkey()
      startPresence()
      startTabRows()

      // First run: show the onboarding.
      if (!getSettings().onboardingDone) setTimeout(() => openPanel(), 1200)

      app.on('activate', () => {
        if (!getBadgeWindow() && BrowserWindow.getAllWindows().length === 0) createBadgeWindow()
      })
    })
    .catch((error) => {
      // Startup failed for good: say so instead of leaving a process with no window.
      logError('app', 'startup failed', error)
      app.quit()
    })

  app.on('will-quit', () => {
    releaseHotkey()
    stopBriefing()
    stopUpdater()
    stopPresence()
    closeDb()
  })

  // The app lives in the tray: closing/hiding windows must not quit it.
  app.on('window-all-closed', () => {})
}
