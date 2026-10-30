import { strings } from '@shared/strings'
import logo from '@renderer/assets/logo-circle.png'
import { DotsArc } from '@renderer/components/DotsArc'
import { ChevronLeftIcon, FileTextIcon, XIcon } from '@renderer/components/icons'

type Props = {
  title: string
  subtitle?: string
  onBriefing?: () => void
  onSettings?: () => void
  onBack?: () => void
}

const iconButton =
  'flex size-8 cursor-pointer items-center justify-center rounded-full text-cesa-mute transition hover:bg-cesa-700 hover:text-cesa-green'

export function Header({
  title,
  subtitle,
  onBriefing,
  onSettings,
  onBack
}: Props): React.JSX.Element {
  return (
    <header className="relative overflow-hidden border-b border-cesa-green/20 bg-gradient-to-br from-cesa-950 via-cesa-900 to-cesa-800 px-4 py-3">
      <DotsArc className="pointer-events-none absolute -top-6 -right-6 size-32 text-cesa-green opacity-10" />
      <div className="relative flex items-center gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className={iconButton} title={strings.panel.back}>
            <ChevronLeftIcon className="size-5" />
          </button>
        ) : (
          <img
            src={logo}
            alt=""
            draggable={false}
            className="size-10 rounded-full ring-2 ring-cesa-green"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-cesa-ink">{title}</h1>
          {subtitle && <p className="truncate text-xs text-cesa-mute">{subtitle}</p>}
        </div>
        {onBriefing && (
          <button
            type="button"
            onClick={onBriefing}
            className={iconButton}
            title={strings.panel.briefing}
            aria-label={strings.panel.briefing}
          >
            <FileTextIcon className="size-5" />
          </button>
        )}
        {onSettings && (
          <button
            type="button"
            onClick={onSettings}
            className={iconButton}
            title={strings.panel.settings}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => window.api.panel.close()}
          className={iconButton}
          title={strings.panel.close}
        >
          <XIcon className="size-5" />
        </button>
      </div>
    </header>
  )
}
