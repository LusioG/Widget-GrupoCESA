export type Rect = { x: number; y: number; width: number; height: number }
export type Size = { width: number; height: number }

const GAP = 8

export function contains(area: Rect, px: number, py: number): boolean {
  return px >= area.x && px < area.x + area.width && py >= area.y && py < area.y + area.height
}

// A saved position is valid only if the center of the rect still lands on a connected display.
export function isVisibleOnSomeDisplay(rect: Rect, workAreas: Rect[]): boolean {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  return workAreas.some((area) => contains(area, cx, cy))
}

export function clampToArea(rect: Rect, area: Rect): Rect {
  const x = Math.min(Math.max(rect.x, area.x), area.x + area.width - rect.width)
  const y = Math.min(Math.max(rect.y, area.y), area.y + area.height - rect.height)
  return { ...rect, x, y }
}

// Default spot: bottom-right corner of the primary display's work area.
export function defaultBadgePosition(area: Rect, size: Size): Rect {
  return {
    x: area.x + area.width - size.width - 24,
    y: area.y + area.height - size.height - 24,
    ...size
  }
}

export type DockSide = 'left' | 'right'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

// A vertical tab glued to a screen edge. `pos` is 0 at the top and 1 at the bottom of its travel.
export function tabRect(side: DockSide, pos: number, size: Size, area: Rect): Rect {
  const travel = Math.max(0, area.height - size.height)
  return {
    x: side === 'left' ? area.x : area.x + area.width - size.width,
    y: Math.round(area.y + travel * clamp01(pos)),
    ...size
  }
}

// The tab with extra rows (urgent / meetings circles) below the logo: its top stays where the
// usual tab's top is, so the logo does not move, and it grows downward, moving up only as far
// as needed to stay on screen.
export function stretchedTabRect(
  side: DockSide,
  pos: number,
  base: Size,
  extraPx: number,
  area: Rect
): Rect {
  const usual = tabRect(side, pos, base, area)
  const height = base.height + extraPx
  const y = Math.min(usual.y, area.y + Math.max(0, area.height - height))
  return { ...usual, y: Math.max(y, area.y), height }
}

// The inverse after a drag: the saved position is that of the usual (not stretched) tab, which
// shares its top edge with the stretched one.
export function usualTabPos(stretched: Rect, baseHeight: number, area: Rect): number {
  const travel = Math.max(0, area.height - baseHeight)
  return travel === 0 ? 0 : clamp01((stretched.y - area.y) / travel)
}

// After dragging a tab anywhere: stick it to the nearest edge, keeping its height on screen.
export function snapTab(rect: Rect, area: Rect): { side: DockSide; pos: number } {
  const centerX = rect.x + rect.width / 2
  const travel = Math.max(0, area.height - rect.height)
  return {
    side: centerX < area.x + area.width / 2 ? 'left' : 'right',
    pos: travel === 0 ? 0 : clamp01((rect.y - area.y) / travel)
  }
}

// The panel's size on a given screen: its usual size, never larger than the work area, or the whole
// usable height when the user asked for that (to see more without scrolling). The width stays.
export function panelSizeFor(size: Size, area: Size, fullHeight: boolean): Size {
  return {
    width: Math.min(size.width, area.width - 16),
    height: fullHeight ? area.height : Math.min(size.height, area.height - 16)
  }
}

// Drawer layout for tab mode: the panel opens flush against the screen edge and the tab rides
// on the panel's outer side, like a drawer handle. The panel is centered on the tab's height.
export function drawerLayout(
  side: DockSide,
  closedTab: Rect,
  panel: Size,
  area: Rect
): { panel: Rect; tab: Rect } {
  const width = Math.min(panel.width, Math.max(0, area.width - closedTab.width))
  const panelRect = clampToArea(
    {
      x: side === 'left' ? area.x : area.x + area.width - width,
      y: closedTab.y + closedTab.height / 2 - panel.height / 2,
      width,
      height: panel.height
    },
    area
  )
  const tabX = side === 'left' ? panelRect.x + panelRect.width : panelRect.x - closedTab.width
  // The panel was clamped to the screen, so a tab near the top or bottom could stick out past
  // the panel's edge and leave a notch. Keep it beside the panel, clear of the rounded corners.
  const minY = panelRect.y + DRAWER_TAB_INSET
  const maxY = panelRect.y + panelRect.height - closedTab.height - DRAWER_TAB_INSET
  const tabY = maxY < minY ? panelRect.y : Math.min(Math.max(closedTab.y, minY), maxY)
  return { panel: panelRect, tab: { ...closedTab, x: tabX, y: tabY } }
}

// The panel window has an 8 px transparent margin above and below its card, and the card has a
// 16 px corner radius, so this keeps the tab clear of the visible rounded corner with some air.
const DRAWER_TAB_INSET = 8 + 16 + 8

// Open the panel on the side of the badge that has more room, then keep it on screen.
export function placePanel(badge: Rect, panel: Size, area: Rect): Rect {
  const badgeCx = badge.x + badge.width / 2
  const badgeCy = badge.y + badge.height / 2
  const areaCx = area.x + area.width / 2
  const areaCy = area.y + area.height / 2

  const x = badgeCx > areaCx ? badge.x - panel.width - GAP : badge.x + badge.width + GAP
  const y = badgeCy > areaCy ? badge.y + badge.height - panel.height : badge.y

  return clampToArea({ x, y, ...panel }, area)
}
