import { app } from 'electron'
import { existsSync, readFileSync, rmSync, unwatchFile, watchFile, writeFileSync } from 'fs'
import { join } from 'path'
import {
  CONFIG_ERROR_FILE_NAME,
  CONFIG_FILE_NAME,
  CONFIG_GUIDE,
  GUIDE_FILE_NAME
} from '../shared/configGuide'
import { settingsPatchSchema } from '../shared/settingsSchema'
import type { Settings } from '../shared/types'
import { logInfo, logWarn } from './logger'
import { getSettings, setSettingsSavedListener } from './settingsStore'

const POLL_MS = 1500
const SETTLE_MS = 400 // an editor may write the file in several steps
const HELP =
  'Edita los valores y guarda. Guía y claves en CONFIGURAR.md (misma carpeta). Si algo no es válido, el motivo queda en config-error.txt.'

const path = (name: string): string => join(app.getPath('userData'), name)

let lastWritten = ''
let writeTimer: NodeJS.Timeout | undefined
let readTimer: NodeJS.Timeout | undefined
let apply: ((patch: unknown) => Promise<unknown>) | undefined

export function configText(settings: Settings): string {
  return JSON.stringify({ _ayuda: HELP, ...settings }, null, 2) + '\n'
}

function writeConfigNow(): void {
  try {
    const text = configText(getSettings())
    if (text === lastWritten) return
    lastWritten = text
    writeFileSync(path(CONFIG_FILE_NAME), text, 'utf8')
  } catch (error) {
    logWarn('config', 'could not write the config file', error)
  }
}

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(writeConfigNow, SETTLE_MS)
}

function writeError(message: string): void {
  try {
    writeFileSync(
      path(CONFIG_ERROR_FILE_NAME),
      `No se aplicó ningún cambio de ${CONFIG_FILE_NAME}:\n\n${message}\n`,
      'utf8'
    )
  } catch {
    // Nothing else to do.
  }
}

async function readExternalChange(): Promise<void> {
  let raw: string
  try {
    raw = readFileSync(path(CONFIG_FILE_NAME), 'utf8')
  } catch {
    return
  }
  if (raw === lastWritten) return // our own write

  let patch: unknown
  try {
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as Record<string, unknown>
    delete parsed['_ayuda']
    patch = parsed
  } catch {
    writeError('El archivo no es un JSON válido (revisa comas, comillas y llaves).')
    logWarn('config', 'config.json is not valid JSON; nothing applied')
    return
  }

  const result = settingsPatchSchema.safeParse(patch)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `- ${i.path.join('.') || '(raíz)'}: ${i.message}`)
    writeError(lines.join('\n'))
    logWarn('config', `config.json has ${lines.length} invalid value(s); nothing applied`)
    return
  }

  try {
    await apply?.(result.data)
  } catch (error) {
    writeError('El widget no pudo guardar estos valores.')
    logWarn('config', 'could not apply config.json', error)
    return
  }
  try {
    rmSync(path(CONFIG_ERROR_FILE_NAME), { force: true })
  } catch {
    // Nothing else to do.
  }
  logInfo('config', 'applied changes from config.json')
  lastWritten = '' // rewrite the file in its tidy form
  writeConfigNow()
}

// Writes the guide for an assistant next to the config (only when it changed).
function writeGuides(): void {
  for (const name of [GUIDE_FILE_NAME, 'CLAUDE.md']) {
    try {
      const file = path(name)
      if (existsSync(file) && readFileSync(file, 'utf8') === CONFIG_GUIDE) continue
      writeFileSync(file, CONFIG_GUIDE, 'utf8')
    } catch (error) {
      logWarn('config', `could not write ${name}`, error)
    }
  }
}

// Starts after the settings are loaded. `applyPatch` saves a patch and makes the app follow it.
export function startConfigFile(applyPatch: (patch: unknown) => Promise<unknown>): void {
  apply = applyPatch
  setSettingsSavedListener(scheduleWrite)
  writeGuides()
  const file = path(CONFIG_FILE_NAME)
  if (existsSync(file)) {
    // The file may have been edited while the widget was closed: those edits win over the stored ones.
    lastWritten = ''
    void readExternalChange().then(() => writeConfigNow())
  } else {
    writeConfigNow()
  }
  watchFile(file, { interval: POLL_MS }, () => {
    if (readTimer) clearTimeout(readTimer)
    readTimer = setTimeout(() => void readExternalChange(), SETTLE_MS)
  })
}

export function stopConfigFile(): void {
  unwatchFile(path(CONFIG_FILE_NAME))
  if (writeTimer) clearTimeout(writeTimer)
  if (readTimer) clearTimeout(readTimer)
}
