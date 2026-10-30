import { useState } from 'react'
import { strings } from '@shared/strings'
import { Button } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'
import { Header } from '../components/Header'
import { Accounts } from './settings/Accounts'
import { NameField } from './settings/DailyBriefing'
import { General } from './settings/General'
import { Schedule } from './settings/Schedule'

const s = strings.onboarding

// Steps: 0 your name, 1 accounts, 2 last settings.
export function Onboarding(): React.JSX.Element {
  const [step, setStep] = useState(0)
  const anyConnected = useAppStore((st) =>
    Object.values(st.state?.accounts ?? {}).some((a) => a.status === 'connected')
  )

  return (
    <>
      <Header title={step === 0 ? s.nameTitle : step === 1 ? s.welcomeTitle : s.finishTitle} />
      <div className="cesa-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {step === 0 ? (
          <>
            <p className="text-sm text-cesa-mute">{s.nameText}</p>
            <NameField autoFocus placeholder={s.namePlaceholder} onEnter={() => setStep(1)} />
          </>
        ) : step === 1 ? (
          <>
            <p className="text-sm text-cesa-mute">{s.welcomeText}</p>
            <Accounts />
          </>
        ) : (
          <>
            <General />
            <Schedule />
          </>
        )}
      </div>
      <div className="flex justify-end border-t border-cesa-700 px-4 py-3">
        {step === 0 ? (
          <Button onClick={() => setStep(1)}>{s.next}</Button>
        ) : step === 1 ? (
          <Button onClick={() => setStep(2)}>{anyConnected ? s.next : s.skip}</Button>
        ) : (
          <Button onClick={() => window.api.settings.update({ onboardingDone: true })}>
            {s.finish}
          </Button>
        )}
      </div>
    </>
  )
}
