import { DEFAULT_WIDGET, OPACITY_RANGE, SCALE_RANGE } from '@shared/settingsSchema'
import { strings } from '@shared/strings'
import type { DockSide, WidgetMode } from '@shared/types'
import { Button, Card, Segment, Slider } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.widget

function Choice({
  active,
  title,
  hint,
  icon,
  onClick
}: {
  active: boolean
  title: string
  hint: string
  icon: React.ReactNode
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition ${
        active
          ? 'border-cesa-green bg-cesa-green/10'
          : 'border-cesa-700 bg-cesa-700/30 hover:border-cesa-green/50'
      }`}
    >
      {icon}
      <span className="text-sm font-semibold text-cesa-ink">{title}</span>
      {/* On the selected tint the grey would fall just under 4.5:1, so it uses the main text color. */}
      <span className={`text-xs leading-tight ${active ? 'text-cesa-ink' : 'text-cesa-mute'}`}>
        {hint}
      </span>
    </button>
  )
}

const PopupIcon = (): React.JSX.Element => (
  <span className="flex size-10 items-center justify-center">
    <span className="size-7 rounded-full border-2 border-cesa-green bg-cesa-900" />
  </span>
)
const TabIcon = (): React.JSX.Element => (
  <span className="flex size-10 items-center justify-end">
    <span className="h-9 w-4 rounded-l-lg border-2 border-r-0 border-cesa-green bg-cesa-900" />
  </span>
)

export function Widget(): React.JSX.Element {
  const widget = useAppStore((st) => st.state?.settings.widget)
  if (!widget) return <></>

  const update = (patch: Partial<typeof widget>): Promise<void> =>
    window.api.settings.update({ widget: patch })
  const setMode = (mode: WidgetMode): Promise<void> => update({ mode })

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-cesa-ink">{s.mode}</h3>
        <div className="flex gap-2">
          <Choice
            active={widget.mode === 'popup'}
            title={s.popup}
            hint={s.popupHint}
            icon={<PopupIcon />}
            onClick={() => setMode('popup')}
          />
          <Choice
            active={widget.mode === 'tab'}
            title={s.tab}
            hint={s.tabHint}
            icon={<TabIcon />}
            onClick={() => setMode('tab')}
          />
        </div>

        {widget.mode === 'tab' && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <div className="text-sm text-cesa-ink">{s.side}</div>
              <Segment<DockSide>
                value={widget.side}
                onChange={(side) => update({ side })}
                options={[
                  { value: 'left', label: s.left },
                  { value: 'right', label: s.right }
                ]}
              />
            </div>
            <Slider
              label={s.position}
              value={widget.tabPos}
              min={0}
              max={1}
              step={0.01}
              live
              format={(v) => (v < 0.05 ? s.top : v > 0.95 ? s.bottom : `${Math.round(v * 100)}%`)}
              onCommit={(tabPos) => update({ tabPos })}
            />
            <p className="text-xs text-cesa-mute">{s.tabHelp}</p>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        {/* The side tab has a fixed size; only the round popup can be enlarged. */}
        {widget.mode === 'popup' && (
          <Slider
            label={s.size}
            value={widget.scale}
            min={SCALE_RANGE.min}
            max={SCALE_RANGE.max}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onCommit={(scale) => update({ scale })}
          />
        )}
        <Slider
          label={s.opacity}
          value={widget.opacity}
          min={OPACITY_RANGE.min}
          max={OPACITY_RANGE.max}
          step={0.05}
          live
          format={(v) => `${Math.round(v * 100)}%`}
          onCommit={(opacity) => update({ opacity })}
        />
        <p className="text-xs text-cesa-mute">{s.hint}</p>
        <Button
          variant="ghost"
          onClick={() =>
            update({
              scale: DEFAULT_WIDGET.scale,
              opacity: DEFAULT_WIDGET.opacity
            })
          }
        >
          {s.reset}
        </Button>
      </Card>
    </div>
  )
}
