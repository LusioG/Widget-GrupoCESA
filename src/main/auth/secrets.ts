import { app, safeStorage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// Secrets are encrypted with the OS keychain (DPAPI on Windows) through safeStorage.
// The file only ever contains ciphertext. Never log values from this module.
const file = (): string => join(app.getPath('userData'), 'secrets.bin')

function readAll(): Record<string, string> {
  try {
    if (!existsSync(file())) return {}
    return JSON.parse(readFileSync(file(), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

export function setSecret(name: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system')
  }
  const all = readAll()
  all[name] = safeStorage.encryptString(value).toString('base64')
  writeFileSync(file(), JSON.stringify(all))
}

export function getSecret(name: string): string | undefined {
  const encoded = readAll()[name]
  if (!encoded || !safeStorage.isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return undefined
  }
}

export function hasSecret(name: string): boolean {
  return name in readAll()
}

export function deleteSecret(name: string): void {
  const all = readAll()
  if (!(name in all)) return
  delete all[name]
  writeFileSync(file(), JSON.stringify(all))
}
