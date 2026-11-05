import { describe, expect, it } from 'vitest'
import { identityLabel } from '../src/shared/accountLabel'

describe('who an account is connected as', () => {
  it('joins the person and the workspace', () => {
    expect(identityLabel({ user: 'luciano', team: 'Grupo Cesa' })).toBe('luciano · Grupo Cesa')
  })

  it('shows what it has when part is missing', () => {
    expect(identityLabel({ user: 'luciano' })).toBe('luciano')
    expect(identityLabel({ team: 'Grupo Cesa' })).toBe('Grupo Cesa')
  })

  it('shows nothing when Slack gave no name (a connection made before it was kept)', () => {
    expect(identityLabel({})).toBeUndefined()
    expect(identityLabel({ user: '  ', team: '' })).toBeUndefined()
    expect(identityLabel(null)).toBeUndefined()
    expect(identityLabel(undefined)).toBeUndefined()
  })
})
