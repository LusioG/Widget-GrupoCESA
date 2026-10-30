import { useEffect, useState } from 'react'
import { shortDate } from '@shared/dueLabel'
import { strings } from '@shared/strings'
import type { BriefingSummary } from '@shared/types'
import { Button, Card, TextField, TimeField, Toggle } from '@renderer/components/ui'
import { useNow } from '@renderer/components/useNow'
import { useAppStore } from '@renderer/store/useAppStore'
import { AiSettings } from './AiSettings'

const s = strings.settings.briefing
const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

// The name is saved when the field is left or Enter is pressed, not on every key.
export function NameField({
  autoFocus,
  placeholder,
  onEnter
}: {
  autoFocus?: boolean
  placeholder: string
  onEnter?: () => void
}): React.JSX.Element {
  const saved = useAppStore((st) => st.state?.settings.profile.name ?? '')
  const [draft, setDraft] = useState(saved)
  // Follow a change that came from elsewhere without an effect.
  const [seen, setSeen] = useState(saved)
  if (saved !== seen) {
    setSeen(saved)
    setDraft(saved)
  }

  const commit = (): void => {
    const name = draft.trim()
    if (name !== saved) void window.api.settings.update({ profile: { name } })
  }

  return (
    <TextField
      value={draft}
      maxLength={40}
      autoFocus={autoFocus}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        commit()
        onEnter?.()
      }}
    />
  )
}

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

// "2026-10-28" as "Hoy", "Ayer" or "mié 28 oct".
function dayName(date: string, now: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const at = new Date(y, m - 1, d).getTime()
  const key = (ms: number): string => new Date(ms).toLocaleDateString('sv-SE')
  if (key(at) === key(now)) return s.today
  if (key(at) === key(now - 24 * 3_600_000)) return s.yesterday
  return shortDate(at, now)
}

export function DailyBriefing(): React.JSX.Element {
  const settings = useAppStore((st) => st.state?.settings)
  const now = useNow()
  const [history, setHistory] = useState<BriefingSummary[]>([])

  useEffect(() => {
    let live = true
    void window.api.briefing.list().then((list) => live && setHistory(list))
    return () => {
      live = false
    }
  }, [])

  if (!settings) return <></>
  const { enabled, time, fullHeight } = settings.briefing

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <div>
          <div className="text-sm text-cesa-ink">{s.nameTitle}</div>
          <div className="text-xs text-cesa-mute">{s.nameHint}</div>
        </div>
        <NameField placeholder={s.namePlaceholder} />
      </Card>

      <Card className="space-y-4">
        <Row title={s.enabled} hint={s.enabledHint}>
          <Toggle
            checked={enabled}
            label={s.enabled}
            onChange={(next) => window.api.settings.update({ briefing: { enabled: next } })}
          />
        </Row>
        {enabled && (
          <div className="space-y-1">
            <span className="text-sm text-cesa-ink">{s.time}</span>
            <TimeField
              label={s.time}
              value={time}
              onCommit={(next) => void window.api.settings.update({ briefing: { time: next } })}
            />
            <span className="block text-xs text-cesa-mute">{s.timeHint}</span>
            {time >= settings.schedule.workEnd && (
              <span role="alert" className="block text-xs text-cesa-alert-text">
                {s.timeAfterWork(settings.schedule.workEnd)}
              </span>
            )}
          </div>
        )}
        <Row title={s.fullHeight} hint={s.fullHeightHint}>
          <Toggle
            checked={fullHeight}
            label={s.fullHeight}
            onChange={(next) => window.api.settings.update({ briefing: { fullHeight: next } })}
          />
        </Row>
      </Card>

      <AiSettings />

      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-cesa-ink">{s.history}</div>
            <div className="text-xs text-cesa-mute">{s.historyHint}</div>
          </div>
          <Button variant="ghost" onClick={() => void window.api.briefing.open()}>
            {s.viewToday}
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-cesa-mute">{s.historyEmpty}</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((b) => (
              <li
                key={b.date}
                className="flex items-center gap-2 rounded-xl border border-cesa-700 bg-cesa-700/20 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-cesa-ink capitalize">
                    {dayName(b.date, now)}
                  </span>
                  <span className="block truncate text-xs text-cesa-mute">
                    {strings.briefing.generatedAt(clock.format(b.createdAt), b.mode)}
                  </span>
                </span>
                <Button variant="ghost" onClick={() => void window.api.briefing.open(b.date)}>
                  {s.view}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
