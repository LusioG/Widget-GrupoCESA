import { useEffect, useRef, useState } from 'react'
import { badgeCircles } from '@shared/badgeState'
import { strings } from '@shared/strings'
import logo from '@renderer/assets/logo-circle.png'
import { ChevronLeftIcon, ChevronRightIcon } from '@renderer/components/icons'
import { playNotificationSound } from '@renderer/components/sound'
import { useAppStore } from '@renderer/store/useAppStore'

type Handlers = Record<string, unknown>

// A small round counter next to the main number: red for urgent items, yellow for meetings.
function Circle({
  value,
  tone,
  title,
  handlers,
  className
}: {
  value: number
  tone: 'urgent' | 'meetings'
  title: string
  handlers: Handlers
  className: string
}): React.JSX.Element {
  const color = tone === 'urgent' ? 'bg-cesa-alert' : 'bg-cesa-meeting'
  return (
    <span
      title={title}
      {...handlers}
      className={`pointer-events-auto flex cursor-pointer items-center justify-center rounded-full text-xs leading-none font-bold text-cesa-950 ${color} ${className}`}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

export function Badge(): React.JSX.Element {
  const state = useAppStore((s) => s.state)
  const init = useAppStore((s) => s.init)
  useEffect(() => init(), [init])

  // Tab mode: the arrow points toward where the panel will go, and back to the edge while open.
  const [panelOpen, setPanelOpen] = useState(false)
  useEffect(() => window.api.onPanelOpen(setPanelOpen), [])

  useEffect(() => window.api.onPlaySound(playNotificationSound), [])

  // The page only forwards the pointer. The main process tells a click from a drag using the real
  // cursor position, so zoom and display scaling cannot skew it.
  const pressed = useRef(false)
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>): void => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      pressed.current = true
      window.api.badge.press()
    },
    onPointerMove: (): void => {
      if (pressed.current) window.api.badge.move()
    },
    onPointerUp: (): void => {
      if (!pressed.current) return
      pressed.current = false
      window.api.badge.release()
    },
    // The pointer was lost without a real release (e.g. the window was taken away).
    onPointerCancel: (): void => {
      if (!pressed.current) return
      pressed.current = false
      window.api.badge.release(true)
    }
  }

  const badge = state?.badge
  const paused = state?.paused ?? false
  const count = badge?.count ?? 0
  const urgent = !paused && !!badge?.urgent
  const focus = !paused && !urgent && !!state?.focus.active
  // The pulse: red for a new mail or Slack message (tasks never pulse), green for a meeting
  // about to start or in progress. The red border and circle still show urgent items of any kind.
  const messagePulse = !paused && !!badge?.messageAlert
  const meetingPulse = !paused && !messagePulse && !!badge?.meetingSoon
  const highlight = messagePulse || meetingPulse
  const widget = state?.settings.widget
  const isTab = widget?.mode === 'tab'

  const title = paused
    ? strings.badge.paused
    : state?.focus.active
      ? strings.panel.focusNotice
      : strings.badge.title
  const ring = urgent ? 'alert' : focus ? 'focus' : 'ok'
  // The green number is always the count of pending items; urgent ones and meetings have their
  // own circles (red and yellow).
  const pillColor = paused ? 'bg-cesa-mute' : 'bg-cesa-green'
  const pillText = count > 99 ? '99+' : count
  const circles = badge ? badgeCircles(badge, !!state?.focus.active) : { urgent: 0, meetings: 0 }
  const urgentTitle = strings.badge.urgentCircle(circles.urgent)
  const meetingsTitle = strings.badge.meetingsCircle(circles.meetings)

  // ---- vertical tab docked to a screen edge ----
  if (isTab) {
    const side = widget?.side ?? 'right'
    // Flat against the screen edge, fully rounded on the side that faces the desktop.
    const shape = side === 'right' ? 'rounded-l-2xl border-r-0' : 'rounded-r-2xl border-l-0'
    const border = {
      alert: 'border-cesa-alert',
      focus: 'border-sky-300',
      ok: 'border-cesa-green/70'
    }
    const glow = messagePulse ? 'var(--color-cesa-alert)' : 'var(--color-cesa-green)'

    return (
      // Only the visible tab reacts to the mouse; the transparent corners do not.
      // No drop shadow: the window is exactly as big as the tab, so a shadow would only show up
      // as a translucent veil in the rounded corners.
      <div className="pointer-events-none h-full w-11" style={{ ['--glow' as string]: glow }}>
        <div
          title={title}
          {...handlers}
          className={`pointer-events-auto flex size-full cursor-pointer flex-col items-center border-2 bg-cesa-800 ${shape} ${border[ring]} ${
            highlight ? 'animate-cesa-glow' : ''
          } ${paused ? 'opacity-60 grayscale' : ''}`}
        >
          {/* Top to bottom: logo, red circle, yellow circle, green number, arrow. The red and
              yellow rows exist only when there is something to show; the window grows 32 px
              downward for each, and the logo never moves. */}
          <div className="flex shrink-0 flex-col items-center gap-2 pt-3.5">
            <img
              src={logo}
              alt=""
              draggable={false}
              className="size-8 rounded-full ring-1 ring-cesa-green/60"
            />
            {circles.urgent > 0 && (
              <Circle
                value={circles.urgent}
                tone="urgent"
                title={urgentTitle}
                handlers={handlers}
                className="h-6 min-w-6 px-1"
              />
            )}
            {circles.meetings > 0 && (
              <Circle
                value={circles.meetings}
                tone="meetings"
                title={meetingsTitle}
                handlers={handlers}
                className="h-6 min-w-6 px-1"
              />
            )}
            {count > 0 ? (
              <span
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs leading-none font-bold text-cesa-950 ${pillColor}`}
              >
                {pillText}
              </span>
            ) : (
              <span className="flex flex-col gap-1" aria-hidden="true">
                {[0.4, 0.7, 1].map((o) => (
                  <span
                    key={o}
                    className="size-1 rounded-full bg-cesa-green"
                    style={{ opacity: o }}
                  />
                ))}
              </span>
            )}
            {/* Arrow pointing where the panel will unfold. */}
            <span className="text-sm leading-none text-cesa-green/80" aria-hidden="true">
              {(side === 'right') !== panelOpen ? (
                <ChevronLeftIcon className="size-4" />
              ) : (
                <ChevronRightIcon className="size-4" />
              )}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ---- round floating popup ----
  return (
    // Only the circle and the counter react to the mouse; the transparent corners do not.
    // Everything (the counter's ring, the pulsing halo) must stay inside this 56px square:
    // anything that sticks out is cut off by the window edge and looks like a square corner.
    <div className="pointer-events-none relative size-14">
      <div
        title={title}
        {...handlers}
        className="pointer-events-auto absolute bottom-1 left-1 size-12 cursor-pointer rounded-full"
      >
        {highlight && (
          <span
            className={`animate-cesa-ping pointer-events-none absolute inset-0 rounded-full ${
              messagePulse ? 'bg-cesa-alert' : 'bg-cesa-green'
            }`}
          />
        )}
        <img
          src={logo}
          alt=""
          draggable={false}
          className={`relative size-full rounded-full ring-2 shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${
            urgent ? 'ring-cesa-alert' : focus ? 'ring-sky-300' : 'ring-cesa-green'
          } ${paused ? 'opacity-50 grayscale' : ''}`}
        />
      </div>

      {count > 0 && (
        <span
          title={title}
          {...handlers}
          className={`pointer-events-auto absolute top-0.5 right-0.5 flex h-5 min-w-5 cursor-pointer items-center justify-center rounded-full px-1 text-xs leading-none font-bold text-cesa-950 ring-2 ring-cesa-950 ${pillColor}`}
        >
          {pillText}
        </span>
      )}

      {/* The other two counters sit on the corners that the round logo leaves free. */}
      {circles.urgent > 0 && (
        <Circle
          value={circles.urgent}
          tone="urgent"
          title={urgentTitle}
          handlers={handlers}
          className="absolute top-0.5 left-0.5 h-5 min-w-5 px-1 ring-2 ring-cesa-950"
        />
      )}
      {circles.meetings > 0 && (
        <Circle
          value={circles.meetings}
          tone="meetings"
          title={meetingsTitle}
          handlers={handlers}
          className="absolute right-0.5 bottom-0.5 h-5 min-w-5 px-1 ring-2 ring-cesa-950"
        />
      )}
    </div>
  )
}
