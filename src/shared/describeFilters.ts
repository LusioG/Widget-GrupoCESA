import type { ClickUpMinPriority, Settings } from './types'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

const MIN_PRIORITY_TEXT: Record<Exclude<ClickUpMinPriority, 'any'>, string> = {
  normal: 'Normal o superior',
  high: 'Alta o superior',
  urgent: 'Urgente'
}

// The ClickUp rules in one plain sentence, so it is clear what will (and will not) be shown.
export function describeClickUpRule(cfg: Settings['clickup'], totalLists?: number): string {
  const scope =
    cfg.listIds.length === 0
      ? 'todas tus listas'
      : totalLists !== undefined
        ? `${cfg.listIds.length} de ${plural(totalLists, 'lista', 'listas')}`
        : plural(cfg.listIds.length, 'lista', 'listas')

  const when = `que estén vencidas o venzan en los próximos ${plural(cfg.dueWindowDays, 'día', 'días')}`
  const flagged = cfg.alwaysShowFlagged
    ? ', o que tengan prioridad Urgente o Alta aunque no tengan fecha'
    : ''

  const parts = [`Verás tus tareas asignadas en ${scope} ${when}${flagged}.`]
  if (cfg.minPriority !== 'any') {
    parts.push(`Solo con prioridad ${MIN_PRIORITY_TEXT[cfg.minPriority]}.`)
  }
  if (cfg.ignoredStatuses.length > 0) {
    parts.push(`Sin las que estén en: ${cfg.ignoredStatuses.join(', ')}.`)
  }
  parts.push(cfg.includeSubtasks ? 'Incluye subtareas.' : 'Sin subtareas.')
  return parts.join(' ')
}
