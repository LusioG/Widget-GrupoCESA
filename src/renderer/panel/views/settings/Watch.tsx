import { useEffect, useRef, useState } from 'react'
import { describeClickUpRule } from '@shared/describeFilters'
import {
  buildListTree,
  checkState,
  listsOfSpace,
  matchesQuery,
  toggleGroup,
  type ListFolder,
  type ListSpace
} from '@shared/listTree'
import { strings } from '@shared/strings'
import type { ClickUpList, ClickUpMinPriority, Settings } from '@shared/types'
import { ChevronRightIcon } from '@renderer/components/icons'
import { Button, Card, Segment, TextField, Toggle } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'
import { CalendarHorizon } from './CalendarHorizon'
import { Filters } from './Filters'

const s = strings.settings.watch

type Row = { id: string; name: string; hint?: string }

const toggleIn = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

const parseWords = (text: string): string[] =>
  text
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)

// Loads a list once the account is connected.
function useList<T>(connected: boolean, load: () => Promise<T[]>): T[] | null {
  const [rows, setRows] = useState<T[] | null>(null)
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    load().then((r) => !cancelled && setRows(r))
    return () => {
      cancelled = true
    }
    // `load` only wraps a stable IPC call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected])
  return rows
}

// A checkbox that can show "some of them are selected".
function TriCheckbox({
  state,
  onChange,
  label
}: {
  state: 'none' | 'some' | 'all'
  onChange: () => void
  label: string
}): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={state === 'all'}
      onChange={onChange}
      className="shrink-0 cursor-pointer accent-cesa-green"
    />
  )
}

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <span
      className={`inline-block w-3 shrink-0 text-center text-cesa-mute transition ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <ChevronRightIcon className="size-3" />
    </span>
  )
}

function Section({
  title,
  connected,
  needText,
  loaded,
  empty,
  children
}: {
  title: string
  connected: boolean
  needText: string
  loaded: boolean
  empty: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-cesa-ink">{title}</h3>
      {!connected ? (
        <p className="text-xs text-cesa-mute">{needText}</p>
      ) : !loaded ? (
        <p className="text-xs text-cesa-mute">{s.loading}</p>
      ) : empty ? (
        <p className="text-xs text-cesa-mute">{s.none}</p>
      ) : (
        children
      )}
    </Card>
  )
}

// ---------- ClickUp: lists as a tree (space > folder > list) ----------

function ListRow({
  list,
  selected,
  onToggle
}: {
  list: ClickUpList
  selected: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-sm text-cesa-ink hover:bg-cesa-700/50">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="shrink-0 cursor-pointer accent-cesa-green"
      />
      <span className="min-w-0 flex-1 truncate">{list.name}</span>
    </label>
  )
}

function FolderGroup({
  folder,
  selected,
  open,
  onOpen,
  onChange
}: {
  folder: ListFolder
  selected: ReadonlySet<string>
  open: boolean
  onOpen: () => void
  onChange: (ids: string[]) => void
}): React.JSX.Element {
  // Lists that sit directly in the space have no folder row of their own.
  if (folder.name === null) {
    return (
      <>
        {folder.lists.map((l) => (
          <ListRow
            key={l.id}
            list={l}
            selected={selected.has(l.id)}
            onToggle={() => onChange(toggleIn([...selected], l.id))}
          />
        ))}
      </>
    )
  }
  const state = checkState(folder.lists, selected)
  const count = folder.lists.filter((l) => selected.has(l.id)).length
  return (
    <div>
      <div className="flex items-center gap-1.5 rounded-lg py-1 pr-2 hover:bg-cesa-700/40">
        <button
          type="button"
          onClick={onOpen}
          className="flex cursor-pointer items-center"
          aria-expanded={open}
          aria-label={folder.name}
        >
          <Chevron open={open} />
        </button>
        <TriCheckbox
          state={state}
          label={folder.name}
          onChange={() => onChange(toggleGroup(folder.lists, [...selected]))}
        />
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-cesa-ink"
        >
          {folder.name}
        </button>
        <span className="shrink-0 text-xs text-cesa-mute">
          {count}/{folder.lists.length}
        </span>
      </div>
      {open && (
        <div className="ml-6 border-l border-cesa-700 pl-1">
          {folder.lists.map((l) => (
            <ListRow
              key={l.id}
              list={l}
              selected={selected.has(l.id)}
              onToggle={() => onChange(toggleIn([...selected], l.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SpaceGroup({
  space,
  showTeam,
  selected,
  isOpen,
  toggleOpen,
  onChange
}: {
  space: ListSpace
  showTeam: boolean
  selected: ReadonlySet<string>
  isOpen: (key: string) => boolean
  toggleOpen: (key: string) => void
  onChange: (ids: string[]) => void
}): React.JSX.Element {
  const lists = listsOfSpace(space)
  const count = lists.filter((l) => selected.has(l.id)).length
  const open = isOpen(space.key)
  return (
    <div className="rounded-lg border border-cesa-700/70 bg-cesa-900/30 px-1.5 py-1">
      <div className="flex items-center gap-1.5 py-1 pr-1">
        <button
          type="button"
          onClick={() => toggleOpen(space.key)}
          className="flex cursor-pointer items-center"
          aria-expanded={open}
          aria-label={space.space}
        >
          <Chevron open={open} />
        </button>
        <TriCheckbox
          state={checkState(lists, selected)}
          label={space.space}
          onChange={() => onChange(toggleGroup(lists, [...selected]))}
        />
        <button
          type="button"
          onClick={() => toggleOpen(space.key)}
          className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-semibold text-cesa-ink"
        >
          {space.space}
          {showTeam && space.team && (
            <span className="ml-1.5 text-xs font-normal text-cesa-mute">{space.team}</span>
          )}
        </button>
        <span className="shrink-0 text-xs text-cesa-mute">
          {count}/{lists.length}
        </span>
      </div>
      {open && (
        <div className="ml-5 space-y-0.5">
          {space.folders.map((f) => (
            <FolderGroup
              key={f.name ?? '(root)'}
              folder={f}
              selected={selected}
              open={isOpen(`${space.key}\u0000${f.name}`)}
              onOpen={() => toggleOpen(`${space.key}\u0000${f.name}`)}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ClickUpLists({
  lists,
  selectedIds,
  onChange
}: {
  lists: ClickUpList[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const selected = new Set(selectedIds)
  const tree = buildListTree(lists, query)
  const visible = tree.flatMap(listsOfSpace)
  const searching = query.trim() !== ''
  const showTeam = new Set(lists.map((l) => l.team ?? '')).size > 1

  // Open groups: by default those that already hold a selection; everything while searching.
  // A space is keyed "team\0space" and a folder "team\0space\0folder".
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const defaultOpen = new Set<string>()
  for (const l of lists) {
    if (!selected.has(l.id)) continue
    const spaceKey = `${l.team ?? ''}\u0000${l.space}`
    defaultOpen.add(spaceKey)
    if (l.folder) defaultOpen.add(`${spaceKey}\u0000${l.folder}`)
  }
  const isOpen = (key: string): boolean =>
    searching || (key in toggled ? toggled[key] : defaultOpen.has(key))
  const toggleOpen = (key: string): void => setToggled((prev) => ({ ...prev, [key]: !isOpen(key) }))

  const inScope = selectedIds.filter((id) => lists.some((l) => l.id === id)).length

  return (
    <div className="space-y-2">
      <p className="text-xs text-cesa-mute">{s.all}</p>
      <TextField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={s.search}
        aria-label={s.search}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-xs text-cesa-mute">
          {s.selectedCount(inScope, lists.length)}
        </span>
        <Button
          variant="ghost"
          disabled={visible.length === 0}
          onClick={() => onChange([...new Set([...selectedIds, ...visible.map((l) => l.id)])])}
        >
          {s.selectVisible}
        </Button>
        <Button variant="ghost" disabled={selectedIds.length === 0} onClick={() => onChange([])}>
          {s.clear}
        </Button>
      </div>
      <div className="cesa-scroll max-h-72 space-y-1.5 overflow-y-auto pe-1">
        {tree.length === 0 ? (
          <p className="py-3 text-center text-xs text-cesa-mute">{s.noMatch}</p>
        ) : (
          tree.map((space) => (
            <SpaceGroup
              key={space.key}
              space={space}
              showTeam={showTeam}
              selected={selected}
              isOpen={isOpen}
              toggleOpen={toggleOpen}
              onChange={onChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---------- ClickUp: which tasks to show ----------

function Field({
  title,
  hint,
  children
}: {
  title: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="text-sm text-cesa-ink">{title}</div>
      {children}
      {hint && <p className="text-xs text-cesa-mute">{hint}</p>}
    </div>
  )
}

function ClickUpTasks({
  cfg,
  total,
  shown
}: {
  cfg: Settings['clickup']
  total: number | undefined
  shown: number
}): React.JSX.Element {
  const update = (patch: Partial<Settings['clickup']>): Promise<void> =>
    window.api.settings.update({ clickup: patch })

  return (
    <div className="space-y-3 border-t border-cesa-700 pt-3">
      <h4 className="text-sm font-semibold text-cesa-ink">{s.tasksTitle}</h4>

      <Field title={s.due}>
        <Segment<number>
          label={s.due}
          value={cfg.dueWindowDays}
          onChange={(dueWindowDays) => update({ dueWindowDays })}
          options={([3, 7, 14, 30, 90] as const).map((d) => ({ value: d, label: s.dueOptions[d] }))}
        />
      </Field>

      <Field title={s.minPriority}>
        <Segment<ClickUpMinPriority>
          label={s.minPriority}
          value={cfg.minPriority}
          onChange={(minPriority) => update({ minPriority })}
          options={(['any', 'normal', 'high', 'urgent'] as const).map((p) => ({
            value: p,
            label: s.minPriorityOptions[p]
          }))}
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-cesa-ink">{s.flagged}</div>
          <div className="text-xs text-cesa-mute">{s.flaggedHint}</div>
        </div>
        <Toggle
          checked={cfg.alwaysShowFlagged}
          label={s.flagged}
          onChange={(alwaysShowFlagged) => update({ alwaysShowFlagged })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-cesa-ink">{s.subtasks}</div>
        <Toggle
          checked={cfg.includeSubtasks}
          label={s.subtasks}
          onChange={(includeSubtasks) => update({ includeSubtasks })}
        />
      </div>

      <Field title={s.statuses} hint={s.statusesHint}>
        <textarea
          defaultValue={cfg.ignoredStatuses.join(', ')}
          rows={2}
          spellCheck={false}
          aria-label={s.statuses}
          onBlur={(e) => update({ ignoredStatuses: parseWords(e.target.value) })}
          className="w-full resize-none rounded-lg border border-cesa-line bg-cesa-900 px-2.5 py-1.5 text-sm text-cesa-ink select-text focus:border-cesa-green focus:outline-none"
        />
      </Field>

      <div className="space-y-1 rounded-lg border border-cesa-green/30 bg-cesa-green/5 p-2.5">
        <div className="text-xs font-semibold tracking-wider text-cesa-green uppercase">
          {s.yourRule}
        </div>
        <p className="text-xs text-cesa-ink select-text">{describeClickUpRule(cfg, total)}</p>
        <p className="text-xs font-semibold text-cesa-green">{s.showing(shown)}</p>
      </div>
    </div>
  )
}

// ---------- Gmail labels / Slack channels: a checklist with search ----------

function SearchableChecklist({
  rows,
  isChecked,
  onToggle,
  onBulk,
  bulkLabel,
  clearLabel,
  hint,
  suffix
}: {
  rows: Row[]
  isChecked: (row: Row) => boolean
  onToggle: (row: Row) => void
  onBulk?: (rows: Row[]) => void
  bulkLabel?: string
  clearLabel?: string
  hint: string
  suffix?: string
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const visible = rows.filter((r) =>
    matchesQuery({ id: r.id, name: r.name, space: r.hint ?? '' }, query)
  )
  const checked = rows.filter(isChecked).length

  return (
    <div className="space-y-2">
      <p className="text-xs text-cesa-mute">{hint}</p>
      {rows.length > 6 && (
        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.searchPlain}
          aria-label={s.searchPlain}
        />
      )}
      {onBulk && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-xs text-cesa-mute">
            {s.selectedCount(checked, rows.length)}
          </span>
          <Button variant="ghost" disabled={visible.length === 0} onClick={() => onBulk(visible)}>
            {bulkLabel}
          </Button>
          <Button variant="ghost" disabled={checked === 0} onClick={() => onBulk([])}>
            {clearLabel}
          </Button>
        </div>
      )}
      <div className="cesa-scroll max-h-60 space-y-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="py-3 text-center text-xs text-cesa-mute">{s.noMatch}</p>
        ) : (
          visible.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-cesa-ink hover:bg-cesa-700/50"
            >
              <input
                type="checkbox"
                checked={isChecked(r)}
                onChange={() => onToggle(r)}
                className="accent-cesa-green"
              />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="shrink-0 text-xs text-cesa-mute">{r.hint ?? suffix}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

export function Watch(): React.JSX.Element {
  const state = useAppStore((st) => st.state)
  const accounts = state?.accounts
  const settings = state?.settings

  const clickupOn = accounts?.clickup.status === 'connected'
  const gmailOn = accounts?.gmail.status === 'connected'
  const slackOn = accounts?.slack.status === 'connected'
  const calendarOn = accounts?.calendar.status === 'connected'

  const clickupLists = useList(clickupOn, () => window.api.accounts.listClickUpLists())
  const gmailRows = useList<Row>(gmailOn, async () =>
    (await window.api.accounts.listGmailLabels()).map((l) => ({ id: l.id, name: l.name }))
  )
  const slackRows = useList<Row>(slackOn, async () =>
    (await window.api.accounts.listSlackChannels()).map((c) => ({
      id: c.id,
      name: `#${c.name}`,
      hint: c.isPrivate ? 'privado' : undefined
    }))
  )

  if (!settings) return <></>
  const cfg = settings.clickup
  const gmailIds = settings.gmail.labelIds
  const muted = settings.filters.mutedChannels
  const shownTasks = (state?.signals ?? []).filter((x) => x.source === 'clickup').length

  const setMuted = (names: string[]): Promise<void> =>
    window.api.settings.update({ filters: { mutedChannels: names } })

  return (
    <div className="space-y-3">
      <Section
        title={s.clickupTitle}
        connected={clickupOn}
        needText={s.needClickUp}
        loaded={clickupLists !== null}
        empty={clickupLists?.length === 0}
      >
        <ClickUpLists
          lists={clickupLists ?? []}
          selectedIds={cfg.listIds}
          onChange={(listIds) => window.api.settings.update({ clickup: { listIds } })}
        />
        <ClickUpTasks cfg={cfg} total={clickupLists?.length} shown={shownTasks} />
      </Section>

      <Section
        title={s.gmailTitle}
        connected={gmailOn}
        needText={s.needGmail}
        loaded={gmailRows !== null}
        empty={gmailRows?.length === 0}
      >
        <SearchableChecklist
          rows={gmailRows ?? []}
          hint={s.gmailHint}
          isChecked={(r) => gmailIds.includes(r.id)}
          onToggle={(r) => {
            const next = toggleIn(gmailIds, r.id)
            // Never end up watching nothing.
            window.api.settings.update({ gmail: { labelIds: next.length > 0 ? next : ['INBOX'] } })
          }}
        />
      </Section>

      <Section
        title={s.slackTitle}
        connected={slackOn}
        needText={s.needSlack}
        loaded={slackRows !== null}
        empty={slackRows?.length === 0}
      >
        <SearchableChecklist
          rows={slackRows ?? []}
          hint={s.slackHint}
          suffix={s.ignore}
          isChecked={(r) => muted.includes(r.name)}
          onToggle={(r) => setMuted(toggleIn(muted, r.name))}
          bulkLabel={s.ignoreVisible}
          clearLabel={s.stopIgnoring}
          onBulk={(visible) => {
            // "Ignore visible" adds the shown channels; "none" clears every Slack channel from the list.
            const slackNames = new Set((slackRows ?? []).map((r) => r.name))
            if (visible.length === 0) setMuted(muted.filter((n) => !slackNames.has(n)))
            else setMuted([...new Set([...muted, ...visible.map((r) => r.name)])])
          }}
        />
      </Section>

      <CalendarHorizon connected={calendarOn} />

      <Filters />
    </div>
  )
}
