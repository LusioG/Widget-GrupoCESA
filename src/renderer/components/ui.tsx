import { useState } from 'react'

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${
        checked ? 'bg-cesa-green' : 'bg-cesa-line'
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-cesa-950 transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  // Called on every move (live preview) when `live`, otherwise only on release.
  live?: boolean
  onCommit: (value: number) => void
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  live,
  onCommit
}: SliderProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  // Follow external changes (e.g. "Restablecer") without an effect.
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }

  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-sm text-cesa-ink">
        {label}
        <span className="text-xs text-cesa-green">{format(draft)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => {
          const next = Number(e.target.value)
          setDraft(next)
          if (live) onCommit(next)
        }}
        onPointerUp={() => !live && onCommit(draft)}
        onKeyUp={() => !live && onCommit(draft)}
        className="h-1.5 w-full cursor-pointer accent-cesa-green"
      />
    </label>
  )
}

export function Card({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={`rounded-xl border border-cesa-700 bg-cesa-700/30 p-3 ${className}`}>
      {children}
    </div>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary'
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'ghost'
}): React.JSX.Element {
  const styles =
    variant === 'primary'
      ? 'bg-cesa-green text-cesa-950 hover:brightness-110'
      : 'border border-cesa-line text-cesa-ink hover:border-cesa-green hover:text-cesa-green'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-6 cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition disabled:cursor-default disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  )
}

// A row of mutually exclusive options.
export function Segment<T extends string | number>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label?: string
}): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-full border border-cesa-line p-0.5"
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 cursor-pointer rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap transition ${
            value === o.value ? 'bg-cesa-green text-cesa-950' : 'text-cesa-mute hover:text-cesa-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      {...props}
      spellCheck={false}
      className="w-full rounded-lg border border-cesa-line bg-cesa-900 px-2.5 py-1.5 text-sm text-cesa-ink select-text placeholder:text-cesa-mute focus:border-cesa-green focus:outline-none [color-scheme:dark]"
    />
  )
}

const COMPLETE_TIME = /^\d{2}:\d{2}$/

// A time of day (HH:MM) that is saved in the main process. The field keeps its own text while it
// is being edited: a field tied straight to the saved value snaps back to the old time while the
// new one is still on its way, and the hour cannot be changed. A complete time is saved at once;
// an empty or half-typed one is not, and the saved time comes back when the field is left.
export function TimeField({
  value,
  onCommit,
  label
}: {
  value: string
  onCommit: (value: string) => void
  label: string
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  // Follow a change that came from elsewhere, but never rewrite what is being typed.
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (!focused) setDraft(value)
  }

  return (
    <TextField
      type="time"
      aria-label={label}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        if (COMPLETE_TIME.test(next) && next !== value) onCommit(next)
      }}
      onBlur={() => {
        setFocused(false)
        if (!COMPLETE_TIME.test(draft)) setDraft(value)
      }}
    />
  )
}
