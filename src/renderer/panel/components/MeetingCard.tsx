import { dayOffset } from '@shared/calendarWindow'
import { meetingMove, moveLabel } from '@shared/meetingMove'
import { strings } from '@shared/strings'
import type { Signal } from '@shared/types'
import { XIcon } from '@renderer/components/icons'

type Props = {
  meeting: Signal
  now: number
  // Reports a dismiss so the panel can offer to undo it.
  onActed?: (action: 'dismiss') => void
}

const time = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

export function MeetingCard({ meeting, now, onActed }: Props): React.JSX.Element {
  const startsAt = meeting.startsAt ?? meeting.occurredAt
  const move = meetingMove(startsAt, meeting.movedFrom)
  const minutes = Math.ceil((startsAt - now) / 60_000)
  const soon = minutes <= 10
  // Today (or already running): how long until it starts. Another day: until when it lasts, since
  // the day heading above already says which day it is.
  const today = dayOffset(startsAt, now) <= 0
  const detail = today
    ? strings.panel.inMinutes(minutes)
    : strings.panel.meetingUntil(time.format(meeting.endsAt ?? startsAt))

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        soon ? 'border-cesa-green/60 bg-cesa-green/10' : 'border-cesa-700 bg-cesa-700/40'
      }`}
    >
      <div className="w-12 shrink-0 text-center">
        <div className="text-sm font-semibold text-cesa-ink">{time.format(startsAt)}</div>
        <div className={`text-xs ${soon ? 'text-cesa-green' : 'text-cesa-mute'}`}>{detail}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-cesa-ink">{meeting.title}</div>
        {/* The time changed: said in words, so it is not missed (and not only by color). */}
        {move && (
          <div className="truncate text-xs font-semibold text-cesa-meeting">
            {moveLabel(move, startsAt, now)}
          </div>
        )}
      </div>
      {meeting.meetingUrl && (
        <button
          type="button"
          onClick={() => window.api.openExternal(meeting.meetingUrl!)}
          // Yellow (the meetings color of the widget) for today's meetings, green for later days.
          className={`min-h-6 shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-bold text-cesa-950 transition hover:brightness-110 ${
            today ? 'bg-cesa-meeting' : 'bg-cesa-green'
          }`}
        >
          {strings.panel.join}
        </button>
      )}
      <button
        type="button"
        title={strings.panel.dismiss}
        aria-label={`${strings.panel.dismiss}: ${meeting.title}`}
        onClick={() => {
          void window.api.items.act({ ids: [meeting.id], action: 'dismiss' })
          onActed?.('dismiss')
        }}
        // Shown on hover or keyboard focus, like the X of the tasks; the space is always kept.
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cesa-line text-cesa-ink opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 hover:border-cesa-green hover:text-cesa-green focus-visible:opacity-100"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}
