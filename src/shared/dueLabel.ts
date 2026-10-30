import { dayOffset } from './calendarWindow'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

// "vie 31 oct" (the year only when it is not the current one).
export function shortDate(at: number, now: number): string {
  const d = new Date(at)
  const year = d.getFullYear() === new Date(now).getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`
}

// A due date in words, always with the date: "vence hoy · jue 29 oct", "vencida · lun 27 oct".
export function dueLabel(dueAt: number, now: number): string {
  const days = dayOffset(dueAt, now)
  const date = shortDate(dueAt, now)
  if (days < 0) return `vencida · ${date}`
  if (days === 0) return `vence hoy · ${date}`
  if (days === 1) return `vence mañana · ${date}`
  return `vence el ${date}`
}
