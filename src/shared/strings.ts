// All user-facing text lives here so it can be translated later.
export const strings = {
  appName: 'Grupo CESA',
  brand: 'GrupoCESA', // shown at the bottom of the panel
  tray: {
    tooltip: 'Grupo CESA · Pendientes',
    update: (version: string): string => `Reiniciar para actualizar (v${version})`,
    openPanel: 'Abrir panel',
    pauseAlerts: 'Pausar alertas',
    focusMode: 'Modo foco',
    hideWidget: 'Ocultar widget',
    briefing: 'Ver resumen del día',
    settings: 'Ajustes',
    quit: 'Salir'
  },
  badge: {
    title: 'Pendientes',
    paused: 'Alertas en pausa',
    urgentCircle: (n: number): string => (n === 1 ? '1 urgente' : `${n} urgentes`),
    meetingsCircle: (n: number): string => (n === 1 ? '1 reunión' : `${n} reuniones`)
  },
  panel: {
    greeting: 'Tus pendientes',
    meetings: 'Próximas reuniones',
    meetingDay: (offset: number, label: string): string =>
      offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : label,
    meetingUntil: (time: string): string => `hasta ${time}`,
    pending: 'Pendientes y novedades',
    empty: 'Todo al día. No hay nada pendiente.',
    noAccounts: 'Aún no hay cuentas conectadas. Conéctalas en Ajustes para ver tus pendientes.',
    join: 'Unirse',
    settings: 'Ajustes',
    briefing: 'Resumen del día',
    back: 'Volver',
    close: 'Cerrar',
    pausedNotice: 'Alertas en pausa',
    focusNotice: 'Modo foco',
    followups: 'Esperando respuesta',
    select: 'Seleccionar',
    selectDone: 'Listo',
    dismiss: 'Descartar',
    snooze: 'Posponer',
    snoozeOptions: { hour: '1 h', tomorrow: 'Mañana', monday: 'Lunes' },
    selectedCount: (n: number): string => (n === 1 ? '1 seleccionado' : `${n} seleccionados`),
    ago: (ms: number): string => {
      const hours = Math.floor(ms / 3_600_000)
      if (hours < 1) return 'hace minutos'
      if (hours < 48) return `hace ${hours} h`
      return `hace ${Math.floor(hours / 24)} d`
    },
    inMinutes: (m: number): string => {
      if (m <= 0) return 'ahora'
      if (m < 60) return `en ${m} min`
      return `en ${Math.round(m / 60)} h`
    },
    urgent: 'Urgente',
    cancel: 'Cancelar',
    connectAccounts: 'Conectar cuentas',
    noAccountsShort: 'Sin cuentas conectadas',
    summary: (pending: number, urgent: number): string => {
      if (pending === 0) return 'Todo al día'
      const base = pending === 1 ? '1 pendiente' : `${pending} pendientes`
      if (urgent === 0) return base
      return `${base} · ${urgent === 1 ? '1 urgente' : `${urgent} urgentes`}`
    },
    undo: 'Deshacer',
    dismissedToast: (n: number): string => (n === 1 ? 'Descartado' : `${n} descartados`),
    snoozedToast: (n: number): string => (n === 1 ? 'Pospuesto' : `${n} pospuestos`),
    snoozedSection: (n: number): string => `Pospuestos (${n})`,
    bringBack: 'Traer ahora',
    returnsIn: (ms: number): string => {
      const minutes = Math.max(1, Math.round(ms / 60_000))
      if (minutes < 60) return `vuelve en ${minutes} min`
      const hours = Math.round(minutes / 60)
      if (hours < 48) return `vuelve en ${hours} h`
      return `vuelve en ${Math.round(hours / 24)} d`
    },
    refresh: 'Actualizar',
    refreshing: 'Actualizando…',
    noUpdateYet: 'Aún sin actualizar',
    updated: (ms: number): string => {
      const minutes = Math.floor(ms / 60_000)
      if (minutes < 1) return 'Actualizado ahora mismo'
      if (minutes < 60) return `Actualizado hace ${minutes} min`
      const hours = Math.floor(minutes / 60)
      return hours < 48
        ? `Actualizado hace ${hours} h`
        : `Actualizado hace ${Math.floor(hours / 24)} d`
    },
    syncProblem: (names: string): string => `Sin conexión con ${names}; se reintenta solo.`,
    priority: { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baja' },
    dueToday: 'vence pronto',
    overdue: 'vencida'
  },
  sources: {
    slack: 'Slack',
    gmail: 'Gmail',
    calendar: 'Calendar',
    clickup: 'ClickUp'
  },
  status: {
    connected: 'Conectado',
    disconnected: 'Desconectado',
    needs_reconnect: 'Requiere reconectar',
    soon: 'Próximamente'
  },
  settings: {
    title: 'Ajustes',
    sections: {
      widget: 'Widget flotante',
      panel: 'Panel de información',
      accounts: 'Cuentas',
      watch: 'Fuentes y filtros',
      briefing: 'Resumen diario',
      schedule: 'Notificaciones y horarios',
      trash: 'Papelera',
      general: 'General'
    },
    widget: {
      mode: 'Forma del widget',
      popup: 'Popup flotante',
      popupHint: 'Un círculo que puedes mover a cualquier parte.',
      tab: 'Solapa vertical',
      tabHint: 'Un rectángulo pegado al borde que se despliega hacia un lado.',
      side: 'Lado de la pantalla',
      left: 'Izquierda',
      right: 'Derecha',
      position: 'Posición vertical',
      top: 'Arriba',
      bottom: 'Abajo',
      size: 'Tamaño del widget',
      opacity: 'Transparencia del widget',
      reset: 'Restablecer',
      hint: 'La transparencia se ve al instante. El tamaño solo se puede cambiar en el popup; la solapa tiene tamaño fijo.',
      tabHelp: 'También puedes arrastrar la solapa: al soltarla se pega al borde más cercano.'
    },
    panel: {
      size: 'Tamaño del contenedor',
      hint: 'Es la ventana que se abre con toda la información. Se aplica al soltar el control.',
      reset: 'Restablecer'
    },
    accounts: {
      connect: 'Conectar',
      disconnect: 'Desconectar',
      reconnect: 'Reconectar',
      connecting: 'Conectando…',
      save: 'Guardar',
      editCredentials: 'Cambiar credenciales',
      clickupHelp: 'Pega tu token personal: ClickUp → Ajustes → Apps → API Token.',
      clickupToken: 'Token personal (pk_…)',
      googleHelp:
        'Crea un cliente OAuth de tipo "Aplicación de escritorio" en Google Cloud Console y pega sus datos. Solo se pide permiso de lectura de eventos.',
      googleClientId: 'Client ID',
      googleClientSecret: 'Client secret (si Google lo muestra)',
      googleConnect: 'Conectar con Google',
      googleBrowser: 'Se abrirá tu navegador para autorizar el acceso.',
      readOnly: 'Solo lectura: nunca crea ni modifica nada.',
      reconnecting: 'Reintentando…',
      slackGuideTitle: 'Cómo crear tu app de Slack (una vez)',
      slackSteps: [
        'Entra a api.slack.com/apps → Create New App → Blank app (o From scratch si Slack aún lo ofrece), y elige tu workspace.',
        'Socket Mode: actívalo y crea un App-Level Token con el permiso connections:write (empieza con xapp-).',
        'OAuth & Permissions → User Token Scopes (solo lectura): channels:history, groups:history, im:history, mpim:history, channels:read, groups:read, im:read, mpim:read, users:read.',
        'Event Subscriptions: actívalo y en "Subscribe to events on behalf of users" añade message.channels, message.groups, message.im y message.mpim.',
        'Install to Workspace y copia el "User OAuth Token" (empieza con xoxp-).'
      ],
      slackAppToken: 'App-Level Token (xapp-…)',
      slackUserToken: 'User OAuth Token (xoxp-…)',
      gmailHelp:
        'Usa el mismo cliente de Google de Calendar. Solo lee cabeceras y etiquetas (nunca el contenido ni los adjuntos). Al activarlo, Google vuelve a pedir permiso.',
      gmailTestMode:
        'Para uso personal la app de Google se usa en modo de prueba: la verificación de Google solo hace falta para distribuirla públicamente.',
      gmailConnect: 'Conectar Gmail',
      calendarConnect: 'Conectar Calendar'
    },
    watch: {
      gmailTitle: 'Etiquetas de Gmail',
      gmailHint:
        'Solo se muestran correos sin leer de las etiquetas marcadas (Recibidos por defecto). Promociones, redes y newsletters siempre se ignoran.',
      needGmail: 'Conecta Gmail en Cuentas para elegir etiquetas.',
      slackTitle: 'Canales de Slack',
      slackHint:
        'Marca los canales a ignorar. Los mensajes directos y las menciones directas siguen llegando.',
      needSlack: 'Conecta Slack en Cuentas para elegir canales.',
      calendarTitle: 'Reuniones de Calendar',
      needCalendar: 'Conecta Calendar en Cuentas para elegir hasta cuándo ver reuniones.',
      calendarHint:
        'Hasta cuántos días hacia adelante se muestran las reuniones, contando hoy. Las que están en curso se ven siempre. El círculo amarillo del widget cuenta solo las de las próximas 24 horas.',
      calendarShowTitle: 'Qué eventos mostrar',
      calendarShowHint:
        'Las reuniones con enlace de videollamada (Meet, Zoom, Teams) se distinguen de los eventos comunes, como un recordatorio o una cita sin enlace.',
      calendarShow: {
        all: 'Todos',
        meets: 'Con videollamada',
        plain: 'Sin videollamada'
      },
      calendarDays: {
        1: 'Hoy',
        2: '2 días',
        3: '3 días',
        7: '1 semana',
        14: '2 semanas'
      } as Record<number, string>,
      calendarSummary: (n: number): string =>
        n === 1
          ? 'Se muestran las reuniones de hoy.'
          : n === 2
            ? 'Se muestran las reuniones de hoy y de mañana.'
            : `Se muestran las reuniones de los próximos ${n} días.`,
      ignore: 'ignorar',
      clickupTitle: 'Listas de ClickUp',
      all: 'Sin selección: se muestran todas tus tareas asignadas.',
      needClickUp: 'Conecta ClickUp en Cuentas para elegir qué vigilar.',
      loading: 'Cargando listas…',
      none: 'No se encontraron listas.',
      search: 'Buscar por lista, carpeta o espacio…',
      searchPlain: 'Buscar…',
      noMatch: 'Nada coincide con la búsqueda.',
      selectedCount: (n: number, total: number): string => `${n} de ${total} seleccionadas`,
      selectVisible: 'Seleccionar visibles',
      clear: 'Limpiar',
      ignoreVisible: 'Ignorar visibles',
      stopIgnoring: 'No ignorar ninguno',
      tasksTitle: 'Qué tareas mostrar',
      due: 'Vencimiento',
      dueOptions: { 3: '3 días', 7: '7 días', 14: '14 días', 30: '30 días', 90: '3 meses' },
      minPriority: 'Prioridad mínima',
      minPriorityOptions: {
        any: 'Cualquiera',
        normal: 'Normal+',
        high: 'Alta+',
        urgent: 'Urgente'
      },
      flagged: 'Mostrar siempre las Urgentes y Altas',
      flaggedHint: 'Aunque venzan más adelante o no tengan fecha.',
      subtasks: 'Incluir subtareas',
      statuses: 'Estados a ignorar',
      statusesHint: 'Nombres exactos de estado separados por coma. Ej.: en espera, bloqueado.',
      showing: (n: number): string =>
        n === 1
          ? 'Ahora se muestra 1 tarea de ClickUp.'
          : `Ahora se muestran ${n} tareas de ClickUp.`,
      yourRule: 'Resumen de tu configuración'
    },
    quit: {
      title: 'Cerrar el widget',
      hint: 'Lo cierra por completo y deja de usar recursos y de consultar tus cuentas. Para volver a usarlo, ábrelo desde su acceso directo.',
      button: 'Cerrar widget',
      confirm: 'Sí, cerrar',
      cancel: 'Cancelar'
    },
    // One line under each section name in the settings list.
    summary: {
      widgetPopup: 'Popup flotante',
      widgetTab: (side: 'left' | 'right'): string =>
        `Solapa vertical · ${side === 'left' ? 'izquierda' : 'derecha'}`,
      panelSize: (scale: number): string => `Tamaño ${Math.round(scale * 100)} %`,
      accounts: (connected: number, total: number): string =>
        connected === 0 ? 'Ninguna conectada' : `${connected} de ${total} conectadas`,
      watch: 'Listas, etiquetas, canales y remitentes',
      briefing: (enabled: boolean, time: string, ai: boolean): string =>
        enabled
          ? `Cada día desde las ${time} · ${ai ? 'escrito con IA' : 'sin IA'}`
          : 'Desactivado',
      schedule: (from: string, to: string, notifications: boolean): string =>
        `${from}–${to} · ${notifications ? 'avisos activos' : 'avisos apagados'}`,
      trash: (n: number): string =>
        n === 0 ? 'Vacía' : n === 1 ? '1 elemento descartado' : `${n} elementos descartados`,
      general: (hotkey: string | null): string => (hotkey ? `Atajo ${hotkey}` : 'Atajo apagado')
    },
    trash: {
      hint: 'Lo que descartas con la X pasa aquí. Puedes restaurarlo o vaciar la papelera. Un elemento solo se ve mientras su origen (ClickUp, Gmail, Calendar…) lo siga mostrando.',
      empty: 'La papelera está vacía.',
      restore: 'Restaurar',
      restoreAll: 'Restaurar todo',
      emptyAction: 'Vaciar papelera',
      emptyConfirm: (n: number): string =>
        n === 1 ? 'Sí, vaciar (1 elemento)' : `Sí, vaciar (${n} elementos)`,
      emptyWarning: 'Los elementos vaciados no se pueden restaurar y no vuelven a aparecer.',
      cancel: 'Cancelar'
    },
    briefing: {
      nameTitle: 'Tu nombre',
      nameHint: 'El resumen te saluda con él: "Buen día, Ana".',
      namePlaceholder: 'Cómo quieres que te llame',
      enabled: 'Resumen diario',
      enabledHint:
        'Una ventana con tu día: reuniones, prioridades y lo que quedó pendiente. Sale una sola vez al día, cuando empiezas a usar el equipo.',
      time: 'Mostrar a partir de las',
      timeHint:
        'No sale antes de esta hora. Si el equipo estaba apagado, sale la primera vez que lo usas después. Solo en tus días y horario laborales.',
      fullHeight: 'Ventana a toda la altura',
      fullHeightHint:
        'El resumen ocupa todo el alto de la pantalla, para leerlo con más calma sin tener que desplazarte.',
      timeAfterWork: (end: string): string =>
        `Esa hora es después de que termina tu horario laboral (${end}), así que el resumen no saldrá. Elige una hora anterior.`,
      history: 'Resúmenes anteriores',
      historyEmpty: 'Todavía no hay ninguno.',
      historyHint: 'Se guardan los últimos 7 días tal como se mostraron.',
      view: 'Ver',
      viewToday: 'Ver el de hoy',
      today: 'Hoy',
      yesterday: 'Ayer',
      // The AI that writes the summary: key, what it reads, the instructions and the record.
      ai: {
        title: 'Escribirlo con IA (Gemini)',
        intro:
          'Con IA, el resumen deja de ser una lista: Gemini lo redacta con tus datos y te cuenta cómo viene el día. Si falla o la apagas, sale el resumen normal.',
        privacyTitle: 'Antes de activarla',
        privacy:
          'Con la cuenta gratuita de Google, lo que se envía puede usarse para mejorar sus productos y personas de Google pueden leerlo. Google pide no enviar información sensible, confidencial ni personal. Con una cuenta de pago no se usa para eso.',
        keyTitle: 'Clave de API de Gemini',
        keyHint:
          'Créala en aistudio.google.com/apikey. Se guarda cifrada en este equipo y no se vuelve a mostrar.',
        keyPlaceholder: 'Pega aquí tu clave',
        keySet: 'Clave guardada',
        save: 'Guardar y probar',
        saving: 'Probando…',
        test: 'Probar de nuevo',
        testOk: 'Funciona: Gemini aceptó la clave y el modelo.',
        offHint:
          'La IA está apagada, así que el resumen sale como lista. Enciende "Escribir el resumen con IA" en la tarjeta de abajo.',
        remove: 'Quitar clave',
        enabled: 'Escribir el resumen con IA',
        enabledHint: 'Una sola consulta por resumen. Sin clave no se puede activar.',
        model: 'Modelo',
        modelHint:
          'Gemini cambia sus modelos seguido. Si deja de funcionar, cambia el nombre por uno vigente en ai.google.dev/gemini-api/docs/models.',
        reads: 'Qué puede leer la IA',
        readsDefault:
          'Siempre: títulos y horas de tus reuniones, y títulos, prioridad y vencimiento de tus tareas de ClickUp. De los correos y Slack solo las cantidades.',
        sendMail: 'Asuntos y remitentes de Gmail',
        sendMailHint: 'Deja que la IA los lea para hablar de tus correos.',
        sendSlack: 'Mensajes de Slack',
        sendSlackHint: 'Deja que la IA lea tus menciones y mensajes directos.',
        masked: 'Antes de enviar se ocultan claves, correos, tarjetas y documentos.',
        topicsTitle: 'Qué quieres que traiga',
        topicsHint:
          'El tono y el formato son fijos. Aquí eliges qué incluye el resumen: quita lo que no quieras con la ✕, o añade algo tuyo. Lo que quitas no se envía a la IA.',
        topicsPlaceholder: 'Algo más que quieras que traiga',
        topicsAdd: 'Añadir',
        topicsRemove: 'Quitar',
        topicsRestore: 'Volver a poner',
        topicsRemoved: 'Quitados',
        topicsExtras: 'Añadidos por ti',
        topicsExtrasHint:
          'La IA solo puede hablar de lo que ya tiene (reuniones, tareas, correos y mensajes). Sirve para pedirle un enfoque, por ejemplo "destaca lo que vence esta semana".',
        topicsReset: 'Volver a los de siempre',
        errors: {
          auth: 'Google no aceptó esa clave. Revisa que la hayas copiado completa.',
          model: 'Ese modelo no está disponible con tu clave. Cambia el nombre del modelo.',
          quota: 'Se alcanzó el límite de uso gratuito. Prueba de nuevo en un rato.',
          network: 'No se pudo conectar con Gemini. Revisa tu conexión.',
          bad_response: 'Gemini respondió algo que no se pudo usar. Prueba de nuevo.',
          secure: 'Este equipo no permite guardar la clave de forma segura.',
          generic: 'No se pudo comprobar la clave. Prueba de nuevo.'
        }
      }
    },
    schedule: {
      workHours: 'Horario laboral',
      from: 'Desde',
      to: 'Hasta',
      days: 'Días laborales',
      dayNames: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
      notifications: 'Notificaciones del sistema',
      notificationsHint:
        'Pocas y filtradas: urgentes, mensajes directos y reuniones por empezar. Solo en horario laboral.',
      sound: 'Sonido de notificación',
      soundHint:
        'Suena con cada correo o mensaje de Slack nuevo, también los no urgentes, y con lo urgente y las reuniones por empezar. Respeta horario, pausa y foco, aunque las notificaciones del sistema estén apagadas.',
      focusFromCalendar: 'Foco automático con bloques "Focus"',
      focusFromCalendarHint:
        'Mientras dure un evento llamado "Focus" del calendario solo avisan los urgentes.',
      focusNow: 'Modo foco ahora',
      focusNowHint: 'Silencia lo no urgente hasta que lo apagues.',
      followupWait: 'Esperando respuesta tras (horas)'
    },
    general: {
      autostart: 'Iniciar con el sistema',
      autostartHint: 'Abre el widget al encender el equipo.',
      hotkey: 'Atajo de teclado',
      hotkeyHint: 'Abre y cierra el panel desde cualquier programa.',
      hotkeyChange: 'Cambiar',
      hotkeyPress: 'Pulsa la combinación…',
      hotkeyCancel: 'Cancelar',
      hotkeyNeedsModifier: 'Usa Ctrl o Alt junto con otra tecla.',
      hotkeyTaken:
        'Otro programa ya usa esa combinación, así que no funciona. Elige otra con "Cambiar".',
      autoHide: 'Ocultar al presentar',
      autoHideHint:
        'Se esconde solo (y no suena) cuando algo está a pantalla completa, como una presentación, un video o un juego. Vuelve solo al terminar.',
      hideFromCapture: 'Ocultar al compartir pantalla',
      hideFromCaptureHint:
        'Tú lo sigues viendo, pero no aparece en lo que compartes en Meet, Zoom, Teams o al grabar la pantalla.',
      hideNow: 'Ocultar widget ahora',
      hideNowHint:
        'Lo quita de la pantalla hasta que lo vuelvas a mostrar. También desde el icono de la bandeja; el atajo sigue abriendo el panel.'
    }
  },
  filtersPage: {
    title: 'Mensajes y correos',
    add: 'Añadir',
    remove: 'Quitar',
    empty: 'Ninguno por ahora.',
    placeholder: 'Nombre o correo',
    minLength: 'Largo mínimo de un mensaje',
    ignoredSenders: 'Remitentes a ignorar',
    importantSenders: 'Remitentes prioritarios',
    importantHint:
      'Todo lo que envíen es urgente: sube al tope, se marca en rojo y avisa (con sonido) incluso en modo foco. Escribe el nombre o el correo, por ejemplo "Sofía Pérez" o "soporte@empresa.com".',
    listHint:
      'Aplican a mensajes y correos (Slack y Gmail); no a tareas ni reuniones. Puedes pegar varios separados por coma.',
    builtIn: 'Siempre se ignoran: bots, no-reply, "gracias", "ok" y reacciones.'
  },
  errors: {
    title: 'Algo salió mal',
    body: 'No se pudo mostrar esta ventana. Tus datos no se perdieron.',
    retry: 'Reintentar',
    reconnectBanner: 'Hay cuentas que requieren reconectar.',
    reconnectAction: 'Revisar',
    apiDisabled: (name: string): string =>
      `La API de ${name} no está habilitada en tu proyecto de Google. Habilítala y pulsa Actualizar.`,
    apiDisabledAction: 'Habilitar'
  },
  notify: {
    databaseReset:
      'No se pudo leer el archivo local de datos y se creó uno nuevo. Tus cuentas y ajustes pueden haberse reiniciado.',
    meetingSoon: 'Reunión por empezar',
    meetingMoved: 'Cambió el horario de una reunión',
    meetingMovedBody: (
      title: string,
      direction: 'earlier' | 'later',
      now: string,
      before: string
    ): string =>
      `${title}: ${direction === 'earlier' ? 'adelantada' : 'atrasada'}, ahora a las ${now} (antes ${before})`,
    summary: (n: number): string => `Tienes ${n} pendientes importantes`
  },
  update: {
    ready: (version: string): string =>
      `Hay una versión nueva del widget (${version}), lista para instalar.`,
    restart: 'Reiniciar y actualizar',
    version: (version: string): string => `Versión ${version}`,
    versionHint: 'El widget se actualiza solo y te avisa cuando hay una versión nueva lista.',
    check: 'Buscar actualizaciones',
    checking: 'Buscando…',
    result: {
      latest: 'Tienes la última versión.',
      downloading: 'Hay una versión nueva. Se está descargando; te avisaremos cuando esté lista.',
      ready: 'Ya hay una versión nueva lista. Usa "Reiniciar y actualizar".',
      error: 'No se pudo buscar actualizaciones. Revisa tu conexión y prueba de nuevo.',
      unavailable: 'Esta copia no es la instalada, así que no se actualiza sola.'
    }
  },
  briefing: {
    title: 'Resumen del día',
    greeting: (hour: number, name: string): string => {
      const salute = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
      return name ? `${salute}, ${name}` : salute
    },
    // The sentence under the greeting when there is no AI: built from the counts.
    intro: (c: { meetings: number; priorities: number; urgent: number }): string => {
      const parts: string[] = []
      if (c.meetings > 0) {
        parts.push(c.meetings === 1 ? 'Hoy tienes 1 reunión' : `Hoy tienes ${c.meetings} reuniones`)
      }
      if (c.priorities > 0) {
        const p = c.priorities === 1 ? '1 prioridad' : `${c.priorities} prioridades`
        parts.push(c.meetings > 0 ? p : `Hoy tienes ${p}`)
      }
      if (parts.length === 0) return 'Hoy no tienes nada pendiente. ¡Buen día libre!'
      const text = parts.join(' y ')
      return c.urgent > 0
        ? `${text}; ${c.urgent === 1 ? '1 es urgente' : `${c.urgent} son urgentes`}.`
        : `${text}.`
    },
    meetings: 'Reuniones de hoy',
    priorities: 'Prioridades principales',
    nextTasks: 'Próximas tareas',
    yesterday: 'Quedó pendiente de ayer',
    waiting: 'Esperando respuesta',
    since: 'Desde el último resumen',
    sinceText: (emails: number, messages: number): string => {
      const parts: string[] = []
      if (emails > 0) parts.push(emails === 1 ? '1 correo nuevo' : `${emails} correos nuevos`)
      if (messages > 0) {
        parts.push(messages === 1 ? '1 mensaje de Slack' : `${messages} mensajes de Slack`)
      }
      return parts.join(' y ')
    },
    join: 'Unirse',
    open: 'Abrir',
    // The small links under a paragraph written by the AI: one per item it talks about.
    link: (kind: 'meeting' | 'task' | 'email' | 'message' | 'followup'): string =>
      kind === 'meeting'
        ? 'Ver reunión'
        : kind === 'task'
          ? 'Ver tarea'
          : kind === 'email'
            ? 'Ver correo'
            : kind === 'followup'
              ? 'Ver hilo'
              : 'Ver mensaje',
    details: 'Ver todo el detalle',
    hideDetails: 'Ocultar el detalle',
    urgent: 'Urgente',
    due: (label: string): string => `vence ${label}`,
    overdue: 'vencida',
    generatedAt: (time: string, mode: 'rules' | 'ai'): string =>
      mode === 'ai' ? `Generado a las ${time} con IA` : `Generado a las ${time}`,
    update: 'Actualizar',
    updating: 'Actualizando…',
    done: 'Entendido',
    close: 'Cerrar',
    empty: 'Todavía no hay un resumen para mostrar.'
  },
  onboarding: {
    nameTitle: '¿Cómo te llamas?',
    nameText:
      'Lo usamos para saludarte en el resumen diario: "Buen día, Ana". Puedes cambiarlo después en Ajustes.',
    namePlaceholder: 'Tu nombre',
    welcomeTitle: 'Bienvenido',
    welcomeText:
      'Conecta tus cuentas para ver aquí lo que necesita tu atención. Puedes saltar cualquiera.',
    next: 'Continuar',
    skip: 'Saltar por ahora',
    finishTitle: 'Últimos ajustes',
    finish: 'Terminar'
  }
} as const
