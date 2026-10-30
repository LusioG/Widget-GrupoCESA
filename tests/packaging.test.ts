import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

// Guards the packaging config: a mistake here does not show in development, only in the installed
// app (which would not start, or would not update).
const read = (file: string): string => readFileSync(resolve(file), 'utf8')
const builder = read('electron-builder.yml')

describe('installer configuration', () => {
  it('uses the same app id as the code, and keeps it stable', () => {
    const id = /^appId:\s*(\S+)/m.exec(builder)?.[1]
    expect(id).toBe('com.grupocesa.widget')
    expect(read('src/main/index.ts')).toContain(`setAppUserModelId('${id}')`)
  })

  it('ships the database migrations the app reads at startup', () => {
    expect(read('src/main/db/client.ts')).toContain("'src/main/db/migrations'")
    // `!src/**` leaves out the source; the migrations must be put back in after it.
    const files = builder.slice(builder.indexOf('files:'), builder.indexOf('asarUnpack:'))
    expect(files).toContain("'!src/**'")
    expect(files.indexOf("'src/main/db/migrations/**'")).toBeGreaterThan(files.indexOf("'!src/**'"))
  })

  it('starts from "everything" so the compiled app is not left out', () => {
    // A list with an include (the migrations) stops getting "everything" by default.
    const files = builder.slice(builder.indexOf('files:'), builder.indexOf('asarUnpack:'))
    expect(files.indexOf("'**/*'")).toBeGreaterThan(-1)
    expect(files.indexOf("'**/*'")).toBeLessThan(files.indexOf("'!src/**'"))
  })

  it('does not ask for administrator rights and keeps the user data on uninstall', () => {
    expect(builder).toMatch(/oneClick:\s*true/)
    expect(builder).toMatch(/perMachine:\s*false/)
    expect(builder).toMatch(/deleteAppDataOnUninstall:\s*false/)
  })

  it('creates the shortcuts that reopen a widget that was closed', () => {
    expect(builder).toMatch(/createDesktopShortcut:\s*always/)
    expect(builder).toMatch(/createStartMenuShortcut:\s*true/)
  })

  it('updates from GitHub Releases, not from a placeholder address', () => {
    expect(builder).toMatch(/provider:\s*github/)
    expect(builder).not.toContain('example.com')
    expect(builder).toMatch(/repo:\s*Widget-GrupoCESA-releases/)
  })

  it('keeps the user data folder fixed, whatever the product name', () => {
    const main = read('src/main/index.ts')
    expect(main).toContain("app.setPath('userData'")
    expect(main).toContain("'widget'")
  })
})
