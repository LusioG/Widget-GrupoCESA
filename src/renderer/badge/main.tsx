import '@renderer/assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { Badge } from './Badge'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary compact>
      <Badge />
    </ErrorBoundary>
  </StrictMode>
)
