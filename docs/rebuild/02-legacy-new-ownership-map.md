# Fase 2 - Mapa de ownership legacy / new UI

Actualizado en F5.H: 2026-04-23

## Objetivo

Evitar hibridos largos y fragiles entre la UI actual y la nueva UI.

Este mapa no dice que una superficie esta perfecta. Dice quien es su owner visual actual:

- `legacy`: la superficie sigue dependiendo estructuralmente del sistema viejo.
- `transition`: la superficie esta parcialmente migrada o conserva compatibilidad legacy necesaria.
- `new-ui`: la superficie ya pertenece visualmente al sistema nuevo, aunque pueda requerir refinamiento en su fase.
- `frozen-contract`: no se migra como capa visual principal; se protege como contrato.

## Regla base

La convivencia temporal correcta no es "una misma pantalla con parches viejos y nuevos", sino:

- superficie aun owned by legacy;
- superficie ya owned by new UI;
- contrato congelado que solo se envuelve visualmente en su fase autorizada.

`new-ui` no significa "sin deuda". Significa que la deuda pendiente debe resolverse como refinamiento de esa fase, no como retorno a legacy.

## Ownership actual despues de F5.H

| Superficie | Estado actual | Fuente principal | Owner / siguiente fase | Nota |
|---|---|---|---|---|
| Foundation visual | `new-ui` | `frontend/src/design-system/*`, `frontend/src/components/ui/*`, `frontend/src/patterns/*`, `frontend/src/layouts/*` | F1 cerrada | Tokens, primitives, patterns de dominio y layouts base ya son fuente visual nueva. |
| Shells | `new-ui` | `frontend/src/shells/DeviceShell.jsx`, `MobileShell.jsx`, `TabletShell.jsx`, `DesktopShell.jsx` | F2 closeout | No reconstruir; solo hardening/validacion. |
| Shell policies / navigation | `new-ui` | `frontend/src/shells/navigationPolicy.js`, `shellPolicies.js`, `buildShellSlots.jsx` | F2 closeout | Politicas declarativas y testeadas; F2.D expone contrato como `data-*`. |
| Route containers | `new-ui` | `frontend/src/route-containers/*` | F2 closeout | `SessionLoadingRouteContainer` ya no usa `<main>` anidado ni clase `page`. |
| App coordinator / route switch | `transition` | `frontend/src/App.jsx` | F2 / fases posteriores | Usa `DeviceShell` y slots, pero sigue concentrando orquestacion de estado y route switch manual. No abrir fuera de fase autorizada. |
| Responsive macro | `transition` | `frontend/src/hooks/useResponsiveLayout.js` | F2 / F8 | Breakpoints macro alineados en F2.C; `dataset.shell` retirado. `viewport` e `inputMode` siguen por compatibilidad con `app.css`. |
| Auth | `new-ui` | `frontend/src/components/AuthView.jsx` | F3 cerrada | F3.B cerro el closeout visual minimo sin tocar auth core, hooks ni services. |
| Survey | `new-ui` | `frontend/src/components/SurveyView.jsx` | F3 cerrada | F3.C-F3.G cerraron primitives, a11y, layouts/patterns, flow y results/CTA sin tocar scoring ni services. |
| Dashboard / ruta | `new-ui` | `frontend/src/components/CoursesView.jsx` | F5 expandida cerrada | F5.B-F5.G consolidaron `RouteBriefing`, dos paneles balanceados, CTA dominante, progress/contexto secundario y guardrails de densidad. |
| Lesson shell | `new-ui` | `frontend/src/components/LessonView.jsx` | F5 expandida cerrada | F5.D-F5.G cerraron transicion route->lesson, layout guided/immersive, activity stage compacto y mapa secundario/collapsable. |
| Feedback panel | `new-ui` | `frontend/src/components/FeedbackPanel.jsx` | F5 expandida cerrada | F5.F lo compacto en una sola superficie con `InlineMessage` accesible y secciones internas ligeras. |
| Session bar | `new-ui` | `frontend/src/components/SessionBar.jsx` | F2/F7 segun uso | F0.6: 0 legacy. No redisenar en F2.E. |
| Activity renderer | `frozen-contract` | `frontend/src/components/activities/ActivityRenderer.jsx` | Frozen; F6 envuelve por fuera | F5 lo preservo como dispatcher sensible. No tocar salvo adaptacion minima aprobada. |
| Activity registry | `frozen-contract` | `frontend/src/components/activities/activityRegistry.js` | Contrato central | Congelado por defecto. No tocar por conveniencia visual. |
| Basic activities | `transition` | `frontend/src/components/activities/basicActivities.jsx` | F6/F8 segun alcance | F5 cerro el contenedor/chrome comun, no los internals de actividades basicas. Cualquier cleanup interno debe entrar despues con alcance explicito. |
| WhatsApp / signal activities | `transition` | `frontend/src/components/activities/signalActivities.jsx` | F6A | Hibrido confirmado: thread `sd-chat-*` nuevo, panel lateral/senales legacy. |
| SMS / Inbox / Scenario / Call / WebLab | `legacy` | `frontend/src/components/activities/immersive/*`, actividades relacionadas | F6B-F6F | No abrir antes de F6 correspondiente. |
| Chat global | `legacy` | `frontend/src/components/ChatDrawer.jsx` | F7 | No redisenar antes de F7. F2 solo puede preservar su slot/mount. |
| Admin | `legacy` | `frontend/src/components/AdminView.jsx` | F7 | Sigue owned by legacy hasta su fase. |
| App error boundary | `legacy` | `frontend/src/components/AppErrorBoundary.jsx` | F8 o fix puntual autorizado | Migracion trivial posible, pero no pertenece a F2.E. |
| CSS nuevo / foundation | `new-ui` | `frontend/src/styles/tailwind.css` | F1/F2/F8 | Contiene tokens, utilities `sd-*`, shells y primitives nuevas. |
| CSS transicional | `transition` | `frontend/src/styles/app.css` | F8 progresivo | Aun sostiene actividades, admin, chat y reglas `body[data-viewport]`. No cleanup masivo antes de F8. |
| CSS heredado | `legacy` | `frontend/src/styles/legacy.css` | F8 final | Retiro completo solo despues de cerrar F5+F6+F7. |

## Ownership especial por archivo critico

### `frontend/src/App.jsx`

- Estado: `transition`.
- Regla: no reestructurarlo como parte de F2.E.
- Evidencia: F0.6 lo marco como 0 clases legacy y renderizando `DeviceShell`; F0.9 aun lo conserva como coordinador con dependencias largas.
- Futuro: solo abrir si una subfase autorizada necesita orquestacion shell minima.

### `frontend/src/hooks/useResponsiveLayout.js`

- Estado: `transition`.
- Regla: mantener `viewport` e `inputMode` mientras `app.css` los consuma.
- F2.C cerrado: breakpoints alineados con shells y `dataset.shell` retirado.
- Futuro: retirar compatibilidad restante en F8, no en F2.E.

### `frontend/src/components/AuthView.jsx`

- Estado: `new-ui`.
- Regla: no tratar como legacy.
- Evidencia: F0.6 reporto 0 clases legacy y alta adherencia a foundation.
- Futuro: F3 solo si requiere refinamiento junto con Survey.

### `frontend/src/components/SurveyView.jsx`

- Estado: `new-ui`.
- Regla: no tocar hasta F3 refine.
- Evidencia: F0.6 reporto 0 clases legacy, pero tambien deuda por branching, state derivado y necesidad de primitives/patterns.
- Futuro: usar `QuestionPage`, `AssessmentLayout`, `Checkbox` y `Radio` creados en F1.

### `frontend/src/components/CoursesView.jsx`

- Estado: `new-ui`.
- Regla: no reabrir como ruta/dashboard salvo fase autorizada.
- Evidencia: F5 expandida cerro route top, continuidad, CTA, densidad, simetria, contraste y comfort responsive.
- Futuro: ajustes mayores pertenecen a F8 hardening o a una fase explicitamente autorizada.

### `frontend/src/components/LessonView.jsx`

- Estado: `new-ui`.
- Regla: no reabrir lesson shell fuera de F6 wrappers especificos o fase autorizada.
- Evidencia: F5 expandida cerro transicion route->lesson, layout content-first, immersive/fullscreen mode, activity chrome y comfort responsive.
- Futuro: F6 puede envolver/adaptar simulaciones especificas, pero no debe reescribir el shell base sin justificacion.

### `frontend/src/components/activities/ActivityRenderer.jsx`

- Estado: `frozen-contract`.
- Regla: no tocar salvo adaptacion minima aprobada.
- Futuro owner visual: F5, como wrapper/chrome, no como reescritura de dominio.

### `frontend/src/components/activities/activityRegistry.js`

- Estado: `frozen-contract`.
- Regla: contrato central congelado.
- Futuro: cualquier ajuste debe ser minimo, justificado y aprobado.

### `frontend/src/components/ChatDrawer.jsx`

- Estado: `legacy`.
- Regla: no rehacer antes de F7.
- En F2 solo se permite preservar su slot/mount dentro de shells.

### `frontend/src/styles/app.css`

- Estado: `transition`.
- Regla: no cleanup masivo antes de F8.
- Nota: contiene reglas aun activas para actividades, admin, chat y compatibilidad responsive legacy.

### `frontend/src/styles/legacy.css`

- Estado: `legacy`.
- Regla: no retirar hasta F8 final.
- Nota: su retiro depende de cerrar F5+F6+F7.

## Regla de corte por superficie

Una superficie solo puede pasar a `new-ui` cuando cumpla:

1. paridad funcional;
2. ownership visual nuevo casi total;
3. ausencia de dependencia estructural de `legacy.css`;
4. gates de validacion aprobados.

Las vistas `AuthView`, `SurveyView`, `CoursesView` y `LessonView` ya cumplen el criterio de ownership visual `new-ui` segun F0.6/F0.8/F0.9, aunque sus refinamientos de fase sigan pendientes.

## Deuda que sigue viva fuera de F5.H

- Courses/Lesson/activity chrome quedan cerrados por F5 expandida; no reabrirlos salvo regresion concreta.
- Simulaciones pertenecen a F6A-F6F.
- Chat/Admin pertenecen a F7.
- Cleanup masivo de `app.css` / `legacy.css` pertenece a F8.

## Veredicto F5.H

El mapa anterior de F0 quedaba desactualizado porque marcaba como `legacy` varias vistas que la auditoria F0.6/F0.8/F0.9 ya habia confirmado como visualmente migradas.

Este mapa queda alineado con el estado real: F1 foundation cerrada, F2 shell closeout cerrado, F3 Auth/Survey cerrado, F4/F5 experiencia ruta->lesson->practica cerrada, vistas principales owned by `new-ui`, y legacy real limitado a internals de actividades/simulaciones, chat/admin, error boundary y CSS transicional/heredado.
