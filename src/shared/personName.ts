// The names of the people in the "From" header of a message: "Ana Pérez <ana@x.com>" is "Ana Pérez".
// A list conversation keeps several of them, separated by " | " (see the Gmail mapper). Addresses
// are never kept: if there is no name, the part before the "@" stands in for it.
const MAX_NAMES = 3

function nameOf(entry: string): string {
  const trimmed = entry.trim()
  const quoted = /^"?([^"<]+?)"?\s*<[^>]*>$/.exec(trimmed)
  if (quoted) return quoted[1].trim()
  const address = /^<?([^@\s<>]+)@[^@\s>]+>?$/.exec(trimmed)
  if (address) return address[1]
  return trimmed.replace(/<[^>]*>/g, '').trim()
}

export function senderNames(sender: string | undefined, max = MAX_NAMES): string {
  if (!sender) return ''
  const names = sender
    .split('|')
    .map(nameOf)
    .filter((n) => n !== '')
  return [...new Set(names)].slice(0, max).join(', ')
}
