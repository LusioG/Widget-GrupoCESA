import { BrowserWindow, ipcMain, screen } from 'electron'
import { IPC } from '../../shared/ipcChannels'
import { publish } from '../appState'
import { snapTab, stretchedTabRect, usualTabPos, type Rect } from '../geometry'
import { Gesture } from '../gesture'
import { getSettings, saveBadgePosition, saveTabDisplayId, updateSettings } from '../settingsStore'
import { widgetRect } from '../windowState'
import { badgeSize, POPUP_BASE, styleWindow, tabExtraPx, usualTabSize } from './appearance'
import { keepAliveOnClose, loadRenderer, pinOnTop, watchHealth, windowPreferences } from './common'

let badgeWindow: BrowserWindow | null = null

export function getBadgeWindow(): BrowserWindow | null {
  return badgeWindow
}

export function createBadgeWindow(): BrowserWindow {
  const rect = widgetRect()
  // Created at the popup's base size and then moved to its real rectangle: on scaled displays
  // Windows would otherwise make a window created directly at the tab size a few pixels larger.
  const win = new BrowserWindow({
    x: rect.x,
    y: rect.y,
    width: POPUP_BASE.width,
    height: POPUP_BASE.height,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Clicking the widget must not take the focus from the panel: the click itself decides
    // whether the panel opens or closes.
    focusable: false,
    show: false,
    webPreferences: windowPreferences('widget-badge')
  })
  win.setBounds(rect)
  pinOnTop(win)
  keepAliveOnClose(win)
  watchHealth(win, 'widget')
  win.webContents.on('did-finish-load', () => styleWindow(win, 'widget'))
  win.once('ready-to-show', () => win.showInactive())
  win.on('closed', () => {
    badgeWindow = null
  })
  loadRenderer(win, 'badge')
  badgeWindow = win
  return win
}

// After a drag in tab mode the tab sticks to the nearest edge of the monitor it was dropped on.
async function dockTab(bounds: Rect): Promise<void> {
  const display = screen.getDisplayMatching(bounds)
  const { side } = snapTab(bounds, display.workArea)
  // The saved position is that of the usual tab; the rows it is showing grow it downward.
  const pos = usualTabPos(bounds, usualTabSize().height, display.workArea)
  badgeWindow?.setBounds(
    stretchedTabRect(side, pos, usualTabSize(), tabExtraPx(), display.workArea)
  )
  await saveTabDisplayId(display.id)
  await updateSettings({ widget: { side, tabPos: pos } })
  publish() // the renderer redraws the tab for its new side
}

export type GestureHooks = {
  onClick(pressedAt: number): void // a press that never became a drag
  onDragStart(): void // the widget is being moved
}

// The renderer only reports press / move / release. Click-versus-drag is decided here, from the
// real cursor position (always in DIP), so zoom and display scaling cannot skew it.
export function registerBadgeGestures(hooks: GestureHooks): void {
  const gesture = new Gesture()
  let windowStart = { x: 0, y: 0 }
  let pressedAt = 0

  const follow = (dx: number, dy: number): void => {
    badgeWindow?.setBounds({
      x: Math.round(windowStart.x + dx),
      y: Math.round(windowStart.y + dy),
      ...badgeSize()
    })
  }

  // Ends a drag: stick the tab to its edge, or remember where the popup was left.
  const finishDrag = (): void => {
    if (!badgeWindow) return
    if (getSettings().widget.mode === 'tab') {
      void dockTab(badgeWindow.getBounds())
      return
    }
    const [x, y] = badgeWindow.getPosition()
    void saveBadgePosition({ x, y })
  }

  ipcMain.on(IPC.badgePress, () => {
    if (!badgeWindow) return
    pressedAt = Date.now()
    const [x, y] = badgeWindow.getPosition()
    windowStart = { x, y }
    gesture.press(screen.getCursorScreenPoint())
  })

  ipcMain.on(IPC.badgeMove, () => {
    const move = gesture.move(screen.getCursorScreenPoint())
    if (!move || !badgeWindow) return
    if (move.started) hooks.onDragStart()
    follow(move.dx, move.dy)
  })

  // `cancelled` is true when the pointer was lost (no real button release).
  ipcMain.on(IPC.badgeRelease, (_event, cancelled: unknown) => {
    const wasDragging = gesture.isDragging
    if (wasDragging && badgeWindow) {
      const m = gesture.move(screen.getCursorScreenPoint()) // land exactly where it was released
      if (m) follow(m.dx, m.dy)
    }
    const outcome = cancelled === true ? gesture.cancel() : gesture.release()
    if (outcome === 'drag') finishDrag()
    else if (outcome === 'click') hooks.onClick(pressedAt)
  })
}
