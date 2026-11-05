// Turns the plain text of a message into pieces the chat can draw: ordinary text, links as short
// chips, and the "[image: …]" markers Gmail leaves where a picture was. Nothing is ever dropped:
// every link stays reachable, and the text around it is kept exactly as written.

export type RichPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; url: string; label: string }
  | { kind: 'image'; name: string }

// 1: an image marker · 2: a link in angle brackets (how Gmail writes the link behind a text) ·
// 3: a bare link
const TOKEN = /\[image:\s*([^\]]*)\]|<(https?:\/\/[^\s<>]+)>|(https?:\/\/[^\s<>]+)/gi

// What a bare link may drag along at its end: "mira https://x.com/a)." is the link and then ").".
const TRAILING = /[.,;:!?)\]'"*]+$/

// "https://www.docs.google.com/d/abc" -> "docs.google.com"
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function toRichParts(text: string): RichPart[] {
  const parts: RichPart[] = []
  let last = 0
  const addText = (value: string): void => {
    if (!value) return
    const previous = parts[parts.length - 1]
    if (previous?.kind === 'text') previous.text += value // one piece of text, not two
    else parts.push({ kind: 'text', text: value })
  }

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0
    addText(text.slice(last, index))
    last = index + match[0].length

    if (match[1] !== undefined) {
      parts.push({ kind: 'image', name: match[1].trim() })
    } else if (match[2]) {
      parts.push({ kind: 'link', url: match[2], label: linkLabel(match[2]) })
    } else {
      const trailing = TRAILING.exec(match[3])?.[0] ?? ''
      const url = trailing ? match[3].slice(0, -trailing.length) : match[3]
      parts.push({ kind: 'link', url, label: linkLabel(url) })
      addText(trailing)
    }
  }
  addText(text.slice(last))
  return parts
}

// "1,2 MB", "340 KB", "812 B"
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

// A long message is shown folded with "Ver más".
const FOLD_LINES = 8
const FOLD_CHARS = 520
export const isLongMessage = (text: string): boolean =>
  text.split('\n').length > FOLD_LINES || text.length > FOLD_CHARS
