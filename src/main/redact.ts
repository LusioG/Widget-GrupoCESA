import { homedir } from 'os'

// Anything that looks like a credential is masked before it can reach a log file.
// Message contents are never logged in the first place; this is the second line of defence.
const PATTERNS: [RegExp, string][] = [
  [/xox[abposr]-[A-Za-z0-9-]{8,}/g, '[slack-token]'],
  [/xapp-[A-Za-z0-9-]{8,}/g, '[slack-app-token]'],
  [/\bpk_[A-Za-z0-9_]{8,}/g, '[clickup-token]'],
  [/\bya29\.[A-Za-z0-9._-]{10,}/g, '[google-token]'],
  [/\b1\/\/[A-Za-z0-9._-]{20,}/g, '[google-refresh-token]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]'],
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[jwt]'],
  [
    /([?&](?:code|access_token|refresh_token|id_token|token|client_secret|state)=)[^&\s"']+/gi,
    '$1[redacted]'
  ],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]'],
  [/\b[A-Za-z0-9_-]{40,}\b/g, '[secret]'] // any other long opaque string
]

const MAX_LENGTH = 2000

export function redact(text: string): string {
  let out = text
  const home = homedir()
  if (home) out = out.split(home).join('~') // keeps the Windows user name out of stack traces
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement)
  return out.length > MAX_LENGTH ? `${out.slice(0, MAX_LENGTH)}…` : out
}

// An error as a short, safe line: its name, message and the top of its stack.
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const stack = (error.stack ?? '').split('\n').slice(1, 4).join(' | ').trim()
    return redact(`${error.name}: ${error.message}${stack ? ` @ ${stack}` : ''}`)
  }
  return redact(typeof error === 'string' ? error : 'Unknown error')
}
