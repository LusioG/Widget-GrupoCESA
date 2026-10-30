import { strings } from '@shared/strings'
import type { Source, TaskPriority } from '@shared/types'
import { CalendarIcon, ClickUpIcon, GmailIcon, SlackIcon } from './icons'

const sourceTint: Record<Source, string> = {
  slack: 'text-fuchsia-300 bg-fuchsia-300/10',
  gmail: 'text-rose-300 bg-rose-300/10',
  calendar: 'text-sky-300 bg-sky-300/10',
  clickup: 'text-violet-300 bg-violet-300/10'
}

const sourceIcon = {
  slack: SlackIcon,
  gmail: GmailIcon,
  calendar: CalendarIcon,
  clickup: ClickUpIcon
}

export function SourceIcon({
  source,
  className
}: {
  source: Source
  className: string
}): React.JSX.Element {
  const Icon = sourceIcon[source]
  return <Icon className={className} />
}

// The small colored tag with the icon and name of where an item comes from.
export function SourceTag({ source }: { source: Source }): React.JSX.Element {
  return (
    <span
      className={`mt-0.5 flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-md px-1 py-1 text-xs leading-tight font-semibold ${sourceTint[source]}`}
    >
      <SourceIcon source={source} className="size-4" />
      {strings.sources[source]}
    </span>
  )
}

// The same flag colors ClickUp uses for each priority.
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  urgent: '#f50000',
  high: '#f8ae00',
  normal: '#6fddff',
  low: '#a8a8a8'
}

export function PriorityFlag({ priority }: { priority: TaskPriority }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3 shrink-0"
      fill={PRIORITY_COLOR[priority]}
      aria-label={strings.panel.priority[priority]}
    >
      <path d="M3 1.5a.75.75 0 0 1 1.5 0V2h7.1c.6 0 .9.7.5 1.1L10.3 5l1.8 1.9c.4.4.1 1.1-.5 1.1H4.5v6.5a.75.75 0 0 1-1.5 0v-13Z" />
    </svg>
  )
}
