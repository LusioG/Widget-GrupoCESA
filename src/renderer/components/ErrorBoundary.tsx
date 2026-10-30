import { Component, type ReactNode } from 'react'
import { strings } from '@shared/strings'

type Props = {
  children: ReactNode
  compact?: boolean // the tiny floating widget has no room for a message
  onRetry?: () => void
}

type State = { failed: boolean }

// If a page throws while rendering, show a way out instead of a blank window.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  private retry = (): void => {
    if (this.props.onRetry) this.props.onRetry()
    else window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children

    if (this.props.compact) {
      return (
        <button
          type="button"
          onClick={this.retry}
          title={strings.errors.retry}
          className="pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-cesa-alert bg-cesa-800 text-lg font-bold text-cesa-alert-text"
        >
          !
        </button>
      )
    }

    return (
      <div className="flex h-full items-center justify-center p-2">
        <div
          role="alert"
          className="w-full space-y-3 rounded-2xl border border-cesa-alert/50 bg-cesa-800 p-5 text-center text-cesa-ink shadow-2xl"
        >
          <h2 className="text-base font-semibold">{strings.errors.title}</h2>
          <p className="text-sm text-cesa-mute">{strings.errors.body}</p>
          <button
            type="button"
            onClick={this.retry}
            className="cursor-pointer rounded-full bg-cesa-green px-4 py-1.5 text-xs font-bold text-cesa-950"
          >
            {strings.errors.retry}
          </button>
        </div>
      </div>
    )
  }
}
