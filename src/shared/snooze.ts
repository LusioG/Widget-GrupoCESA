// "Sin fecha": an item snoozed with no return date is stored with the largest possible date (the
// latest moment JavaScript can represent), so it never comes back by itself.
export const SNOOZE_FOREVER = 8_640_000_000_000_000

// Anything more than ten years away is "no date" (a normal snooze is at most days).
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000
export const isIndefinite = (msFromNow: number): boolean => msFromNow > TEN_YEARS_MS
