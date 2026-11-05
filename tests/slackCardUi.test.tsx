// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemCard } from '@renderer/panel/components/ItemCard'
import { strings } from '@shared/strings'
import type { Signal } from '@shared/types'

const api = {
  openExternal: vi.fn(async () => undefined),
  items: { act: vi.fn(async () => undefined) },
  threads: { open: vi.fn(async () => undefined) }
}

const NOW = 1_800_000_000_000

const dm = (over: Partial<Signal> = {}): Signal => ({
  id: 'slack:D1:1',
  source: 'slack',
  kind: 'dm',
  title: '¿tienes un minuto?',
  body: 'Mensaje directo',
  url: 'https://cesa.slack.com/archives/D1/p1',
  occurredAt: NOW - 60_000,
  sender: 'Ana Pérez',
  urgency: 0.5,
  ...over
})

const show = (item: Signal): void => void render(<ItemCard item={item} now={NOW} />)

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('a direct message of Slack in the panel', () => {
  it('says who wrote it', () => {
    show(dm())
    expect(screen.getByText('Ana Pérez')).toBeTruthy()
    expect(screen.getByText('¿tienes un minuto?')).toBeTruthy()
    expect(screen.getByText('Mensaje directo')).toBeTruthy()
  })

  it('has the green dot with "!" (one message, so no count) until it is opened', () => {
    show(dm())
    expect(screen.getByLabelText(strings.panel.newMessage).textContent).toBe('!')
  })

  it('loses the dot when it is opened, and the message stays', () => {
    const { rerender } = render(<ItemCard item={dm()} now={NOW} />)
    fireEvent.click(screen.getByText('¿tienes un minuto?'))
    expect(api.openExternal).toHaveBeenCalledWith('https://cesa.slack.com/archives/D1/p1')
    expect(api.items.act).toHaveBeenCalledWith({ ids: ['slack:D1:1'], action: 'seen' })
    // The panel then draws it again as seen.
    rerender(<ItemCard item={dm({ seen: true })} now={NOW} />)
    expect(screen.queryByLabelText(strings.panel.newMessage)).toBeNull()
    expect(screen.getByText('¿tienes un minuto?')).toBeTruthy()
    expect(screen.getByText('Ana Pérez')).toBeTruthy()
  })

  it('is marked urgent like any other item when the person is a priority sender', () => {
    show(dm({ urgency: 0.9 }))
    expect(screen.getByText(strings.panel.urgent)).toBeTruthy()
    expect(screen.getByLabelText(strings.panel.newMessage)).toBeTruthy() // both signs together
  })
})

describe('other items', () => {
  it('a mention shows who wrote it but has no green dot', () => {
    show(dm({ kind: 'mention', body: '#ventas', channel: '#ventas' }))
    expect(screen.getByText('Ana Pérez')).toBeTruthy()
    expect(screen.queryByLabelText(strings.panel.newMessage)).toBeNull()
  })

  it('an email does not repeat the sender: its text already says it', () => {
    show({
      id: 'gmail:1',
      source: 'gmail',
      kind: 'email',
      title: 'Contrato',
      body: 'Ana · Hola',
      url: 'https://mail.google.com',
      occurredAt: NOW,
      sender: 'Ana <ana@x.com>'
    })
    expect(screen.queryByText('Ana <ana@x.com>')).toBeNull()
    expect(screen.queryByLabelText(strings.panel.newMessage)).toBeNull()
  })
})
