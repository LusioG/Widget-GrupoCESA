import { describe, expect, it } from 'vitest'
import { addEntries, MAX_ENTRIES, parseEntries, removeEntry } from '../src/shared/entryList'

describe('entryList', () => {
  it('adds a trimmed entry at the end', () => {
    expect(addEntries(['a@x.com'], '  b@x.com ')).toEqual(['a@x.com', 'b@x.com'])
  })

  it('ignores empty text', () => {
    expect(addEntries(['a'], '   ')).toEqual(['a'])
    expect(addEntries([], ' , ;')).toEqual([])
  })

  it('skips duplicates regardless of case and accents', () => {
    expect(addEntries(['Sofía Pérez'], 'sofia perez')).toEqual(['Sofía Pérez'])
    expect(addEntries(['A@X.com'], 'a@x.com')).toEqual(['A@X.com'])
  })

  it('accepts several entries pasted at once', () => {
    expect(addEntries(['a'], 'b, c;\nd, a')).toEqual(['a', 'b', 'c', 'd'])
    expect(parseEntries('x, ,y')).toEqual(['x', 'y'])
  })

  it('removes a single entry and leaves the rest', () => {
    expect(removeEntry(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('never goes over the limit', () => {
    const full = Array.from({ length: MAX_ENTRIES }, (_, i) => `u${i}`)
    expect(addEntries(full, 'nuevo')).toHaveLength(MAX_ENTRIES)
  })
})
