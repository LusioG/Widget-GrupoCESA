import { strings } from '@shared/strings'
import { Card, TextField, Toggle } from '@renderer/components/ui'
import { playNotificationSound } from '@renderer/components/sound'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.schedule

function Row({
  title,
  hint,
  children
}: {
  title: string
  hint: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm text-cesa-ink">{title}</div>
        <div className="text-xs text-cesa-mute">{hint}</div>
      </div>
      {children}
    </div>
  )
}

export function Schedule(): React.JSX.Element {
  const state = useAppStore((st) => st.state)
  if (!state) return <></>
  const { schedule, notifications, followups } = state.settings

  const update = (patch: Partial<typeof schedule>): Promise<void> =>
    window.api.settings.update({ schedule: patch })

  const toggleDay = (day: number): void => {
    const days = schedule.workDays.includes(day)
      ? schedule.workDays.filter((d) => d !== day)
      : [...schedule.workDays, day].sort()
    update({ workDays: days })
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm text-cesa-ink">{s.workHours}</h3>
          <div className="flex items-center gap-3 text-xs text-cesa-mute">
            <label className="flex-1 space-y-1">
              {s.from}
              <TextField
                type="time"
                value={schedule.workStart}
                onChange={(e) => e.target.value && update({ workStart: e.target.value })}
              />
            </label>
            <label className="flex-1 space-y-1">
              {s.to}
              <TextField
                type="time"
                value={schedule.workEnd}
                onChange={(e) => e.target.value && update({ workEnd: e.target.value })}
              />
            </label>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm text-cesa-ink">{s.days}</h3>
          <div className="flex gap-1.5">
            {s.dayNames.map((name, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`size-8 cursor-pointer rounded-full text-xs font-semibold transition ${
                  schedule.workDays.includes(day)
                    ? 'bg-cesa-green text-cesa-950'
                    : 'border border-cesa-line text-cesa-mute hover:border-cesa-green'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <Row title={s.notifications} hint={s.notificationsHint}>
          <Toggle
            checked={notifications.enabled}
            label={s.notifications}
            onChange={(enabled) => window.api.settings.update({ notifications: { enabled } })}
          />
        </Row>
        <Row title={s.sound} hint={s.soundHint}>
          <Toggle
            checked={notifications.sound}
            label={s.sound}
            onChange={(sound) => {
              if (sound) playNotificationSound() // preview when turning it on
              void window.api.settings.update({ notifications: { sound } })
            }}
          />
        </Row>
        <Row title={s.focusNow} hint={s.focusNowHint}>
          <Toggle
            checked={state.focus.manual}
            label={s.focusNow}
            onChange={(on) => window.api.system.setFocus(on)}
          />
        </Row>
        <Row title={s.focusFromCalendar} hint={s.focusFromCalendarHint}>
          <Toggle
            checked={notifications.focusFromCalendar}
            label={s.focusFromCalendar}
            onChange={(focusFromCalendar) =>
              window.api.settings.update({ notifications: { focusFromCalendar } })
            }
          />
        </Row>
      </Card>

      <Card>
        <label className="flex items-center justify-between gap-3 text-sm text-cesa-ink">
          {s.followupWait}
          <input
            type="number"
            min={1}
            max={720}
            defaultValue={followups.waitHours}
            onBlur={(e) => {
              const waitHours = Math.min(720, Math.max(1, Math.round(Number(e.target.value) || 48)))
              window.api.settings.update({ followups: { waitHours } })
            }}
            className="w-20 rounded-lg border border-cesa-line bg-cesa-900 px-2 py-1 text-right text-sm text-cesa-ink [color-scheme:dark] focus:border-cesa-green focus:outline-none"
          />
        </label>
      </Card>
    </div>
  )
}
