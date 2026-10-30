import { DEFAULT_PANEL, SCALE_RANGE } from '@shared/settingsSchema'
import { strings } from '@shared/strings'
import { Button, Card, Slider, Toggle } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.panel

export function PanelSize(): React.JSX.Element {
  const panel = useAppStore((st) => st.state?.settings.panel)
  if (!panel) return <></>

  return (
    <Card className="space-y-4">
      <Slider
        label={s.size}
        value={panel.scale}
        min={SCALE_RANGE.min}
        max={SCALE_RANGE.max}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onCommit={(scale) => window.api.settings.update({ panel: { scale } })}
      />
      <p className="text-xs text-cesa-mute">{s.hint}</p>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-cesa-ink">{s.fullHeight}</div>
          <div className="text-xs text-cesa-mute">{s.fullHeightHint}</div>
        </div>
        <Toggle
          checked={panel.fullHeight}
          label={s.fullHeight}
          onChange={(fullHeight) => window.api.settings.update({ panel: { fullHeight } })}
        />
      </div>
      <Button
        variant="ghost"
        onClick={() => window.api.settings.update({ panel: { scale: DEFAULT_PANEL.scale } })}
      >
        {s.reset}
      </Button>
    </Card>
  )
}
