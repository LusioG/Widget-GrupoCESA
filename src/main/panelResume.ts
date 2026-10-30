// After the panel is hidden (e.g. you clicked on another window to copy something), opening it
// again within this time puts you back where you were, with what you had typed.
export const RESUME_WINDOW_MS = 10 * 60 * 1000

export function shouldResume(
  lastHiddenAt: number,
  now: number,
  windowMs = RESUME_WINDOW_MS
): boolean {
  return lastHiddenAt > 0 && now - lastHiddenAt < windowMs
}
