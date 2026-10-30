// Helpers for the "add one at a time" lists (priority and ignored senders).
export const MAX_ENTRIES = 200
const MAX_LENGTH = 120

const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Splits what was typed or pasted: several entries can be separated by commas, semicolons or lines.
export function parseEntries(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((x) => x.trim().slice(0, MAX_LENGTH))
    .filter(Boolean)
}

// Adds new entries at the end, skipping empty ones and any that are already there
// (ignoring case and accents, so "Sofía" and "sofia" count as the same).
export function addEntries(list: string[], text: string): string[] {
  const seen = new Set(list.map(fold))
  const next = [...list]
  for (const entry of parseEntries(text)) {
    const key = fold(entry)
    if (seen.has(key) || next.length >= MAX_ENTRIES) continue
    seen.add(key)
    next.push(entry)
  }
  return next
}

export const removeEntry = (list: string[], entry: string): string[] =>
  list.filter((x) => x !== entry)
