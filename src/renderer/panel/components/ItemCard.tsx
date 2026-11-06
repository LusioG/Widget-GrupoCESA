import { useState } from 'react'
import { strings } from '@shared/strings'
import type { Signal, SnoozeOption } from '@shared/types'
import { dueLabel } from '@shared/dueLabel'
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  UserIcon,
  UsersIcon,
  XIcon
} from '@renderer/components/icons'
import { PriorityFlag, SourceTag } from '@renderer/components/SourceBadge'

type Props = {
  item: Signal
  now: number
  selecting?: boolean
  selected?: boolean
  onToggle?: () => void
  // Reports a dismiss/snooze so the panel can offer to undo it.
  onActed?: (action: 'dismiss' | 'snooze') => void
}

const SNOOZE_OPTIONS: SnoozeOption[] = ['hour', 'tomorrow', 'monday', 'forever']

// An unfolded conversation lists this many messages; the rest are "Hay N mensajes más".
export const SHOWN_MESSAGES = 4

function subtitle(item: Signal, now: number): string | undefined {
  if (item.kind === 'followup') return strings.panel.ago(now - item.occurredAt)
  if (item.dueAt !== undefined) {
    return dueLabel(item.dueAt, now)
  }
  return item.body
}

const chip =
  'inline-flex min-h-6 cursor-pointer items-center justify-center gap-1 rounded-full border border-cesa-line bg-cesa-900 px-2.5 py-0.5 text-xs text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green'

export function ItemCard({
  item,
  now,
  selecting,
  selected,
  onToggle,
  onActed
}: Props): React.JSX.Element {
  const [snoozing, setSnoozing] = useState(false)
  const [unfolded, setUnfolded] = useState(false)
  const urgent = (item.urgency ?? 0) >= 0.8
  const sub = subtitle(item, now)

  // A conversation of a distribution list opens in its own window, as a chat; anything else opens
  // the original in the browser.
  const open = (): void => {
    if (item.threadId) {
      void window.api.threads.open({
        threadId: item.threadId,
        signalId: item.id,
        title: item.title
      })
      return
    }
    window.api.openExternal(item.url)
    window.api.items.act({ ids: [item.id], action: 'seen' })
  }
  // Direct messages of Slack arrive as one card per conversation, with its latest messages.
  const messages = item.source === 'slack' && item.kind === 'dm' ? (item.messages ?? []) : []
  const conversation = messages.length > 0
  const newInConversation = conversation && !item.seen ? (item.unread ?? 1) : 0
  const unread =
    item.threadId && !item.seen ? (item.unread ?? 0) : newInConversation > 1 ? newInConversation : 0
  // A message (a direct one, a mention, a mail) is one: it gets the green dot with "!" until it is
  // opened. A conversation of a list, or of Slack with several new messages, has their count instead.
  const isOneMessage =
    item.kind === 'dm' || item.kind === 'mention' || (item.kind === 'email' && !item.threadId)
  const newDirect = isOneMessage && !item.seen && newInConversation <= 1
  const foldable = conversation && messages.length > 1 && !selecting
  const shown = messages.slice(0, SHOWN_MESSAGES)
  const hidden = messages.length - shown.length
  // Who wrote it, for the messages of Slack (an email says it in its text).
  const author = item.source === 'slack' && item.kind !== 'followup' ? item.sender : undefined

  return (
    <div
      className={`group relative rounded-xl border px-3 py-2.5 transition ${
        selected
          ? 'border-cesa-green bg-cesa-green/10'
          : 'border-cesa-700 bg-cesa-700/30 hover:border-cesa-green/50 hover:bg-cesa-700/60'
      }`}
    >
      <button
        type="button"
        onClick={selecting ? onToggle : open}
        className="flex w-full cursor-pointer items-start gap-3 text-left"
      >
        {selecting && (
          <input type="checkbox" readOnly checked={!!selected} tabIndex={-1} className="mt-0.5" />
        )}
        <SourceTag source={item.source} />
        <span className="min-w-0 flex-1">
          {item.list && (
            <span className="mb-0.5 flex items-center gap-1 truncate text-xs text-cesa-mute">
              <UsersIcon className="size-3.5 shrink-0" />
              <span className="truncate">{item.list.name}</span>
            </span>
          )}
          {author && (
            <span className="mb-0.5 flex items-center gap-1 truncate text-xs font-semibold text-cesa-ink">
              <UserIcon className="size-3.5 shrink-0 text-cesa-mute" />
              <span className="truncate">{author}</span>
            </span>
          )}
          <span
            title={item.title}
            className={`line-clamp-2 text-sm break-words ${item.seen ? 'text-cesa-mute' : 'text-cesa-ink'} ${unread > 0 || newDirect ? 'font-semibold' : ''}`}
          >
            {item.title}
          </span>
          {(sub || item.priority) && (
            <span
              className={`flex items-center gap-1 truncate text-xs ${urgent ? 'text-cesa-alert-text' : 'text-cesa-mute'}`}
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
        <span className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
          {urgent && (
            <span className="inline-flex items-center gap-1 rounded-full border border-cesa-alert/50 px-1.5 py-0.5 text-xs font-semibold text-cesa-alert-text">
              <AlertIcon className="size-3" />
              {strings.panel.urgent}
            </span>
          )}
          {newDirect && (
            <span
              title={strings.panel.newMessage}
              aria-label={strings.panel.newMessage}
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-cesa-green px-1.5 py-0.5 text-xs font-bold text-cesa-950"
            >
              !
            </span>
          )}
          {unread > 0 && (
            <span
              title={
                conversation ? strings.panel.newMessages(unread) : strings.panel.listUnread(unread)
              }
              aria-label={
                conversation ? strings.panel.newMessages(unread) : strings.panel.listUnread(unread)
              }
              className="inline-flex min-w-5 items-center justify-center gap-1 rounded-full bg-cesa-green px-1.5 py-0.5 text-xs font-bold text-cesa-950"
            >
              {unread}
            </span>
          )}
        </span>
      </button>

      {foldable && (
        <div className="mt-1.5">
          <button
            type="button"
            aria-expanded={unfolded}
            onClick={() => setUnfolded((v) => !v)}
            className="flex min-h-6 cursor-pointer items-center gap-1 text-xs font-semibold text-cesa-mute transition hover:text-cesa-green"
          >
            {unfolded ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
            {unfolded
              ? strings.panel.conversationHide
              : strings.panel.conversationShow(messages.length)}
          </button>
          {unfolded && (
            <ul className="mt-1 space-y-1">
              {shown.map((m, i) => {
                const isNew = !item.seen && i < newInConversation
                return (
                  <li key={m.ts}>
                    <button
                      type="button"
                      onClick={open}
                      className="flex w-full cursor-pointer items-baseline gap-2 rounded-lg px-2 py-1 text-left hover:bg-cesa-700/60"
                    >
                      <span className="shrink-0 text-xs text-cesa-mute">
                        {strings.panel.ago(now - m.at)}
                      </span>
                      <span
                        className={`line-clamp-2 min-w-0 flex-1 text-sm break-words ${isNew ? 'font-semibold text-cesa-ink' : 'text-cesa-mute'}`}
                      >
                        {m.text}
                      </span>
                    </button>
                  </li>
                )
              })}
              {hidden > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={open}
                    className="min-h-6 cursor-pointer px-2 text-xs font-semibold text-cesa-green hover:underline"
                  >
                    {strings.panel.moreMessages(hidden)}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {!selecting && (
        <div
          className={`absolute top-1.5 right-1.5 items-center gap-1.5 rounded-full bg-cesa-800/95 p-0.5 shadow ${
            snoozing ? 'flex' : 'hidden group-focus-within:flex group-hover:flex'
          }`}
        >
          {snoozing ? (
            <>
              {SNOOZE_OPTIONS.map((until) => (
                <button
                  key={until}
                  type="button"
                  className={chip}
                  onClick={() => {
                    void window.api.items.act({ ids: [item.id], action: 'snooze', until })
                    onActed?.('snooze')
                  }}
                >
                  {strings.panel.snoozeOptions[until]}
                </button>
              ))}
              <button
                type="button"
                className={chip}
                aria-label={strings.panel.cancel}
                title={strings.panel.cancel}
                onClick={() => setSnoozing(false)}
              >
                <XIcon className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={chip}
                title={strings.panel.snooze}
                aria-label={`${strings.panel.snooze}: ${item.title}`}
                onClick={() => setSnoozing(true)}
              >
                <ClockIcon className="size-3.5" />
                {strings.panel.snooze}
              </button>
              <button
                type="button"
                className={chip}
                title={strings.panel.dismiss}
                aria-label={`${strings.panel.dismiss}: ${item.title}`}
                onClick={() => {
                  void window.api.items.act({ ids: [item.id], action: 'dismiss' })
                  onActed?.('dismiss')
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
