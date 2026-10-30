import type { SettingsPatch } from './settingsSchema'
import type {
  ActionResult,
  AppState,
  Briefing,
  BriefingSummary,
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
  // The daily summary: its own window in the middle of the screen.
  briefing: {
    list(): Promise<BriefingSummary[]> // saved days, newest first
    get(date?: string): Promise<Briefing | null> // that day's, or the latest
    open(date?: string): Promise<void> // shows that day's, or today's (made now if missing)
    regenerate(): Promise<Briefing | null> // rebuilds today's with the data of now
    close(): void
    // The page tells how tall its content is, so the window is no taller than it needs to be.
    fit(height: number): void
    // The main process sends the summary to show, each time the window is opened.
    onShow(cb: (briefing: Briefing) => void): () => void
  }
  // The Gemini key (stored encrypted, never sent back to the pages).
  ai: {
    saveKey(key: string): Promise<ActionResult> // stores it after checking it works
    removeKey(): Promise<void>
    test(): Promise<ActionResult> // checks the stored key with the chosen model
  }
}
