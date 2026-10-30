// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextField } from '../src/renderer/components/ui'
import { TimeField } from '../src/renderer/components/ui'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// The real app saves a setting in the main process and the new value comes back a moment later
// through the state. This host imitates that round trip.
function Host({ Field, delayMs }: { Field: 'old' | 'new'; delayMs: number }): React.JSX.Element {
  const [saved, setSaved] = useState('09:00')
  const commit = (value: string): void => {
    setTimeout(() => setSaved(value), delayMs)
  }
  return Field === 'old' ? (
    // How the field was written before: controlled straight from the saved value.
    <TextField
      type="time"
      aria-label="hora"
      value={saved}
      onChange={(e) => e.target.value && commit(e.target.value)}
    />
  ) : (
    <TimeField label="hora" value={saved} onCommit={commit} />
  )
}

describe('time field', () => {
  it('the old field snaps back while the save is on its way', () => {
    vi.useFakeTimers()
    render(<Host Field="old" delayMs={50} />)
    const input = screen.getByLabelText('hora') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10:30' } })
    // Controlled by a value that has not come back yet: React puts the old time back.
    expect(input.value).toBe('09:00')
    vi.useRealTimers()
  })

  it('the new field keeps what is typed while the save is on its way, then agrees with it', () => {
    vi.useFakeTimers()
    render(<Host Field="new" delayMs={50} />)
    const input = screen.getByLabelText('hora') as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: '10:30' } })
    expect(input.value).toBe('10:30')
    act(() => void vi.advanceTimersByTime(60))
    expect(input.value).toBe('10:30')
    vi.useRealTimers()
  })

  it('saves only a complete time, and puts the saved one back if it is left empty', () => {
    const onCommit = vi.fn()
    render(<TimeField label="hora" value="09:00" onCommit={onCommit} />)
    const input = screen.getByLabelText('hora') as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: '' } })
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('')
    fireEvent.blur(input)
    expect(input.value).toBe('09:00')
    fireEvent.change(input, { target: { value: '11:15' } })
    expect(onCommit).toHaveBeenCalledWith('11:15')
  })
})
