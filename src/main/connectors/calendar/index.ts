import { horizonEnd } from '../../../shared/calendarWindow'
import type { Signal } from '../../../shared/types'
import { getSettings } from '../../settingsStore'
import { ApiDisabledError, AuthError, type Connector, type ConnectorContext } from '../types'
import {
  apiDisabledInfo,
  authorizedClient,
  disableFeature,
  enableFeature,
  httpStatus,
  isAuthFailure,
  isFeatureConnected
} from '../google/auth'
import { eventToSignal, trackMove, type CalendarEvent } from './mapper'

// A sync token keeps the window of the request that created it, so the cursor remembers the day
// and how many days it covered: a new day or a new setting starts over.
type SyncCursor = { token?: string; day: string; days?: number }

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

export class CalendarConnector implements Connector {
  readonly id = 'calendar' as const

  async isConnected(): Promise<boolean> {
    return isFeatureConnected('calendar')
  }

  // PKCE + loopback redirect, opened in the system browser.
  async connect(): Promise<void> {
    await enableFeature('calendar')
  }

  async disconnect(): Promise<void> {
    disableFeature('calendar')
  }

  async sync(ctx: ConnectorContext): Promise<Signal[]> {
    const oauth = await authorizedClient()
    const { google } = await import('googleapis')
    const calendar = google.calendar({ version: 'v3', auth: oauth })

    const now = new Date()
    let cursor: SyncCursor | undefined
    try {
      cursor = JSON.parse((await ctx.getCursor()) ?? '') as SyncCursor
    } catch {
      cursor = undefined
    }
    // The window of a sync token is fixed by the first request, so start over each new day.
    const days = getSettings().calendar.daysAhead
    let token =
      cursor && cursor.day === dayKey(now) && cursor.days === days ? cursor.token : undefined

    const cached = new Map((await ctx.loadCached()).map((s) => [s.id, s]))
    // What was read the time before, kept even when a full sync empties `cached`, so a change of
    // time can be told from the first time a meeting is seen.
    const previous = new Map(cached)

    const fetchAll = async (incremental: boolean): Promise<string | undefined> => {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const base = incremental
        ? { syncToken: token }
        : {
            timeMin: startOfToday.toISOString(),
            timeMax: new Date(horizonEnd(now.getTime(), days)).toISOString()
          }
      let pageToken: string | undefined
      let nextSyncToken: string | undefined
      do {
        const res = await calendar.events.list({
          calendarId: 'primary',
          singleEvents: true,
          maxResults: 250,
          pageToken,
          ...base
        })
        for (const item of (res.data.items ?? []) as CalendarEvent[]) {
          const signal = eventToSignal(item)
          if (signal) cached.set(signal.id, trackMove(previous.get(signal.id), signal))
          else if (item.id) cached.delete(`calendar:${item.id}`) // cancelled, declined or all-day
        }
        pageToken = res.data.nextPageToken ?? undefined
        nextSyncToken = res.data.nextSyncToken ?? undefined
      } while (pageToken)
      return nextSyncToken
    }

    try {
      let next: string | undefined
      if (token) {
        try {
          next = await fetchAll(true)
        } catch (error) {
          if (httpStatus(error) !== 410) throw error
          token = undefined // sync token expired: wipe the store and do a full sync
          cached.clear()
          next = await fetchAll(false)
        }
      } else {
        cached.clear()
        next = await fetchAll(false)
      }
      await ctx.setCursor(
        JSON.stringify({ token: next, day: dayKey(now), days } satisfies SyncCursor)
      )
    } catch (error) {
      if (isAuthFailure(error)) throw new AuthError()
      const disabled = apiDisabledInfo(error)
      if (disabled) throw new ApiDisabledError('calendar', disabled.url)
      throw error
    }

    return [...cached.values()]
  }
}
