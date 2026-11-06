// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Briefing } from '@renderer/briefing/Briefing'
import { AiSettings } from '@renderer/panel/views/settings/AiSettings'
import { useAppStore } from '@renderer/store/useAppStore'
import { DEFAULT_SETTINGS } from '@shared/settingsSchema'
import { strings } from '@shared/strings'
import type { AiAuditEntry, AppState, Briefing as BriefingData } from '@shared/types'

const s = strings.settings.briefing.ai
const sb = strings.briefing

const api = {
  openExternal: vi.fn(async () => undefined),
  threads: { open: vi.fn(async () => undefined) },
  ai: {
    auditList: vi.fn(async (): Promise<AiAuditEntry[]> => []),
    auditClear: vi.fn(async () => undefined)
  },
  settings: { update: vi.fn(async () => undefined) },
  briefing: {
    get: vi.fn(async (): Promise<BriefingData | null> => null),
    onShow: vi.fn(() => () => undefined),
    fit: vi.fn(),
    close: vi.fn(),
    regenerate: vi.fn(async () => null)
  }
}

const setAi = (over: Partial<typeof DEFAULT_SETTINGS.ai> = {}): void =>
  useAppStore.setState({
    state: {
      aiKeySet: true,
      settings: { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, enabled: true, ...over } }
    } as unknown as AppState
  })

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: api, configurable: true })
  Element.prototype.animate = vi.fn() as never
  window.matchMedia = vi.fn(() => ({ matches: false })) as never
  globalThis.ResizeObserver = class {
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
  } as never
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('what the AI may read: one level for each source', () => {
  it('shows mail, lists and Slack, each at "solo cantidades" by default', () => {
    setAi()
    render(<AiSettings />)
    for (const title of [s.levelMail, s.levelLists, s.levelSlack]) {
      const group = screen.getByRole('group', { name: title })
      expect(
        within(group).getByRole('button', { name: s.levelCounts }).getAttribute('aria-pressed')
      ).toBe('true')
    }
  })

  it('saves the level of just that source', () => {
    setAi()
    render(<AiSettings />)
    const lists = screen.getByRole('group', { name: s.levelLists })
    fireEvent.click(within(lists).getByRole('button', { name: s.levelsMail.titles }))
    expect(api.settings.update).toHaveBeenLastCalledWith({ ai: { lists: 'titles' } })
    const slack = screen.getByRole('group', { name: s.levelSlack })
    fireEvent.click(within(slack).getByRole('button', { name: s.levelsSlack.people }))
    expect(api.settings.update).toHaveBeenLastCalledWith({ ai: { slack: 'people' } })
  })

  it('shows the level that was chosen', () => {
    setAi({ mail: 'people' })
    render(<AiSettings />)
    const mail = screen.getByRole('group', { name: s.levelMail })
    expect(
      within(mail).getByRole('button', { name: s.levelsMail.people }).getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      within(mail).getByRole('button', { name: s.levelCounts }).getAttribute('aria-pressed')
    ).toBe('false')
  })

  it('offers the two new sections to put back when they were taken off', () => {
    setAi({ sections: ['meetings'] })
    render(<AiSettings />)
    expect(screen.getByText(/Los últimos 3 correos sin leer/)).toBeTruthy()
    expect(screen.getByText(/Lo nuevo en tus listas de distribución/)).toBeTruthy()
  })

  it('says the free requests only change the style', () => {
    setAi({ extras: ['destaca lo que vence esta semana'] })
    render(<AiSettings />)
    expect(screen.getByText(s.topicsExtrasHint)).toBeTruthy()
    expect(s.topicsExtrasHint).toMatch(/No agrega datos/)
  })
})

const briefing = (over: Partial<BriefingData> = {}): BriefingData => ({
  date: '2026-11-06',
  createdAt: new Date(2026, 10, 6, 9, 0).getTime(),
  name: 'Luciano',
  mode: 'ai',
  greeting: 'Buen día, Luciano',
  intro: 'Tienes correos nuevos.',
  meetings: [],
  priorities: [],
  nextTasks: [],
  yesterday: [],
  waiting: [],
  since: { emails: 0, messages: 0 },
  narrative: [{ key: 'mail', text: 'Tienes 4 correos sin leer.', refs: [] }],
  ...over
})

const show = async (b: BriefingData): Promise<void> => {
  api.briefing.get.mockResolvedValue(b)
  render(<Briefing />)
  await screen.findByText(b.intro)
}

describe('the summary window', () => {
  it('says which source the AI could not read, and where to change it', async () => {
    await show(briefing({ notices: ['mail', 'lists'] }))
    expect(screen.getByText(sb.notices.mail)).toBeTruthy()
    expect(screen.getByText(sb.notices.lists)).toBeTruthy()
    expect(screen.queryByText(sb.notices.slack)).toBeNull()
    expect(screen.getByText(sb.notices.change)).toBeTruthy()
  })

  it('has no note when the AI could read everything', async () => {
    await show(briefing())
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('shows the latest mails and each list with its counts in the detail', async () => {
    const item = {
      id: 'gmail:m1',
      source: 'gmail' as const,
      kind: 'email' as const,
      title: 'Asunto uno',
      url: 'https://mail.google.com',
      urgent: false
    }
    const b = briefing({
      narrative: [{ key: 'since', text: 'Hay correos nuevos.', refs: [] }], // so the titles below are the detail's
      mail: [item],
      mailTotal: 1,
      lists: [
        {
          address: 'soporte@cesa.com',
          name: 'Soporte CESA',
          conversations: 2,
          unread: 6,
          urgent: true,
          items: [
            {
              ...item,
              id: 'gmail:list:a1:m1',
              title: 'Caída en la sede norte',
              listName: 'Soporte CESA'
            }
          ]
        }
      ]
    })
    await show(b)
    fireEvent.click(screen.getByRole('button', { name: sb.details }))
    expect(screen.getByText(sb.mail)).toBeTruthy()
    expect(screen.getByText('Asunto uno')).toBeTruthy()
    expect(screen.getByText(sb.lists)).toBeTruthy()
    expect(screen.getByText('Soporte CESA')).toBeTruthy()
    expect(screen.getByText(sb.listCounts(2, 6))).toBeTruthy()
    expect(screen.getByText('Caída en la sede norte')).toBeTruthy()
  })

  it('opens a list conversation in the chat window, and a single mail in the browser', async () => {
    const mail = {
      id: 'gmail:m1',
      source: 'gmail' as const,
      kind: 'email' as const,
      title: 'Asunto uno',
      url: 'https://mail.google.com/m1',
      urgent: false
    }
    const conversation = {
      ...mail,
      id: 'gmail:list:18fa11aa11aa11aa:m4',
      title: 'Caída en la sede norte',
      url: 'https://mail.google.com/list',
      listName: 'Soporte CESA',
      threadId: '18fa11aa11aa11aa'
    }
    await show(
      briefing({
        narrative: [{ key: 'since', text: 'Hay novedades.', refs: [] }],
        mail: [mail],
        lists: [
          {
            address: 'soporte@cesa.com',
            name: 'Soporte CESA',
            conversations: 1,
            unread: 1,
            urgent: false,
            items: [conversation]
          }
        ]
      })
    )
    fireEvent.click(screen.getByRole('button', { name: sb.details }))
    fireEvent.click(screen.getByText('Caída en la sede norte'))
    expect(api.threads.open).toHaveBeenCalledWith({
      threadId: '18fa11aa11aa11aa',
      signalId: 'gmail:list:18fa11aa11aa11aa:m4',
      title: 'Caída en la sede norte'
    })
    expect(api.openExternal).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Asunto uno'))
    expect(api.openExternal).toHaveBeenCalledWith('https://mail.google.com/m1')
  })

  it('opens a summary saved before these sections existed', async () => {
    await show(
      briefing({ notices: undefined, narrative: [{ key: 'since', text: 'Nada.', refs: [] }] })
    )
    expect(screen.getByText('Nada.')).toBeTruthy()
  })
})

describe('history of what was sent to the AI', () => {
  const entry = (id: number, over: Partial<AiAuditEntry> = {}): AiAuditEntry => ({
    id,
    at: new Date(2026, 10, 6, 9, id).getTime(),
    provider: 'gemini',
    model: 'gemini-test',
    system: 'Eres el asistente personal',
    user: 'Datos de hoy (JSON):\n{"reuniones":[{"titulo":"Daily"}]}',
    ...over
  })

  it('says so when nothing was sent yet', async () => {
    setAi()
    render(<AiSettings />)
    expect(await screen.findByText(s.auditEmpty)).toBeTruthy()
    expect(screen.queryByRole('button', { name: s.auditClear })).toBeNull()
  })

  it('lists each request, and shows the data and the instructions as they were sent', async () => {
    api.ai.auditList.mockResolvedValue([entry(2), entry(1)])
    setAi()
    render(<AiSettings />)
    expect(await screen.findAllByText('gemini-test')).toHaveLength(2)
    expect(screen.getAllByText(s.auditData)).toHaveLength(2)
    expect(screen.getAllByText(/"titulo": "Daily"/)).toHaveLength(2) // indented JSON
    expect(screen.getAllByText('Eres el asistente personal')).toHaveLength(2)
  })

  it('deletes the history on request', async () => {
    api.ai.auditList.mockResolvedValue([entry(1)])
    setAi()
    render(<AiSettings />)
    fireEvent.click(await screen.findByRole('button', { name: s.auditClear }))
    expect(api.ai.auditClear).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(s.auditEmpty)).toBeTruthy()
  })
})
