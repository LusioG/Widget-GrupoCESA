const MAX_BACKOFF_MS = 30 * 60 * 1000

// Exponential backoff after consecutive failures, capped.
export function nextDelay(baseMs: number, failures: number, maxMs = MAX_BACKOFF_MS): number {
  return Math.min(baseMs * 2 ** failures, maxMs)
}
