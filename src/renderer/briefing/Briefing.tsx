import { useEffect, useRef, useState } from 'react'
import { dueLabel } from '@shared/dueLabel'
import { strings } from '@shared/strings'
import type { Briefing as BriefingData, BriefingItem } from '@shared/types'
import logo from '@renderer/assets/logo-circle.png'
import { DotsArc, DotsDivider } from '@renderer/components/DotsArc'
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshIcon,
  XIcon
} from '@renderer/components/icons'
import { Button } from '@renderer/components/ui'
import { useNow } from '@renderer/components/useNow'
import { PriorityFlag, SourceIcon, SourceTag } from '@renderer/components/SourceBadge'

const s = strings.briefing

const time = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const longDate = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })

function SectionTitle({ children }: { children: string }): React.JSX.Element {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-cesa-mute uppercase">
      <span className="size-1.5 rounded-full bg-cesa-green" />
      {children}
    </h2>
  )
}

// Opens the original in the browser; the summary stays where it is.
const open = (url: string): void => void window.api.openExternal(url)

function Meeting({ item }: { item: BriefingItem }): React.JSX.Element {
  const start = item.startsAt
  const end = item.endsAt
  return (
    <li className="flex items-center gap-3 rounded-xl border border-cesa-700 bg-cesa-700/30 px-3 py-2.5">
      <span className="w-[5.5rem] shrink-0 text-sm font-semibold text-cesa-meeting tabular-nums">
        {start !== undefined ? time.format(start) : ''}
        {end !== undefined ? `–${time.format(end)}` : ''}
      </span>
      <span title={item.title} className="min-w-0 flex-1 truncate text-sm text-cesa-ink">
        {item.title}
      </span>
      {item.meetingUrl && (
        <button
          type="button"
          onClick={() => open(item.meetingUrl!)}
          aria-label={`${s.join}: ${item.title}`}
          className="min-h-6 shrink-0 cursor-pointer rounded-full bg-cesa-green px-3 py-1 text-xs font-bold text-cesa-950 transition hover:brightness-110"
        >
          {s.join}
        </button>
      )}
    </li>
  )
}

function Row({
  item,
  now,
  rank
}: {
  item: BriefingItem
  now: number
  rank?: number
}): React.JSX.Element {
  const sub = item.dueAt !== undefined ? dueLabel(item.dueAt, now) : undefined
  return (
    <li>
      <button
        type="button"
        onClick={() => open(item.url)}
        title={`${s.open}: ${item.title}`}
        className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-cesa-700 bg-cesa-700/30 px-3 py-2.5 text-left transition hover:border-cesa-green/50 hover:bg-cesa-700/60"
      >
        {rank !== undefined && (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-cesa-900 text-xs font-bold text-cesa-green">
            {rank}
          </span>
        )}
        <SourceTag source={item.source} />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm break-words text-cesa-ink">{item.title}</span>
          {(sub || item.priority) && (
            <span
              className={`mt-0.5 flex items-center gap-1 text-xs ${item.urgent ? 'text-cesa-alert-text' : 'text-cesa-mute'}`}
            >
              {item.priority && <PriorityFlag priority={item.priority} />}
              {item.priority && (
                <span className="text-cesa-mute">
                  {strings.panel.priority[item.priority]}
                  {sub ? ' ·' : ''}
                </span>
              )}
              {sub && <span className="truncate">{sub}</span>}
            </span>
          )}
        </span>
        {item.urgent && (
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-cesa-alert/50 px-1.5 py-0.5 text-xs font-semibold text-cesa-alert-text">
            <AlertIcon className="size-3" />
            {s.urgent}
          </span>
        )}
      </button>
    </li>
  )
}

function Section({
  title,
  items,
  now,
  ranked
}: {
  title: string
  items: BriefingItem[]
  now: number
  ranked?: boolean
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <Row key={item.id} item={item} now={now} rank={ranked ? i + 1 : undefined} />
        ))}
      </ul>
    </section>
  )
}

// The lists: all the meetings and items, one row each. It is the whole summary when the AI did
// not write it, and the detail behind the text when it did.
function Detail({ briefing, now }: { briefing: BriefingData; now: number }): React.JSX.Element {
  const since = s.sinceText(briefing.since.emails, briefing.since.messages)
  return (
    <div className="space-y-5">
      {briefing.meetings.length > 0 && (
        <section>
          <SectionTitle>{s.meetings}</SectionTitle>
          <ul className="space-y-2">
            {briefing.meetings.map((m) => (
              <Meeting key={m.id} item={m} />
            ))}
          </ul>
        </section>
      )}
      <Section title={s.priorities} items={briefing.priorities} now={now} ranked />
      <Section title={s.nextTasks} items={briefing.nextTasks} now={now} />
      <Section title={s.yesterday} items={briefing.yesterday} now={now} />
      <Section title={s.waiting} items={briefing.waiting} now={now} />
      {since && (
        <section>
          <SectionTitle>{s.since}</SectionTitle>
          <p className="rounded-xl border border-cesa-700 bg-cesa-700/30 px-3 py-2.5 text-sm text-cesa-ink">
            {since}
          </p>
        </section>
      )}
    </div>
  )
}

const linkKind = (item: BriefingItem): Parameters<typeof s.link>[0] =>
  item.kind === 'meeting'
    ? 'meeting'
    : item.kind === 'task'
      ? 'task'
      : item.kind === 'email'
        ? 'email'
        : item.kind === 'followup'
          ? 'followup'
          : 'message'

const shorten = (text: string, max = 34): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

// A small link under the paragraph: opens the task, the mail, the message, or joins the meeting.
function Chip({ item }: { item: BriefingItem }): React.JSX.Element {
  const joinable = item.kind === 'meeting' && !!item.meetingUrl
  return (
    <button
      type="button"
      onClick={() => open(joinable ? item.meetingUrl! : item.url)}
      title={item.title}
      className={`inline-flex min-h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition ${
        joinable
          ? 'border-cesa-green/60 text-cesa-green hover:bg-cesa-green/10'
          : 'border-cesa-line text-cesa-ink hover:border-cesa-green hover:text-cesa-green'
      }`}
    >
      <SourceIcon source={item.source} className="size-3.5" />
      <span className="font-semibold">{joinable ? s.join : s.link(linkKind(item))}</span>
      <span className="truncate text-cesa-mute">· {shorten(item.title)}</span>
    </button>
  )
}

// The summary as the AI wrote it: a paragraph per section and small links to what it mentions.
function Narrative({ briefing }: { briefing: BriefingData }): React.JSX.Element {
  const byId = new Map<string, BriefingItem>()
  for (const list of [
    briefing.meetings,
    briefing.priorities,
    briefing.nextTasks,
    briefing.yesterday,
    briefing.waiting
  ]) {
    for (const item of list) byId.set(item.id, item)
  }
  const titles: Record<string, string> = {
    meetings: s.meetings,
    priorities: s.priorities,
    nextTasks: s.nextTasks,
    yesterday: s.yesterday,
    waiting: s.waiting,
    since: s.since
  }

  return (
    <div className="space-y-5">
      {(briefing.narrative ?? []).map((section) => {
        const items = section.refs.flatMap((id) => byId.get(id) ?? [])
        return (
          <section key={section.key}>
            <SectionTitle>{titles[section.key]}</SectionTitle>
            <p className="text-[15px] leading-relaxed text-cesa-ink select-text">{section.text}</p>
            {items.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <Chip key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export function Briefing(): React.JSX.Element {
  const now = useNow()
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // Each time the window opens the main process sends the summary to show; the one asked for at
  // load covers a page that was reloaded after a crash.
  useEffect(() => {
    void window.api.briefing.get().then((b) => setBriefing((current) => current ?? b))
    return window.api.briefing.onShow((b) => {
      setBriefing(b)
      setShowDetail(false)
      scroller.current?.scrollTo({ top: 0 })
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      card.current?.animate(
        [
          { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
          { opacity: 1, transform: 'none' }
        ],
        { duration: still ? 0 : 220, easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)' }
      )
    })
  }, [])

  const refresh = async (): Promise<void> => {
    if (refreshing) return
    setRefreshing(true)
    const started = Date.now()
    try {
      const next = await window.api.briefing.regenerate()
      if (next) setBriefing(next)
    } finally {
      // So a very fast refresh still visibly "did something".
      setTimeout(() => setRefreshing(false), Math.max(0, 600 - (Date.now() - started)))
    }
  }

  // "Actualizar" rebuilds today's summary, so it only makes sense while looking at today's.
  const isToday = briefing?.date === new Date(now).toLocaleDateString('sv-SE')
  const written = !!briefing?.narrative && briefing.narrative.length > 0
  const empty =
    !!briefing &&
    briefing.meetings.length +
      briefing.priorities.length +
      briefing.nextTasks.length +
      briefing.yesterday.length +
      briefing.waiting.length ===
      0

  return (
    // The transparent margin leaves room for the shadow.
    <div className="h-full p-2">
      <div
        ref={card}
        role="dialog"
        aria-label={s.title}
        className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-cesa-green/25 bg-cesa-800 text-cesa-ink shadow-2xl shadow-black/60"
      >
        <header className="relative overflow-hidden border-b border-cesa-green/20 bg-gradient-to-br from-cesa-950 via-cesa-900 to-cesa-800 px-6 pt-5 pb-4">
          <DotsArc className="pointer-events-none absolute -top-8 -right-8 size-44 text-cesa-green opacity-10" />
          <div className="relative flex items-start gap-4">
            <img
              src={logo}
              alt=""
              draggable={false}
              className="size-12 shrink-0 rounded-full ring-2 ring-cesa-green"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wider text-cesa-mute uppercase">
                {briefing ? longDate.format(briefing.createdAt) : s.title}
              </p>
              <h1 className="truncate text-2xl font-semibold text-cesa-ink">
                {briefing?.greeting ?? s.title}
              </h1>
              {briefing && (
                <p className="mt-1 text-[15px] leading-relaxed text-cesa-ink/90 select-text">
                  {briefing.intro}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => window.api.briefing.close()}
              title={s.close}
              aria-label={s.close}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-cesa-mute transition hover:bg-cesa-700 hover:text-cesa-green"
            >
              <XIcon className="size-5" />
            </button>
          </div>
        </header>

        <div ref={scroller} className="cesa-scroll flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {!briefing && <p className="py-8 text-center text-sm text-cesa-mute">{s.empty}</p>}
          {briefing && written && (
            <>
              <Narrative briefing={briefing} />
              {!empty && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDetail((v) => !v)}
                    aria-expanded={showDetail}
                    className="flex min-h-6 cursor-pointer items-center gap-1.5 text-xs font-semibold text-cesa-mute transition hover:text-cesa-green"
                  >
                    {showDetail ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronRightIcon className="size-4" />
                    )}
                    {showDetail ? s.hideDetails : s.details}
                  </button>
                  {showDetail && (
                    <div className="mt-3">
                      <Detail briefing={briefing} now={now} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {briefing && !written && <Detail briefing={briefing} now={now} />}
          {briefing && !empty && !written && <DotsDivider />}
        </div>

        <footer className="flex items-center gap-3 border-t border-cesa-700 bg-cesa-950/60 px-6 py-3">
          <span className="min-w-0 flex-1 truncate text-xs text-cesa-mute">
            {briefing ? s.generatedAt(time.format(briefing.createdAt), briefing.mode) : ''}
          </span>
          {isToday && (
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="flex min-h-6 cursor-pointer items-center gap-1.5 rounded-full border border-cesa-line px-3 py-1 text-xs font-bold text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green disabled:cursor-default disabled:opacity-60"
            >
              <RefreshIcon className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? s.updating : s.update}
            </button>
          )}
          <Button onClick={() => window.api.briefing.close()}>{s.done}</Button>
        </footer>
      </div>
    </div>
  )
}
