import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The manifest people paste into Slack must ask for exactly the read-only permissions the guide
// and the code rely on: nothing that writes, and no Socket Mode (the widget polls with the user token).
const manifest = JSON.parse(readFileSync('docs/slack-app-manifest.json', 'utf8')) as {
  oauth_config: { scopes: { user: string[]; bot?: string[] } }
  settings: {
    event_subscriptions?: unknown
    socket_mode_enabled: boolean
  }
}

describe('Slack app manifest', () => {
  it('asks for the six read-only user scopes', () => {
    expect([...manifest.oauth_config.scopes.user].sort()).toEqual(
      [
        'channels:read',
        'groups:read',
        'im:read',
        'mpim:read',
        'search:read',
        'users:read'
      ].sort()
    )
  })

  it('never asks for a permission that writes', () => {
    const all = [...manifest.oauth_config.scopes.user, ...(manifest.oauth_config.scopes.bot ?? [])]
    expect(all.filter((s) => /write|chat:|files:|reactions:|admin/.test(s))).toEqual([])
    expect(manifest.oauth_config.scopes.bot).toBeUndefined() // no bot user at all
  })

  it('needs neither Socket Mode nor event subscriptions', () => {
    expect(manifest.settings.socket_mode_enabled).toBe(false)
    expect(manifest.settings.event_subscriptions).toBeUndefined()
  })
})
