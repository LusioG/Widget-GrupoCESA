import { app, shell } from 'electron'
import { resolve } from 'path'
import { WIDGET_PROTOCOL } from '../../shared/slackApp'
import { logInfo, logWarn } from '../logger'
import {
  buildAuthorizeUrl,
  exchangeCode,
  isWidgetUrl,
  newPkce,
  newState,
  parseCallback,
  slackClientId,
  type SlackTokens
} from './slackOAuth'

const TIMEOUT_MS = 5 * 60 * 1000

// The sign-in that is waiting for the browser to come back, if any.
let waiting: { state: string; deliver: (url: string) => void } | null = null

// Windows starts a second copy of the widget for the address (grupocesa-widget://…); the one that
// was already running gets it in `second-instance` with the command line. macOS uses `open-url`.
export const urlFromArgv = (argv: readonly string[]): string | undefined => argv.find(isWidgetUrl)

// Gives the widget the address Slack sent the browser to. True when it was ours (even if nobody
// was waiting for it), so the caller does not treat it as anything else.
export function deliverProtocolUrl(url: string): boolean {
  if (!isWidgetUrl(url)) return false
  if (waiting) waiting.deliver(url)
  else logWarn('slack', 'received a Slack sign-in address that nobody was waiting for')
  return true
}

// So Windows knows this program opens grupocesa-widget:// addresses. The installer does it too;
// this repeats it each time the app starts, in case it was moved. In development it is left alone
// unless asked (WIDGET_REGISTER_PROTOCOL=1): the scheme belongs to ONE program at a time, and the
// development copy would take it from the installed widget.
export function registerProtocol(): void {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(WIDGET_PROTOCOL)
  } else if (process.env['WIDGET_REGISTER_PROTOCOL'] === '1' && process.argv[1]) {
    // The copy Windows starts for the address must find THIS one (the single-instance lock is per
    // data folder): when this run uses its own folder, the registered command carries it too.
    const dataDir = app.commandLine.getSwitchValue('user-data-dir')
    app.setAsDefaultProtocolClient(WIDGET_PROTOCOL, process.execPath, [
      resolve(process.argv[1]),
      ...(dataDir ? [`--user-data-dir=${dataDir}`] : [])
    ])
  }
}

// Opens Slack in the browser, waits for the person to say "Permitir", and returns their token.
// Errors use the same short messages as the other sign-ins ('Authorization denied', …).
export async function signInWithSlack(): Promise<SlackTokens> {
  const clientId = slackClientId()
  if (!clientId) throw new Error('Slack sign-in is not set up')

  const { verifier, challenge } = newPkce()
  const state = newState()

  const code = await new Promise<string>((resolveCode, reject) => {
    const timer = setTimeout(() => {
      waiting = null
      reject(new Error('Authorization timed out'))
    }, TIMEOUT_MS)

    waiting = {
      state,
      deliver: (url) => {
        const result = parseCallback(url, state)
        if ('code' in result) {
          clearTimeout(timer)
          waiting = null
          resolveCode(result.code)
        } else if (result.error === 'denied') {
          clearTimeout(timer)
          waiting = null
          reject(new Error('Authorization denied'))
        } else {
          logWarn('slack', 'ignored a sign-in address that did not match the one waiting')
        }
      }
    }

    shell.openExternal(buildAuthorizeUrl({ clientId, state, challenge })).catch((error) => {
      clearTimeout(timer)
      waiting = null
      reject(error)
    })
  })

  const tokens = await exchangeCode({ clientId, code, verifier })
  logInfo('slack', tokens.expiresAt ? 'signed in (the token expires and is renewed)' : 'signed in')
  return tokens
}
