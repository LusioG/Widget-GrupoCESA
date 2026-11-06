import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'
import type { Signal } from '../src/shared/types'

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../src/main/db/repos', () => ({ loadInbox: async () => [], saveInbox: async () => {} }))
vi.mock('../src/main/settingsStore', () => ({ getSettings: () => DEFAULT_SETTINGS }))
vi.mock('../src/main/autostart', () => ({ getAutostart: () => false }))
vi.mock('../src/main/connectors/google/auth', () => ({ hasGoogleCredentials: () => false }))

const { applyItemAction, handledSignalIds, setHandledListener, setSourceSignals } =
  await import('../src/main/appState')

const slack = (id: string, over: Partial<Signal> = {}): Signal => ({
  id,
  source: 'slack',
  kind: 'dm',
  title: 'hola',
  url: 'https://slack.com',
  occurredAt: Date.now(),
  ...over
})

const handled = vi.fn()
beforeEach(() => {
  handled.mockClear()
  setHandledListener(handled)
  setSourceSignals('slack', [
    slack('slack:DPABLO:1700000000.000100'),
    slack('slack:DLUIS:1700000100.000100')
  ])
  setSourceSignals('clickup', [
    { ...slack('clickup:t1'), source: 'clickup', kind: 'task', title: 'Tarea' }
  ])
})

describe('what the person handles in a Slack conversation counts as read', () => {
  it('opening it tells the connector, with the id of the conversation', async () => {
    await applyItemAction({ ids: ['slack:DPABLO:1700000000.000100'], action: 'seen' })
    expect(handled).toHaveBeenCalledWith(['slack:DPABLO:1700000000.000100'])
  })

  it('dismissing or snoozing it counts too', async () => {
    await applyItemAction({ ids: ['slack:DPABLO:1700000000.000100'], action: 'dismiss' })
    await applyItemAction({
      ids: ['slack:DLUIS:1700000100.000100'],
      action: 'snooze',
      until: 'hour'
    })
    expect(handled).toHaveBeenCalledTimes(2)
  })

  it('restoring or emptying the trash does not', async () => {
    await applyItemAction({ ids: ['slack:DPABLO:1700000000.000100'], action: 'restore' })
    await applyItemAction({ ids: ['slack:DPABLO:1700000000.000100'], action: 'purge' })
    expect(handled).not.toHaveBeenCalled()
  })

  it('only hears about Slack, and only about what is really in the list', async () => {
    await applyItemAction({ ids: ['clickup:t1', 'slack:DNADA:1.000100'], action: 'seen' })
    expect(handled).not.toHaveBeenCalled()
  })

  it('knows, after a restart, what was already handled', async () => {
    // Ids of their own: the earlier tests above already handled the other two.
    setSourceSignals('slack', [
      slack('slack:DOPENED:1800000000.000100'),
      slack('slack:DUNTOUCHED:1800000100.000100')
    ])
    await applyItemAction({ ids: ['slack:DOPENED:1800000000.000100'], action: 'seen' })
    expect(handledSignalIds('slack')).toContain('slack:DOPENED:1800000000.000100')
    expect(handledSignalIds('slack')).not.toContain('slack:DUNTOUCHED:1800000100.000100')
    expect(handledSignalIds('clickup').every((id) => id.startsWith('clickup:'))).toBe(true)
  })
})
