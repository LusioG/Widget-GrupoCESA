import { useEffect, useRef } from 'react'
import { strings } from '@shared/strings'
import type { DockSide } from '@shared/types'
import { DotsArc } from '@renderer/components/DotsArc'
import { useAppStore } from '@renderer/store/useAppStore'
import { Home } from './views/Home'
import { Onboarding } from './views/Onboarding'
import { Settings } from './views/Settings'

// Same easing and timing as the tab sliding out in the main process, so both move together.
const EASING = 'cubic-bezier(0.215, 0.61, 0.355, 1)'
const OPEN_MS = 280
const CLOSE_MS = 220

// The drawer is revealed starting from the screen edge it is docked to.
const hiddenClip = (dock: DockSide): string =>
  dock === 'left' ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)'
const shownClip = 'inset(0 0 0 0)'

export function Panel(): React.JSX.Element {
  const view = useAppStore((s) => s.view)
  const state = useAppStore((s) => s.state)
  const init = useAppStore((s) => s.init)
  useEffect(() => init(), [init])

  const widget = state?.settings.widget
  // Tab mode: the panel is a drawer that opens flush against the screen edge.
  const dock: DockSide | null = widget?.mode === 'tab' ? widget.side : null

  const card = useRef<HTMLDivElement>(null)
  const running = useRef<Animation | null>(null)
  useEffect(() => {
    if (!dock) return
    return window.api.onPanelOpen((open) => {
      running.current?.cancel()
      const hidden = hiddenClip(dock)
      // With "reduce motion" the drawer appears at once (the main process skips its slide too).
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // Unfolds sideways from the edge on open and folds back on close; it stays in its end
      // state until the next change, so a closed drawer never flashes before it opens.
      running.current =
        card.current?.animate(
          [{ clipPath: open ? hidden : shownClip }, { clipPath: open ? shownClip : hidden }],
          { duration: still ? 0 : open ? OPEN_MS : CLOSE_MS, easing: EASING, fill: 'forwards' }
        ) ?? null
    })
  }, [dock])

  // The transparent margin leaves room for the shadow. In tab mode the panel is flush with the
  // screen edge and with the tab, so only the top and bottom keep it. The edge side is square.
  const margin = dock ? 'px-0 py-2' : 'p-2'
  const shape =
    dock === 'left'
      ? 'rounded-r-2xl border-l-0'
      : dock === 'right'
        ? 'rounded-l-2xl border-r-0'
        : 'rounded-2xl'

  return (
    // data-dock lets the CSS put the scrollbars on the side of the screen edge the drawer is on.
    <div className={`h-full ${margin}`} data-dock={dock ?? undefined}>
      <div
        ref={card}
        // Closed drawer starts hidden, so nothing shows before the opening animation runs.
        style={dock ? { clipPath: hiddenClip(dock) } : undefined}
        className={`relative flex h-full flex-col overflow-hidden border border-cesa-green/25 bg-cesa-800 text-cesa-ink ${dock ? '' : 'shadow-2xl shadow-black/60'} ${shape}`}
      >
        {state &&
          (!state.settings.onboardingDone ? (
            <Onboarding />
          ) : view === 'home' ? (
            <Home />
          ) : (
            <Settings />
          ))}
        <footer className="relative flex items-center justify-center gap-2 border-t border-cesa-700 bg-cesa-950/60 py-1.5 text-xs font-semibold tracking-wide text-cesa-mute">
          <DotsArc className="size-3.5 text-cesa-green" />
          {strings.brand}
        </footer>
      </div>
    </div>
  )
}
