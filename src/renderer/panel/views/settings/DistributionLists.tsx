import { useState } from 'react'
import { strings } from '@shared/strings'
import type { AvailableList, DistributionList, ListDays } from '@shared/types'
import { UsersIcon, XIcon } from '@renderer/components/icons'
import { Button, Card, Segment, TextField, Toggle } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.watch

const LIST_DAYS: ListDays[] = [1, 3, 7]

const ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/

// "Distribution lists": pick the ones whose mail gets its own section in the panel.
export function DistributionLists(): React.JSX.Element {
  const state = useAppStore((st) => st.state)
  const connected = state?.accounts.gmail.status === 'connected'
  const followed = state?.settings.gmail.lists ?? []

  const [found, setFound] = useState<AvailableList[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [address, setAddress] = useState('')
  const [invalid, setInvalid] = useState(false)

  const save = (lists: DistributionList[]): Promise<void> =>
    window.api.settings.update({ gmail: { lists } })

  const search = async (): Promise<void> => {
    setSearching(true)
    try {
      setFound(await window.api.accounts.listGmailLists())
    } finally {
      setSearching(false)
    }
  }

  const follow = (list: { address: string; name: string }): void => {
    if (followed.some((l) => l.address === list.address)) return
    void save([...followed, { address: list.address, name: list.name, urgent: false }])
  }

  const addByAddress = (): void => {
    const value = address.trim().toLowerCase()
    if (!ADDRESS.test(value)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setAddress('')
    follow({ address: value, name: value.split('@')[0] })
  }

  const offered = (found ?? []).filter((l) => !followed.some((f) => f.address === l.address))

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-cesa-ink">{s.listsTitle}</h3>
      {!connected ? (
        <p className="text-xs text-cesa-mute">{s.needLists}</p>
      ) : (
        <>
          <p className="text-xs text-cesa-mute">{s.listsHint}</p>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-cesa-mute">{s.listsDaysLabel}</span>
            <Segment<ListDays>
              label={s.listsDaysLabel}
              value={state?.settings.gmail.listDays ?? 7}
              options={LIST_DAYS.map((days) => ({ value: days, label: s.listsDays[days] }))}
              onChange={(listDays) => void window.api.settings.update({ gmail: { listDays } })}
            />
          </div>

          {followed.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-cesa-mute">{s.listsFollowing}</h4>
              {followed.map((l) => (
                <div key={l.address} className="flex items-center gap-2 rounded-lg px-2 py-1">
                  <UsersIcon className="size-4 shrink-0 text-cesa-mute" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-cesa-ink">{l.name}</span>
                    <span className="block truncate text-xs text-cesa-mute">{l.address}</span>
                  </span>
                  <span className="text-xs text-cesa-mute">{s.urgent}</span>
                  <Toggle
                    checked={l.urgent}
                    label={`${s.urgent}: ${l.name}`}
                    onChange={(urgent) =>
                      void save(followed.map((x) => (x.address === l.address ? { ...x, urgent } : x)))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => void save(followed.filter((x) => x.address !== l.address))}
                    title={s.listsRemove}
                    aria-label={`${s.listsRemove}: ${l.name}`}
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cesa-line text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => void search()} disabled={searching}>
                {searching ? s.listsSearching : s.listsSearch}
              </Button>
              {found && !searching && (
                <span className="text-xs text-cesa-mute">{s.listsFound(found.length)}</span>
              )}
            </div>
            {found && found.length === 0 && !searching && (
              <p className="text-xs text-cesa-mute">{s.listsNone}</p>
            )}
            {offered.map((l) => (
              <div key={l.address} className="flex items-center gap-2 rounded-lg px-2 py-1">
                <UsersIcon className="size-4 shrink-0 text-cesa-mute" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-cesa-ink">{l.name}</span>
                  <span className="block truncate text-xs text-cesa-mute">
                    {l.address} · {s.listsMessages(l.count)}
                  </span>
                </span>
                <Button onClick={() => follow(l)}>{s.listsFollow}</Button>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label htmlFor="list-address" className="text-xs font-semibold text-cesa-mute">
              {s.listsAddLabel}
            </label>
            <div className="flex items-center gap-2">
              <TextField
                id="list-address"
                type="email"
                value={address}
                placeholder={s.listsAddPlaceholder}
                onChange={(e) => {
                  setAddress(e.target.value)
                  setInvalid(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && addByAddress()}
                aria-invalid={invalid}
              />
              <Button onClick={addByAddress}>{s.listsAdd}</Button>
            </div>
            {invalid && (
              <p role="alert" className="text-xs text-cesa-alert-text">
                {s.listsInvalid}
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
