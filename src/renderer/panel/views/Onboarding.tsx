import { useState } from 'react'
import { strings } from '@shared/strings'
import { Button } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/useAppStore'
import { Header } from '../components/Header'
import { Accounts } from './settings/Accounts'
import { General } from './settings/General'
import { Schedule } from './settings/Schedule'

const s = strings.onboarding

export function Onboarding(): React.JSX.Element {
  const [step, setStep] = useState(0)
  const anyConnected = useAppStore((st) =>
    Object.values(st.state?.accounts ?? {}).some((a) => a.status === 'connected')
  )

  return (
    <>
      <Header title={step === 0 ? s.welcomeTitle : s.finishTitle} />
      <div className="cesa-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {step === 0 ? (
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
          <Button onClick={() => setStep(1)}>{anyConnected ? s.next : s.skip}</Button>
        ) : (
          <Button onClick={() => window.api.settings.update({ onboardingDone: true })}>
            {s.finish}
          </Button>
        )}
      </div>
    </>
  )
}
