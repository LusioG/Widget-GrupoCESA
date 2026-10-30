import { useEffect, useState } from 'react'
import { acceleratorFromEvent, formatAccelerator } from '@shared/accelerator'
import { strings } from '@shared/strings'
import { Button, Card, Toggle } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.general

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

// Press the combination you want; it is saved as soon as it is a valid one.
function HotkeyField(): React.JSX.Element {
  const accelerator = useAppStore((st) => st.state?.settings.hotkey.accelerator ?? '')
  const [listening, setListening] = useState(false)
  const [tooWeak, setTooWeak] = useState(false)

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent): void => {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return // wait for the real key
      e.preventDefault()
      const next = acceleratorFromEvent(e)
      if (!next) {
        setTooWeak(true)
        return
      }
      setTooWeak(false)
      setListening(false)
      void window.api.settings.update({ hotkey: { accelerator: next } })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [listening])

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <kbd className="rounded-md border border-cesa-line bg-cesa-900 px-2 py-1 text-xs whitespace-nowrap text-cesa-ink">
          {listening ? s.hotkeyPress : formatAccelerator(accelerator)}
        </kbd>
        <Button
          variant="ghost"
          onClick={() => {
            setTooWeak(false)
            setListening((v) => !v)
          }}
        >
          {listening ? s.hotkeyCancel : s.hotkeyChange}
        </Button>
      </div>
      {listening && tooWeak && (
        <p className="text-xs text-cesa-alert-text">{s.hotkeyNeedsModifier}</p>
      )}
    </div>
  )
}

export function General(): React.JSX.Element {
  const autostart = useAppStore((st) => st.state?.autostart ?? false)
  const settings = useAppStore((st) => st.state?.settings)
  const hotkeyFailed = useAppStore((st) => st.state?.hotkeyFailed ?? false)
  const hidden = useAppStore((st) => st.state?.widgetHidden ?? false)
  if (!settings) return <></>

  return (
    <div className="space-y-3">
      <Card>
        <Row title={s.autostart} hint={s.autostartHint}>
          {/* The value comes from the real system state, re-read after every change. */}
          <Toggle
            checked={autostart}
            label={s.autostart}
            onChange={(v) => window.api.system.setAutostart(v)}
          />
        </Row>
      </Card>

      <Card className="space-y-3">
        <Row title={s.hotkey} hint={s.hotkeyHint}>
          <Toggle
            checked={settings.hotkey.enabled}
            label={s.hotkey}
            onChange={(enabled) => window.api.settings.update({ hotkey: { enabled } })}
          />
        </Row>
        {settings.hotkey.enabled && (
          <div className="flex justify-end">
            <HotkeyField />
          </div>
        )}
        {settings.hotkey.enabled && hotkeyFailed && (
          <p role="alert" className="text-xs text-cesa-alert-text">
            {s.hotkeyTaken}
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <Row title={s.autoHide} hint={s.autoHideHint}>
          <Toggle
            checked={settings.presentation.autoHide}
            label={s.autoHide}
            onChange={(autoHide) => window.api.settings.update({ presentation: { autoHide } })}
          />
        </Row>
        <Row title={s.hideFromCapture} hint={s.hideFromCaptureHint}>
          <Toggle
            checked={settings.presentation.hideFromCapture}
            label={s.hideFromCapture}
            onChange={(hideFromCapture) =>
              window.api.settings.update({ presentation: { hideFromCapture } })
            }
          />
        </Row>
        <Row title={s.hideNow} hint={s.hideNowHint}>
          <Toggle
            checked={hidden}
            label={s.hideNow}
            onChange={(v) => window.api.system.setWidgetHidden(v)}
          />
        </Row>
      </Card>
    </div>
  )
}
