import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SLACK_REDIRECT_URI, SLACK_USER_SCOPES } from '../src/shared/slackApp'

type Manifest = {
  oauth_config: {
    redirect_urls: string[]
    pkce_enabled: boolean
    scopes: { user: string[]; bot?: string[] }
  }
  settings: { socket_mode_enabled: boolean; event_subscriptions?: unknown }
}

const personal = JSON.parse(readFileSync('docs/slack-app-manifest.json', 'utf8')) as Manifest
const company = JSON.parse(readFileSync('docs/slack-app-manifest-empresa.json', 'utf8')) as Manifest

// The one app of the company, which every person authorizes with their own Slack account.
describe('Slack company app manifest', () => {
  it('asks for exactly the same read-only permissions as the personal app', () => {
    expect([...company.oauth_config.scopes.user].sort()).toEqual(
      [...personal.oauth_config.scopes.user].sort()
    )
  })

  it('has no bot, no events and no write permission', () => {
    expect(company.oauth_config.scopes.bot).toBeUndefined()
    expect(company.settings.socket_mode_enabled).toBe(false)
    expect(company.settings.event_subscriptions).toBeUndefined()
    for (const scope of company.oauth_config.scopes.user) {
      expect(scope).not.toMatch(/write|history|files|admin/)
    }
  })

  it('is a public client (PKCE, no secret in the widget) that comes back to the widget by its own scheme', () => {
    expect(company.oauth_config.pkce_enabled).toBe(true)
    expect(company.oauth_config.redirect_urls).toEqual(['grupocesa-widget://slack'])
  })

  it('is the same app the widget signs in to: same scopes and same redirect', () => {
    expect([...company.oauth_config.scopes.user].sort()).toEqual([...SLACK_USER_SCOPES].sort())
    expect(company.oauth_config.redirect_urls).toEqual([SLACK_REDIRECT_URI])
  })
})
