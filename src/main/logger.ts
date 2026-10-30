import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { describeError, redact } from './redact'

// Local log file only: nothing is ever sent anywhere. It holds events and error summaries,
// never message contents, and everything passes through `redact`.
const MAX_BYTES = 512 * 1024
const KEEP_OLD = 1

type Level = 'info' | 'warn' | 'error'

const dir = (): string => join(app.getPath('userData'), 'logs')
export const logFile = (): string => join(dir(), 'widget.log')

function rotate(file: string): void {
  try {
    if (!existsSync(file) || statSync(file).size < MAX_BYTES) return
    for (let i = KEEP_OLD; i >= 1; i--) {
      const from = i === 1 ? file : `${file}.${i - 1}`
      if (existsSync(from)) renameSync(from, `${file}.${i}`)
    }
  } catch {
    // Logging must never break the app.
  }
}

export function log(level: Level, scope: string, message: string, error?: unknown): void {
  try {
    mkdirSync(dir(), { recursive: true })
    rotate(logFile())
    const detail = error === undefined ? '' : ` ${describeError(error)}`
    appendFileSync(
      logFile(),
      `${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${redact(message)}${detail}\n`
    )
  } catch {
    // Same: swallow.
  }
}

export const logInfo = (scope: string, message: string): void => log('info', scope, message)
export const logWarn = (scope: string, message: string, error?: unknown): void =>
  log('warn', scope, message, error)
export const logError = (scope: string, message: string, error?: unknown): void =>
  log('error', scope, message, error)
