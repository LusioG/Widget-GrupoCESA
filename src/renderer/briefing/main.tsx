import '@renderer/assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { Briefing } from './Briefing'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Briefing />
    </ErrorBoundary>
  </StrictMode>
)
