import { useState } from 'react'
import {
  BRIEFING_SECTIONS,
  MAX_EXTRA_LENGTH,
  MAX_EXTRAS,
  SECTION_TOPICS
} from '@shared/briefingPrompt'
import { strings } from '@shared/strings'
import type { BriefingSectionKey } from '@shared/types'
import { XIcon } from '@renderer/components/icons'
import { Button, Card, TextField, Toggle } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.briefing.ai

function Row({
  title,
  hint,
  children
}: {
  title: string
  hint: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm text-cesa-ink">{title}</div>
        <div className="text-xs text-cesa-mute">{hint}</div>
      </div>
      {children}
    </div>
  )
}

type Status = { ok: boolean; text: string } | null

// The key is pasted once, checked against Google and stored encrypted; it is never shown again.
function KeyCard(): React.JSX.Element {
  const keySet = useAppStore((st) => st.state?.aiKeySet ?? false)
  const aiOn = useAppStore((st) => st.state?.settings.ai.enabled ?? false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const result = await action()
      setStatus(result.ok ? { ok: true, text: s.testOk } : { ok: false, text: result.error ?? '' })
      if (result.ok) setDraft('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-2.5">
      <div>
        <div className="text-sm text-cesa-ink">{s.keyTitle}</div>
        <div className="text-xs text-cesa-mute">{s.keyHint}</div>
      </div>
      {keySet ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-cesa-green/40 px-2.5 py-0.5 text-xs font-semibold text-cesa-green">
            {s.keySet}
          </span>
          <Button variant="ghost" disabled={busy} onClick={() => run(() => window.api.ai.test())}>
            {busy ? s.saving : s.test}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setStatus(null)
              void window.api.ai.removeKey()
            }}
          >
            {s.remove}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <TextField
            type="password"
            autoComplete="off"
            value={draft}
            placeholder={s.keyPlaceholder}
            aria-label={s.keyTitle}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) void run(() => window.api.ai.saveKey(draft))
            }}
          />
          <Button
            disabled={busy || draft.trim().length < 20}
            onClick={() => run(() => window.api.ai.saveKey(draft))}
          >
            {busy ? s.saving : s.save}
          </Button>
        </div>
      )}
      {/* A key that works is not enough: with the switch off the summary stays a plain list. */}
      {keySet && !aiOn && (
        <p
          role="note"
          className="rounded-lg border border-cesa-meeting/40 bg-cesa-meeting/10 px-2.5 py-1.5 text-xs text-cesa-ink"
        >
          {s.offHint}
        </p>
      )}
      {status && (
        <p
          role={status.ok ? 'status' : 'alert'}
          className={`text-xs ${status.ok ? 'text-cesa-green' : 'text-cesa-alert-text'}`}
        >
          {status.text}
        </p>
      )}
    </Card>
  )
}

function ModelField(): React.JSX.Element {
  const saved = useAppStore((st) => st.state?.settings.ai.model ?? '')
  const [draft, setDraft] = useState(saved)
  const [seen, setSeen] = useState(saved)
  if (saved !== seen) {
    setSeen(saved)
    setDraft(saved)
  }
  const valid = /^[A-Za-z0-9._-]{1,80}$/.test(draft.trim())

  const commit = (): void => {
    const model = draft.trim()
    if (valid && model !== saved) void window.api.settings.update({ ai: { model } })
    else setDraft(saved) // an invalid name is not kept
  }

  return (
    <label className="block space-y-1">
      <span className="text-sm text-cesa-ink">{s.model}</span>
      <TextField
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      <span className="block text-xs text-cesa-mute">{s.modelHint}</span>
    </label>
  )
}

const removeButton =
  'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-cesa-mute transition hover:text-cesa-green'

// What the summary brings. The tone and the answer format are fixed in the app; here the user
// keeps or removes each built-in item (all on by default) and adds their own, one at a time.
function TopicsCard(): React.JSX.Element {
  const sections = useAppStore((st) => st.state?.settings.ai.sections ?? [])
  const extras = useAppStore((st) => st.state?.settings.ai.extras ?? [])
  const [text, setText] = useState('')

  const save = (patch: { sections?: BriefingSectionKey[]; extras?: string[] }): void =>
    void window.api.settings.update({ ai: patch })

  const on = BRIEFING_SECTIONS.filter((k) => sections.includes(k))
  const off = BRIEFING_SECTIONS.filter((k) => !sections.includes(k))
  const entry = text.replace(/\s+/g, ' ').trim().slice(0, MAX_EXTRA_LENGTH)
  const duplicate = extras.some((e) => e.toLowerCase() === entry.toLowerCase())
  const canAdd = entry !== '' && !duplicate && extras.length < MAX_EXTRAS

  const add = (): void => {
    if (!canAdd) return
    save({ extras: [...extras, entry] })
    setText('')
  }

  const changed = off.length > 0 || extras.length > 0

  return (
    <Card className="space-y-2.5">
      <div>
        <div className="text-sm text-cesa-ink">{s.topicsTitle}</div>
        <div className="text-xs text-cesa-mute">{s.topicsHint}</div>
      </div>

      <div className="flex items-center gap-2">
        <TextField
          value={text}
          maxLength={MAX_EXTRA_LENGTH}
          placeholder={s.topicsPlaceholder}
          aria-label={s.topicsPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <Button onClick={add} disabled={!canAdd}>
          {s.topicsAdd}
        </Button>
      </div>

      <ul className="space-y-1">
        {on.map((key) => (
          <li
            key={key}
            className="flex items-center justify-between gap-2 rounded-lg border border-cesa-700 bg-cesa-700/30 px-2.5 py-1 text-sm text-cesa-ink"
          >
            <span className="min-w-0 flex-1 select-text">{SECTION_TOPICS[key]}</span>
            <button
              type="button"
              aria-label={`${s.topicsRemove}: ${SECTION_TOPICS[key]}`}
              title={s.topicsRemove}
              onClick={() => save({ sections: on.filter((k) => k !== key) })}
              className={removeButton}
            >
              <XIcon className="size-3.5" />
            </button>
          </li>
        ))}
        {extras.map((extra) => (
          <li
            key={extra}
            className="flex items-center justify-between gap-2 rounded-lg border border-cesa-green/30 bg-cesa-green/5 px-2.5 py-1 text-sm text-cesa-ink"
          >
            <span className="min-w-0 flex-1 select-text">{extra}</span>
            <button
              type="button"
              aria-label={`${s.topicsRemove}: ${extra}`}
              title={s.topicsRemove}
              onClick={() => save({ extras: extras.filter((e) => e !== extra) })}
              className={removeButton}
            >
              <XIcon className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {extras.length > 0 && <p className="text-xs text-cesa-mute">{s.topicsExtrasHint}</p>}

      {off.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-cesa-mute">{s.topicsRemoved}</p>
          <div className="flex flex-wrap gap-1.5">
            {off.map((key) => (
              <button
                key={key}
                type="button"
                title={s.topicsRestore}
                onClick={() =>
                  save({ sections: BRIEFING_SECTIONS.filter((k) => k === key || on.includes(k)) })
                }
                className="inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-full border border-dashed border-cesa-line px-2.5 py-0.5 text-xs text-cesa-mute transition hover:border-cesa-green hover:text-cesa-green"
              >
                + {SECTION_TOPICS[key]}
              </button>
            ))}
          </div>
        </div>
      )}

      {changed && (
        <Button
          variant="ghost"
          onClick={() => save({ sections: [...BRIEFING_SECTIONS], extras: [] })}
        >
          {s.topicsReset}
        </Button>
      )}
    </Card>
  )
}

// Everything about the AI that writes the daily summary, inside "Resumen diario".
export function AiSettings(): React.JSX.Element {
  const ai = useAppStore((st) => st.state?.settings.ai)
  const keySet = useAppStore((st) => st.state?.aiKeySet ?? false)
  if (!ai) return <></>

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-cesa-ink">{s.title}</h3>
        <p className="text-xs text-cesa-mute">{s.intro}</p>
      </div>

      <div
        role="note"
        className="rounded-xl border border-cesa-meeting/40 bg-cesa-meeting/10 px-3 py-2.5 text-xs text-cesa-ink"
      >
        <div className="mb-0.5 font-semibold text-cesa-meeting">{s.privacyTitle}</div>
        {s.privacy}
      </div>

      <KeyCard />

      {keySet && (
        <>
          <Card className="space-y-4">
            <Row title={s.enabled} hint={s.enabledHint}>
              <Toggle
                checked={ai.enabled}
                label={s.enabled}
                onChange={(enabled) => window.api.settings.update({ ai: { enabled } })}
              />
            </Row>
            <ModelField />
          </Card>

          <TopicsCard />

          <Card className="space-y-4">
            <div>
              <div className="text-sm text-cesa-ink">{s.reads}</div>
              <div className="text-xs text-cesa-mute">{s.readsDefault}</div>
            </div>
            <Row title={s.sendMail} hint={s.sendMailHint}>
              <Toggle
                checked={ai.sendMail}
                label={s.sendMail}
                onChange={(sendMail) => window.api.settings.update({ ai: { sendMail } })}
              />
            </Row>
            <Row title={s.sendSlack} hint={s.sendSlackHint}>
              <Toggle
                checked={ai.sendSlack}
                label={s.sendSlack}
                onChange={(sendSlack) => window.api.settings.update({ ai: { sendSlack } })}
              />
            </Row>
            <p className="text-xs text-cesa-mute">{s.masked}</p>
          </Card>
        </>
      )}
    </div>
  )
}
