import { describe, expect, it } from 'vitest'
import {
  buildListTree,
  checkState,
  listsOfSpace,
  matchesQuery,
  toggleGroup
} from '../src/shared/listTree'
import type { ClickUpList } from '../src/shared/types'

const L = (
  id: string,
  name: string,
  space: string,
  folder?: string,
  team = 'CESA'
): ClickUpList => ({
  id,
  name,
  space,
  folder,
  team
})

const lists: ClickUpList[] = [
  L('1', 'Pipeline', 'Comercial'),
  L('2', 'Clientes activos', 'Comercial', 'Ventas'),
  L('3', 'Cotizaciones', 'Comercial', 'Ventas'),
  L('4', 'Facturación', 'Finanzas', 'Cobranzas'),
  L('5', 'Bugs', 'Tecnología'),
  L('6', 'Gestión de proyectos', 'Tecnología', 'PMO')
]

describe('buildListTree', () => {
  it('groups lists by space and folder', () => {
    const tree = buildListTree(lists)
    expect(tree.map((s) => s.space)).toEqual(['Comercial', 'Finanzas', 'Tecnología'])
    const comercial = tree[0]
    expect(comercial.folders.map((f) => f.name)).toEqual([null, 'Ventas'])
    expect(comercial.folders[0].lists.map((l) => l.name)).toEqual(['Pipeline'])
    expect(comercial.folders[1].lists.map((l) => l.name)).toEqual([
      'Clientes activos',
      'Cotizaciones'
    ])
  })

  it('puts lists that sit directly in a space before its folders', () => {
    const tec = buildListTree(lists).find((s) => s.space === 'Tecnología')!
    expect(tec.folders[0].name).toBeNull()
    expect(tec.folders[1].name).toBe('PMO')
  })

  it('keeps spaces of different workspaces apart even with the same name', () => {
    const tree = buildListTree([
      L('a', 'X', 'General', undefined, 'Empresa A'),
      L('b', 'Y', 'General', undefined, 'Empresa B')
    ])
    expect(tree).toHaveLength(2)
  })

  it('returns nothing for no lists', () => {
    expect(buildListTree([])).toEqual([])
  })

  it('does not lose or duplicate any list', () => {
    const all = buildListTree(lists).flatMap(listsOfSpace)
    expect(all.map((l) => l.id).sort()).toEqual(['1', '2', '3', '4', '5', '6'])
  })
})

describe('search', () => {
  it('matches the list, folder, space or workspace name, ignoring case and accents', () => {
    expect(matchesQuery(lists[5], 'gestion')).toBe(true) // list name, no accent
    expect(matchesQuery(lists[5], 'PMO')).toBe(true) // folder
    expect(matchesQuery(lists[5], 'tecnologia')).toBe(true) // space
    expect(matchesQuery(lists[5], 'cesa')).toBe(true) // workspace
    expect(matchesQuery(lists[5], 'cobranzas')).toBe(false)
  })

  it('an empty query matches everything', () => {
    expect(matchesQuery(lists[0], '')).toBe(true)
    expect(matchesQuery(lists[0], '   ')).toBe(true)
  })

  it('filters the tree and drops empty groups', () => {
    const tree = buildListTree(lists, 'ventas')
    expect(tree.map((s) => s.space)).toEqual(['Comercial'])
    expect(listsOfSpace(tree[0]).map((l) => l.id)).toEqual(['2', '3'])
    expect(buildListTree(lists, 'zzz')).toEqual([])
  })
})

describe('tri-state selection', () => {
  const group = [lists[1], lists[2]]

  it('reports none / some / all', () => {
    expect(checkState(group, new Set())).toBe('none')
    expect(checkState(group, new Set(['2']))).toBe('some')
    expect(checkState(group, new Set(['2', '3', '99']))).toBe('all')
    expect(checkState([], new Set(['2']))).toBe('none')
  })

  it('clicking a group selects all of its lists, keeping the rest of the selection', () => {
    expect(toggleGroup(group, ['5']).sort()).toEqual(['2', '3', '5'])
    expect(toggleGroup(group, ['2']).sort()).toEqual(['2', '3'])
  })

  it('clicking a fully selected group clears only that group', () => {
    expect(toggleGroup(group, ['2', '3', '5'])).toEqual(['5'])
  })

  it('never produces duplicates', () => {
    const out = toggleGroup(group, ['2', '2', '5'])
    expect(new Set(out).size).toBe(out.length)
  })
})
