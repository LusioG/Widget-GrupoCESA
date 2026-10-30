# Lista de verificación manual

Estado de cada comprobación. **Auto** = la ejecuté contra la aplicación real (con servicios
simulados donde se indica). **Pendiente** = necesita tu equipo, tus cuentas o un monitor adicional.

Leyenda: ✅ verificado · ⚠️ verificado con límites · ⏳ pendiente · ❌ no se puede automatizar

## Widget y panel

| Comprobación                                                                                            | Estado  | Notas                                         |
| ------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------- |
| Popup arrastrable, recuerda su posición al reiniciar                                                    | ✅ Auto |                                               |
| Solapa pegada a izquierda/derecha, altura ajustable, se arrastra y se pega al borde                     | ✅ Auto |                                               |
| Panel como cajón: pegado al borde, solapa viaja con él, animación                                       | ✅ Auto | Movimiento medido; no se juzga a simple vista |
| Clic vs. arrastre: temblor de mano, clic largo, borde de pantalla, esquinas transparentes, clic derecho | ✅ Auto | Ratón real                                    |
| Tamaño del widget y del panel independientes; transparencia solo del widget                             | ✅ Auto |                                               |
| Instancia única (abrir dos veces no duplica)                                                            | ✅ Auto |                                               |
| Cerrar el panel no cierra la aplicación; solo _Salir_ del tray                                          | ✅ Auto |                                               |

## Robustez (Fase 9)

| Comprobación                                                                              | Estado                   | Cómo / notas                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| Pérdida de internet: la cuenta sigue "Conectada" con _Reintentando…_ y se recupera sola   | ✅ Auto                  | ClickUp (simulado) y Slack (simulado, con corte de unos segundos)                           |
| Token revocado: la cuenta pasa a _Requiere reconectar_, aviso en el panel, el resto sigue | ✅ Auto                  | ClickUp (simulado). Slack y Google siguen la misma ruta pero no se probaron en vivo         |
| Una ventana que se cae se recarga sola (no queda en blanco)                               | ✅ Auto                  | Se forzó la caída del proceso de la página                                                  |
| Pantalla de error con _Reintentar_ si una página falla al dibujarse                       | ✅ Pruebas de componente | No se provocó en la app real                                                                |
| Base de datos dañada: se aparta, se crea una nueva y se avisa                             | ✅ Auto                  |                                                                                             |
| Navegación, ventanas emergentes y permisos del navegador bloqueados                       | ✅ Auto                  |                                                                                             |
| Registros sin tokens, correos ni contenido de mensajes                                    | ✅ Auto                  |                                                                                             |
| Apps a pantalla completa normales (vídeo, navegador F11): el widget queda encima          | ✅ Auto                  |                                                                                             |
| Ventana a pantalla completa _siempre encima_ (algunas herramientas de presentación)       | ✅ Auto                  | El widget se recoloca encima cada ~1,5 s. Ojo: **también se verá sobre presentaciones**     |
| Juegos en pantalla completa exclusiva (DirectX)                                           | ❌                       | Windows no permite superponer ventanas ahí                                                  |
| **Varios monitores**                                                                      | ⏳                       | Solo había un monitor. La lógica de posición está probada con tests; falta probarla en vivo |
| **Suspensión y reanudación**                                                              | ⏳                       | Implementado (al despertar refresca cuentas y reabre conexiones). Falta probarlo en vivo    |

## Panel: deshacer, pospuestos, actualizar, atajo y ocultar

| Comprobación                                                                                     | Estado                   | Notas                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Descartar/posponer muestra "Deshacer" ~6 s; deshacer restaura (también lotes)                    | ✅ Auto                  | ClickUp simulado; el estado se guarda y se deshace en el proceso principal                            |
| Lista "Pospuestos": cuándo vuelve cada uno y botón _Traer ahora_                                 | ✅ Auto                  |                                                                                                       |
| "Actualizado hace X" y botón _Actualizar_ (consulta todas las cuentas al instante, aun en pausa) | ✅ Auto                  | ClickUp simulado                                                                                      |
| Atajo global `Ctrl+Alt+P`: abre y cierra el panel; se puede cambiar o apagar                     | ✅ Auto                  | Pulsación real de teclas. Si otro programa usa la combinación se avisa en Ajustes → General           |
| Ocultar widget a mano (Ajustes o bandeja) y volver a mostrarlo                                   | ✅ Auto                  |                                                                                                       |
| Vigilante de pantalla completa en marcha (y detenido al apagar la opción)                        | ✅ Auto                  | Se comprueba que el proceso existe y que Windows responde un estado válido                            |
| **El widget se esconde de verdad con una presentación / vídeo / juego a pantalla completa**      | ⏳                       | No lo provoqué para no tapar tu pantalla. Prueba con PowerPoint en presentación o F11 en el navegador |
| Mensaje "API no habilitada" (Gmail/Calendar) con botón _Habilitar_                               | ✅ Pruebas de componente | La detección está probada con respuestas de Google de ejemplo; no se provocó con Google real          |

## Contadores del widget y Calendar

| Comprobación                                                                                                  | Estado     | Notas                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Popup: círculo rojo (urgentes) y amarillo (reuniones) en las esquinas; la ventana sigue de 56 px              | ✅ Auto    | Datos de ejemplo. Los círculos tapan parte del logo; se puede agrandar el popup en Ajustes                                                           |
| Solapa: se estira 32 px por círculo, rojo arriba y amarillo debajo, y vuelve a 120 px sin nada                | ✅ Auto    | Tamaño real de la ventana medido                                                                                                                     |
| Solapa estirada con el panel abierto (cajón) y al arrastrarla a otro borde o altura                           | ⏳         | Implementado (la posición guardada es la de la solapa normal); falta probarlo con el ratón                                                           |
| Pulso: rojo solo con correo/Slack nuevo (tareas urgentes no pulsan); verde con reunión próxima                | ✅ Pruebas | Con datos de ejemplo se comprobó que una tarea urgente no pulsa. **El pulso rojo con un correo o Slack real no se ha visto en vivo**                 |
| Botón _Cerrar widget_ (Ajustes): pide confirmar y termina el proceso                                          | ✅ Auto    |                                                                                                                                                      |
| Reuniones por días (Hoy / 2 días / 3 días / 1 semana / 2 semanas): qué se ve y qué pide a Google              | ✅ Pruebas | Con reloj simulado y un Google simulado. **Con tu calendario real falta probarlo** (elegir "1 semana" y ver que aparecen las reuniones de la semana) |
| Con la solapa a la izquierda, las barras de scroll van al borde izquierdo (a la derecha ya iban a la derecha) | ✅ Auto    | Medido en la app real y con captura. El popup flotante conserva la barra a la derecha                                                                |
| Calendar: consulta cada 60 s y al abrir el panel si los datos tienen más de 30 s                              | ✅ Auto    | Pruebas con reloj simulado. **Con tu Google real sigue sin probarse**                                                                                |

## Accesibilidad del panel

| Comprobación                                                                  | Estado  | Notas                                                                                                 |
| ----------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| Con Tab se llega a Posponer y ✕ de cada tarea; el foco se ve (contorno verde) | ✅ Auto | Teclas reales por CDP                                                                                 |
| Todo el texto de todas las pantallas cumple 4.5:1 y mide 12 px o más          | ✅ Auto | Medido sobre la pantalla (color real vs. fondo real). El degradado del encabezado se aproxima         |
| Botones e interruptores de 24 px o más                                        | ✅ Auto |                                                                                                       |
| Con "reducir movimiento" no hay animaciones en bucle ni transiciones          | ✅ Auto | Emulado en la página. La parte de Windows (`getAnimationSettings`, sin deslizar el panel) no se probó |
| **Con Windows "Mostrar animaciones" apagado, el panel aparece sin deslizar**  | ⏳      | Ajustes de Windows → Accesibilidad → Efectos visuales → Efectos de animación                          |

> **Ocultar al presentar** usa la misma señal que Windows usa para no mostrar avisos
> (`SHQueryUserNotificationState`): oculta con apps a pantalla completa, juegos y modo
> presentación. **No detecta** compartir pantalla en Teams/Meet/Zoom si la ventana no está a
> pantalla completa: para eso usa _Ocultar widget_ desde la bandeja.

### Cómo probar lo pendiente

**Varios monitores** (con un segundo monitor):

1. Arrastra el popup al segundo monitor, reinicia la app → debe volver al mismo monitor.
2. Pon la solapa en el segundo monitor; ábrela → el panel debe abrirse en ese monitor.
3. Con el widget en el segundo monitor, **desconéctalo** → el widget debe pasar al monitor principal
   (puede tardar un par de segundos). Vuelve a conectarlo.
4. Cambia la resolución o la escala de un monitor → el widget debe seguir dentro de la pantalla.

**Suspensión y reanudación:**

1. Con ClickUp o Slack conectados, suspende el equipo unos minutos (o cierra la tapa).
2. Al despertar, en unos 3–5 segundos las cuentas deben volver a _Conectada_ sin tocar nada y los
   datos deben actualizarse. En `widget.log` debe aparecer `resume from sleep: refreshing accounts`.
3. Repite con el internet apagado al despertar: debe mostrar _Reintentando…_ y recuperarse al volver.

## Con tus cuentas reales (nada de esto se ha probado todavía)

| Comprobación                                                                                                          | Estado |
| --------------------------------------------------------------------------------------------------------------------- | ------ |
| ClickUp con tu token: tareas reales, lista de listas, filtro por listas                                               | ⏳     |
| Google Calendar: login, reuniones del día, enlace _Unirse_, huecos                                                    | ⏳     |
| Gmail: login (incluida la nueva autorización al sumar Calendar), correos relevantes, etiquetas, "esperando respuesta" | ⏳     |
| Slack: los eventos "en nombre del usuario" llegan con un token de usuario (la documentación no lo confirma del todo)  | ⏳     |
| Notificaciones del sistema visibles en pantalla (hoy solo probadas por reglas)                                        | ⏳     |
| Inicio automático con el sistema (requiere el instalador)                                                             | ⏳     |
