import { useState } from 'react'
import { strings } from '@shared/strings'
import type { Signal, SnoozeOption } from '@shared/types'
import { dueLabel } from '@shared/dueLabel'
import { AlertIcon, ClockIcon, XIcon } from '@renderer/components/icons'
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

const SNOOZE_OPTIONS: SnoozeOption[] = ['hour', 'tomorrow', 'monday']

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
  const urgent = (item.urgency ?? 0) >= 0.8
  const sub = subtitle(item, now)

  const open = (): void => {
    window.api.openExternal(item.url)
    window.api.items.act({ ids: [item.id], action: 'seen' })
  }

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
          <input
            type="checkbox"
            readOnly
            checked={!!selected}
            tabIndex={-1}
            className="mt-1 accent-cesa-green"
          />
        )}
        <SourceTag source={item.source} />
        <span className="min-w-0 flex-1">
          <span
            title={item.title}
            className={`line-clamp-2 text-sm break-words ${item.seen ? 'text-cesa-mute' : 'text-cesa-ink'}`}
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
        {urgent && (
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-cesa-alert/50 px-1.5 py-0.5 text-xs font-semibold text-cesa-alert-text">
            <AlertIcon className="size-3" />
            {strings.panel.urgent}
          </span>
        )}
      </button>

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
