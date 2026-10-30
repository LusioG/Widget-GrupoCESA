import { tabExtraRows } from '../../shared/badgeState'
import { onStateChange } from '../appState'
import { getSettings } from '../settingsStore'
import { applyLayout } from './apply'
import { getTabRows, setTabRows } from './appearance'

// The vertical tab stretches when there are urgent items or meetings to show as circles, and
// shrinks back to its usual size when there are none.
export function startTabRows(): void {
  const update = (rows: number): void => {
    if (rows === getTabRows()) return
    setTabRows(rows)
    if (getSettings().widget.mode === 'tab') applyLayout()
  }
  onStateChange((state) => update(tabExtraRows(state.badge, state.focus.active)))
}
