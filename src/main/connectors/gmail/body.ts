import type { gmail_v1 } from 'googleapis'
import type { ThreadAttachment } from '../../../shared/types'

type Part = gmail_v1.Schema$MessagePart

// Pure helpers that turn the body of a Gmail message into plain text for a chat bubble. The body
// is only read when the user opens a conversation; it is never stored.

function decode(data: string | null | undefined, charset: string): string {
  if (!data) return ''
  const bytes = Buffer.from(data, 'base64url')
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return bytes.toString('utf8') // an unknown charset name
  }
}

function charsetOf(part: Part): string {
  const type = part.headers?.find((h) => h.name?.toLowerCase() === 'content-type')?.value ?? ''
  return /charset="?([\w-]+)"?/i.exec(type)?.[1] ?? 'utf-8'
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ'
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '') // what is being answered
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
      if (name[0] === '#') {
        const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
      }
      return ENTITIES[name.toLowerCase()] ?? whole
    })
}

function find(part: Part | undefined, mime: string): Part | undefined {
  if (!part) return undefined
  if (part.mimeType === mime && part.body?.data) return part
  for (const child of part.parts ?? []) {
    const hit = find(child, mime)
    if (hit) return hit
  }
  return undefined
}

// The readable text of a message: the plain-text part when there is one, else the HTML one.
export function extractText(payload: Part | undefined): string {
  const plain = find(payload, 'text/plain')
  if (plain) return decode(plain.body?.data, charsetOf(plain))
  const html = find(payload, 'text/html')
  if (html) return htmlToText(decode(html.body?.data, charsetOf(html)))
  return ''
}

// "El lun, 3 nov 2026 a las 10:15, Ana <a@x.com> escribió:", "On … wrote:", forwarded headers.
const QUOTE_INTRO = [
  /^el .{3,200}escribi[óo]:?\s*$/i,
  /^on .{3,200}wrote:?\s*$/i,
  /^-{2,}\s*(mensaje reenviado|forwarded message|original message|mensaje original)/i,
  /^_{5,}\s*$/,
  /^(de|from):\s.+<[^>\s]+@[^>\s]+>/i // Outlook's header block; a plain "De: lunes a viernes" stays
]

// Takes out the quoted earlier messages, so a bubble only holds what that person wrote.
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const kept: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // The "wrote:" line is often wrapped onto the next one.
    const joined = i + 1 < lines.length ? `${line} ${lines[i + 1].trim()}` : line
    if (kept.some((l) => l.trim() !== '') && QUOTE_INTRO.some((re) => re.test(line) || re.test(joined))) break
    if (line.startsWith('>')) continue
    kept.push(lines[i])
  }
  const result = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return result || text.trim() // never show an empty bubble
}

// ---- what is around the message: group footer, signature, attachments ----

// The footer Google Groups adds to every message of a list. It is the same text every time, so it
// can be removed outright (the "--" line that opens it goes too).
const GROUP_FOOTER =
  /^(has recibido este mensaje porque est[aá]s suscrit[oa] al grupo|recibiste este mensaje porque est[aá]s suscrit[oa] al grupo|you received this message because you are subscribed to the google groups|voc[eê] recebeu esta mensagem porque est[aá] inscrit[oa] no grupo)/i
const FOOTER_MAX_LINES = 15 // the footer is short; more than this after the line is not a footer

export function removeGroupFooter(text: string): string {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => GROUP_FOOTER.test(l.trim()))
  if (at < 0 || lines.length - at > FOOTER_MAX_LINES) return text
  let end = at
  let i = at - 1
  while (i >= 0 && lines[i].trim() === '') i--
  if (i >= 0 && /^--\s*$/.test(lines[i])) end = i
  return lines.slice(0, end).join('\n').trimEnd()
}

const IMAGE_PLACEHOLDER = /\[image:[^\]]*\]/i
const SIGNATURE_MAX_LINES = 15

// Splits off a signature so it can be folded away, never deleted. Two signs of one: the "-- " line
// that email programs put before it, or a last paragraph that holds an image (the logo that
// Gmail's plain text shows as "[image: …]"). Without either, nothing is split.
export function splitSignature(text: string): { main: string; signature: string } {
  const lines = text.split('\n')
  let mainEnd = -1 // where the text ends
  let signatureStart = -1 // where the signature starts

  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^--\s*$/.test(lines[i]) && lines.length - i - 1 <= SIGNATURE_MAX_LINES) {
      mainEnd = i
      signatureStart = i + 1
      break
    }
  }
  if (mainEnd < 0) {
    let blank = lines.length - 1
    while (blank >= 0 && lines[blank].trim() !== '') blank--
    const tail = lines.slice(blank + 1)
    if (blank > 0 && tail.length <= SIGNATURE_MAX_LINES && tail.some((l) => IMAGE_PLACEHOLDER.test(l))) {
      mainEnd = blank
      signatureStart = blank + 1
    }
  }
  if (mainEnd < 0) return { main: text, signature: '' }
  const main = lines.slice(0, mainEnd).join('\n').trim()
  const signature = lines.slice(signatureStart).join('\n').trim()
  return main ? { main, signature } : { main: text, signature: '' } // never an empty bubble
}

// The quoted earlier messages and the group footer go; the signature is set apart.
export function cleanMessageText(raw: string): { text: string; signature: string } {
  const unquoted = stripQuoted(raw)
  const withoutFooter = removeGroupFooter(unquoted)
  const { main, signature } = splitSignature(withoutFooter || unquoted)
  return { text: main, signature }
}

const MAX_ATTACHMENTS = 20

// The files attached to a message. Pictures embedded in the body (logos in a signature, which
// carry a Content-ID) are not attachments, so they are left out.
export function listAttachments(payload: Part | undefined): ThreadAttachment[] {
  const found: ThreadAttachment[] = []
  const walk = (part: Part): void => {
    const header = (name: string): string =>
      part.headers?.find((h) => h.name?.toLowerCase() === name)?.value ?? ''
    if (
      part.filename &&
      part.body?.attachmentId &&
      !header('content-id') &&
      !/^inline/i.test(header('content-disposition'))
    ) {
      found.push({ name: part.filename, size: part.body.size ?? 0, mime: part.mimeType ?? '' })
    }
    for (const child of part.parts ?? []) walk(child)
  }
  if (payload) walk(payload)
  return found.slice(0, MAX_ATTACHMENTS)
}
