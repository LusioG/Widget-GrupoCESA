const MAX_TITLE = 160

export type TextLookups = {
  userName(id: string): string | undefined
  channelName(id: string): string | undefined
}

// Slack markup -> readable text: <@U1> -> @name, <#C1|general> -> #general, <url|label> -> label.
export function cleanSlackText(text: string, lookups: TextLookups): string {
  const out = text
    .replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/g, (_m, id: string, label?: string) => {
      return `@${lookups.userName(id) ?? label ?? 'alguien'}`
    })
    .replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/g, (_m, id: string, label?: string) => {
      return `#${label ?? lookups.channelName(id) ?? 'canal'}`
    })
    .replace(/<!(channel|here|everyone)(?:\|[^>]*)?>/g, '@$1')
    .replace(/<!subteam\^[A-Z0-9]+\|?([^>]*)>/g, (_m, label: string) => label || '@grupo')
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/<mailto:[^|>]+\|([^>]+)>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return out.length > MAX_TITLE ? `${out.slice(0, MAX_TITLE - 1)}…` : out
}

// A direct mention of the user (not @channel / @here).
export function mentionsUser(text: string, userId: string): boolean {
  return new RegExp(`<@${userId}(\\|[^>]*)?>`).test(text)
}

// https://<workspace>.slack.com/archives/<channel>/p<ts without the dot>
export function permalink(workspaceUrl: string, channel: string, ts: string): string {
  const base = workspaceUrl.endsWith('/') ? workspaceUrl : `${workspaceUrl}/`
  return `${base}archives/${channel}/p${ts.replace('.', '')}`
}
