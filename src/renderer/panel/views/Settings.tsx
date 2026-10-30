import { useState } from 'react'
import { formatAccelerator } from '@shared/accelerator'
import { strings } from '@shared/strings'
import type { AppState } from '@shared/types'
import {
  BellIcon,
  ChevronRightIcon,
  EyeIcon,
  MonitorIcon,
  PanelRightIcon,
  SlidersIcon,
  SparklesIcon,
  TrashIcon,
  UsersIcon
} from '@renderer/components/icons'
import { useAppStore } from '@renderer/store/useAppStore'
import { Button, Card } from '@renderer/components/ui'
import { Header } from '../components/Header'
import { Accounts } from './settings/Accounts'
import { PanelSize } from './settings/PanelSize'
import { Widget } from './settings/Widget'
import { General } from './settings/General'
import { Schedule } from './settings/Schedule'
import { Trash } from './settings/Trash'
import { Watch } from './settings/Watch'

type Section = keyof typeof strings.settings.sections

const pages: Record<Section, () => React.JSX.Element> = {
  widget: Widget,
  panel: PanelSize,
  accounts: Accounts,
  watch: Watch,
  ai: () => (
    <Card>
      <p className="text-sm text-cesa-mute">{strings.settings.ai.text}</p>
    </Card>
  ),
  schedule: Schedule,
  trash: Trash,
  general: General
}

// Each row of the list: an icon and a one-line summary of what is set today.
const sm = strings.settings.summary
const rows: Record<
  Section,
  { icon: (p: { className?: string }) => React.JSX.Element; summary: (s: AppState) => string }
> = {
  widget: {
    icon: MonitorIcon,
    summary: ({ settings: { widget } }) =>
      widget.mode === 'tab' ? sm.widgetTab(widget.side) : sm.widgetPopup
  },
  panel: { icon: PanelRightIcon, summary: ({ settings }) => sm.panelSize(settings.panel.scale) },
  accounts: {
    icon: UsersIcon,
    summary: ({ accounts }) =>
      sm.accounts(
        Object.values(accounts).filter((a) => a.status !== 'disconnected').length,
        Object.keys(accounts).length
      )
  },
  watch: { icon: EyeIcon, summary: () => sm.watch },
  ai: { icon: SparklesIcon, summary: () => sm.ai },
  schedule: {
    icon: BellIcon,
    summary: ({ settings: { schedule, notifications } }) =>
      sm.schedule(schedule.workStart, schedule.workEnd, notifications.enabled)
  },
  trash: { icon: TrashIcon, summary: ({ trash }) => sm.trash(trash.length) },
  general: {
    icon: SlidersIcon,
    summary: ({ settings: { hotkey } }) =>
      sm.general(hotkey.enabled ? formatAccelerator(hotkey.accelerator) : null)
  }
}

// At the bottom of the list: closes the whole widget. It asks once more, so a stray click does not.
function QuitCard(): React.JSX.Element {
  const q = strings.settings.quit
  const [confirming, setConfirming] = useState(false)
  return (
    <Card className="mt-4 space-y-2.5">
      <div>
        <div className="text-sm text-cesa-ink">{q.title}</div>
        <div className="text-xs text-cesa-mute">{q.hint}</div>
      </div>
      {confirming ? (
        <div className="flex gap-2">
          <Button onClick={() => void window.api.system.quitApp()}>{q.confirm}</Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            {q.cancel}
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          {q.button}
        </Button>
      )}
    </Card>
  )
}

export function Settings(): React.JSX.Element {
  const setView = useAppStore((s) => s.setView)
  const openSection = useAppStore((s) => s.openSection)
  const state = useAppStore((s) => s.state)
  const [section, setSection] = useState<Section | null>(
    openSection && openSection in pages ? (openSection as Section) : null
  )
  const Page = section ? pages[section] : null

  return (
    <>
      <Header
        title={section ? strings.settings.sections[section] : strings.settings.title}
        onBack={() => (section ? setSection(null) : setView('home'))}
      />
      <div className="cesa-scroll flex-1 space-y-2 overflow-y-auto p-4">
        {Page ? (
          <Page />
        ) : (
          (Object.keys(strings.settings.sections) as Section[]).map((key) => {
            const { icon: SectionIcon, summary } = rows[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-cesa-700 bg-cesa-700/30 px-3 py-2.5 text-left transition hover:border-cesa-green/50 hover:bg-cesa-700/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cesa-900 text-cesa-green">
                  <SectionIcon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-cesa-ink">
                    {strings.settings.sections[key]}
                  </span>
                  {state && (
                    <span className="block truncate text-xs text-cesa-mute">{summary(state)}</span>
                  )}
                </span>
                <ChevronRightIcon className="size-4 text-cesa-mute" />
              </button>
            )
          })
        )}
        {!Page && <QuitCard />}
      </div>
    </>
  )
}
