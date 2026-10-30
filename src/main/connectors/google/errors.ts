export function httpStatus(error: unknown): number | undefined {
  const e = error as { code?: number | string; status?: number; response?: { status?: number } }
  const status = e?.response?.status ?? e?.status ?? e?.code
  return typeof status === 'number' ? status : undefined
}

// Only Google's own console pages are ever offered as the place to fix it.
const CONSOLE_URL = /https:\/\/console\.(?:developers|cloud)\.google\.com\/[^\s"'<>)]+/i

// Google answers 403 "<API> has not been used in project N before or it is disabled" when the
// user never enabled the API in their Cloud project. Returns null for any other error;
// otherwise `{ url }`, where url is the page that enables it when Google said which.
export function apiDisabledInfo(error: unknown): { url?: string } | null {
  if (httpStatus(error) !== 403) return null
  const e = error as {
    message?: string
    errors?: { reason?: string }[]
    response?: {
      data?: {
        error?: {
          message?: string
          details?: { reason?: string; metadata?: Record<string, string> }[]
        }
      }
    }
  }
  const detail = e.response?.data?.error
  const message = `${e.message ?? ''} ${detail?.message ?? ''}`
  const disabled =
    /has not been used in project|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(
      message
    ) ||
    !!e.errors?.some((x) => x.reason === 'accessNotConfigured') ||
    !!detail?.details?.some((d) => d.reason === 'SERVICE_DISABLED')
  if (!disabled) return null
  const fromDetails = detail?.details?.find((d) => d.metadata?.['activationUrl'])?.metadata?.[
    'activationUrl'
  ]
  const url = [fromDetails, message.match(CONSOLE_URL)?.[0]].find(
    (u): u is string => !!u && CONSOLE_URL.test(u)
  )
  return { url: url?.replace(/[.,;]+$/, '') }
}
