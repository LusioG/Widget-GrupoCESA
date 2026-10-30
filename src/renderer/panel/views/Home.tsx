import { useEffect, useRef, useState } from 'react'
import { strings } from '@shared/strings'
import { URGENT_THRESHOLD } from '@shared/badgeState'
import { dayOffset } from '@shared/calendarWindow'
import { syncSummary } from '@shared/syncStatus'
import type { Signal, SnoozeOption } from '@shared/types'
import { DotsDivider } from '@renderer/components/DotsArc'
import {
  CheckSquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ClockIcon,
  PlugIcon,
  RefreshIcon
} from '@renderer/components/icons'
import { Button } from '@renderer/components/ui'
import { useNow } from '@renderer/components/useNow'
import { useAppStore } from '@renderer/store/useAppStore'
import { Header } from '../components/Header'
import { ItemCard } from '../components/ItemCard'
import { MeetingCard } from '../components/MeetingCard'

function SectionTitle({ children }: { children: string }): React.JSX.Element {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-cesa-mute uppercase">
      <span className="size-1.5 rounded-full bg-cesa-green" />
      {children}
    </h2>
  )
}

// "miércoles, 30 oct": the heading of a day more than a day ahead.
const dayLabel = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' })

// The small round buttons of the toolbar above the list (select, refresh).
const toolbarChip =
  'flex min-h-6 cursor-pointer items-center gap-1 rounded-full border border-cesa-line px-2.5 py-0.5 text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green disabled:cursor-default'

const SNOOZE_OPTIONS: SnoozeOption[] = ['hour', 'tomorrow', 'monday']
const UNDO_VISIBLE_MS = 6000
const MIN_REFRESH_MS = 600 // so a very fast refresh still visibly "did something"

export function Home(): React.JSX.Element {
  const state = useAppStore((s) => s.state)
  const setView = useAppStore((s) => s.setView)
  const now = useNow()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // `hold`: the pointer or keyboard focus is on the bar, so it stays until they leave.
  const [undo, setUndo] = useState<{ key: number; text: string; hold: boolean } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showSnoozed, setShowSnoozed] = useState(false)
  const undoKey = useRef(0)

  // The "Descartado · Deshacer" bar goes away by itself, but not while it is being used.
  const undoKeyNow = undo?.key
  const undoHold = undo?.hold ?? false
  useEffect(() => {
    if (undoKeyNow === undefined || undoHold) return
    const id = setTimeout(() => setUndo(null), UNDO_VISIBLE_MS)
    return () => clearTimeout(id)
  }, [undoKeyNow, undoHold])

  const holdUndo = (hold: boolean): void => setUndo((u) => (u ? { ...u, hold } : u))

  const noteActed = (action: 'dismiss' | 'snooze', count = 1): void =>
    setUndo({
      key: ++undoKey.current,
      hold: false,
      text:
        action === 'dismiss'
          ? strings.panel.dismissedToast(count)
          : strings.panel.snoozedToast(count)
    })

  const undoLast = async (): Promise<void> => {
    setUndo(null)
    await window.api.items.undo()
  }

  const refresh = async (): Promise<void> => {
    if (refreshing) return
    setRefreshing(true)
    const started = Date.now()
    try {
      await window.api.sync.refresh()
    } finally {
      setTimeout(() => setRefreshing(false), Math.max(0, MIN_REFRESH_MS - (Date.now() - started)))
    }
  }

  const all: Signal[] = state?.signals ?? []
  const meetings = all
    .filter((s) => s.kind === 'meeting')
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))
  // Meetings grouped by calendar day (one already running from yesterday counts as today).
  const meetingDays: { offset: number; items: (Signal & { startsAt: number })[] }[] = []
  for (const m of meetings) {
    const startsAt = m.startsAt ?? m.occurredAt
    const offset = Math.max(0, dayOffset(startsAt, now))
    const last = meetingDays[meetingDays.length - 1]
    const entry = { ...m, startsAt }
    if (last && last.offset === offset) last.items.push(entry)
    else meetingDays.push({ offset, items: [entry] })
  }
  const items = all.filter((s) => s.kind !== 'meeting' && s.kind !== 'followup')
  const followups = all.filter((s) => s.kind === 'followup')
  const anyConnected = Object.values(state?.accounts ?? {}).some((a) => a.status !== 'disconnected')
  const needsReconnect = Object.values(state?.accounts ?? {}).some(
    (a) => a.status === 'needs_reconnect'
  )
  const snoozed = state?.snoozed ?? []
  const sync = state ? syncSummary(state.accounts) : null

  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const stopSelecting = (): void => {
    setSelecting(false)
    setSelected(new Set())
  }

  const batch = async (
    request: { action: 'dismiss' } | { action: 'snooze'; until: SnoozeOption }
  ): Promise<void> => {
    const count = selected.size
    await window.api.items.act({ ids: [...selected], ...request })
    stopSelecting()
    noteActed(request.action, count)
  }

  const renderItems = (list: Signal[]): React.JSX.Element => (
    <div className="space-y-2">
      {list.map((i) => (
        <ItemCard
          key={i.id}
          item={i}
          now={now}
          selecting={selecting}
          selected={selected.has(i.id)}
          onToggle={() => toggle(i.id)}
          onActed={(action) => noteActed(action)}
        />
      ))}
    </div>
  )

  const urgentCount = items.filter((i) => (i.urgency ?? 0) >= URGENT_THRESHOLD).length
  const summary = strings.panel.summary(items.length, urgentCount)
  const subtitle = state?.paused
    ? strings.panel.pausedNotice
    : !anyConnected
      ? strings.panel.noAccountsShort
      : state?.focus.active
        ? `${strings.panel.focusNotice} · ${summary}`
        : summary
  const hasSelectable = items.length > 0 || followups.length > 0

  return (
    <>
      <Header
        title={strings.panel.greeting}
        subtitle={subtitle}
        onSettings={() => setView('settings')}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="cesa-scroll flex-1 space-y-4 overflow-y-auto p-4">
          {anyConnected && sync && (
            <div className="flex items-center gap-2 text-xs text-cesa-mute">
              <span className="flex-1 truncate">
                {sync.lastSyncAt
                  ? strings.panel.updated(now - sync.lastSyncAt)
                  : strings.panel.noUpdateYet}
              </span>
              {hasSelectable && (
                <button
                  type="button"
                  aria-pressed={selecting}
                  onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                  className={`${toolbarChip} ${selecting ? 'border-cesa-green text-cesa-green' : ''}`}
                >
                  <CheckSquareIcon className="size-3.5" />
                  {selecting ? strings.panel.selectDone : strings.panel.select}
                </button>
              )}
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                title={strings.panel.refresh}
                className={toolbarChip}
              >
                <RefreshIcon className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? strings.panel.refreshing : strings.panel.refresh}
              </button>
            </div>
          )}
          {sync && sync.problems.length > 0 && (
            <p className="text-xs text-cesa-alert-text">
              {strings.panel.syncProblem(sync.problems.map((p) => strings.sources[p]).join(', '))}
            </p>
          )}
          {sync?.apiDisabled.map(({ source, url }) => (
            <div
              key={source}
              role="alert"
              className="flex items-center gap-3 rounded-xl border border-cesa-alert/50 bg-cesa-alert/10 px-3 py-2 text-xs text-cesa-ink"
            >
              <span className="flex-1">{strings.errors.apiDisabled(strings.sources[source])}</span>
              {url && (
                <button
                  type="button"
                  onClick={() => void window.api.openExternal(url)}
                  className="min-h-6 cursor-pointer rounded-full border border-cesa-alert px-2.5 py-1 font-semibold text-cesa-alert-text hover:bg-cesa-alert/10"
                >
                  {strings.errors.apiDisabledAction}
                </button>
              )}
            </div>
          ))}
          {needsReconnect && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-xl border border-cesa-alert/50 bg-cesa-alert/10 px-3 py-2 text-xs text-cesa-ink"
            >
              <span className="flex-1">{strings.errors.reconnectBanner}</span>
              <button
                type="button"
                onClick={() => setView('settings', 'accounts')}
                className="min-h-6 cursor-pointer rounded-full border border-cesa-alert px-2.5 py-1 font-semibold text-cesa-alert-text hover:bg-cesa-alert/10"
              >
                {strings.errors.reconnectAction}
              </button>
            </div>
          )}
          {meetings.length > 0 && (
            <section>
              <SectionTitle>{strings.panel.meetings}</SectionTitle>
              <div className="space-y-3">
                {meetingDays.map((group) => (
                  <div key={group.offset} className="space-y-2">
                    {/* A heading only when the list reaches beyond today. */}
                    {(meetingDays.length > 1 || group.offset > 0) && (
                      <h3 className="text-xs font-semibold text-cesa-mute capitalize">
                        {strings.panel.meetingDay(
                          group.offset,
                          dayLabel.format(group.items[0].startsAt)
                        )}
                      </h3>
                    )}
                    {group.items.map((m) => (
                      <MeetingCard key={m.id} meeting={m} now={now} onActed={noteActed} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
          {meetings.length > 0 && items.length > 0 && <DotsDivider />}
          {items.length > 0 && (
            <section>
              <SectionTitle>{strings.panel.pending}</SectionTitle>
              {renderItems(items)}
            </section>
          )}
          {followups.length > 0 && (
            <section>
              <SectionTitle>{strings.panel.followups}</SectionTitle>
              {renderItems(followups)}
            </section>
          )}
          {items.length === 0 && followups.length === 0 && meetings.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              {anyConnected ? (
                <CircleCheckIcon className="size-9 text-cesa-green" />
              ) : (
                <PlugIcon className="size-9 text-cesa-mute" />
              )}
              <p className="text-sm text-cesa-mute">
                {anyConnected ? strings.panel.empty : strings.panel.noAccounts}
              </p>
              {!anyConnected && (
                <Button onClick={() => setView('settings', 'accounts')}>
                  {strings.panel.connectAccounts}
                </Button>
              )}
            </div>
          )}
          {snoozed.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowSnoozed((v) => !v)}
                aria-expanded={showSnoozed}
                className="flex min-h-6 w-full cursor-pointer items-center gap-2 text-xs font-semibold tracking-wider text-cesa-mute uppercase hover:text-cesa-green"
              >
                <span className="size-1.5 rounded-full bg-cesa-600" />
                <span className="flex-1 text-left">
                  {strings.panel.snoozedSection(snoozed.length)}
                </span>
                {showSnoozed ? (
                  <ChevronDownIcon className="size-4" />
                ) : (
                  <ChevronRightIcon className="size-4" />
                )}
              </button>
              {showSnoozed && (
                <ul className="mt-2 space-y-1.5">
                  {snoozed.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl border border-cesa-700 bg-cesa-700/20 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-cesa-ink">{item.title}</span>
                        <span className="block truncate text-xs text-cesa-mute">
                          {strings.sources[item.source]} ·{' '}
                          {strings.panel.returnsIn((item.snoozedUntil ?? now) - now)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void window.api.items.act({ ids: [item.id], action: 'restore' })
                        }
                        className="min-h-6 cursor-pointer rounded-full border border-cesa-line px-2.5 py-0.5 text-xs whitespace-nowrap text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green"
                      >
                        {strings.panel.bringBack}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Floats over the list so showing it never moves the cards under the pointer. */}
        {undo && !selecting && (
          <div
            key={undo.key}
            role="status"
            onMouseEnter={() => holdUndo(true)}
            onMouseLeave={() => holdUndo(false)}
            onFocus={() => holdUndo(true)}
            onBlur={() => holdUndo(false)}
            className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border border-cesa-green/40 bg-cesa-900 px-3 py-2 text-xs text-cesa-ink shadow-lg shadow-black/50"
          >
            <span className="flex-1">{undo.text}</span>
            <button
              type="button"
              onClick={() => void undoLast()}
              className="min-h-6 cursor-pointer rounded-full bg-cesa-green px-3 py-1 text-xs font-bold text-cesa-950 hover:brightness-110"
            >
              {strings.panel.undo}
            </button>
          </div>
        )}
      </div>

      {selecting && (
        <div className="flex flex-wrap items-center gap-2 border-t border-cesa-green/30 bg-cesa-900 px-4 py-2.5">
          <span className="flex-1 text-xs whitespace-nowrap text-cesa-ink">
            {strings.panel.selectedCount(selected.size)}
          </span>
          {SNOOZE_OPTIONS.map((until) => (
            <button
              key={until}
              type="button"
              disabled={selected.size === 0}
              onClick={() => batch({ action: 'snooze', until })}
              className="inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-full border border-cesa-line px-2.5 py-1 text-xs text-cesa-ink hover:border-cesa-green disabled:cursor-default disabled:opacity-40"
            >
              <ClockIcon className="size-3.5" />
              {strings.panel.snoozeOptions[until]}
            </button>
          ))}
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => batch({ action: 'dismiss' })}
            className="min-h-6 cursor-pointer rounded-full bg-cesa-green px-2.5 py-1 text-xs font-bold text-cesa-950 disabled:cursor-default disabled:opacity-40"
          >
            {strings.panel.dismiss}
          </button>
        </div>
      )}
    </>
  )
}
