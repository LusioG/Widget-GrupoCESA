import { useEffect, useRef, useState } from 'react'
import { fileSize, isLongMessage, toRichParts } from '@shared/richText'
import { strings } from '@shared/strings'
import type { ThreadMessage, ThreadView } from '@shared/types'
import { AlertIcon, UsersIcon, XIcon } from '@renderer/components/icons'
import { useNow } from '@renderer/components/useNow'

const s = strings.thread

const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const longDate = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })

const dayKey = (at: number): string => new Date(at).toDateString()

function dayLabel(at: number, now: number): string {
  if (dayKey(at) === dayKey(now)) return s.today
  if (dayKey(at) === dayKey(now - 24 * 60 * 60 * 1000)) return s.yesterday
  return longDate.format(at)
}

// Each person keeps one colour for their name and avatar, so who wrote what can be told at a glance.
const NAME_COLOURS = ['#7dd3fc', '#fca5a5', '#fcd34d', '#c4b5fd', '#86efac', '#f9a8d4', '#fdba74']
function colourOf(address: string): string {
  let hash = 0
  for (const ch of address.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return NAME_COLOURS[hash % NAME_COLOURS.length]
}

// "Ana Pérez" -> "AP"; an address with no name -> its first letter.
function initials(name: string): string {
  const words = name.replace(/[<>"@]/g, ' ').split(/[\s._-]+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

function Avatar({ name, address }: { name: string; address: string }): React.JSX.Element {
  const colour = colourOf(address || name)
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-cesa-950"
      style={{ backgroundColor: colour }}
    >
      {initials(name)}
    </span>
  )
}

const chip =
  'mx-0.5 inline-flex max-w-full cursor-pointer items-center gap-0.5 rounded-full border border-cesa-line bg-cesa-950/60 px-2 text-xs font-semibold text-cesa-green align-baseline transition hover:border-cesa-green'

// The text of a message: links become short chips that open in the browser, the "[image: …]"
// markers become a small label, and the rest is written as it came.
function RichText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {toRichParts(text).map((part, i) => {
        if (part.kind === 'text') return <span key={i}>{part.text}</span>
        if (part.kind === 'image') {
          return (
            <span
              key={i}
              title={s.image(part.name)}
              className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-cesa-950/40 px-2 text-xs text-cesa-mute align-baseline"
            >
              <span aria-hidden="true">🖼</span>
              <span className="truncate">{part.name || s.image('')}</span>
            </span>
          )
        }
        return (
          <button
            key={i}
            type="button"
            title={part.url}
            aria-label={s.openLink(part.label)}
            onClick={() => void window.api.openExternal(part.url)}
            className={chip}
          >
            <span className="truncate">{part.label}</span>
            <span aria-hidden="true">↗</span>
          </button>
        )
      })}
    </>
  )
}

const FOLDED = 'max-h-44 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]'

function Bubble({
  message,
  showName,
  gmailUrl
}: {
  message: ThreadMessage
  showName: boolean
  gmailUrl: string
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const name = message.mine ? s.you : message.from.name || message.from.address
  const colour = colourOf(message.from.address || name)
  const long = isLongMessage(message.text)
  const attachments = message.attachments ?? []

  return (
    <li className={`flex items-start gap-2 ${message.mine ? 'justify-end' : 'justify-start'}`}>
      {!message.mine &&
        (showName ? (
          <Avatar name={name} address={message.from.address} />
        ) : (
          <span className="size-8 shrink-0" />
        ))}
      <div
        className={`max-w-[85%] min-w-0 rounded-2xl px-3 py-2 shadow ${
          message.mine
            ? 'rounded-br-md border border-cesa-green/40 bg-cesa-green/15'
            : 'rounded-bl-md border border-cesa-700 bg-cesa-700/60'
        }`}
      >
        {showName && !message.mine && (
          <p className="mb-0.5 truncate text-xs font-bold" style={{ color: colour }}>
            {name}
          </p>
        )}
        {message.replyTo && (
          <div className="mb-1.5 rounded-lg border-l-4 border-cesa-green/70 bg-cesa-950/50 px-2 py-1">
            <p className="truncate text-xs font-semibold text-cesa-green">
              {s.inReplyTo(message.replyTo.name)}
            </p>
            <p className="line-clamp-2 text-xs break-words text-cesa-mute">
              {message.replyTo.snippet}
            </p>
          </div>
        )}

        <p
          className={`text-sm break-words whitespace-pre-wrap text-cesa-ink select-text ${
            long && !expanded ? FOLDED : ''
          }`}
        >
          <RichText text={message.text} />
        </p>
        {long && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 min-h-6 cursor-pointer text-xs font-semibold text-cesa-green hover:underline"
          >
            {expanded ? s.showLess : s.showMore}
          </button>
        )}

        {attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((file, i) => (
              <li key={`${file.name}-${i}`} className="min-w-0 max-w-full">
                <button
                  type="button"
                  title={s.attachment(file.name)}
                  aria-label={s.attachment(file.name)}
                  onClick={() => void window.api.openExternal(gmailUrl)}
                  className="flex max-w-full min-h-6 cursor-pointer items-center gap-1.5 rounded-lg border border-cesa-line bg-cesa-950/60 px-2 py-1 text-xs text-cesa-ink transition hover:border-cesa-green"
                >
                  <span aria-hidden="true">📎</span>
                  <span className="truncate">{file.name}</span>
                  {file.size > 0 && (
                    <span className="shrink-0 text-cesa-mute">{fileSize(file.size)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {message.signature && (
          <div className="mt-1">
            <button
              type="button"
              aria-expanded={signatureOpen}
              aria-label={signatureOpen ? s.hideSignature : s.showSignature}
              title={signatureOpen ? s.hideSignature : s.showSignature}
              onClick={() => setSignatureOpen((v) => !v)}
              className="min-h-6 cursor-pointer rounded-full px-2 text-xs font-bold tracking-widest text-cesa-mute hover:text-cesa-green"
            >
              ···
            </button>
            {signatureOpen && (
              <p className="mt-1 rounded-lg bg-cesa-950/40 px-2 py-1.5 text-xs break-words whitespace-pre-wrap text-cesa-mute select-text">
                <RichText text={message.signature} />
              </p>
            )}
          </div>
        )}

        <p className="mt-1 text-right text-xs text-cesa-mute tabular-nums">
          {clock.format(message.at)}
        </p>
      </div>
    </li>
  )
}

function Conversation({ view }: { view: ThreadView }): React.JSX.Element {
  const unreadMarker = useRef<HTMLParagraphElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const now = useNow()

  // It opens where the news start (the "Nuevo" mark), not at the end of a long thread; with
  // nothing new, like a chat, on the latest message.
  useEffect(() => {
    if (unreadMarker.current) unreadMarker.current.scrollIntoView({ block: 'start' })
    else end.current?.scrollIntoView({ block: 'end' })
  }, [view.threadId, view.messages.length])

  const firstUnread = view.messages.findIndex((m) => m.unread && !m.mine)

  return (
    <div className="space-y-2">
      {view.messages.map((m, i) => {
        const previous = view.messages[i - 1]
        const newDay = !previous || dayKey(previous.at) !== dayKey(m.at)
        // The name and avatar go on the first bubble of a run by the same person.
        const showName =
          newDay || previous.from.address !== m.from.address || previous.mine !== m.mine
        return (
          <div key={m.id}>
            {newDay && (
              <p className="my-2 text-center">
                <span className="rounded-full bg-cesa-900 px-3 py-0.5 text-xs text-cesa-mute capitalize">
                  {dayLabel(m.at, now)}
                </span>
              </p>
            )}
            {i === firstUnread && (
              <p
                ref={unreadMarker}
                className="my-2 flex items-center gap-2 text-xs font-bold text-cesa-green"
              >
                <span className="h-px flex-1 bg-cesa-green/40" />
                {s.newMessage}
                <span className="h-px flex-1 bg-cesa-green/40" />
              </p>
            )}
            <ul>
              <Bubble message={m} showName={showName} gmailUrl={view.gmailUrl} />
            </ul>
          </div>
        )
      })}
      <div ref={end} />
    </div>
  )
}

export function Thread(): React.JSX.Element {
  const [view, setView] = useState<ThreadView | null>(null)

  useEffect(() => {
    let cancelled = false
    // The window may have been sent the conversation before this page was listening.
    void window.api.threads.current().then((v) => !cancelled && v && setView((now) => now ?? v))
    const off = window.api.threads.onShow(setView)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const body = ((): React.JSX.Element => {
    if (!view || view.loading) {
      return <p className="py-10 text-center text-sm text-cesa-mute">{s.loading}</p>
    }
    if (view.error) {
      return (
        <div role="alert" className="flex items-start gap-2 py-6 text-sm text-cesa-alert-text">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>{s.errors[view.error]}</span>
        </div>
      )
    }
    if (view.messages.length === 0) {
      return <p className="py-10 text-center text-sm text-cesa-mute">{s.empty}</p>
    }
    return <Conversation view={view} />
  })()

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-2xl border border-cesa-green/30 bg-cesa-950 text-cesa-ink shadow-2xl shadow-black/60">
      <header className="flex items-start gap-3 border-b border-cesa-700 bg-cesa-900 px-4 py-3">
        <div className="min-w-0 flex-1">
          {view?.list && (
            <p className="flex items-center gap-1 truncate text-xs text-cesa-mute">
              <UsersIcon className="size-3.5 shrink-0" />
              <span className="truncate">{view.list.name}</span>
            </p>
          )}
          <h1 title={view?.subject} className="line-clamp-2 text-sm font-bold break-words">
            {view?.subject || ' '}
          </h1>
          {view && !view.loading && !view.error && view.messages.length > 0 && (
            <p className="text-xs text-cesa-mute">{s.messages(view.messages.length)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.api.threads.close()}
          aria-label={s.close}
          title={s.close}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cesa-line text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green"
        >
          <XIcon className="size-3.5" />
        </button>
      </header>

      <main className="cesa-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">{body}</main>

      {view && (
        <footer className="border-t border-cesa-700 bg-cesa-900 px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => void window.api.openExternal(view.gmailUrl)}
            className="min-h-6 cursor-pointer rounded-full border border-cesa-line px-3 py-1 text-xs font-semibold text-cesa-ink transition hover:border-cesa-green hover:text-cesa-green"
          >
            {s.openInGmail}
          </button>
        </footer>
      )}
    </div>
  )
}
