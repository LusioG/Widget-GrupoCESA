import { redact } from '../redact'

// Extra masks for text that is about to leave the computer: on top of the credentials and e-mail
// addresses `redact` already hides, card numbers, identity documents and passwords written in a
// title.
const PATTERNS: [RegExp, string][] = [
  [/\b(?:\d[ -]?){13,19}\b/g, '[número]'], // card or account numbers
  [/\b\d{1,2}\.\d{3}\.\d{3}\b/g, '[documento]'], // DNI written with dots
  [/\b\d{2}-\d{8}-\d\b/g, '[documento]'], // CUIT / CUIL
  [/\b(contraseña|password|clave|pin)\s*[:=]\s*\S+/gi, '$1: [oculto]']
]

export function maskForAi(text: string): string {
  let out = redact(text)
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  return out
}
