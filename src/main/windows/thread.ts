import { BrowserWindow, screen } from 'electron'
import { IPC } from '../../shared/ipcChannels'
import type { ThreadView } from '../../shared/types'
import { keepAliveOnClose, loadRenderer, pinOnTop, watchHealth, windowPreferences } from './common'
import { getPanelWindow, keepPanelOpenWhile, onPanelPlaced } from './panel'
import { placeThread, THREAD_SIZE } from './threadPlacement'

// The conversation of a distribution list opens in its own small window, like a chat.
const BASE = THREAD_SIZE

let threadWindow: BrowserWindow | null = null
let loaded: Promise<void> | null = null
let lastView: ThreadView | null = null

function create(): BrowserWindow {
  const win = new BrowserWindow({
    ...BASE,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: windowPreferences('widget-thread')
  })
  pinOnTop(win) // above the panel and the widget, which sit at that level too
  keepAliveOnClose(win)
  watchHealth(win, 'thread')
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault()
      closeThreadWindow()
    }
  })
  win.on('closed', () => {
    threadWindow = null
    loaded = null
  })
  loaded = loadRenderer(win, 'thread')
  threadWindow = win
  // Going from the panel to the conversation must not close the panel.
  keepPanelOpenWhile(() => !!threadWindow && !threadWindow.isDestroyed() && threadWindow.isFocused())
  return win
}

function bounds(): Electron.Rectangle {
  const panel = getPanelWindow()
  const panelBounds = panel && !panel.isDestroyed() && panel.isVisible() ? panel.getBounds() : null
  const area = panelBounds
    ? screen.getDisplayMatching(panelBounds).workArea
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  return placeThread(panelBounds, area)
}

// The panel moved or changed size: the conversation keeps its distance.
onPanelPlaced(() => {
  if (threadWindow && !threadWindow.isDestroyed() && threadWindow.isVisible()) {
    threadWindow.setBounds(bounds())
  }
})

// Opens the window (made the first time it is needed) and gives it what to show. It is called
// twice per conversation: at once with `loading`, then with the messages.
// `focus: false` is for the second call, so it does not take the keyboard back if the user has
// already gone elsewhere (for instance, back to the panel) while the messages loaded.
export async function showThreadWindow(
  view: ThreadView,
  options: { focus: boolean } = { focus: true }
): Promise<void> {
  const win = threadWindow && !threadWindow.isDestroyed() ? threadWindow : create()
  await loaded // the page must be listening before it is sent anything
  if (win.isDestroyed()) return
  if (!win.isVisible()) {
    win.setBounds(bounds())
    win.show()
  }
  if (options.focus) win.focus()
  lastView = view
  win.webContents.send(IPC.threadShown, view)
}

// The page asks for this when it starts, in case it was not yet listening when the first view
// was sent.
export function currentThreadView(): ThreadView | null {
  return lastView
}

export function closeThreadWindow(): void {
  if (threadWindow && threadWindow.isVisible()) threadWindow.hide()
}
