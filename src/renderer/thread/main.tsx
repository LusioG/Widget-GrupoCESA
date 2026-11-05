import '@renderer/assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { Thread } from './Thread'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Thread />
    </ErrorBoundary>
  </StrictMode>
)
