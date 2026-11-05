// The floating widget is shown when its page reports the first paint, and hidden on purpose only
// when the user hides it or something is shown full screen. If it is neither visible nor hidden on
// purpose, something went wrong (a slow first start after an update left it out of sight once), and
// it is shown again.
export const RESCUE_AFTER_START_MS = 8_000 // let the page load first; a blank window must not flash

export function shouldRescueBadge(input: {
  visible: boolean
  hiddenOnPurpose: boolean // hidden by hand, or while presenting
  sinceStartMs: number // time since the widget started following its state
}): boolean {
  if (input.visible || input.hiddenOnPurpose) return false
  return input.sinceStartMs >= RESCUE_AFTER_START_MS
}
