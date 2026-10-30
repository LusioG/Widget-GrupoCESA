import type { Signal } from '../shared/types'

const MIN = 60_000
const HOUR = 60 * MIN

// Phase 1 only: fake signals relative to "now" so meetings always look upcoming.
export function buildFakeSignals(now: number): Signal[] {
  return [
    {
      id: 'calendar:fake-1',
      source: 'calendar',
      kind: 'meeting',
      title: 'Daily de equipo',
      url: 'https://calendar.google.com',
      occurredAt: now,
      startsAt: now + 7 * MIN,
      endsAt: now + 37 * MIN,
      meetingUrl: 'https://meet.google.com'
    },
    {
      id: 'calendar:fake-2',
      source: 'calendar',
      kind: 'meeting',
      title: 'Revisión de presupuesto',
      url: 'https://calendar.google.com',
      occurredAt: now,
      startsAt: now + 3 * HOUR,
      endsAt: now + 4 * HOUR,
      meetingUrl: 'https://zoom.us'
    },
    {
      id: 'clickup:fake-1',
      source: 'clickup',
      kind: 'task',
      title: 'Enviar propuesta al cliente',
      url: 'https://app.clickup.com',
      occurredAt: now - 5 * HOUR,
      dueAt: now - 2 * HOUR,
      urgency: 0.9
    },
    {
      id: 'slack:fake-1',
      source: 'slack',
      kind: 'mention',
      title: '@luciano ¿puedes revisar el informe de ventas?',
      body: '#ventas',
      url: 'https://slack.com',
      occurredAt: now - 20 * MIN,
      urgency: 0.6
    },
    {
      id: 'slack:fake-2',
      source: 'slack',
      kind: 'dm',
      title: 'Mensaje directo: ¿tienes un minuto?',
      url: 'https://slack.com',
      occurredAt: now - 45 * MIN,
      urgency: 0.5
    },
    {
      id: 'gmail:fake-1',
      source: 'gmail',
      kind: 'email',
      title: 'Contrato de servicio: firma pendiente',
      body: 'Legal · hace 2 h',
      url: 'https://mail.google.com',
      occurredAt: now - 2 * HOUR,
      urgency: 0.4
    },
    {
      id: 'clickup:fake-2',
      source: 'clickup',
      kind: 'task',
      title: 'Actualizar tablero de indicadores',
      url: 'https://app.clickup.com',
      occurredAt: now - 24 * HOUR,
      dueAt: now + 6 * HOUR,
      urgency: 0.3
    }
  ]
}
