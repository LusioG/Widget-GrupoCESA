import { useState } from 'react'
import { strings } from '@shared/strings'
import { Button, Card } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.trash

// What was dismissed with the X: restore one, restore everything, or empty it for good.
export function Trash(): React.JSX.Element {
  const trash = useAppStore((st) => st.state?.trash ?? [])
  const [confirming, setConfirming] = useState(false)
  const ids = trash.map((item) => item.id)

  const act = (action: 'restore' | 'purge', which: string[]): void => {
    setConfirming(false)
    if (which.length > 0) void window.api.items.act({ ids: which, action })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-cesa-mute">{s.hint}</p>
      {trash.length === 0 ? (
        <Card>
          <p className="text-sm text-cesa-mute">{s.empty}</p>
        </Card>
      ) : (
        <>
          <ul className="space-y-1.5">
            {trash.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-cesa-700 bg-cesa-700/20 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span title={item.title} className="block truncate text-sm text-cesa-ink">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-cesa-mute">
                    {strings.sources[item.source]}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => act('restore', [item.id])}
                  aria-label={`${s.restore}: ${item.title}`}
                  className="min-h-6 cursor-pointer rounded-full border border-cesa-line px-2.5 py-0.5 text-xs whitespace-nowrap text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green"
                >
                  {s.restore}
                </button>
              </li>
            ))}
          </ul>
          {confirming ? (
            <Card className="space-y-2.5">
              <p className="text-xs text-cesa-mute">{s.emptyWarning}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => act('purge', ids)}>{s.emptyConfirm(ids.length)}</Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  {s.cancel}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => act('restore', ids)}>
                {s.restoreAll}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(true)}>
                {s.emptyAction}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
