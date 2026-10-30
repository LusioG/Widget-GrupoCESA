// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { strings } from '@shared/strings'

function Boom(): React.JSX.Element {
  throw new Error('render failed')
}

beforeEach(() => {
  // React reports caught render errors on the console; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>todo bien</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('todo bien')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a clear message and a retry button instead of a blank window when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(strings.errors.title)).toBeTruthy()
    expect(screen.getByText(strings.errors.body)).toBeTruthy()
    expect(screen.getByRole('button', { name: strings.errors.retry })).toBeTruthy()
  })

  it('does not show technical details to the user', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.queryByText(/render failed/)).toBeNull()
  })

  it('the retry button runs the retry action', () => {
    const onRetry = vi.fn()
    render(
      <ErrorBoundary onRetry={onRetry}>
        <Boom />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: strings.errors.retry }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('the tiny widget gets a compact "!" button that retries', () => {
    const onRetry = vi.fn()
    render(
      <ErrorBoundary compact onRetry={onRetry}>
        <Boom />
      </ErrorBoundary>
    )
    const button = screen.getByTitle(strings.errors.retry)
    expect(button.textContent).toBe('!')
    expect(screen.queryByText(strings.errors.title)).toBeNull() // no room for a message
    fireEvent.click(button)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('only the failing part is replaced; siblings outside the boundary keep working', () => {
    render(
      <div>
        <p>fuera</p>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </div>
    )
    expect(screen.getByText('fuera')).toBeTruthy()
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
