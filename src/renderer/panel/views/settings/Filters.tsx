import { useState } from 'react'
import { addEntries, removeEntry } from '@shared/entryList'
import { strings } from '@shared/strings'
import { XIcon } from '@renderer/components/icons'
import { Button, Card, TextField } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.filtersPage

type ListKey = 'ignoredSenders' | 'importantSenders'

// One entry at a time: type it, press "Añadir" (or Enter) and it joins the list below with an ✕.
function ListField({
  label,
  field,
  hint,
  placeholder
}: {
  label: string
  field: ListKey
  hint?: string
  placeholder: string
}): React.JSX.Element {
  const values = useAppStore((st) => st.state?.settings.filters[field] ?? [])
  const [text, setText] = useState('')
  const save = (list: string[]): Promise<void> =>
    window.api.settings.update({ filters: { [field]: list } })

  const add = (): void => {
    if (text.trim() === '') return
    void save(addEntries(values, text))
    setText('')
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-cesa-ink">{label}</p>
        {hint && <p className="text-xs text-cesa-mute">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <TextField
          value={text}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <Button onClick={add} disabled={text.trim() === ''}>
          {s.add}
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-cesa-mute">{s.empty}</p>
      ) : (
        <ul className="space-y-1">
          {values.map((entry) => (
            <li
              key={entry}
              className="flex items-center justify-between gap-2 rounded-lg border border-cesa-700 bg-cesa-700/30 px-2.5 py-1 text-sm text-cesa-ink"
            >
              <span className="min-w-0 flex-1 truncate select-text" title={entry}>
                {entry}
              </span>
              <button
                type="button"
                aria-label={`${s.remove} ${entry}`}
                title={s.remove}
                onClick={() => void save(removeEntry(values, entry))}
                className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-cesa-mute transition hover:text-cesa-green"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Filters(): React.JSX.Element {
  const minLength = useAppStore((st) => st.state?.settings.filters.minLength ?? 3)
  return (
    <Card className="space-y-4">
      <h3 className="text-sm font-semibold text-cesa-ink">{s.title}</h3>
      <label className="flex items-center justify-between gap-3 text-sm text-cesa-ink">
        {s.minLength}
        <input
          type="number"
          min={0}
          max={100}
          defaultValue={minLength}
          onBlur={(e) => {
            const value = Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0)))
            window.api.settings.update({ filters: { minLength: value } })
          }}
          className="w-20 rounded-lg border border-cesa-line bg-cesa-900 px-2 py-1 text-right text-sm text-cesa-ink [color-scheme:dark] focus:border-cesa-green focus:outline-none"
        />
      </label>
      <ListField
        label={s.importantSenders}
        field="importantSenders"
        hint={s.importantHint}
        placeholder={s.placeholder}
      />
      <ListField label={s.ignoredSenders} field="ignoredSenders" placeholder={s.placeholder} />
      <p className="text-xs text-cesa-mute">{s.listHint}</p>
      <p className="text-xs text-cesa-mute">{s.builtIn}</p>
    </Card>
  )
}
