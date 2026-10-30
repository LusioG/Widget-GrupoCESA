// Google Gemini over plain HTTPS (generateContent). Nothing else in the app talks to a language
// model. The key goes in a header, never in the address, and is never logged.
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const TIMEOUT_MS = 30_000

export type GeminiErrorKind =
  | 'auth' // the key was refused
  | 'model' // that model does not exist or is not available to this key
  | 'quota' // too many requests, or the free allowance is used up
  | 'network' // no connection, a timeout, or Google had a problem
  | 'bad_response' // an answer that cannot be used

export class GeminiError extends Error {
  constructor(
    readonly kind: GeminiErrorKind,
    message: string
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

type Fetch = typeof fetch

export type GeminiRequest = {
  apiKey: string
  model: string
  system?: string
  user: string
  json?: boolean // ask for a JSON answer
  maxOutputTokens?: number
  fetchImpl?: Fetch // tests pass a fake
}

function kindForStatus(status: number, message: string): GeminiErrorKind {
  if (status === 401 || status === 403 || /api key (not valid|expired)|API_KEY_INVALID/i.test(message))
    return 'auth'
  if (status === 404) return 'model'
  if (status === 429) return 'quota'
  return 'network'
}

// One question, one answer. Returns the text the model wrote.
export async function askGemini(req: GeminiRequest): Promise<string> {
  const doFetch = req.fetchImpl ?? fetch
  const body = {
    ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: req.user }] }],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: req.maxOutputTokens ?? 4096,
      ...(req.json ? { responseMimeType: 'application/json' } : {})
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await doFetch(`${BASE}/models/${encodeURIComponent(req.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch {
    throw new GeminiError('network', 'Could not reach Gemini')
  } finally {
    clearTimeout(timer)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = undefined
  }

  if (!res.ok) {
    const message = (data as { error?: { message?: string } } | undefined)?.error?.message ?? ''
    throw new GeminiError(kindForStatus(res.status, message), `Gemini answered ${res.status}`)
  }

  const parts = (
    data as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | undefined
  )?.candidates?.[0]?.content?.parts
  const text = (parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new GeminiError('bad_response', 'Gemini returned no text')
  return text
}

// Checks the key and the model with a tiny question that carries none of the user's data.
export async function testGemini(
  apiKey: string,
  model: string,
  fetchImpl?: Fetch
): Promise<void> {
  try {
    await askGemini({ apiKey, model, user: 'Responde solo: ok', maxOutputTokens: 64, fetchImpl })
  } catch (error) {
    // A reply with no text still proves the key and the model are accepted.
    if (error instanceof GeminiError && error.kind === 'bad_response') return
    throw error
  }
}
