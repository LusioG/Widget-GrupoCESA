import type { SettingsPatch } from './settingsSchema'
import type {
  ActionResult,
  AppState,
  ClickUpList,
  GmailLabel,
  GoogleFeature,
  ItemAction,
  PanelView,
  SlackChannel,
  Source
} from './types'

// Typed surface exposed to the renderer as `window.api`.
export interface Api {
  getState(): Promise<AppState>
  onState(cb: (state: AppState) => void): () => void
  onNavigate(cb: (view: PanelView) => void): () => void
  // Fires when the panel opens (true) or starts closing (false), in both windows.
  onPanelOpen(cb: (open: boolean) => void): () => void
  // The main process asks the widget page to play the notification sound.
  onPlaySound(cb: () => void): () => void
  openExternal(url: string): Promise<void>
  settings: {
    update(patch: SettingsPatch): Promise<void>
  }
  accounts: {
    connectClickUp(token: string): Promise<ActionResult>
    saveGoogleCredentials(clientId: string, clientSecret: string): Promise<ActionResult>
    connectGoogle(feature: GoogleFeature): Promise<ActionResult>
    connectSlack(appToken: string, userToken: string): Promise<ActionResult>
    disconnect(source: Source): Promise<void>
    listClickUpLists(): Promise<ClickUpList[]>
    listGmailLabels(): Promise<GmailLabel[]>
    listSlackChannels(): Promise<SlackChannel[]>
  }
  items: {
    act(request: ItemAction): Promise<void>
    // Reverts the last dismiss/snooze if it was done a few seconds ago; false if too late.
    undo(): Promise<boolean>
  }
  // Checks every account right now; resolves when they have all answered.
  sync: {
    refresh(): Promise<void>
  }
  system: {
    setAutostart(enabled: boolean): Promise<void>
    setFocus(enabled: boolean): Promise<void>
    setWidgetHidden(hidden: boolean): Promise<void>
    // Closes the widget completely (it stops running until it is opened again).
    quitApp(): Promise<void>
  }
  // The page only forwards the pointer; the main process tells a click from a drag.
  badge: {
    press(): void
    move(): void
    release(cancelled?: boolean): void
  }
  panel: {
    close(): void
  }
}
