import type { AccountInfo, Source } from './types'

// Where to switch the API on when Google did not say exactly which page.
const ENABLE_API_URL: Partial<Record<Source, string>> = {
  gmail: 'https://console.cloud.google.com/apis/library/gmail.googleapis.com',
  calendar: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com'
}

export type SyncSummary = {
  lastSyncAt?: number // the most recent successful check of any connected account
  problems: Source[] // connected, but the last check failed (no internet, service down)
  apiDisabled: { source: Source; url?: string }[] // the Google API is off in the user's project
}

export function syncSummary(accounts: Record<Source, AccountInfo>): SyncSummary {
  const connected = (Object.entries(accounts) as [Source, AccountInfo][]).filter(
    ([, a]) => a.status === 'connected'
  )
  const times = connected.flatMap(([, a]) => (a.lastSyncAt ? [a.lastSyncAt] : []))
  return {
    lastSyncAt: times.length > 0 ? Math.max(...times) : undefined,
    problems: connected
      .filter(([, a]) => a.error === 'sync' || a.error === 'offline')
      .map(([source]) => source),
    apiDisabled: connected
      .filter(([, a]) => a.error === 'api_disabled')
      .map(([source, a]) => ({ source, url: a.errorUrl ?? ENABLE_API_URL[source] }))
  }
}
