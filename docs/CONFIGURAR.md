# Configurar el widget de Grupo CESA con Claude

Esta carpeta es la de datos del widget (`%APPDATA%\widget`). Si estás leyendo esto como
asistente: puedes cambiar los ajustes del widget editando **`config.json`**, en esta misma carpeta.
El widget lo vigila y aplica los cambios en pocos segundos, sin reiniciar.

## Cómo hacerlo

1. Lee `config.json`: contiene todos los ajustes actuales.
2. Cambia solo los valores que pidió la persona y guarda el archivo como JSON válido
   (el campo `_ayuda` se ignora; no inventes claves nuevas).
3. Espera unos 3 segundos y vuelve a leer `config.json`: si el cambio se aplicó, el widget lo reescribe
   ordenado. Si algún valor no era válido, **no se aplica nada** y el motivo queda en
   `config-error.txt` (esta misma carpeta). Corrígelo y guarda de nuevo.

## Claves

Las listas se reemplazan completas (no se combinan).

| Clave | Valores | Qué hace |
|---|---|---|
| `widget.mode` | `"popup"` o `"tab"` | Círculo flotante o solapa vertical pegada al borde |
| `widget.side` | `"left"` o `"right"` | Borde de la solapa |
| `widget.tabPos` | 0 a 1 | Altura de la solapa (0 arriba, 1 abajo) |
| `widget.scale` | 0.8 a 1.4 | Tamaño del widget |
| `widget.opacity` | 0.35 a 1 | Transparencia del widget (1 = opaco) |
| `panel.scale` | 0.8 a 1.4 | Tamaño del panel |
| `panel.width` | 360 a 760 (px, a tamaño 100 %) | Ancho del panel |
| `panel.fullHeight` | true/false | Panel a toda la altura de la pantalla |
| `schedule.workStart`, `schedule.workEnd` | `"HH:MM"` | Horario laboral (fuera de él no se avisa) |
| `schedule.workDays` | lista de 0 a 6 (0 = domingo) | Días laborales |
| `notifications.enabled` | true/false | Notificaciones de Windows |
| `notifications.sound` | true/false | Sonido de aviso |
| `notifications.focusFromCalendar` | true/false | Modo foco durante reuniones |
| `filters.minLength` | 0 a 100 | Longitud mínima de un mensaje |
| `filters.ignoredSenders` | lista de textos | Remitentes que se ignoran |
| `filters.importantSenders` | lista de textos | Remitentes prioritarios (siempre urgentes) |
| `filters.mutedChannels` | lista de textos (p. ej. `"#ventas"`) | Canales de Slack silenciados |
| `filters.importantChannels` | lista de textos (p. ej. `"#soporte"`) | Canales de Slack donde toda mención tuya es urgente |
| `followups.waitHours` | 1 a 720 | Horas de espera antes de un seguimiento |
| `gmail.labelIds` | lista de ids (por defecto `["INBOX"]`) | Etiquetas de Gmail a vigilar |
| `gmail.lists` | lista de `{"address": "soporte@empresa.com", "name": "Soporte", "urgent": false}` | Listas de distribución que se siguen (sección propia en el panel); `urgent`: todo lo que llega por la lista es urgente |
| `gmail.listDays` | 1, 3 o 7 (por defecto 7) | Días hacia atrás en que se ven los correos sin leer de las listas de distribución |
| `clickup.listIds` | lista de ids | Listas de ClickUp a vigilar (vacío = todas) |
| `clickup.dueWindowDays` | 1 a 90 | Tareas que vencen en los próximos N días |
| `clickup.minPriority` | `"any"`, `"normal"`, `"high"`, `"urgent"` | Prioridad mínima |
| `clickup.alwaysShowFlagged` | true/false | Mostrar urgentes/altas aunque no tengan fecha |
| `clickup.includeSubtasks` | true/false | Incluir subtareas |
| `clickup.ignoredStatuses` | lista de textos | Estados que se ignoran |
| `hotkey.enabled`, `hotkey.accelerator` | true/false, p. ej. `"Control+Alt+P"` | Atajo global para abrir el panel |
| `presentation.autoHide` | true/false | Ocultar el widget en presentaciones |
| `presentation.hideFromCapture` | true/false | Ocultarlo en capturas de pantalla |
| `calendar.daysAhead` | 1 a 30 | Días de reuniones a mostrar (1 = solo hoy) |
| `calendar.show` | `"all"`, `"meets"`, `"plain"` | Todas, solo con videollamada o solo sin ella |
| `profile.name` | texto, máx. 40 | Nombre para el saludo |
| `briefing.enabled`, `briefing.time`, `briefing.fullHeight` | true/false, `"HH:MM"`, true/false | Resumen diario |
| `ai.*` | (ver el archivo) | Opciones del resumen con IA; la clave de Gemini NO va aquí |
| `onboardingDone` | true/false | Si ya se mostró la bienvenida |

## Lo que NO se puede configurar por archivo

Las claves y cuentas se escriben en el widget (Ajustes → Cuentas), nunca en este archivo ni en la
conversación, porque van cifradas y no deben pasar por un chat:

- Token de Slack (`xoxp-…`, con los permisos de usuario `search:read`, `channels:read`, `groups:read`,
  `im:read`, `mpim:read` y `users:read`; el widget consulta Slack cada 60 s).
- Token de ClickUp.
- Client ID y secret de Google, y el inicio de sesión de Google (se autoriza en el navegador).
- Clave de Gemini.

Si te piden conectar una cuenta, explica los pasos de la persona en Ajustes → Cuentas y pídele que
pegue ella misma el token allí.
