import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The manifest people paste into Slack must ask for exactly the read-only permissions the guide
// and the code rely on: nothing that writes, and everything the widget needs to receive messages.
const manifest = JSON.parse(readFileSync('docs/slack-app-manifest.json', 'utf8')) as {
  oauth_config: { scopes: { user: string[]; bot?: string[] } }
  settings: {
    event_subscriptions: { user_events: string[]; bot_events?: string[]; request_url?: string }
    socket_mode_enabled: boolean
  }
}

describe('Slack app manifest', () => {
  it('asks for the nine read-only user scopes', () => {
    expect([...manifest.oauth_config.scopes.user].sort()).toEqual(
      [
        'channels:history',
        'channels:read',
        'groups:history',
        'groups:read',
        'im:history',
        'im:read',
        'mpim:history',
        'mpim:read',
        'users:read'
      ].sort()
    )
  })

  it('never asks for a permission that writes', () => {
    const all = [...manifest.oauth_config.scopes.user, ...(manifest.oauth_config.scopes.bot ?? [])]
    expect(all.filter((s) => /write|chat:|files:|reactions:|admin/.test(s))).toEqual([])
    expect(manifest.oauth_config.scopes.bot).toBeUndefined() // no bot user at all
  })

  it('subscribes to the four message events on behalf of the user', () => {
    expect([...manifest.settings.event_subscriptions.user_events].sort()).toEqual([
      'message.channels',
      'message.groups',
      'message.im',
      'message.mpim'
    ])
    expect(manifest.settings.event_subscriptions.bot_events).toBeUndefined()
  })

  it('uses Socket Mode, so no public web address is needed', () => {
    expect(manifest.settings.socket_mode_enabled).toBe(true)
    expect(manifest.settings.event_subscriptions.request_url).toBeUndefined()
  })
})
