type Rect = { x: number; y: number; width: number; height: number }

export const THREAD_SIZE = { width: 580, height: 700 } // wide enough to read long messages
const GAP = 48 // between the panel and the conversation beside it: clearly apart
const MARGIN = 16 // from the screen edge
const MIN_WIDTH = 340 // narrower than this the chat is not worth shrinking: it goes in the middle

// Where the conversation window goes. Beside the panel when there is one, on the side with more
// room, so both can be read together; if the panel leaves less room than the chat needs, the chat
// gets narrower (down to MIN_WIDTH) rather than going under the panel. With no panel, or no room
// at all, it goes in the middle of the screen.
export function placeThread(panel: Rect | null, area: Rect): Rect {
  const height = Math.min(THREAD_SIZE.height, area.height - MARGIN * 2)
  const y = Math.round(area.y + (area.height - height) / 2)

  if (panel) {
    const roomLeft = panel.x - area.x - GAP - MARGIN
    const roomRight = area.x + area.width - (panel.x + panel.width) - GAP - MARGIN
    const onLeft = roomLeft >= roomRight
    const width = Math.min(THREAD_SIZE.width, onLeft ? roomLeft : roomRight)
    if (width >= MIN_WIDTH) {
      return { x: onLeft ? panel.x - GAP - width : panel.x + panel.width + GAP, y, width, height }
    }
  }
  const width = Math.min(THREAD_SIZE.width, area.width - MARGIN * 2)
  return { x: Math.round(area.x + (area.width - width) / 2), y, width, height }
}
