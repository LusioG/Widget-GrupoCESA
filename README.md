# GrupoCESA Widget

Widget flotante de escritorio (Windows) que reúne en un solo lugar lo que necesita tu atención:
reuniones próximas, tareas de **ClickUp**, menciones y mensajes directos de **Slack** y correos
relevantes de **Gmail**. Es de **solo lectura**: nunca crea, modifica ni borra nada en esos servicios.

> Estado: en desarrollo. Se puede instalar con el instalador de Windows y se actualiza solo (ver
> [Instalación y actualizaciones](#instalación-y-actualizaciones)); también se puede ejecutar desde el
> código. Ver [Qué falta](#qué-falta).

## Qué hace

- **Dos formas de widget** (Ajustes → Widget flotante):
  - **Popup flotante:** un círculo con el logo que puedes arrastrar a cualquier parte.
  - **Solapa vertical:** un rectángulo redondeado pegado al borde izquierdo o derecho. Al hacer
    clic, el panel se despliega horizontalmente desde el borde y la solapa viaja con él. Las barras
    de scroll quedan siempre pegadas al borde del monitor (a la izquierda si la solapa está a la
    izquierda). Se arrastra para cambiarla de lado o de altura.
- **Contadores del widget:**
  - **Número verde:** pendientes (tareas, correos, menciones, mensajes directos, esperando
    respuesta). Las reuniones no cuentan. En modo foco cuenta solo los urgentes.
  - **Círculo rojo:** cuántos de esos pendientes son urgentes. Solo aparece si hay alguno.
  - **Círculo amarillo:** reuniones en curso o de las próximas 24 horas. Solo aparece si hay alguna.
  - En el **popup** los círculos salen en las esquinas del logo (rojo arriba a la izquierda,
    verde arriba a la derecha, amarillo abajo a la derecha). En la **solapa**, la barra se estira
    hacia abajo, de arriba abajo: logo, círculo **rojo**, círculo **amarillo**, número **verde** y
    la flecha. El logo no se mueve. Se achica a su tamaño normal cuando no hay rojo ni amarillo.
  - **Pulso rojo:** solo cuando llega un **correo o mensaje de Slack nuevo** (más reciente que la
    última vez que abriste o cerraste el panel y aún sin abrir). Se apaga al abrir el panel. Las
    **tareas nunca hacen pulsar**: solo suman a los contadores (y al círculo rojo si son urgentes).
    En modo foco solo pulsa un mensaje urgente.
  - **Pulso verde:** una reunión empieza en menos de 10 minutos o está en curso (no en modo foco).
  - El borde rojo del widget sigue marcando que hay algo urgente, sea del tipo que sea.- **Panel** con reuniones (botón _Unirse_, amarillo en las de hoy y verde en las de otros días), pendientes ordenados por urgencia y "Esperando respuesta".
- **Acciones por elemento:** abrir el original, posponer (1 h / mañana / lunes), descartar, y en lote.
  Tras descartar o posponer aparece **Deshacer** unos segundos. Lo pospuesto queda en una lista
  **"Pospuestos"** al final del panel, con cuándo vuelve y un botón _Traer ahora_.
- **"Actualizado hace X" y botón Actualizar** arriba del panel: consulta todas las cuentas al
  instante (también con las alertas en pausa) sin esperar al siguiente ciclo.
- **Atajo de teclado global** (por defecto `Ctrl+Alt+P`) para abrir y cerrar el panel desde
  cualquier programa. Se cambia o se apaga en Ajustes → General; si otro programa ya usa la
  combinación, ahí mismo se avisa.
- **Ocultar al presentar:** el widget se esconde solo (y no suena) cuando hay algo a pantalla
  completa —presentación, vídeo, juego— y vuelve al terminar. Se puede apagar. Además puedes
  **ocultarlo a mano** (Ajustes → General, o clic derecho en la bandeja → _Ocultar widget_); el
  atajo sigue abriendo el panel. No detecta compartir pantalla en Teams/Meet/Zoom si la ventana
  no está a pantalla completa: ahí usa el ocultado a mano.
- **Modo foco / No molestar:** silencia lo no urgente; también se activa solo durante un evento
  llamado "Focus" del calendario.
- **Notificaciones del sistema** pocas y filtradas, solo en horario laboral. Cada aviso nuevo va
  acompañado de un **sonido** (una vez por tanda, aunque lleguen varios a la vez). El sonido también
  suena con los **correos y mensajes de Slack no urgentes** que llegan nuevos (la notificación del
  sistema sigue siendo solo para lo importante). Respeta horario, pausa y modo foco y se apaga en **Ajustes → Notificaciones y
  horarios → Sonido de notificación**, y es independiente de las notificaciones del sistema (puedes
  tener sonido sin ventanita o al revés). El archivo es `src/renderer/assets/notification.mp3`.
- **Fuentes y filtros** (Ajustes) reúne lo que se muestra de cada fuente: listas de ClickUp,
  etiquetas de Gmail, canales de Slack a ignorar, **cuántos días de reuniones** de Calendar y, al
  final, "Mensajes y correos" (largo mínimo, remitentes a ignorar y **remitentes prioritarios**).
- **Reuniones de Calendar:** eliges hasta cuántos días hacia adelante se ven, contando hoy: _Hoy_,
  2 días (por defecto: hoy y mañana), 3 días, 1 semana o 2 semanas. Si abarca más de un día, el
  panel las agrupa con títulos ("Hoy", "Mañana", "jueves, 5 nov"). Las que están en curso se ven
  siempre. Cambiar el ajuste vuelve a leer el calendario al instante. El **círculo amarillo** del
  widget cuenta solo las reuniones en curso o de las próximas 24 horas, sin importar este ajuste.
- **Remitentes prioritarios:** escribes un nombre o correo (por ejemplo el de la líder de soporte),
  pulsas **Añadir** (o Enter) y pasa a una lista debajo, con una ✕ para quitarlo de uno en uno. Lo
  mismo para **Remitentes a ignorar**. Todo lo
  que envíen es urgente: sube al tope, se marca en rojo y avisa con sonido incluso en modo foco.
  Ignora mayúsculas y acentos y vale para Gmail y Slack.
- **Resumen del día:** una ventana centrada y sencilla, con el estilo del widget, que sale una sola
  vez al día la primera vez que usas el equipo en tu horario laboral, a partir de la hora que elijas
  (Ajustes → Resumen diario). Te saluda por tu nombre ("Buen día, Ana") y reúne tus reuniones de
  hoy, las 5 prioridades principales, las próximas 3 tareas normales, lo pendiente de ayer, lo que
  espera respuesta y lo nuevo desde el último resumen. Con IA (tu clave de Gemini) lo redacta en
  prosa y deja enlaces pequeños a cada tarea, correo o reunión; la lista completa queda en "Ver
  todo el detalle". Sin IA, o si falla, sale la lista. Se guarda cada día y se puede volver a verlo
  desde el icono de hoja del panel, la bandeja ("Ver resumen del día") o Ajustes (últimos 7 días).
  Las instrucciones para la IA se pueden personalizar en Ajustes.
- Tamaño del widget, tamaño del panel y transparencia del widget ajustables.

## Instalación y actualizaciones

1. Descarga `widget-X.Y.Z-setup.exe` de las _Releases_ de
   [`Widget-GrupoCESA-releases`](https://github.com/LusioG/Widget-GrupoCESA-releases/releases) y
   ábrelo. Se instala solo, **sin pedir permisos de administrador**, y abre el widget al terminar.
2. Como el instalador no está firmado, la primera vez Windows puede mostrar _"Windows protegió su
   PC"_: pulsa **Más información → Ejecutar de todas formas**.
3. Deja accesos directos en el **escritorio** y en el **menú de inicio**. Si cierras el widget
   (Ajustes → Cerrar widget, o Salir en la bandeja), ábrelo de nuevo desde cualquiera de los dos.
4. Para que se abra solo al encender el equipo, activa **Ajustes → General → Iniciar con el sistema**.
5. **Se actualiza solo.** Ajustes → General muestra la versión y permite buscar actualizaciones.
   Desinstalar no borra tus cuentas ni tus ajustes (están en `%APPDATA%\widget`).

## Requisitos y cómo ejecutarlo

Necesitas [Node.js](https://nodejs.org) 22 o superior (probado con 24) y Windows 10/11.

```powershell
cd C:\Users\lucia\widget
npm install
npm.cmd run dev
```

> En PowerShell, si `npm run dev` da _"la ejecución de scripts está deshabilitada"_, usa
> `npm.cmd` en lugar de `npm` (o permite scripts solo para tu usuario con
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).

Para verlo con **datos de ejemplo**, sin conectar cuentas:

```powershell
$env:WIDGET_FAKE_DATA = '1'; npm.cmd run dev
```

Para cerrarlo: **Ajustes → botón _Cerrar widget_** (abajo del todo, pide confirmar), o clic derecho en
su icono de la bandeja del sistema → **Salir**. Cerrado, no consume nada ni consulta tus cuentas.

## Conectar tus cuentas

Todo se hace en **Ajustes (la tuerca) → Cuentas**. Los datos se piden una sola vez y se guardan
cifrados con Windows.

### ClickUp (1 minuto)

1. En ClickUp: tu avatar → **Settings → Apps → API Token → Generate**. Copia el token (`pk_…`).
2. Pégalo en la tarjeta de ClickUp y pulsa **Conectar**.

Por defecto se muestran las tareas asignadas a ti que están **vencidas**, que **vencen en los
próximos 7 días** o que tienen prioridad **Urgente** o **Alta** (aunque no tengan fecha).

En **Ajustes → Fuentes y filtros** lo afinas:

- **Listas:** se agrupan como en ClickUp (espacio → carpeta → lista). Marcas una lista, una carpeta
  o un espacio entero, o buscas por nombre (ignora mayúsculas y acentos) y pulsas
  _Seleccionar visibles_. Sin ninguna marcada se vigilan todas.
- **Vencimiento:** 3, 7, 14, 30 días o 3 meses.
- **Prioridad mínima:** cualquiera, Normal o más, Alta o más, o solo Urgente.
- **Mostrar siempre las Urgentes y Altas**, aunque venzan más adelante o no tengan fecha.
- **Incluir subtareas**, o no.
- **Estados a ignorar:** nombres exactos de estado (por ejemplo `en espera, bloqueado`).

Abajo de esas opciones verás un resumen en una frase de lo que se mostrará y cuántas tareas hay
ahora mismo. Los cambios se aplican de inmediato.

La **prioridad de ClickUp** también decide la urgencia: una tarea _Urgente_ se marca en rojo por sí
sola, una _Alta_ sube en la lista y es urgente si además vence hoy, y una _Baja_ baja. Una tarea
**vencida** siempre es urgente, sea cual sea su prioridad. Cada tarea muestra su bandera de color.

### Google: Calendar y Gmail

Cada usuario crea su propio cliente de Google (así ninguna clave viaja con la aplicación).

1. Entra a [Google Cloud Console](https://console.cloud.google.com) y crea un proyecto.
2. **APIs y servicios → Biblioteca**: habilita **Google Calendar API** y **Gmail API**.
3. **Pantalla de consentimiento de OAuth**: tipo _Externo_, rellena el nombre y tu correo, y en
   _Usuarios de prueba_ añade tu cuenta de Google.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación de escritorio**.
5. Copia el **ID de cliente** (y el _secreto_ si Google lo muestra) y pégalos en la tarjeta de
   Calendar o Gmail. Se guardan una vez y las dos funciones los comparten.
6. Pulsa **Conectar Calendar** y/o **Conectar Gmail**. Se abre tu navegador para autorizar.

Permisos que se piden (solo lectura):

| Función  | Permiso                    | Qué permite                                                       |
| -------- | -------------------------- | ----------------------------------------------------------------- |
| Calendar | `calendar.events.readonly` | Ver eventos                                                       |
| Gmail    | `gmail.metadata`           | Ver **cabeceras y etiquetas**, nunca el contenido ni los adjuntos |

Notas importantes:

- Google **no permite ampliar permisos** a una aplicación de escritorio: al activar Gmail teniendo
  Calendar conectado, Google vuelve a pedir autorización con los dos permisos.
- Mientras la pantalla de consentimiento esté en estado **"Pruebas"**, Google hace caducar el acceso
  a los **7 días** y tendrás que reconectar. Para uso personal puedes pasarla a **"En producción"**
  (aparecerá un aviso de "app no verificada" que puedes aceptar). La verificación de Google solo es
  necesaria para distribuir la app públicamente.

### Slack

Cada usuario crea su propia app de Slack (una vez). La tarjeta de Slack incluye esta guía:

> **Atajo:** en [api.slack.com/apps](https://api.slack.com/apps) elige **Create New App → From a
> manifest**, selecciona tu workspace y pega el contenido de
> [`docs/slack-app-manifest.json`](docs/slack-app-manifest.json) (pestaña JSON). Eso deja hechos
> los pasos 2 a 4 (permisos, eventos y Socket Mode). Después solo falta el _App-Level Token_
> (`xapp-`, en **Basic Information → App-Level Tokens**, con el permiso `connections:write`), instalar
> la app y copiar el _User OAuth Token_ (`xoxp-`).

1. En [api.slack.com/apps](https://api.slack.com/apps): **Create New App → Blank app** (o _From scratch_ si Slack aún lo ofrece) y elige tu workspace.
2. **Socket Mode**: actívalo y crea un _App-Level Token_ con el permiso `connections:write`
   (empieza con `xapp-`).
3. **OAuth & Permissions → User Token Scopes** (solo lectura): `channels:history`, `groups:history`,
   `im:history`, `mpim:history`, `channels:read`, `groups:read`, `im:read`, `mpim:read`, `users:read`.
4. **Event Subscriptions**: actívalo y en _Subscribe to events on behalf of users_ añade
   `message.channels`, `message.groups`, `message.im` y `message.mpim`.
5. **Install to Workspace** y copia el _User OAuth Token_ (empieza con `xoxp-`).
6. Pega los dos tokens en la tarjeta de Slack.

Llegan mensajes directos y menciones directas (no `@channel`). En **Fuentes y filtros** marcas los
canales que quieres ignorar.

## Datos y privacidad (resumen)

- **Solo lectura.** Se piden los permisos mínimos de cada servicio y el código no usa ninguna
  operación de escritura (hay pruebas automáticas que lo comprueban).
- **Todo se queda en tu equipo.** El widget habla únicamente con ClickUp, Slack y Google, para
  leer tus propios datos. No hay servidor propio, ni analítica, ni envío a terceros.
- **La IA es opcional y viene apagada.** Solo se usa para redactar el resumen diario, y solo si
  tú pegas tu propia clave de Gemini y la activas. Por defecto lo único que se envía son los
  títulos y horas de tus reuniones y los títulos, prioridad y vencimiento de tus tareas de ClickUp.
  De Gmail y Slack solo van cantidades, a menos que actives cada fuente. Antes de enviar se ocultan
  claves, correos, tarjetas y documentos, y **Ajustes → Resumen diario** guarda las últimas 30
  consultas tal como salieron, para que las revises o las borres. Con la cuenta gratuita de Google,
  lo enviado puede usarse para mejorar sus productos y ser leído por personas de Google; con una
  cuenta de pago no.
- **Claves y tokens:** cifrados con el almacenamiento seguro de Windows (DPAPI) en
  `%APPDATA%\widget\secrets.bin`. Nunca en texto plano, ni en el código, ni en los registros.
- **Caché local** (`%APPDATA%\widget\widget.db`, **sin cifrar**): títulos de tareas, texto de
  mensajes de Slack, asuntos y fragmentos de correos, remitentes, y qué descartaste o pospusiste.
  Gmail nunca descarga cuerpos ni adjuntos.
- **Registros** (`%APPDATA%\widget\logs\widget.log`): solo eventos y errores técnicos, con
  cualquier credencial, correo o ruta personal enmascarados. Nunca contenido de mensajes ni tareas.
  Se rotan automáticamente (máx. ~1 MB).
- **Desconectar una cuenta** borra su token, sus datos guardados y su estado. Para borrarlo todo,
  cierra la aplicación y elimina la carpeta `%APPDATA%\widget`.

## Si algo no funciona

| Síntoma                                                  | Qué hacer                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "La ejecución de scripts está deshabilitada"             | Usa `npm.cmd` en lugar de `npm`                                                                                                                                                |
| No veo el widget                                         | Búscalo en la bandeja del sistema (icono de "^"); clic derecho → _Abrir panel_                                                                                                 |
| Una cuenta dice **Requiere reconectar**                  | El servicio rechazó el acceso (token revocado o caducado): vuelve a conectarla en Ajustes → Cuentas. Verás un aviso en el panel.                                               |
| Una cuenta dice **Reintentando…**                        | No hay internet o el servicio no responde; reintenta solo (30 s, 1 min, 2 min…) y se actualiza al volver la conexión                                                           |
| Dice _"La API de Gmail (o Calendar) no está habilitada"_ | En tu proyecto de Google Cloud falta habilitar esa API. Pulsa **Habilitar** (abre la página exacta), actívala y pulsa **Actualizar**; también se recupera sola en unos minutos |
| Google pide reconectar cada semana                       | La pantalla de consentimiento está en "Pruebas"; ver la nota de Google arriba                                                                                                  |
| El panel se ve en blanco o con error                     | Pulsa **Reintentar**. Si una ventana se cae, la aplicación la recarga sola. Revisa `%APPDATA%\widget\logs\widget.log`                                                          |
| La base de datos se dañó                                 | Se aparta el archivo dañado (`widget.db.corrupt-…`), se crea uno nuevo y se avisa con una notificación                                                                         |

## Desarrollo

```powershell
npm.cmd run dev        # ejecutar
npm.cmd test           # pruebas (Vitest)
npm.cmd run lint       # ESLint
npm.cmd run typecheck  # TypeScript estricto
npm.cmd run build      # compilar
```

Variables de entorno **solo para pruebas** (ver `.env.example`): `WIDGET_FAKE_DATA`,
`CLICKUP_API_BASE`, `SLACK_API_URL`.

Estructura: `src/main` (proceso principal: ventanas, conectores, motor de reglas, base de datos),
`src/preload` (puente seguro y tipado), `src/renderer` (interfaz React + Tailwind) y `src/shared`
(tipos, ajustes y textos). Stack: Electron, TypeScript, React, Tailwind, Zustand, SQLite
(`node:sqlite` + Drizzle), zod y Vitest. La lista de verificación manual está en
[`docs/MANUAL_TESTS.md`](docs/MANUAL_TESTS.md).

### Publicar una versión

Quien mantiene el widget publica desde su PC y todos los demás se actualizan solos. Solo se hace la
primera vez la preparación (pasos 1 y 2).

1. **Crea el repositorio de instaladores:** en GitHub, un repo **público** llamado
   `Widget-GrupoCESA-releases` en la cuenta `LusioG`. Solo guarda los instaladores (no lleva código ni
   claves), así que el repo del código puede ser privado.
2. **Crea un token** en GitHub → Settings → Developer settings → Personal access tokens →
   _Fine-grained tokens_, limitado a ese repo y con el permiso **Contents: Read and write**. Guárdalo
   en tu equipo como variable de entorno del usuario `GH_TOKEN` (nunca en el repo).
3. **Sube el número de versión** en `package.json` (por ejemplo de `1.0.0` a `1.0.1`):
   `npm.cmd version patch --no-git-tag-version`. Sin un número mayor, nadie se actualiza.
4. **Publica:** `npm.cmd run release`. Pasa las comprobaciones, compila, crea el instalador y lo sube
   como release (`widget-X.Y.Z-setup.exe` y `latest.yml`).
5. Haz commit del cambio de versión y súbelo al repo del código.

Para probar el instalador sin publicar: `npm.cmd run build:win` deja el instalador en `dist/`.

Cada widget instalado busca versiones nuevas un minuto después de abrirse y cada 4 horas. Cuando
descarga una, avisa en el panel y en la bandeja con "Reiniciar y actualizar"; si no se pulsa, se
instala solo la próxima vez que se cierre. Un widget cerrado se actualiza al abrirse.

## Qué falta

- Decidir cómo se conecta Slack para toda la oficina (hoy cada persona necesita su propia app).
- Un solo proyecto de Google para toda la oficina (hoy cada persona crea el suyo).
- Probar el resumen con IA con una clave real de Gemini y datos reales durante unos días.
- Firmar el instalador con un certificado (opcional: sin firma, Windows avisa una vez al instalar).
