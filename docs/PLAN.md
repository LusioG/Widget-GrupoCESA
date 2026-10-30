# Plan de implementación: Widget flotante de pendientes (Electron)

> Documento para Claude Code. Léelo completo antes de escribir código. Trabaja **una fase a la vez**, y al terminar cada fase detente, resume lo hecho y espera confirmación antes de pasar a la siguiente.

**Alcance de esta versión:** el widget es **de solo lectura**. Muestra y ordena lo que necesita atención, pero **no crea ni modifica nada** en ClickUp, Slack ni Gmail. La **IA se usa únicamente para el resumen diario**.

---

## 1. Qué estamos construyendo

Una app de escritorio (Windows y macOS) que muestra un **widget flotante siempre encima de todas las ventanas**. El widget muestra un icono/badge con un número (cantidad de pendientes o novedades). Al hacer click se abre un panel con:

- Reuniones próximas (con botón "Unirse").
- Lista de pendientes y novedades, ordenada por reglas: tareas de ClickUp asignadas o por vencer, menciones y mensajes directos de Slack, correos relevantes de Gmail.
- Acciones por elemento: **abrir el original**, **posponer**, **descartar**.

Además:
- Se inicia solo al prender la PC.
- Muestra un **resumen diario** la primera vez que el usuario está activo cada día (único lugar donde se usa IA).
- Tiene un engranaje de **Ajustes** donde se vinculan las cuentas (Gmail, Slack, ClickUp, Calendar).

### Principios que no se negocian

1. **Solo lectura.** La app no crea, edita ni elimina tareas, mensajes ni correos en ningún servicio. Pedir solo permisos de lectura donde la API lo permita.
2. **La IA solo participa en el resumen diario.** Todo lo demás (filtros, orden, alertas, badge) se resuelve con reglas y código normal.
3. **Funciona sin IA.** Si no hay API key, no hay internet o se agotó la cuota, el resumen se genera por plantilla y reglas.
4. **Privacidad primero.** Enviar al LLM solo lo mínimo necesario. Nada de secretos en archivos planos.
5. **Un solo formato interno (`Signal`).** Todos los conectores producen el mismo tipo; agregar uno nuevo no debe tocar el resto.
6. **Que no moleste.** Pocas notificaciones, filtradas, respetando horario laboral.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| App de escritorio | Electron + TypeScript (strict) |
| Build | `electron-vite` |
| UI | React + Tailwind |
| Estado (renderer) | Zustand |
| Base local | SQLite con `better-sqlite3` + Drizzle ORM |
| Secretos | `safeStorage` de Electron (o `keytar`), nunca archivos planos |
| Slack | `@slack/bolt` en Socket Mode |
| Google (Gmail, Calendar) | `googleapis` |
| ClickUp | API v2 con `fetch` (solo endpoints de lectura) |
| Validación | `zod` |
| Tests | `vitest` |
| Empaquetado | `electron-builder` + `electron-updater` |
| IA (solo resumen diario) | Interfaz `LLMProvider`; implementación inicial con Gemini (plan gratuito, key del propio usuario) |

> **Importante:** las APIs, scopes, nombres de modelos y cuotas cambian seguido. Antes de implementar cada integración, **consulta la documentación oficial vigente** y verifica scopes, flujo OAuth y nombres de endpoints. No te fíes solo de lo que está escrito aquí.

---

## 3. Estructura del proyecto

```
widget/
├─ src/
│  ├─ main/
│  │  ├─ index.ts                 # entrada, single instance, ciclo de vida
│  │  ├─ tray.ts
│  │  ├─ autostart.ts
│  │  ├─ windows/
│  │  │  ├─ badge.ts              # ventana chica, transparente, alwaysOnTop
│  │  │  └─ panel.ts              # ventana del panel
│  │  ├─ connectors/
│  │  │  ├─ types.ts              # interface Connector (solo lectura)
│  │  │  ├─ clickup/
│  │  │  ├─ calendar/
│  │  │  ├─ slack/
│  │  │  └─ gmail/
│  │  ├─ auth/
│  │  │  ├─ oauth.ts              # PKCE + redirect loopback
│  │  │  └─ secrets.ts            # wrapper de safeStorage
│  │  ├─ engine/
│  │  │  ├─ filters.ts            # reglas: ignorar newsletters, bots, etc.
│  │  │  ├─ ranking.ts            # priorización por reglas
│  │  │  ├─ freeSlots.ts          # huecos libres del calendario
│  │  │  ├─ followups.ts          # "esperando respuesta"
│  │  │  └─ briefing.ts           # arma el resumen diario (reglas + IA opcional)
│  │  ├─ ai/
│  │  │  ├─ provider.ts           # interface LLMProvider
│  │  │  ├─ gemini.ts
│  │  │  ├─ prompts/              # prompt del resumen, versionado en archivo
│  │  │  ├─ redact.ts             # enmascarado de datos sensibles
│  │  │  └─ auditLog.ts           # registro de lo enviado a la IA
│  │  ├─ scheduler.ts             # polling con backoff
│  │  ├─ db/
│  │  │  ├─ schema.ts
│  │  │  └─ migrations/
│  │  └─ ipc/                     # handlers tipados
│  ├─ preload/
│  │  └─ index.ts                 # contextBridge, API mínima y tipada
│  ├─ renderer/
│  │  ├─ badge/
│  │  ├─ panel/
│  │  │  ├─ components/           # ItemCard, MeetingCard, Briefing
│  │  │  ├─ onboarding/
│  │  │  └─ settings/             # Cuentas, Qué vigilar, IA, Horarios, General
│  │  └─ store/
│  └─ shared/
│     ├─ types.ts                 # Signal, InboxItem, Settings
│     └─ ipcChannels.ts
├─ tests/
├─ electron-builder.yml
└─ PLAN.md
```

---

## 4. Modelos de datos centrales

```ts
// shared/types.ts
export type Source = 'slack' | 'gmail' | 'calendar' | 'clickup';

export type Signal = {
  id: string;                 // estable: `${source}:${externalId}`
  source: Source;
  kind: 'mention' | 'dm' | 'email' | 'meeting' | 'task';
  title: string;
  body?: string;
  url: string;                // link al original
  occurredAt: number;
  startsAt?: number;          // reuniones
  endsAt?: number;
  meetingUrl?: string;
  dueAt?: number;             // tareas
  urgency?: number;           // 0..1, calculado por reglas
  raw?: unknown;              // nunca se envía al LLM
};

// Lo que se muestra en el panel: una señal + el estado que le dio el usuario
export type InboxItem = {
  signalId: string;
  status: 'new' | 'seen' | 'snoozed' | 'dismissed';
  snoozedUntil?: number;
  score: number;              // resultado del ranking por reglas
};
```

```ts
// connectors/types.ts
export interface Connector {
  id: Source;
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;          // abre OAuth en el navegador del sistema
  disconnect(): Promise<void>;       // borra token y caché de esa fuente
  sync(): Promise<Signal[]>;         // incremental cuando sea posible, SOLO LECTURA
}
```

```ts
// ai/provider.ts  (único uso de IA: resumen diario)
export interface LLMProvider {
  summarizeBriefing(input: BriefingInput): Promise<BriefingOutput>;
}

// BriefingInput: reuniones de hoy, pendientes ya ordenados por reglas, huecos libres.
// BriefingOutput (validado con zod): { topPriorities: [{ signalId, reason }] (máx. 3), paragraph: string }
```

---

## 5. Fases de implementación

Cada fase tiene **tareas** y **criterios de aceptación**. No avances si no se cumplen.

### Fase 0: Esqueleto del proyecto

**Tareas**
- Inicializar con `electron-vite` (React + TypeScript).
- Configurar Tailwind, ESLint, Prettier, `vitest`.
- `tsconfig` en modo `strict`.
- `contextIsolation: true`, `nodeIntegration: false` en todas las ventanas.
- `app.requestSingleInstanceLock()`: si ya hay una instancia, enfocar y salir.

**Aceptación**
- `npm run dev` abre una ventana de prueba.
- `npm run build` y `npm test` funcionan.
- Abrir la app dos veces no genera dos instancias.

### Fase 1: Ventanas flotantes + datos falsos

**Tareas**
- **Ventana badge:** 48×48, `frame: false`, `transparent: true`, `alwaysOnTop`, `skipTaskbar`, `resizable: false`. Usar `setAlwaysOnTop(true, 'screen-saver')` y `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` donde aplique.
- Que el badge sea **arrastrable** y recuerde su posición (en la DB). Validar que la posición guardada siga dentro de un monitor existente.
- **Ventana panel:** se abre junto al badge al hacer click, se cierra al perder el foco o con Escape. Debe reposicionarse para no salirse de la pantalla.
- Badge con número (o icono de alerta si hay algo urgente) alimentado por **datos falsos**.
- Preload con API tipada (`window.api`), canales definidos en `shared/ipcChannels.ts`.
- Tray con: Abrir panel, Pausar alertas, Ajustes, Salir.

**Aceptación**
- El badge queda encima de otras ventanas y se puede mover.
- El panel se abre/cierra sin errores y no se sale de pantalla.
- Cerrar el panel no cierra la app; solo "Salir" del tray la cierra.

### Fase 2: Persistencia, secretos y Ajustes

**Tareas**
- SQLite + Drizzle con migraciones. Tablas: `settings`, `signals_cache`, `inbox_items`, `ai_audit_log`, `sync_state`.
- `auth/secrets.ts`: guardar/leer/borrar secretos con `safeStorage`. **Nunca** loguear tokens.
- Pantalla de **Ajustes** (engranaje arriba a la derecha del panel) con secciones: Cuentas, Qué vigilar, IA, Notificaciones y horarios, General.
- **Onboarding** al abrir sin cuentas: tarjetas por servicio con botón "Conectar" (aún sin funcionar), cada una saltable, paso final con "Iniciar con el sistema" y horario laboral.
- Inicio automático: `app.setLoginItemSettings({ openAtLogin })` conectado a un interruptor en Ajustes; leer el estado real con `getLoginItemSettings()`.
- En el arranque, mostrar solo el badge y esperar ~10-20 s antes de la primera sincronización.

**Aceptación**
- Los ajustes persisten entre reinicios.
- El interruptor de inicio automático refleja el estado real del sistema.
- Ningún secreto aparece en archivos de la carpeta de datos ni en logs.

### Fase 3: Marco de conectores + ClickUp (solo lectura)

**Tareas**
- Implementar `Connector` y un `scheduler` con polling configurable, backoff exponencial ante errores y pausa cuando el usuario activa "No molestar".
- **ClickUp:** verificar en la documentación vigente qué flujo de autenticación corresponde. Si OAuth exige `client_secret`, **para el MVP personal usar el token personal de API** que el usuario pega en Ajustes (guardado con `safeStorage`).
- **Restricción de solo lectura:** como el token personal técnicamente permite escribir, el cliente de ClickUp debe exponer **únicamente métodos GET**. Agregar un test que falle si aparece cualquier otro método HTTP en ese módulo.
- Traer tareas asignadas al usuario, vencidas y próximas a vencer. Mapear a `Signal`.
- UI de la tarjeta "ClickUp" en Cuentas: estados **Conectado / Desconectado / Requiere reconectar**.
- Elegir qué espacios/listas vigilar.
- Badge y lista del panel muestran datos reales de ClickUp.

**Aceptación**
- Con token válido, el panel lista tareas reales y el badge cuenta las relevantes.
- Con token inválido o revocado, la tarjeta pasa a "Requiere reconectar" sin romper la app.
- Desconectar borra el token y la caché de esa fuente.
- El test de solo lectura pasa.

### Fase 4: Google Calendar

**Tareas**
- OAuth para app de escritorio: **PKCE + redirect a `http://127.0.0.1:<puerto libre>`**. Abrir la autorización en el navegador del sistema.
- Scope mínimo: solo lectura de calendario. Verificar el scope vigente en la documentación.
- Sincronización con `events.list` usando `syncToken` (manejar el caso de token expirado reiniciando la sincronización completa).
- Extraer el link de la reunión de `conferenceData` o, si no existe, de la descripción (Meet, Zoom, Teams).
- `engine/freeSlots.ts`: calcular huecos libres entre reuniones dentro del horario laboral. **Con tests unitarios** (reuniones solapadas, eventos de día completo, eventos cancelados, zonas horarias).
- Tarjeta de reunión con **cuenta regresiva** y botón **Unirse**; 10 minutos antes el badge cambia para destacarla.

**Aceptación**
- Las reuniones del día aparecen con hora y link correctos.
- El botón Unirse abre el link en el navegador.
- Los tests de `freeSlots` pasan.

### Fase 5: Slack (solo lectura)

**Tareas**
- Para uso personal/equipo pequeño: cada usuario crea su propia Slack App; documentar en la UI el paso a paso. **Verificar en la documentación vigente** qué tokens y scopes requiere Socket Mode y la lectura de menciones y mensajes directos. Pedir solo scopes de lectura.
- Escuchar menciones y DMs en tiempo real con Socket Mode (`@slack/bolt`).
- Ignorar mensajes de bots y de canales silenciados.
- Mapear a `Signal` incluyendo el permalink del mensaje.
- Ajustes: elegir qué canales seguir o ignorar.
- Manejar reconexión automática.

**Aceptación**
- Una mención o DM nuevo aparece en el panel en pocos segundos.
- Cortar y restaurar internet no deja la conexión muerta.
- El link abre el mensaje original.

### Fase 6: Gmail (solo lectura)

**Tareas**
- Reutilizar el login de Google de la Fase 4, con un **interruptor separado** para Gmail (el usuario puede activar solo Calendar).
- Scope de solo lectura. Aviso en la UI: la verificación de Google para distribuir públicamente es un tema aparte; para uso personal se usa en modo de prueba.
- Polling cada 1-2 minutos con `history.list` (o equivalente incremental) para traer correos nuevos.
- Leer solo lo necesario: remitente, asunto, fragmento, fecha, link. No descargar adjuntos.
- Filtros de entrada por reglas: ignorar promociones, newsletters (cabecera `List-Unsubscribe`), `no-reply`, notificaciones automáticas.
- Ajustes: qué etiquetas vigilar.

**Aceptación**
- Mails relevantes aparecen como señales; newsletters y promociones no.
- El link abre el hilo en Gmail.

### Fase 7: Motor de reglas y acciones del usuario

**Tareas**
- `engine/filters.ts`: descartar por longitud mínima, remitentes bot, patrones ("gracias", "ok", reacciones), canales silenciados. Configurable.
- `engine/ranking.ts`: puntuar urgencia con reglas simples (mención directa, vencimiento hoy o vencido, remitente o canal marcado como importante, antigüedad). Con tests.
- Acciones en cada elemento: **abrir original**, **posponer** (1 h / mañana / lunes), **descartar**. Persistir todo. Acciones en lote (descartar/posponer varios).
- **Modo foco y No molestar:** respetar horario laboral y silenciar lo no urgente; opcionalmente activar el modo foco en bloques de calendario marcados como "Focus".
- **"Esperando respuesta"** (`engine/followups.ts`): detectar lo que el usuario envió (mail o Slack) y no tuvo respuesta tras X horas/días configurables.

**Aceptación**
- La lista está ordenada y sin ruido evidente.
- Lo descartado no vuelve a aparecer; lo pospuesto reaparece a la hora indicada.
- Los seguimientos aparecen con su antigüedad y se pueden cerrar o posponer.
- Todo esto funciona con la IA completamente desactivada.

### Fase 8: Resumen diario (única función con IA)

**Tareas**
- **Disparo:** guardar `lastBriefingDate`. Mostrarlo **la primera vez del día** cuando el usuario esté activo y dentro del horario laboral (`powerMonitor.getSystemIdleTime()`). Escuchar `powerMonitor` `resume` y desbloqueo de pantalla para PCs que solo se suspenden. Esperar una sincronización antes de generarlo. Opción "Ver resumen" en el tray.
- **Contenido** (breve, 30 segundos de lectura; **no mostrar secciones vacías**): reuniones de hoy con link, top 3 prioridades, pendientes de ayer, esperando respuesta, lo que pasó desde que se fue.
- **Versión sin IA (siempre disponible):** secciones armadas por reglas; las 3 prioridades salen del `ranking.ts` y el texto introductorio de una plantilla.
- **Versión con IA (opcional):** `GeminiProvider.summarizeBriefing()` recibe los datos ya filtrados y ordenados, y devuelve en JSON validado con `zod`: hasta 3 prioridades con una línea de motivo, y un párrafo breve. Si la validación falla: un reintento y luego caer a la versión por reglas.
- **Qué se envía al LLM (por defecto, lo mínimo):** títulos y fechas de reuniones, títulos de tareas de ClickUp, y solo **cantidades** de menciones y correos. Incluir asunto/remitente de Gmail o texto de Slack **solo si el usuario lo activa por fuente** con un aviso claro de privacidad.
- Key de Gemini del propio usuario (BYOK) guardada con `safeStorage`. **Verificar en la documentación vigente** los modelos gratuitos disponibles, sus límites y las condiciones de uso de datos del plan gratuito (el contenido puede usarse para mejorar productos de Google); mostrar ese aviso junto al campo de la key.
- `ai/redact.ts`: enmascarar tokens, contraseñas, tarjetas y documentos de identidad antes de enviar.
- `ai/auditLog.ts`: guardar qué se envió, cuándo y a qué proveedor; pantalla en Ajustes > IA para consultarlo y borrarlo.
- Una sola llamada por resumen. Ante `RESOURCE_EXHAUSTED`, timeout o falta de key: **caer a la versión por reglas** sin errores visibles.
- Prompt en `ai/prompts/briefing.md`, versionado.
- Presentación: **tarjeta desde el badge, sin robar el foco**; se cierra con un click. Acciones: Abrir, Posponer, Descartar.
- Ajustes: activar/desactivar resumen, activar/desactivar IA, hora, días laborales.

**Aceptación**
- Aparece una sola vez por día y no fuera del horario configurado.
- Con IA activada, el resumen incluye motivo por prioridad y un párrafo; sin IA, sale completo por reglas.
- Se puede ver en Ajustes exactamente qué se envió al proveedor.
- Ninguna otra parte de la app llama al LLM.

### Fase 9: Empaquetado y robustez

**Tareas**
- `electron-builder` para Windows y macOS; firma de código si es posible.
- `electron-updater` para actualizaciones automáticas.
- Manejo de errores global: nada de pantallas en blanco; mensajes claros y logs locales sin datos sensibles.
- Pruebas manuales: varios monitores, apps a pantalla completa, suspensión y reanudación, pérdida de internet, token revocado.
- Documentación: README con instalación, cómo crear la Slack App, cómo obtener la key de Gemini y política de privacidad resumida.

**Aceptación**
- Instalador funcional; la app arranca con el sistema y se actualiza.
- Checklist de pruebas manuales completado.

---

## 6. Reglas de seguridad y privacidad

- **Solo lectura:** ningún conector llama a endpoints que creen, modifiquen o borren datos en servicios externos.
- Secretos solo en `safeStorage`/keychain. Prohibido `console.log` de tokens, headers de autorización o contenido de mensajes en builds de producción.
- Ninguna API key de proveedor embebida en el código ni en el repositorio. Usar `.env.example` y `.gitignore`.
- El renderer **no** tiene acceso a Node; todo pasa por IPC tipado y validado en el main.
- Validar con `zod` todo dato que entra por IPC y toda respuesta de APIs externas, incluida la salida del LLM.
- Pedir el **mínimo de permisos (scopes)** a cada servicio.
- Al desconectar una cuenta: borrar token, caché de señales y estados de esa fuente.
- Todo lo que se envía a un LLM se enmascara primero y queda en el registro de auditoría.

## 7. Convenciones de trabajo para Claude Code

- Commits pequeños y descriptivos, uno por tarea lógica.
- Tests para la lógica pura (`freeSlots`, `filters`, `ranking`, `followups`, validación de la salida del LLM, solo lectura de ClickUp).
- Código y comentarios en inglés; textos de la interfaz en español, centralizados en un archivo de strings para poder traducirlos después.
- No agregar dependencias sin una razón clara; preferir las del stack definido.
- Si algo del plan choca con la documentación oficial vigente de una API, **sigue la documentación, avisa del cambio y explica la decisión**.
- Ante ambigüedad importante (por ejemplo, método de autenticación), pregunta antes de implementar.

## 8. Fuera de alcance por ahora (posibles versiones futuras)

- **Crear tareas** en ClickUp desde el widget, captura rápida con atajo global y sugerencias de tareas generadas por IA (el diseño de `Connector` y `LLMProvider` permite sumarlas después).
- Clasificación de mensajes con IA, respuestas sugeridas y prep de reuniones con IA.
- Linux (se puede agregar después con un `.desktop` en autostart).
- Backend propio y webhooks (se evalúa si el producto se distribuye a terceros).
- GitHub/GitLab, Jira y otras integraciones.
- Modelo local con Ollama como alternativa privada para el resumen.

## 9. Definición de "MVP listo"

- Badge flotante estable, con inicio automático y tray.
- ClickUp, Calendar y Slack conectados en solo lectura; Gmail como mejora siguiente.
- Lista ordenada por reglas con abrir, posponer y descartar; seguimientos de "esperando respuesta".
- Resumen diario funcionando, con IA opcional (Gemini con key propia), fallback por reglas y registro de lo enviado.
