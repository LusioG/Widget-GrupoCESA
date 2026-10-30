import { CALENDAR_DAY_CHOICES } from '@shared/calendarWindow'
import { strings } from '@shared/strings'
import { Card, Segment } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.watch

// How many days ahead the meetings list reaches. A different choice re-reads the calendar at once.
export function CalendarHorizon({ connected }: { connected: boolean }): React.JSX.Element {
  const days = useAppStore((st) => st.state?.settings.calendar.daysAhead ?? 2)
  const show = useAppStore((st) => st.state?.settings.calendar.show ?? 'all')
  const showOptions = (['all', 'meets', 'plain'] as const).map((value) => ({
    value,
    label: s.calendarShow[value]
  }))
  const options = CALENDAR_DAY_CHOICES.map((value) => ({ value, label: s.calendarDays[value] }))

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-cesa-ink">{s.calendarTitle}</h3>
      {!connected ? (
        <p className="text-xs text-cesa-mute">{s.needCalendar}</p>
      ) : (
        <>
          <p className="text-xs text-cesa-mute">{s.calendarHint}</p>
          <Segment
            label={s.calendarTitle}
            value={days}
            options={options}
            onChange={(daysAhead) => window.api.settings.update({ calendar: { daysAhead } })}
          />
          <p className="text-xs text-cesa-mute">{s.calendarSummary(days)}</p>
          <h4 className="pt-1 text-sm font-semibold text-cesa-ink">{s.calendarShowTitle}</h4>
          <p className="text-xs text-cesa-mute">{s.calendarShowHint}</p>
          <Segment
            label={s.calendarShowTitle}
            value={show}
            options={showOptions}
            onChange={(next) => window.api.settings.update({ calendar: { show: next } })}
          />
        </>
      )}
    </Card>
  )
}
