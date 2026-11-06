import { URGENT_THRESHOLD } from '../../shared/badgeState'
import { senderNames } from '../../shared/personName'
import { strings } from '../../shared/strings'
import type { Briefing, BriefingItem, BriefingList, Signal } from '../../shared/types'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const MAX_PRIORITIES = 5
export const MAX_NEXT_TASKS = 3
const MAX_YESTERDAY = 5
const MAX_WAITING = 5
export const MAX_MAIL = 3
const MAX_LISTS = 5 // lists shown, the busiest first
const MAX_LIST_ITEMS = 3 // conversations shown for each list
const MAX_SINCE = 3 * DAY // after a long absence "since the last summary" stops at three days

const pad = (n: number): string => String(n).padStart(2, '0')

// Case and accent insensitive, so "Invitación" and "invitacion" match.
const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const INVITATION = /\b(invitaci[oó]n|invitation)\b/i
const MIN_MEETING_TITLE = 8 // a short title such as "Daily" would match unrelated mail

// The local day of a moment as YYYY-MM-DD: the key a summary is stored under.
export function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function toItem(s: Signal): BriefingItem {
  const item: BriefingItem = {
    id: s.id,
    source: s.source,
    kind: s.kind,
    title: s.title,
    url: s.url,
    urgent: (s.urgency ?? 0) >= URGENT_THRESHOLD
  }
  if (s.startsAt !== undefined) item.startsAt = s.startsAt
  if (s.endsAt !== undefined) item.endsAt = s.endsAt
  if (s.movedFrom !== undefined) item.movedFrom = s.movedFrom
  if (s.meetingUrl) item.meetingUrl = s.meetingUrl
  if (s.dueAt !== undefined) item.dueAt = s.dueAt
  if (s.priority) item.priority = s.priority
  // Who wrote it: a Slack message's author (not a follow-up's), or the names in a mail's sender.
  const from =
    s.source === 'slack'
      ? s.kind !== 'followup'
        ? s.sender
        : undefined
      : s.source === 'gmail' && s.kind === 'email'
        ? senderNames(s.sender)
        : undefined
  if (from) item.from = from
  if (s.list) item.listName = s.list.name
  return item
}

const newestFirst = (a: Signal, b: Signal): number => b.occurredAt - a.occurredAt

// What is new in each distribution list, grouped here (not by the AI): the busiest lists first, the
// ones with something urgent before them.
function groupLists(conversations: Signal[]): BriefingList[] {
  const byList = new Map<string, Signal[]>()
  for (const s of conversations) {
    if (!s.list) continue
    byList.set(s.list.address, [...(byList.get(s.list.address) ?? []), s])
  }
  return [...byList.values()]
    .map((group): BriefingList => {
      const sorted = [...group].sort(newestFirst)
      return {
        address: sorted[0].list!.address,
        name: sorted[0].list!.name,
        conversations: group.length,
        unread: group.reduce((sum, s) => sum + (s.unread ?? 1), 0),
        urgent: group.some((s) => (s.urgency ?? 0) >= URGENT_THRESHOLD),
        items: sorted.slice(0, MAX_LIST_ITEMS).map(toItem)
      }
    })
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        b.conversations - a.conversations ||
        a.name.localeCompare(b.name)
    )
    .slice(0, MAX_LISTS)
}

// Most urgent first; between equals, the one that falls due first (no date goes last).
function byImportance(a: Signal, b: Signal): number {
  const urgency = (b.urgency ?? 0) - (a.urgency ?? 0)
  if (urgency !== 0) return urgency
  return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity)
}

export type BriefingInput = {
  // What the panel shows right now: filtered, not dismissed or snoozed, with urgency set.
  signals: Signal[]
  name: string
  now: number
  previousAt?: number // when the summary before this one was made
}

// The daily summary from the panel's own data, with no AI: always available, and the base the AI
// version is written from.
export function buildBriefing(input: BriefingInput): Briefing {
  const { signals, now } = input
  const today = startOfDay(now)
  const tomorrow = today + DAY
  const yesterdayStart = today - DAY

  const meetings = signals
    .filter((s) => {
      if (s.kind !== 'meeting') return false
      const start = s.startsAt ?? s.occurredAt
      const end = s.endsAt ?? start
      return end > now && start < tomorrow // still to come or running, and starting today
    })
    .sort((a, b) => (a.startsAt ?? a.occurredAt) - (b.startsAt ?? b.occurredAt))

  // The mail that only invites you to a meeting already in the list is part of that meeting: it
  // is not a pending item of its own.
  const invitesToTodaysMeeting = (s: Signal): boolean =>
    s.kind === 'email' &&
    INVITATION.test(s.title) &&
    meetings.some(
      (m) => m.title.length >= MIN_MEETING_TITLE && fold(s.title).includes(fold(m.title))
    )

  const pending = signals.filter(
    (s) => s.kind !== 'meeting' && s.kind !== 'followup' && !invitesToTodaysMeeting(s)
  )
  const used = new Set<string>()

  const priorities = [...pending].sort(byImportance).slice(0, MAX_PRIORITIES)
  priorities.forEach((s) => used.add(s.id))

  // Ordinary tasks (normal or no priority) that are next to fall due, apart from the priorities.
  const nextTasks = pending
    .filter((s) => s.kind === 'task' && !used.has(s.id) && (!s.priority || s.priority === 'normal'))
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
    .slice(0, MAX_NEXT_TASKS)
  nextTasks.forEach((s) => used.add(s.id))

  const yesterday = pending
    .filter((s) => !used.has(s.id) && s.occurredAt >= yesterdayStart && s.occurredAt < today)
    .sort(byImportance)
    .slice(0, MAX_YESTERDAY)

  const waiting = signals
    .filter((s) => s.kind === 'followup')
    .sort((a, b) => a.occurredAt - b.occurredAt)
    .slice(0, MAX_WAITING)

  // The latest individual mails still unread, and what is new in the lists (conversations that were
  // opened do not count, like in the panel).
  const unreadMail = pending
    .filter((s) => s.kind === 'email' && !s.list && !s.seen)
    .sort(newestFirst)
  const lists = groupLists(pending.filter((s) => !!s.list && !s.seen))

  const sinceAt = Math.max(input.previousAt ?? now - DAY, now - MAX_SINCE)
  const fresh = pending.filter((s) => s.occurredAt > sinceAt && !s.seen)

  return {
    date: localDate(now),
    createdAt: now,
    name: input.name,
    mode: 'rules',
    greeting: strings.briefing.greeting(new Date(now).getHours(), input.name),
    intro: strings.briefing.intro({
      meetings: meetings.length,
      priorities: priorities.length,
      urgent: priorities.filter((s) => (s.urgency ?? 0) >= URGENT_THRESHOLD).length
    }),
    meetings: meetings.map(toItem),
    priorities: priorities.map(toItem),
    nextTasks: nextTasks.map(toItem),
    yesterday: yesterday.map(toItem),
    waiting: waiting.map(toItem),
    mail: unreadMail.slice(0, MAX_MAIL).map(toItem),
    mailTotal: unreadMail.length,
    lists,
    since: {
      emails: fresh.filter((s) => s.kind === 'email').length,
      messages: fresh.filter((s) => s.kind === 'mention' || s.kind === 'dm').length
    }
  }
}
