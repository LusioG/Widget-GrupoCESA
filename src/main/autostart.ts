import { app } from 'electron'

// In development the executable is electron.exe, so it must be told which app to run.
const options = (): { path?: string; args?: string[] } =>
  app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] }

export function getAutostart(): boolean {
  return app.getLoginItemSettings(options()).openAtLogin
}

export function setAutostart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, ...options() })
}
