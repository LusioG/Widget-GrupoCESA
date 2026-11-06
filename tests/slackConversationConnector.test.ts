import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/settingsSchema'

// The real connector, with a made-up Slack: the messages the search "finds", and nothing else.
const secrets = vi.hoisted(
  () =>
    ({
      store: new Map<string, string>(),
      found: [] as { channel: string; ts: string; text: string; user: string }[]
    }) as {
      store: Map<string, string>
      found: { channel: string; ts: string; text: string; user: string }[]
    }
)

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../src/main/settingsStore', () => ({ getSettings: () => DEFAULT_SETTINGS }))
vi.mock('../src/main/auth/slackSignIn', () => ({ signInWithSlack: async () => ({}) }))
vi.mock('../src/main/auth/secrets', () => ({
  getSecret: (key: string) => secrets.store.get(key) ?? null,
  setSecret: (key: string, value: string) => void secrets.store.set(key, value),
  deleteSecret: (key: string) => void secrets.store.delete(key),
  hasSecret: (key: string) => secrets.store.has(key)
}))
vi.mock('@slack/web-api', () => ({
  WebClient: class {
    search = {
      // Only the direct-message query finds anything: the mention query comes back empty.
      messages: async ({ query }: { query: string }) => ({
        messages: {
          matches: query.startsWith('is:dm')
            ? secrets.found.map((m) => ({
                type: 'message',
                user: m.user,
                text: m.text,
                ts: m.ts,
                channel: { id: m.channel, name: 'UPABLO', is_im: true }
              }))
            : []
        }
      })
    }
    users = { info: async () => ({ user: { profile: { display_name: 'Pablo Calvo' } } }) }
  }
}))

const { SlackConnector } = await import('../src/main/connectors/slack')

const NOW = Date.now()
const tsOf = (minutesAgo: number): string =>
  `${Math.floor((NOW - minutesAgo * 60_000) / 1000)}.000100`

// What the app keeps between runs: the cursor and the local copy of the signals.
const disk = { cursor: undefined as string | undefined, cached: [] as unknown[] }
const context = (): Parameters<InstanceType<typeof SlackConnector>['sync']>[0] =>
  ({
    getCursor: async () => disk.cursor,
    setCursor: async (cursor: string | undefined) => {
      disk.cursor = cursor
    },
    loadCached: async () => disk.cached
  }) as never

const say = (minutesAgo: number, text: string): void => {
  secrets.found.push({ channel: 'DPABLO', ts: tsOf(minutesAgo), text, user: 'UPABLO' })
}

const start = (): InstanceType<typeof SlackConnector> => {
  const connector = new SlackConnector()
  return connector
}

beforeEach(() => {
  secrets.store.clear()
  secrets.store.set('slack.userToken', 'xoxp-test')
  secrets.store.set(
    'slack.identity',
    JSON.stringify({ userId: 'UME', workspaceUrl: 'https://cesa.slack.com/', user: 'luciano' })
  )
  secrets.found.length = 0
  // The connector only shows what is newer than the moment Slack was connected.
  disk.cursor = JSON.stringify({ since: NOW - 3 * 60 * 60_000 })
  disk.cached = []
})

const conversationsOf = async (
  connector: InstanceType<typeof SlackConnector>
): Promise<{ title: string; unread?: number; messages?: { text: string }[] }[]> =>
  (await connector.sync(context())).filter((s) => s.kind === 'dm')

describe('the Slack connector gives one signal per conversation', () => {
  it('turns seven messages from one person into a single card with all of them', async () => {
    for (let i = 7; i >= 1; i--) say(i * 10, `mensaje ${8 - i}`) // mensaje 1 oldest ... mensaje 7 newest
    const out = await conversationsOf(start())
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('mensaje 7')
    expect(out[0].unread).toBe(7)
    expect(out[0].messages?.map((m) => m.text)).toEqual([
      'mensaje 7',
      'mensaje 6',
      'mensaje 5',
      'mensaje 4',
      'mensaje 3',
      'mensaje 2',
      'mensaje 1'
    ])
  })

  it('counts as new only what arrives after the person handled the conversation', async () => {
    say(60, 'uno')
    say(50, 'dos')
    const connector = start()
    const first = await conversationsOf(connector)
    expect(first[0].unread).toBe(2)

    // The person opens the card: its id is the one of the latest message.
    const latestId = (await connector.sync(context())).find((s) => s.kind === 'dm')!.id
    connector.markRead([latestId])
    say(1, 'tres') // a new message afterwards
    const again = await conversationsOf(connector)
    expect(again).toHaveLength(1)
    expect(again[0].title).toBe('tres')
    expect(again[0].unread).toBe(1) // only the new one
    expect(again[0].messages).toHaveLength(3) // the earlier ones are still listed
  })

  it('remembers what was read across a restart, and keeps the messages', async () => {
    say(60, 'uno')
    say(50, 'dos')
    const connector = start()
    const signals = await connector.sync(context())
    const latest = signals.find((s) => s.kind === 'dm')!
    connector.markRead([latest.id])
    await new Promise((resolve) => setTimeout(resolve, 10)) // the cursor is saved in the background
    disk.cached = signals // what the scheduler keeps in the local copy

    say(1, 'tres')
    const restarted = start() // a new run of the widget: nothing in memory
    const out = await conversationsOf(restarted)
    expect(out).toHaveLength(1)
    expect(out[0].unread).toBe(1)
    expect(out[0].messages?.map((m) => m.text)).toEqual(['tres', 'dos', 'uno'])
  })

  it('counts as read what the panel already knew was handled before conversations existed', async () => {
    say(60, 'uno')
    say(50, 'dos')
    const connector = start()
    const oldIds = [`slack:DPABLO:${tsOf(50)}`] // opened in the previous version, message by message
    connector.setSeenSource(() => oldIds)
    say(1, 'tres')
    const out = await conversationsOf(connector)
    expect(out[0].unread).toBe(1) // "uno" and "dos" were opened before: only "tres" is new
  })
})
