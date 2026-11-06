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
const URL = 'https://cesa.slack.com/archives/D1/p1'

const dm = (over: Partial<Signal> = {}): Signal => ({
  id: 'slack:D1:1',
  source: 'slack',
  kind: 'dm',
  title: '¿tienes un minuto?',
  body: 'Mensaje directo',
  url: URL,
  occurredAt: NOW - 60_000,
  sender: 'Ana Pérez',
  urgency: 0.5,
  ...over
})

// A conversation of n messages, the newest first: "mensaje n" is the latest one.
const lines = (n: number): NonNullable<Signal['messages']> =>
  Array.from({ length: n }, (_, i) => ({
    ts: `${1_700_000_000 + (n - i)}.000100`,
    at: NOW - (i + 1) * 60_000,
    text: `mensaje ${n - i}`,
    sender: 'Ana Pérez'
  }))

const conversation = (n: number, unread: number, over: Partial<Signal> = {}): Signal =>
  dm({ title: `mensaje ${n}`, messages: lines(n), unread, ...over })

const show = (item: Signal): void => void render(<ItemCard item={item} now={NOW} />)
const foldedBy = (n: number): string => strings.panel.conversationShow(n)

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('a conversation of Slack: one card with its messages folded behind it', () => {
  it('shows the number of new messages instead of the "!" when there are several', () => {
    show(conversation(7, 6))
    expect(screen.getByLabelText(strings.panel.newMessages(6)).textContent).toBe('6')
    expect(screen.queryByLabelText(strings.panel.newMessage)).toBeNull()
  })

  it('keeps the "!" when only one message is new', () => {
    show(conversation(7, 1))
    expect(screen.getByLabelText(strings.panel.newMessage).textContent).toBe('!')
    expect(screen.queryByLabelText(strings.panel.newMessages(1))).toBeNull()
  })

  it('shows no badge once it was opened', () => {
    show(conversation(7, 6, { seen: true }))
    expect(screen.queryByLabelText(strings.panel.newMessages(6))).toBeNull()
    expect(screen.queryByLabelText(strings.panel.newMessage)).toBeNull()
  })

  it('unfolds to the latest 4 messages, newest first, and says how many more there are', () => {
    show(conversation(7, 6))
    const toggle = screen.getByRole('button', { name: foldedBy(7) })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getAllByText('mensaje 7')).toHaveLength(1) // only the card's own text

    fireEvent.click(toggle)
    const written = screen.getAllByText(/^mensaje \d$/).map((el) => el.textContent)
    // the card's own text, then the 4 latest messages; the older three are not listed
    expect(written).toEqual(['mensaje 7', 'mensaje 7', 'mensaje 6', 'mensaje 5', 'mensaje 4'])
    expect(screen.getByText(strings.panel.moreMessages(3))).toBeTruthy()
  })

  it('has no "more" line when everything fits', () => {
    show(conversation(4, 4))
    fireEvent.click(screen.getByRole('button', { name: foldedBy(4) }))
    expect(screen.queryByText(/Hay \d+ mensajes? más/)).toBeNull()
    expect(screen.getByText('mensaje 1')).toBeTruthy()
  })

  it('says "1 mensaje" in the singular when only one is left out', () => {
    show(conversation(5, 5))
    fireEvent.click(screen.getByRole('button', { name: foldedBy(5) }))
    expect(screen.getByText('Hay 1 mensaje más')).toBeTruthy()
  })

  it('folds again, and opens Slack from a message, marking the conversation as seen', () => {
    show(conversation(7, 6))
    fireEvent.click(screen.getByRole('button', { name: foldedBy(7) }))
    fireEvent.click(screen.getByRole('button', { name: strings.panel.conversationHide }))
    expect(screen.queryByText('mensaje 6')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: foldedBy(7) }))
    fireEvent.click(screen.getByText(strings.panel.moreMessages(3)))
    expect(api.openExternal).toHaveBeenCalledWith(URL)
    expect(api.items.act).toHaveBeenCalledWith({ ids: ['slack:D1:1'], action: 'seen' })
  })

  it('does not offer to unfold a single message, or while selecting', () => {
    show(dm())
    expect(screen.queryByRole('button', { name: /Ver \d+ mensajes/ })).toBeNull()
    cleanup()
    render(<ItemCard item={conversation(7, 6)} now={NOW} selecting />)
    expect(screen.queryByRole('button', { name: /Ver \d+ mensajes/ })).toBeNull()
  })

  it('is only for direct messages of Slack, not for a mention in a channel', () => {
    show(conversation(7, 6, { kind: 'mention', channel: '#ventas' }))
    expect(screen.queryByRole('button', { name: /Ver \d+ mensajes/ })).toBeNull()
  })
})
