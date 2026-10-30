import '@renderer/assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { Panel } from './Panel'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Panel />
    </ErrorBoundary>
  </StrictMode>
)
