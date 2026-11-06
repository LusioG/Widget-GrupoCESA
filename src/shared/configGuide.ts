import { MAX_CALENDAR_DAYS } from './calendarWindow'
import { OPACITY_RANGE, PANEL_WIDTH_RANGE, SCALE_RANGE } from './settingsSchema'

export const CONFIG_FILE_NAME = 'config.json'
export const CONFIG_ERROR_FILE_NAME = 'config-error.txt'
export const GUIDE_FILE_NAME = 'CONFIGURAR.md'

// The guide an AI assistant (Claude) reads to configure the widget for someone. The app writes it
// next to the config file (as CONFIGURAR.md and CLAUDE.md) and the settings can copy it. The same
// text is kept in docs/CONFIGURAR.md (a test keeps both equal).
export const CONFIG_GUIDE = `# Configurar el widget de Grupo CESA con Claude

Esta carpeta es la de datos del widget (\`%APPDATA%\\widget\`). Si estás leyendo esto como
asistente: puedes cambiar los ajustes del widget editando **\`${CONFIG_FILE_NAME}\`**, en esta misma carpeta.
El widget lo vigila y aplica los cambios en pocos segundos, sin reiniciar.

## Cómo hacerlo

1. Lee \`${CONFIG_FILE_NAME}\`: contiene todos los ajustes actuales.
2. Cambia solo los valores que pidió la persona y guarda el archivo como JSON válido
   (el campo \`_ayuda\` se ignora; no inventes claves nuevas).
3. Espera unos 3 segundos y vuelve a leer \`${CONFIG_FILE_NAME}\`: si el cambio se aplicó, el widget lo reescribe
   ordenado. Si algún valor no era válido, **no se aplica nada** y el motivo queda en
   \`${CONFIG_ERROR_FILE_NAME}\` (esta misma carpeta). Corrígelo y guarda de nuevo.

## Claves

Las listas se reemplazan completas (no se combinan).

| Clave | Valores | Qué hace |
|---|---|---|
| \`widget.mode\` | \`"popup"\` o \`"tab"\` | Círculo flotante o solapa vertical pegada al borde |
| \`widget.side\` | \`"left"\` o \`"right"\` | Borde de la solapa |
| \`widget.tabPos\` | 0 a 1 | Altura de la solapa (0 arriba, 1 abajo) |
| \`widget.scale\` | ${SCALE_RANGE.min} a ${SCALE_RANGE.max} | Tamaño del widget |
| \`widget.opacity\` | ${OPACITY_RANGE.min} a ${OPACITY_RANGE.max} | Transparencia del widget (1 = opaco) |
| \`panel.scale\` | ${SCALE_RANGE.min} a ${SCALE_RANGE.max} | Tamaño del panel |
| \`panel.width\` | ${PANEL_WIDTH_RANGE.min} a ${PANEL_WIDTH_RANGE.max} (px, a tamaño 100 %) | Ancho del panel |
| \`panel.fullHeight\` | true/false | Panel a toda la altura de la pantalla |
| \`schedule.workStart\`, \`schedule.workEnd\` | \`"HH:MM"\` | Horario laboral (fuera de él no se avisa) |
| \`schedule.workDays\` | lista de 0 a 6 (0 = domingo) | Días laborales |
| \`notifications.enabled\` | true/false | Notificaciones de Windows |
| \`notifications.sound\` | true/false | Sonido de aviso |
| \`notifications.focusFromCalendar\` | true/false | Modo foco durante reuniones |
| \`filters.minLength\` | 0 a 100 | Longitud mínima de un mensaje |
| \`filters.ignoredSenders\` | lista de textos | Remitentes que se ignoran |
| \`filters.importantSenders\` | lista de textos | Remitentes prioritarios (siempre urgentes) |
| \`filters.mutedChannels\` | lista de textos (p. ej. \`"#ventas"\`) | Canales de Slack ignorados (en Ajustes, cada canal es Normal, Urgente o Ignorar) |
| \`filters.importantChannels\` | lista de textos (p. ej. \`"#soporte"\`) | Canales de Slack urgentes: toda mención tuya ahí es urgente. Un canal va en una sola de las dos listas |
| \`followups.waitHours\` | 1 a 720 | Horas de espera antes de un seguimiento |
| \`gmail.labelIds\` | lista de ids (por defecto \`["INBOX"]\`) | Etiquetas de Gmail a vigilar |
| \`gmail.lists\` | lista de \`{"address": "soporte@empresa.com", "name": "Soporte", "urgent": false}\` | Listas de distribución que se siguen (sección propia en el panel); \`urgent\`: todo lo que llega por la lista es urgente |
| \`gmail.listDays\` | 1, 3 o 7 (por defecto 7) | Días hacia atrás en que se ven los correos sin leer de las listas de distribución |
| \`clickup.listIds\` | lista de ids | Listas de ClickUp a vigilar (vacío = todas) |
| \`clickup.dueWindowDays\` | 1 a 90 | Tareas que vencen en los próximos N días |
| \`clickup.minPriority\` | \`"any"\`, \`"normal"\`, \`"high"\`, \`"urgent"\` | Prioridad mínima |
| \`clickup.alwaysShowFlagged\` | true/false | Mostrar urgentes/altas aunque no tengan fecha |
| \`clickup.includeSubtasks\` | true/false | Incluir subtareas |
| \`clickup.ignoredStatuses\` | lista de textos | Estados que se ignoran |
| \`hotkey.enabled\`, \`hotkey.accelerator\` | true/false, p. ej. \`"Control+Alt+P"\` | Atajo global para abrir el panel |
| \`presentation.autoHide\` | true/false | Ocultar el widget en presentaciones |
| \`presentation.hideFromCapture\` | true/false | Ocultarlo en capturas de pantalla |
| \`calendar.daysAhead\` | 1 a ${MAX_CALENDAR_DAYS} | Días de reuniones a mostrar (1 = solo hoy) |
| \`calendar.show\` | \`"all"\`, \`"meets"\`, \`"plain"\` | Todas, solo con videollamada o solo sin ella |
| \`profile.name\` | texto, máx. 40 | Nombre para el saludo |
| \`briefing.enabled\`, \`briefing.time\`, \`briefing.fullHeight\` | true/false, \`"HH:MM"\`, true/false | Resumen diario |
| \`ai.enabled\` | true/false | Resumen escrito con IA (necesita la clave de Gemini, que NO va aquí) |
| \`ai.model\` | texto | Modelo de Gemini |
| \`ai.sections\` | lista con \`"meetings"\`, \`"priorities"\`, \`"nextTasks"\`, \`"yesterday"\`, \`"waiting"\`, \`"mail"\`, \`"lists"\`, \`"since"\` | Qué secciones lleva el resumen (\`mail\`: últimos correos; \`lists\`: listas de distribución); lo que se quita no se envía a la IA |
| \`ai.extras\` | hasta 10 textos de 120 caracteres | Pedidos de enfoque para la IA (ver abajo) |
| \`ai.mail\` | \`"counts"\`, \`"titles"\` o \`"people"\` (por defecto \`"counts"\`) | Qué lee la IA de tus correos: solo cuántos hay, el asunto, o el asunto y quién lo mandó. Nunca el cuerpo |
| \`ai.lists\` | \`"counts"\`, \`"titles"\` o \`"people"\` (por defecto \`"counts"\`) | Lo mismo para las listas de distribución: cantidades, nombre de la lista y asuntos, o además quién escribió |
| \`ai.slack\` | \`"counts"\`, \`"titles"\` o \`"people"\` (por defecto \`"counts"\`) | Lo mismo para Slack: cantidades, el texto de las menciones y mensajes directos, o además quién los escribió |
| \`onboardingDone\` | true/false | Si ya se mostró la bienvenida |

## Sobre \`ai.extras\`

Un extra solo cambia cómo se cuenta (un enfoque o un estilo): no trae datos nuevos. La IA habla de lo
que le llega de las secciones activas de \`ai.sections\`, y de cada fuente solo lo que permitan
\`ai.mail\`, \`ai.lists\` y \`ai.slack\`. Para que el resumen hable de los últimos correos o de las listas hay
que dejar las secciones \`"mail"\` y \`"lists"\` en \`ai.sections\`, y subir su nivel de \`"counts"\` a
\`"titles"\` si se quieren los asuntos. Los extras no sirven para pedir esos datos.

## Lo que NO se puede configurar por archivo

Las claves y cuentas se escriben en el widget (Ajustes → Cuentas), nunca en este archivo ni en la
conversación, porque van cifradas y no deben pasar por un chat:

- Conexión de Slack: la persona pulsa «Conectar con Slack» en Ajustes → Cuentas y autoriza en el navegador. Solo si ese botón no está disponible se pega a mano un token de usuario (\`xoxp-…\`, con los permisos \`search:read\`, \`channels:read\`, \`groups:read\`,
  \`im:read\`, \`mpim:read\` y \`users:read\`). El widget consulta Slack cada minuto.
- Token de ClickUp.
- Client ID y secret de Google, y el inicio de sesión de Google (se autoriza en el navegador).
- Clave de Gemini.

Si te piden conectar una cuenta, explica los pasos de la persona en Ajustes → Cuentas y pídele que
pegue ella misma el token allí.
`
