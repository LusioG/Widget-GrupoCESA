import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  classifyMessage,
  type ConversationKind,
  type SlackLookups
} from '../src/main/connectors/slack/events'
import {
  emptyDmState,
  parseDmState,
  pruneDmState,
  slackFollowups,
  type DmState
} from '../src/main/connectors/slack/followups'
import { cleanSlackText, mentionsUser, permalink } from '../src/main/connectors/slack/text'

const ME = 'UME123'
const HOUR = 3_600_000
const DAY = 24 * HOUR

const people: Record<string, { name: string; isBot: boolean }> = {
  UANA123: { name: 'Ana', isBot: false },
  UBOT123: { name: 'Deploy Bot', isBot: true },
  [ME]: { name: 'Luciano', isBot: false }
}
const conversations: Record<string, { kind: ConversationKind; name?: string; peerId?: string }> = {
  CVENTAS1: { kind: 'channel', name: 'ventas' },
  GPRIV123: { kind: 'group', name: 'direccion' },
  DANA123: { kind: 'im', peerId: 'UANA123' },
  GMPIM123: { kind: 'mpim' }
}

const lookups: SlackLookups = {
  me: { userId: ME, workspaceUrl: 'https://cesa.slack.com/' },
  conversation: async (channel) => conversations[channel] ?? { kind: 'channel' },
  user: async (id) => people[id] ?? { name: id, isBot: false },
  userName: (id) => people[id]?.name,
  channelName: (id) => conversations[id]?.name
}

const ev = (over: Record<string, unknown>): Parameters<typeof classifyMessage>[0] => ({
  type: 'message',
  channel: 'DANA123',
  user: 'UANA123',
  text: 'hola',
  ts: '1761654000.000100',
  ...over
})

describe('cleanSlackText', () => {
  const l = {
    userName: (id: string) => people[id]?.name,
    channelName: (id: string) => conversations[id]?.name
  }

  it('resolves user and channel mentions', () => {
    expect(cleanSlackText('hey <@UANA123> mira <#CVENTAS1|ventas>', l)).toBe(
      'hey @Ana mira #ventas'
    )
  })

  it('unwraps links and special mentions', () => {
    expect(cleanSlackText('<https://x.com/a|el informe> <!here> <https://y.com>', l)).toBe(
      'el informe @here https://y.com'
    )
  })

  it('decodes entities and collapses whitespace', () => {
    expect(cleanSlackText('a &lt;b&gt; &amp;   c', l)).toBe('a <b> & c')
  })

  it('truncates long text', () => {
    expect(cleanSlackText('x'.repeat(500), l).length).toBeLessThanOrEqual(160)
  })
})

describe('helpers', () => {
  it('detects a direct mention but not @channel', () => {
    expect(mentionsUser('hola <@UME123> ¿ok?', ME)).toBe(true)
    expect(mentionsUser('<@UME123|luciano> mira', ME)).toBe(true)
    expect(mentionsUser('<!channel> atención', ME)).toBe(false)
    expect(mentionsUser('hola <@UOTHER1>', ME)).toBe(false)
  })

  it('builds a permalink from the workspace url', () => {
    expect(permalink('https://cesa.slack.com/', 'C123', '1355517523.000005')).toBe(
      'https://cesa.slack.com/archives/C123/p1355517523000005'
    )
    expect(permalink('https://cesa.slack.com', 'C123', '1.5')).toBe(
      'https://cesa.slack.com/archives/C123/p15'
    )
  })
})

describe('classifyMessage', () => {
  it('turns a direct message into a "dm" signal with permalink', async () => {
    const r = await classifyMessage(ev({}), lookups)
    expect(r.type).toBe('signal')
    if (r.type !== 'signal') return
    expect(r.signal).toMatchObject({
      id: 'slack:DANA123:1761654000.000100',
      source: 'slack',
      kind: 'dm',
      title: 'hola',
      sender: 'Ana',
      url: 'https://cesa.slack.com/archives/DANA123/p1761654000000100'
    })
    expect(r.signal.occurredAt).toBe(1761654000000)
    expect(r.isDm).toBe(true)
  })

  it('treats group DMs as direct messages', async () => {
    const r = await classifyMessage(ev({ channel: 'GMPIM123' }), lookups)
    expect(
      r.type === 'signal' && r.signal.kind === 'dm' && r.signal.body === 'Mensaje de grupo'
    ).toBe(true)
  })

  it('turns a channel message that mentions the user into a "mention"', async () => {
    const r = await classifyMessage(
      ev({ channel: 'CVENTAS1', text: '<@UME123> ¿revisas el informe? <#CVENTAS1|ventas>' }),
      lookups
    )
    expect(r.type === 'signal' && r.signal.kind === 'mention').toBe(true)
    if (r.type === 'signal') {
      expect(r.signal.channel).toBe('#ventas')
      expect(r.signal.title).toBe('@Luciano ¿revisas el informe? #ventas')
      expect(r.isDm).toBe(false)
    }
  })

  it('ignores channel messages that do not mention the user', async () => {
    expect(
      (await classifyMessage(ev({ channel: 'CVENTAS1', text: 'buenos días' }), lookups)).type
    ).toBe('ignore')
    expect(
      (await classifyMessage(ev({ channel: 'CVENTAS1', text: '<!channel> reunión' }), lookups)).type
    ).toBe('ignore')
  })

  it('works for private channels too', async () => {
    const r = await classifyMessage(ev({ channel: 'GPRIV123', text: 'cc <@UME123>' }), lookups)
    expect(r.type === 'signal' && r.signal.channel === '#direccion').toBe(true)
  })

  it('ignores bots (by bot_id, subtype or user profile)', async () => {
    expect((await classifyMessage(ev({ bot_id: 'B1' }), lookups)).type).toBe('ignore')
    expect((await classifyMessage(ev({ subtype: 'bot_message' }), lookups)).type).toBe('ignore')
    expect((await classifyMessage(ev({ user: 'UBOT123' }), lookups)).type).toBe('ignore')
  })

  it('ignores edits, deletions, joins and malformed events', async () => {
    for (const subtype of ['message_changed', 'message_deleted', 'channel_join']) {
      expect((await classifyMessage(ev({ subtype }), lookups)).type, subtype).toBe('ignore')
    }
    expect((await classifyMessage({ type: 'reaction_added' }, lookups)).type).toBe('ignore')
    expect((await classifyMessage(ev({ ts: undefined }), lookups)).type).toBe('ignore')
  })

  it('keeps file shares and labels empty text', async () => {
    const r = await classifyMessage(ev({ subtype: 'file_share', text: '' }), lookups)
    expect(r.type === 'signal' && r.signal.title === '(archivo adjunto)').toBe(true)
  })

  it('records the user\'s own DMs as "sent" and ignores their channel messages', async () => {
    const sent = await classifyMessage(ev({ user: ME, text: '¿viste mi propuesta?' }), lookups)
    expect(sent).toMatchObject({
      type: 'sent',
      channel: 'DANA123',
      to: 'Ana',
      text: '¿viste mi propuesta?'
    })
    expect(
      (await classifyMessage(ev({ user: ME, channel: 'CVENTAS1', text: 'hola' }), lookups)).type
    ).toBe('ignore')
  })
})

describe('Slack follow-ups', () => {
  const now = 1_800_000_000_000
  const state = (): DmState => ({
    sentByChannel: {
      DANA123: { at: now - 3 * DAY, text: 'propuesta', to: 'Ana', url: 'https://x/1' }
    },
    lastIncoming: {} as Record<string, number>
  })

  it('lists a DM nobody answered after the wait time', () => {
    const out = slackFollowups(state(), now, 48)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      kind: 'followup',
      source: 'slack',
      title: 'Mensaje a Ana: propuesta'
    })
  })

  it('does not list it once the other person answered', () => {
    const s = state()
    s.lastIncoming['DANA123'] = now - 2 * DAY
    expect(slackFollowups(s, now, 48)).toEqual([])
  })

  it('an answer from before my message does not count', () => {
    const s = state()
    s.lastIncoming['DANA123'] = now - 5 * DAY
    expect(slackFollowups(s, now, 48)).toHaveLength(1)
  })

  it('does not list recent messages', () => {
    const s = state()
    s.sentByChannel['DANA123'].at = now - HOUR
    expect(slackFollowups(s, now, 48)).toEqual([])
  })

  it('prunes old records and survives corrupt storage', () => {
    const s = state()
    s.sentByChannel['DOLD123'] = { at: now - 40 * DAY, text: 'x', to: 'y', url: 'u' }
    expect(Object.keys(pruneDmState(s, now).sentByChannel)).toEqual(['DANA123'])
    expect(parseDmState('not json')).toEqual(emptyDmState())
    expect(parseDmState(undefined)).toEqual(emptyDmState())
  })
})

describe('Slack module is read-only', () => {
  const dir = join(__dirname, '../src/main/connectors/slack')
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))

  it('never calls a Slack write method', () => {
    const forbidden =
      /\.(chat|reactions|files|pins|stars|reminders|dnd|usergroups|bookmarks)\.(post|update|delete|add|remove|upload|set|create|schedule)|conversations\.(join|leave|create|archive|invite|kick|rename|setTopic|setPurpose|mark|open|close)|users\.(setPresence|profile\.set)|postMessage|postEphemeral/
    for (const { file, text } of sources) expect(text, file).not.toMatch(forbidden)
  })

  it('only uses the expected read methods', () => {
    const used = new Set<string>()
    for (const { text } of sources) {
      for (const m of text.matchAll(/web\.([a-z]+(?:\.[a-zA-Z]+)?)\(/g)) used.add(m[1])
    }
    expect([...used].sort()).toEqual([
      'auth.test',
      'conversations.info',
      'users.conversations',
      'users.info'
    ])
  })
})
