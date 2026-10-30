// Global shortcut written the way Electron expects it, e.g. "Control+Alt+P".
const KEY =
  '(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Up|Down|Left|Right|Enter|Tab|Home|End|PageUp|PageDown|Insert|Delete)'
const ACCELERATOR = new RegExp(`^(?:Control\\+)?(?:Alt\\+)?(?:Shift\\+)?${KEY}$`)

export const DEFAULT_ACCELERATOR = 'Control+Alt+P'

// Needs Control or Alt: Shift alone (or no modifier) would hijack normal typing everywhere.
export function isValidAccelerator(value: string): boolean {
  return ACCELERATOR.test(value) && /^(?:Control|Alt)/.test(value)
}

type KeyEventLike = {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

const NAMED: Record<string, string> = {
  Space: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Enter',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Delete: 'Delete'
}

// Builds the accelerator from a key press, or null while it is not a usable combination yet
// (only modifiers so far, no Control/Alt, or a key we cannot register).
export function acceleratorFromEvent(e: KeyEventLike): string | null {
  if (e.metaKey || !(e.ctrlKey || e.altKey)) return null
  let key: string | undefined
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5)
  else if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(e.code)) key = e.code
  else key = NAMED[e.code]
  if (!key) return null
  const parts = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', key]
  const value = parts.filter(Boolean).join('+')
  return isValidAccelerator(value) ? value : null
}

// "Control+Alt+P" -> "Ctrl + Alt + P"
export function formatAccelerator(value: string): string {
  return value
    .replace(/Control/g, 'Ctrl')
    .split('+')
    .join(' + ')
}
