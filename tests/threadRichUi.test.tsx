// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { Thread } from '@renderer/thread/Thread'
import { strings } from '@shared/strings'
import type { ThreadMessage, ThreadView } from '@shared/types'

let shown: ((view: ThreadView) => void) | null = null
const api = {
  openExternal: vi.fn(async () => undefined),
  threads: {
    open: vi.fn(async () => undefined),
    close: vi.fn(),
    current: vi.fn(async (): Promise<ThreadView | null> => null),
    onShow: vi.fn((cb: (view: ThreadView) => void) => {
      shown = cb
      return () => {
        shown = null
      }
    })
  }
}

const GMAIL = 'https://mail.google.com/mail/?authuser=yo%40cesa.com#all/abc123'
const at = (h: number, m: number): number => new Date(2026, 10, 3, h, m).getTime()

const message = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'm1',
  from: { name: 'Pablo Calvo', address: 'pablo@cesa.com' },
  at: at(9, 0),
  text: 'Hola equipo',
  mine: false,
  unread: false,
  ...over
})

const view = (messages: ThreadMessage[]): ThreadView => ({
  threadId: 'abc123',
  subject: 'Probar acceso al nuevo server Argos',
  list: { address: 'desarrollo@cesa.com', name: 'desarrollo' },
  gmailUrl: GMAIL,
  messages
})

const open = async (v: ThreadView): Promise<void> => {
  await act(async () => void render(<Thread />))
  await act(async () => shown?.(v))
}

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  Element.prototype.scrollIntoView = vi.fn()
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('conversation window: links', () => {
  const text = 'Les dejo el acuerdo <https://docs.google.com/document/d/1abc> y la carpeta https://drive.google.com/drive/folders/9z gracias'

  it('shows every link as a short chip that opens in the browser', async () => {
    await open(view([message({ text })]))
    const doc = screen.getByRole('button', { name: strings.thread.openLink('docs.google.com') })
    const folder = screen.getByRole('button', { name: strings.thread.openLink('drive.google.com') })
    expect(doc.textContent).toContain('docs.google.com')
    // The long address is no longer written out in the text.
    expect(screen.queryByText(/document\/d\/1abc/)).toBeNull()
    fireEvent.click(doc)
    expect(api.openExternal).toHaveBeenLastCalledWith('https://docs.google.com/document/d/1abc')
    fireEvent.click(folder)
    expect(api.openExternal).toHaveBeenLastCalledWith('https://drive.google.com/drive/folders/9z')
  })

  it('keeps the words around the link and shows images as a small label', async () => {
    await open(view([message({ text: `${text}\n[image: captura.png]` })]))
    expect(screen.getByText(/Les dejo el acuerdo/)).toBeTruthy()
    expect(screen.getByText(/gracias/)).toBeTruthy()
    expect(screen.getByTitle(strings.thread.image('captura.png'))).toBeTruthy()
  })
})

describe('conversation window: long messages and signatures', () => {
  const long = Array.from({ length: 14 }, (_, i) => `Línea ${i + 1} del mensaje`).join('\n')

  it('folds a long message and unfolds it on demand', async () => {
    await open(view([message({ text: long })]))
    const more = screen.getByRole('button', { name: strings.thread.showMore })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    const less = screen.getByRole('button', { name: strings.thread.showLess })
    expect(less.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(less)
    expect(screen.getByRole('button', { name: strings.thread.showMore })).toBeTruthy()
  })

  it('does not offer to unfold a short message', async () => {
    await open(view([message()]))
    expect(screen.queryByRole('button', { name: strings.thread.showMore })).toBeNull()
  })

  it('hides the signature behind "···" without losing it', async () => {
    const signature = 'Pablo Calvo\nLíder de Ingeniería <https://grupocesa.net/>'
    await open(view([message({ signature })]))
    expect(screen.queryByText(/Líder de Ingeniería/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: strings.thread.showSignature }))
    expect(screen.getByText(/Líder de Ingeniería/)).toBeTruthy()
    // Its links are still there, as chips.
    expect(screen.getByRole('button', { name: strings.thread.openLink('grupocesa.net') })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: strings.thread.hideSignature }))
    expect(screen.queryByText(/Líder de Ingeniería/)).toBeNull()
  })

  it('has no "···" when the message has no signature', async () => {
    await open(view([message()]))
    expect(screen.queryByRole('button', { name: strings.thread.showSignature })).toBeNull()
  })
})

describe('conversation window: attachments', () => {
  it('shows each file as a small link with its size, which opens the conversation in Gmail', async () => {
    await open(
      view([
        message({
          attachments: [
            { name: 'informe.pdf', size: 1_258_291, mime: 'application/pdf' },
            { name: 'datos.zip', size: 0, mime: 'application/zip' }
          ]
        })
      ])
    )
    const pdf = screen.getByRole('button', { name: strings.thread.attachment('informe.pdf') })
    expect(pdf.textContent).toContain('informe.pdf')
    expect(pdf.textContent).toContain('1,2 MB')
    const zip = screen.getByRole('button', { name: strings.thread.attachment('datos.zip') })
    expect(zip.textContent).not.toContain('MB') // an unknown size is not written as "0 B"
    fireEvent.click(pdf)
    expect(api.openExternal).toHaveBeenCalledWith(GMAIL)
  })

  it('shows nothing when there are no attachments', async () => {
    await open(view([message()]))
    expect(screen.queryByText('📎')).toBeNull()
  })
})

describe('conversation window: who wrote what', () => {
  it('puts an avatar with initials on the first bubble of each person, not on the next ones', async () => {
    await open(
      view([
        message({ id: 'a1', from: { name: 'Pablo Calvo', address: 'pablo@cesa.com' }, text: 'uno' }),
        message({ id: 'a2', from: { name: 'Pablo Calvo', address: 'pablo@cesa.com' }, text: 'dos', at: at(9, 1) }),
        message({ id: 'b1', from: { name: 'Luis Gómez', address: 'luis@cesa.com' }, text: 'tres', at: at(9, 2) }),
        message({ id: 'c1', from: { name: 'Yo', address: 'yo@cesa.com' }, text: 'cuatro', mine: true, at: at(9, 3) })
      ])
    )
    expect(screen.getAllByText('PC')).toHaveLength(1) // two messages in a row, one avatar
    expect(screen.getAllByText('LG')).toHaveLength(1)
    expect(screen.queryByText('YO')).toBeNull() // one's own bubbles have none
  })
})

describe('conversation window: where it opens', () => {
  const scrolledTo = (): Element[] =>
    (Element.prototype.scrollIntoView as Mock).mock.contexts as Element[]

  it('opens on the first new message, not at the end of a long thread', async () => {
    await open(
      view([
        message({ id: 'a', text: 'viejo uno' }),
        message({ id: 'b', text: 'viejo dos', at: at(9, 5) }),
        message({ id: 'c', text: 'nuevo', at: at(9, 10), unread: true }),
        message({ id: 'd', text: 'más nuevo', at: at(9, 20), unread: true })
      ])
    )
    const marker = screen.getByText(strings.thread.newMessage).closest('p')!
    expect(scrolledTo()).toContain(marker)
    expect(
      (Element.prototype.scrollIntoView as Mock).mock.calls.at(-1)?.[0]
    ).toEqual({ block: 'start' })
  })

  it('opens on the latest message when nothing is new', async () => {
    await open(view([message({ id: 'a' }), message({ id: 'b', at: at(9, 5), text: 'último' })]))
    expect((Element.prototype.scrollIntoView as Mock).mock.calls.at(-1)?.[0]).toEqual({
      block: 'end'
    })
    expect(within(document.body).queryByText(strings.thread.newMessage)).toBeNull()
  })
})

describe('conversation window: bold words', () => {
  it('draws *word* as a bold word, without the asterisks', async () => {
    await open(view([message({ text: 'Esto es *importante* y no *olvidar* nada' })]))
    const bold = document.querySelectorAll('strong')
    expect([...bold].map((b) => b.textContent)).toEqual(['importante', 'olvidar'])
    expect(document.body.textContent).not.toContain('*')
    expect(screen.getByText(/Esto es/)).toBeTruthy()
  })

  it('keeps a lone asterisk as it is', async () => {
    await open(view([message({ text: 'precio 2*3 y * nota' })]))
    expect(document.querySelectorAll('strong')).toHaveLength(0)
    expect(document.body.textContent).toContain('2*3')
  })
})
