import type { Signal, ThreadView } from '../shared/types'
import { cleanMessageText } from './connectors/gmail/body'

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
      movedFrom: now + 2 * HOUR, // shows the "Atrasada · antes …" tag in the demo
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
      sender: 'Ana Pérez',
      channel: '#ventas',
      urgency: 0.6
    },
    {
      id: 'slack:fake-2',
      source: 'slack',
      kind: 'dm',
      title: '¿Tienes un minuto? Necesito que revises algo del servidor',
      body: 'Mensaje directo',
      url: 'https://slack.com',
      occurredAt: now - 45 * MIN,
      sender: 'Luis Gómez',
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
    },
    // Distribution lists: one conversation each. "Soporte" is marked urgent (see FAKE_LISTS).
    {
      id: 'gmail:list:18fa11aa11aa11aa:m4',
      source: 'gmail',
      kind: 'email',
      title: 'Caída del sistema en la sede norte',
      body: 'Ana Pérez · Desde las 9:00 no podemos facturar, ¿alguien puede revisar el servidor?',
      url: 'https://mail.google.com/mail/u/0/#all/18fa11aa11aa11aa',
      occurredAt: now - 12 * MIN,
      sender: 'Ana Pérez <ana@sedenorte.com> | Luis Gómez <luis@cesa.com>',
      list: { address: 'soporte@cesa.com', name: 'Soporte CESA' },
      threadId: '18fa11aa11aa11aa',
      unread: 3
    },
    {
      id: 'gmail:list:18fa22bb22bb22bb:m2',
      source: 'gmail',
      kind: 'email',
      title: 'Propuesta para el cliente de Córdoba',
      body: 'Marta Díaz · Les paso el borrador de la propuesta, díganme si ajustamos los plazos.',
      url: 'https://mail.google.com/mail/u/0/#all/18fa22bb22bb22bb',
      occurredAt: now - 3 * HOUR,
      sender: 'Marta Díaz <marta@cesa.com>',
      list: { address: 'ventas@cesa.com', name: 'Ventas' },
      threadId: '18fa22bb22bb22bb',
      unread: 1
    }
  ]
}

// The lists of the demo, in the settings of the (isolated) demo profile.
export const FAKE_LISTS = [
  { address: 'soporte@cesa.com', name: 'Soporte CESA', urgent: true },
  { address: 'ventas@cesa.com', name: 'Ventas', urgent: false }
]

const ME = { name: 'Luciano', address: 'luciano@grupocesa.net' }
const ANA = { name: 'Ana Pérez', address: 'ana@sedenorte.com' }
const LUIS = { name: 'Luis Gómez', address: 'luis@cesa.com' }
const MARTA = { name: 'Marta Díaz', address: 'marta@cesa.com' }

// A message as Gmail's plain text gives it for a Google Group (text, a link to a document, the
// signature with its logos, and the footer of the group). It goes through the same cleaning as a
// real one, so the demo shows what a real conversation will look like.
const RAW_LONG_MESSAGE = [
  'Hola, chicos!!',
  '',
  'Ya está disponible Argos, el nuevo servidor de producción en AWS.',
  'El objetivo de esta instancia es migrar e implementar los entornos productivos (webchat,',
  'context, etc) que actualmente tenemos alojados en otros proveedores.',
  '',
  'Necesito que cada uno pruebe el acceso y me confirme antes del viernes:',
  '',
  '   1. Conectarse a la tailnet TheCodigoHub desde Tailscale.',
  '   2. Abrir PowerShell y ejecutar: ssh gcs@argos (las pass ya se encuentran en el vault).',
  '   3. Una vez dentro, verificar: whoami -> debe devolver gcs; docker ps para ver los nodos.',
  '   4. Salir con exit.',
  '',
  'Si funciona, respondan «Argos OK». Si falla, envíen el error completo.',
  '',
  'Importante: gcs tiene permisos equivalentes a root en producción.',
  'La guía paso a paso está acá <https://docs.google.com/document/d/1argos-guia> y el',
  'inventario en https://drive.google.com/drive/folders/9argos.',
  '',
  'Si tienen problemas de conexión, revisen que estén en la tailnet correcta.',
  '',
  'Gracias!',
  '',
  '*[image: GrupoCESA] <https://grupocesa.net/>Pablo CalvoLíder de Ingeniería',
  'y Desarrollo(+54 9 11 6841-6550Whatsapp +54 9 11 2337-7926Comunicaciones',
  'unificadas,conversaciones inteligentes.www.grupocesa.net',
  '<https://grupocesa.net/>[image: LinkedIn GrupoCESA]',
  '<https://linkedin.com/company/grupocesa> [image: Instagram GrupoCESA]',
  '<https://instagram.com/grupo.cesa/>*',
  '',
  '--',
  'Has recibido este mensaje porque estás suscrito al grupo "Desarrollo" de Grupos de Google.',
  'Para cancelar la suscripción a este grupo y dejar de recibir sus mensajes, envía un correo',
  'electrónico a desarrollo+unsubscribe@grupocesa.net.',
  'Para ver este debate, visita https://groups.google.com/a/grupocesa.net/d/msgid/desarrollo/abc.'
].join('\n')

// A message as the sender's program leaves it: the lines are cut in the middle of the sentences,
// and a bold word is written with asterisks.
const RAW_CUT_MESSAGE = [
  'Buenas, voy a hacer unas pequeñas pruebas de migracion de zoho desk a',
  'zammad, sobretodo ver si puedo armar la skill para cuando toque hacer la',
  'migracion,',
  'Tengo algo de tiempo para encararlo y se que ustedes estan a full con proyectos, asique les comento las novedades de avance por aca.',
  '',
  'Ojo: *no tocar* el servidor de producción hasta que lo confirme.',
  '',
  'Saludos !',
  '--',
  'Has recibido este mensaje porque estás suscrito al grupo "Desarrollo" de Grupos de Google.',
  'Para ver este debate, visita https://groups.google.com/a/grupocesa.net/d/msgid/desarrollo/abc.'
].join('\n')

// A reply cut at 73 characters, the last cut right at the edge (before "lo").
const RAW_CUT_REPLY = [
  'Dale guiidote, anda avisando. Pruébenlo internamente. Si todo sale ok, la',
  'semana que viene nos juntamos y le damos vida para que los chicos de Omni',
  'lo puedan testear.'
].join('\n')

// The conversations the demo opens, so the chat window can be seen without Gmail.
export function buildFakeThread(threadId: string, now: number): ThreadView | null {
  const gmailUrl = `https://mail.google.com/mail/u/0/#all/${threadId}`
  if (threadId === '18fa11aa11aa11aa') {
    return {
      threadId,
      subject: 'Caída del sistema en la sede norte',
      list: { address: 'soporte@cesa.com', name: 'Soporte CESA' },
      gmailUrl,
      messages: [
        {
          id: 'm0',
          from: { name: 'Pablo Calvo', address: 'pablo@grupocesa.net' },
          at: now - 30 * HOUR,
          ...cleanMessageText(RAW_LONG_MESSAGE),
          attachments: [
            { name: 'Guia-acceso-Argos.pdf', size: 1_258_291, mime: 'application/pdf' },
            { name: 'inventario-servidores.xlsx', size: 84_300, mime: 'application/vnd.ms-excel' }
          ],
          mine: false,
          unread: false
        },
        {
          id: 'm0b',
          from: { name: 'Guido Lapiy', address: 'guido@grupocesa.net' },
          at: now - 28 * HOUR,
          ...cleanMessageText(RAW_CUT_MESSAGE),
          mine: false,
          unread: false
        },
        {
          id: 'm0c',
          from: { name: 'Pablo Calvo', address: 'pablo@grupocesa.net' },
          at: now - 27 * HOUR,
          ...cleanMessageText(RAW_CUT_REPLY),
          replyTo: {
            name: 'Guido Lapiy',
            snippet: 'Buenas, voy a hacer unas pequeñas pruebas de migracion de zoho desk a zammad, sobretodo…'
          },
          mine: false,
          unread: false
        },
        {
          id: 'm1',
          from: ANA,
          at: now - 26 * HOUR,
          text: 'Buen día equipo. Desde las 9:00 no podemos facturar, ¿alguien puede revisar el servidor?\n\nGracias.',
          mine: false,
          unread: false
        },
        {
          id: 'm2',
          from: LUIS,
          at: now - 25 * HOUR,
          text: 'Lo estoy mirando. Parece un problema con la base de datos.',
          mine: false,
          unread: false,
          replyTo: { name: ANA.name, snippet: 'Desde las 9:00 no podemos facturar, ¿alguien puede revisar…' }
        },
        {
          id: 'm3',
          from: ME,
          at: now - 25 * HOUR + 10 * MIN,
          text: 'Yo reinicio el servicio y les aviso.',
          mine: true,
          unread: false,
          replyTo: { name: LUIS.name, snippet: 'Lo estoy mirando. Parece un problema con la base de datos.' }
        },
        {
          id: 'm4',
          from: ANA,
          at: now - 40 * MIN,
          text: 'Volvió a pasar esta mañana, y ahora también falla el módulo de cobranzas.',
          mine: false,
          unread: true,
          replyTo: { name: ME.name, snippet: 'Yo reinicio el servicio y les aviso.' }
        },
        {
          id: 'm5',
          from: LUIS,
          at: now - 12 * MIN,
          text: 'Confirmado: se llenó el disco del servidor. Libero espacio ahora y les cuento.',
          mine: false,
          unread: true,
          replyTo: { name: ANA.name, snippet: 'Volvió a pasar esta mañana, y ahora también falla el módulo…' }
        }
      ]
    }
  }
  if (threadId === '18fa22bb22bb22bb') {
    return {
      threadId,
      subject: 'Propuesta para el cliente de Córdoba',
      list: { address: 'ventas@cesa.com', name: 'Ventas' },
      gmailUrl,
      messages: [
        {
          id: 'm1',
          from: MARTA,
          at: now - 3 * HOUR,
          text: 'Les paso el borrador de la propuesta, díganme si ajustamos los plazos.',
          mine: false,
          unread: true
        }
      ]
    }
  }
  return null
}
