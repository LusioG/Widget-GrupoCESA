import type { ClickUpList } from './types'

// ClickUp lists grouped the way ClickUp shows them: workspace > space > folder > list.
export type ListFolder = { name: string | null; lists: ClickUpList[] } // null = directly in the space
export type ListSpace = { key: string; team: string; space: string; folders: ListFolder[] }

// Lower-case and without accents, so "Gestión" matches a search for "gestion".
const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

export function matchesQuery(list: ClickUpList, query: string): boolean {
  const q = norm(query.trim())
  if (!q) return true
  return [list.name, list.folder ?? '', list.space, list.team ?? ''].some((v) =>
    norm(v).includes(q)
  )
}

// Groups (and optionally filters) lists. Order is stable: spaces and lists alphabetically,
// the lists that sit directly in a space before its folders.
export function buildListTree(lists: ClickUpList[], query = ''): ListSpace[] {
  const spaces = new Map<string, ListSpace>()
  for (const list of lists) {
    if (!matchesQuery(list, query)) continue
    const team = list.team ?? ''
    const key = `${team}\u0000${list.space}`
    let space = spaces.get(key)
    if (!space) {
      space = { key, team, space: list.space, folders: [] }
      spaces.set(key, space)
    }
    const folderName = list.folder ?? null
    let folder = space.folders.find((f) => f.name === folderName)
    if (!folder) {
      folder = { name: folderName, lists: [] }
      space.folders.push(folder)
    }
    folder.lists.push(list)
  }
  const byName = (a: string, b: string): number => a.localeCompare(b, 'es')
  const result = [...spaces.values()].sort((a, b) => byName(a.space, b.space))
  for (const space of result) {
    space.folders.sort((a, b) => {
      if (a.name === null) return -1
      if (b.name === null) return 1
      return byName(a.name, b.name)
    })
    for (const folder of space.folders) folder.lists.sort((a, b) => byName(a.name, b.name))
  }
  return result
}

export const listsOfSpace = (space: ListSpace): ClickUpList[] =>
  space.folders.flatMap((f) => f.lists)

export type Check = 'none' | 'some' | 'all'

// Tri-state of a group given the selected ids (checked when every list in it is selected).
export function checkState(lists: ClickUpList[], selected: ReadonlySet<string>): Check {
  if (lists.length === 0) return 'none'
  const n = lists.filter((l) => selected.has(l.id)).length
  return n === 0 ? 'none' : n === lists.length ? 'all' : 'some'
}

// Clicking a group selects all of its lists, or clears them when they were all selected.
export function toggleGroup(lists: ClickUpList[], selected: readonly string[]): string[] {
  const set = new Set(selected)
  const ids = lists.map((l) => l.id)
  if (checkState(lists, set) === 'all') return selected.filter((id) => !ids.includes(id))
  return [...new Set([...selected, ...ids])]
}
