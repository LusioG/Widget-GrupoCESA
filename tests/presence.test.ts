import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { isHidingState, PRESENCE_SCRIPT_ENCODED } from '../src/main/presenceScript'

describe('presence states', () => {
  it('steps aside for full screen, games and presentations only', () => {
    expect([2, 3, 4, 7].every(isHidingState)).toBe(true)
    // 1 not present, 5 normal, 6 quiet hours (Focus assist) must not hide the widget
    expect([1, 5, 6].some(isHidingState)).toBe(false)
  })
})

// The real script that runs on Windows: it must print Windows' current state as a number.
describe.skipIf(process.platform !== 'win32')('presence watcher script', () => {
  it('prints a valid state on startup', async () => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', PRESENCE_SCRIPT_ENCODED],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    )
    const first = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no output')), 20_000)
      child.stdout.once('data', (chunk: Buffer) => {
        clearTimeout(timer)
        resolve(chunk.toString().trim())
      })
    }).finally(() => child.kill())
    const state = Number(first)
    expect(Number.isInteger(state)).toBe(true)
    expect(state).toBeGreaterThanOrEqual(1)
    expect(state).toBeLessThanOrEqual(7)
  }, 30_000)
})
