import { useState } from 'react'
import { strings } from '@shared/strings'
import { syncSummary } from '@shared/syncStatus'
import type { AccountStatus, ActionResult, GoogleFeature, Source } from '@shared/types'
import { Button, Card, TextField } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'

const s = strings.settings.accounts

const pill: Record<AccountStatus | 'soon', string> = {
  connected: 'bg-cesa-green/15 text-cesa-green',
  disconnected: 'bg-cesa-900 text-cesa-mute',
  needs_reconnect: 'bg-cesa-alert/15 text-cesa-alert-text',
  soon: 'bg-cesa-900 text-cesa-mute'
}

function Frame({
  source,
  status,
  children
}: {
  source: Source
  status: AccountStatus | 'soon'
  children?: React.ReactNode
}): React.JSX.Element {
  // Connected but the last check failed (no internet, service down): it will retry on its own.
  const error = useAppStore((st) => st.state?.accounts[source].error)
  const offline = status === 'connected' && (error === 'offline' || error === 'sync')
  // Google answered that the API is switched off in the user's own Cloud project.
  const accounts = useAppStore((st) => st.state?.accounts)
  const disabled = accounts
    ? syncSummary(accounts).apiDisabled.find((d) => d.source === source)
    : undefined
  return (
    <Card className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-cesa-ink">{strings.sources[source]}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill[status]}`}>
          {offline ? s.reconnecting : strings.status[status]}
        </span>
      </div>
      {disabled && (
        <div role="alert" className="flex items-center gap-2 text-xs text-cesa-alert-text">
          <span className="flex-1">{strings.errors.apiDisabled(strings.sources[source])}</span>
          {disabled.url && (
            <Button variant="ghost" onClick={() => void window.api.openExternal(disabled.url!)}>
              {strings.errors.apiDisabledAction}
            </Button>
          )}
        </div>
      )}
      {children}
    </Card>
  )
}

function useAction(): {
  busy: boolean
  error: string | null
  run: (fn: () => Promise<ActionResult>) => Promise<boolean>
} {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<ActionResult>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    const result = await fn()
    setBusy(false)
    if (!result.ok) setError(result.error)
    return result.ok
  }
  return { busy, error, run }
}

const Footer = ({ error }: { error: string | null }): React.JSX.Element => (
  <>
    <p className="text-xs text-cesa-mute">{s.readOnly}</p>
    {error && <p className="text-xs text-cesa-alert-text">{error}</p>}
  </>
)

function ClickUpCard(): React.JSX.Element {
  const account = useAppStore((st) => st.state?.accounts.clickup)
  const [token, setToken] = useState('')
  const { busy, error, run } = useAction()
  const status = account?.status ?? 'disconnected'

  return (
    <Frame source="clickup" status={status}>
      {status === 'connected' ? (
        <Button variant="ghost" onClick={() => window.api.accounts.disconnect('clickup')}>
          {s.disconnect}
        </Button>
      ) : (
        <>
          <p className="text-xs text-cesa-mute">{s.clickupHelp}</p>
          <TextField
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={s.clickupToken}
          />
          <Button
            disabled={busy || !token.trim()}
            onClick={async () => {
              if (await run(() => window.api.accounts.connectClickUp(token))) setToken('')
            }}
          >
            {busy ? s.connecting : status === 'needs_reconnect' ? s.reconnect : s.connect}
          </Button>
        </>
      )}
      <Footer error={error} />
    </Frame>
  )
}

function SlackCard(): React.JSX.Element {
  const account = useAppStore((st) => st.state?.accounts.slack)
  const [appToken, setAppToken] = useState('')
  const [userToken, setUserToken] = useState('')
  const { busy, error, run } = useAction()
  const status = account?.status ?? 'disconnected'

  return (
    <Frame source="slack" status={status}>
      {status === 'connected' ? (
        <Button variant="ghost" onClick={() => window.api.accounts.disconnect('slack')}>
          {s.disconnect}
        </Button>
      ) : (
        <>
          <details className="text-xs text-cesa-mute">
            <summary className="cursor-pointer text-cesa-ink">{s.slackGuideTitle}</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 select-text">
              {s.slackSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
          <TextField
            type="password"
            value={appToken}
            onChange={(e) => setAppToken(e.target.value)}
            placeholder={s.slackAppToken}
          />
          <TextField
            type="password"
            value={userToken}
            onChange={(e) => setUserToken(e.target.value)}
            placeholder={s.slackUserToken}
          />
          <Button
            disabled={busy || !appToken.trim() || !userToken.trim()}
            onClick={async () => {
              if (await run(() => window.api.accounts.connectSlack(appToken, userToken))) {
                setAppToken('')
                setUserToken('')
              }
            }}
          >
            {busy ? s.connecting : status === 'needs_reconnect' ? s.reconnect : s.connect}
          </Button>
        </>
      )}
      <Footer error={error} />
    </Frame>
  )
}

function GoogleCard({ feature }: { feature: GoogleFeature }): React.JSX.Element {
  const state = useAppStore((st) => st.state)
  const status = state?.accounts[feature].status ?? 'disconnected'
  const hasCreds = state?.googleHasCredentials ?? false
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const { busy, error, run } = useAction()
  const showForm = !hasCreds || editing
  const connectLabel = feature === 'gmail' ? s.gmailConnect : s.calendarConnect

  return (
    <Frame source={feature} status={status}>
      {status === 'connected' ? (
        <Button variant="ghost" onClick={() => window.api.accounts.disconnect(feature)}>
          {s.disconnect}
        </Button>
      ) : showForm ? (
        <>
          <p className="text-xs text-cesa-mute">{s.googleHelp}</p>
          <TextField
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={s.googleClientId}
          />
          <TextField
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={s.googleClientSecret}
          />
          <Button
            disabled={busy || !clientId.trim()}
            onClick={async () => {
              const ok = await run(() =>
                window.api.accounts.saveGoogleCredentials(clientId, clientSecret)
              )
              if (ok) {
                setClientId('')
                setClientSecret('')
                setEditing(false)
              }
            }}
          >
            {s.save}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-cesa-mute">
            {feature === 'gmail' ? s.gmailHelp : s.googleBrowser}
          </p>
          {feature === 'gmail' && <p className="text-xs text-cesa-mute">{s.gmailTestMode}</p>}
          <div className="flex items-center gap-2">
            <Button
              disabled={busy}
              onClick={() => run(() => window.api.accounts.connectGoogle(feature))}
            >
              {busy ? s.connecting : status === 'needs_reconnect' ? s.reconnect : connectLabel}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              {s.editCredentials}
            </Button>
          </div>
        </>
      )}
      <Footer error={error} />
    </Frame>
  )
}

export function Accounts(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <ClickUpCard />
      <GoogleCard feature="calendar" />
      <GoogleCard feature="gmail" />
      <SlackCard />
    </div>
  )
}
