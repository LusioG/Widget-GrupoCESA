// How tall the daily summary window is. Pure, so it can be tested without a screen.
export const BRIEFING_MAX_HEIGHT = 760 // the usual window: tall enough to read, not a wall of text
export const BRIEFING_MIN_HEIGHT = 360
const MARGIN = 16 // air left above and below the usual window

// `contentHeight`: what the page says it needs (null until it has said it).
// `fullHeight`: the user asked for the window to take the whole height of the screen, to read the
// summary without it scrolling. `areaHeight`: the usable height of the screen (without the taskbar).
export function briefingHeight(
  contentHeight: number | null,
  areaHeight: number,
  fullHeight: boolean
): number {
  if (fullHeight) return Math.round(areaHeight)
  const wanted = Math.max(contentHeight ?? BRIEFING_MAX_HEIGHT, BRIEFING_MIN_HEIGHT)
  return Math.round(Math.min(wanted, BRIEFING_MAX_HEIGHT, areaHeight - MARGIN * 2))
}
