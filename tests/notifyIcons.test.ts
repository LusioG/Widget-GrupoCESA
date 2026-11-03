import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Each notification shows the logo of its source: the four files must exist and be 256 px PNGs.
describe('notification icons', () => {
  for (const name of ['slack', 'gmail', 'calendar', 'clickup']) {
    it(`${name}.png is a 256 x 256 PNG`, () => {
      const data = readFileSync(`resources/notify/${name}.png`)
      expect(data.subarray(1, 4).toString()).toBe('PNG')
      expect(data.readUInt32BE(16)).toBe(256)
      expect(data.readUInt32BE(20)).toBe(256)
    })
  }
})
