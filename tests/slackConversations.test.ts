import { describe, expect, it } from 'vitest'
import {
  groupConversations,
  MAX_CONVERSATION_MESSAGES,
  messageId,
  parseMessageId,
  splitConversation,
  tsToMs
} from '../src/main/connectors/slack/conversations'
import { emptyDmState, parseDmState, pruneDmState } from '../src/main/connectors/slack/followups'
import type { Signal } from '../src/shared/types'

const NOW = 1_800_000_000_000
const MIN = 60_000

const message = (
  channel: string,
  minutesAgo: number,
  text: string,
  over: Partial<Signal> = {}
): Signal => {
  const at = NOW - minutesAgo * MIN
  const ts = `${Math.floor(at / 1000)}.000100`
  return {
    id: messageId(channel, ts),
    source: 'slack',
    kind: 'dm',
    title: text,
    body: 'Mensaje directo',
    url: `https://cesa.slack.com/archives/${channel}/p${ts}`,
    occurredAt: tsToMs(ts),
    sender: 'Pablo Calvo',
    ...over
  }
}

describe('direct messages of Slack, one card per conversation', () => {
  const pablo = [
    message('DPABLO', 60, 'Lucho buen día'),
    message('DPABLO', 50, 'acabo de ver la respuesta de Dani'),
    message('DPABLO', 5, 'Lucho, mañana lo vemos a primera hora')
  ]
  const luis = message('DLUIS', 30, '¿tienes un minuto?', { sender: 'Luis Gómez' })

  it('is one signal for each conversation, with the latest message as its card', () => {
    const out = groupConversations([...pablo, luis], {})
    expect(out).toHaveLength(2)
    const group = out.find((s) => s.sender === 'Pablo Calvo')!
    expect(group.title).toBe('Lucho, mañana lo vemos a primera hora')
    expect(group.id).toBe(pablo[2].id) // the id of the latest message: a new one makes a new card
  })

  it('lists the messages newest first, with who wrote each and when', () => {
    const group = groupConversations(pablo, {})[0]
    expect(group.messages?.map((m) => m.text)).toEqual([
      'Lucho, mañana lo vemos a primera hora',
      'acabo de ver la respuesta de Dani',
      'Lucho buen día'
    ])
    expect(group.messages?.[0]).toMatchObject({ sender: 'Pablo Calvo', at: pablo[2].occurredAt })
  })

  it('counts as new only what came after the person last read the conversation', () => {
    expect(groupConversations(pablo, {})[0].unread).toBe(3) // never read
    const readUpToSecond = { DPABLO: pablo[1].occurredAt }
    expect(groupConversations(pablo, readUpToSecond)[0].unread).toBe(1)
    expect(groupConversations(pablo, { DPABLO: pablo[2].occurredAt })[0].unread).toBe(0)
  })

  it('keeps each conversation apart', () => {
    const out = groupConversations([...pablo, luis], { DPABLO: pablo[2].occurredAt })
    expect(out.find((s) => s.sender === 'Luis Gómez')?.unread).toBe(1)
    expect(out.find((s) => s.sender === 'Pablo Calvo')?.unread).toBe(0)
  })

  it('leaves mentions in channels and anything else as separate items', () => {
    const mention = message('C123', 10, '@luciano mirá esto', { kind: 'mention' })
    const out = groupConversations([...pablo, mention], {})
    expect(out).toHaveLength(2)
    expect(out.find((s) => s.kind === 'mention')?.messages).toBeUndefined()
  })

  it('keeps at most the latest 20 messages of a conversation', () => {
    const many = Array.from({ length: 30 }, (_, i) => message('DPABLO', 100 - i, `mensaje ${i}`))
    const group = groupConversations(many, {})[0]
    expect(group.messages).toHaveLength(MAX_CONVERSATION_MESSAGES)
    expect(group.unread).toBe(30) // all of them count as new, even the ones not listed
    expect(group.messages?.[0].text).toBe('mensaje 29') // the newest (the last one written)
  })

  it('reads the channel and the time out of an id', () => {
    expect(parseMessageId('slack:DPABLO:1700000000.000100')).toEqual({
      channel: 'DPABLO',
      ts: '1700000000.000100'
    })
    expect(parseMessageId('gmail:abc')).toBeNull()
    expect(parseMessageId('slack:fake-1')).toBeNull()
    expect(tsToMs('1700000000.000100')).toBe(1_700_000_000_000)
  })
})

describe('what is kept of a conversation', () => {
  it('comes back as the same separate messages after a restart', () => {
    const originals = [
      message('DPABLO', 60, 'uno'),
      message('DPABLO', 30, 'dos'),
      message('DPABLO', 5, 'tres')
    ]
    const group = groupConversations(originals, {})[0]
    const stored = JSON.parse(JSON.stringify(group)) as typeof group // through the local copy
    const back = splitConversation(stored)
    expect(back.map((m) => [m.id, m.title, m.occurredAt])).toEqual(
      originals
        .map((m) => [m.id, m.title, m.occurredAt])
        .sort((a, b) => Number(b[2]) - Number(a[2]))
    )
    expect(back.every((m) => m.messages === undefined && m.unread === undefined)).toBe(true)
    // and they group again into the same card
    expect(groupConversations(back, {})[0].title).toBe('tres')
  })

  it('leaves a message that was kept alone as it is', () => {
    const single = message('DLUIS', 5, 'hola')
    expect(splitConversation(single)).toEqual([single])
    const mention = message('C1', 5, 'hey', { kind: 'mention' })
    expect(splitConversation(mention)).toEqual([mention])
  })
})

describe('where the read-up-to time is kept', () => {
  it('is saved with the rest of the state and read back', () => {
    const state = { ...emptyDmState(), seenUpTo: { DPABLO: NOW } }
    expect(parseDmState(JSON.stringify(state)).seenUpTo).toEqual({ DPABLO: NOW })
  })

  it('is empty for a state saved before it existed', () => {
    const old = JSON.stringify({ sentByChannel: {}, lastIncoming: {} })
    expect(parseDmState(old).seenUpTo).toEqual({})
  })

  it('forgets conversations older than two weeks', () => {
    const state = {
      ...emptyDmState(),
      seenUpTo: { DNEW: NOW - 1000, DOLD: NOW - 30 * 24 * 60 * MIN }
    }
    expect(Object.keys(pruneDmState(state, NOW).seenUpTo)).toEqual(['DNEW'])
  })
})
