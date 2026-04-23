# AGENTS.md

## Propósito
Este repositorio entra a un **rebuild visual total del frontend** de Escudo Digital.

La tesis obligatoria es:

- Se reconstruye por completo la capa visual del frontend.
- No se reescribe innecesariamente el cerebro funcional del producto.
- La lógica de dominio, contratos y persistencia se preservan salvo evidencia fuerte y aprobación explícita.

## Repo activo
- Repo oficial de trabajo: `C:\Users\emili\OneDrive\Documentos\GitHub\escudo-digital`
- No trabajar sobre la otra copia: `C:\Users\emili\OneDrive\Documentos\New project`

## Stack detectado
- Frontend: React 19 + Vite 7 + Tailwind v4
- Backend: Node + Express
- DB: PostgreSQL
- Build de cliente servido desde `dist/`
- Tests actuales: `node --test`

## Comandos reales del repo
- Instalar dependencias: `.\npm-local.cmd install`
- Desarrollo frontend: `.\npm-local.cmd run dev`
- Build cliente: `.\npm-local.cmd run build`
- Tests: `.\npm-local.cmd test`
- Backend local: `.\node-local.cmd server.js`
- Flujo build + server: `.\start-local.cmd`

## Nota operativa importante
- `node-local.cmd`, `npm-local.cmd` y `start-local.cmd` usan un runtime de Node ubicado bajo `C:\Users\emili\OneDrive\Documentos\New project\tools\...`.
- Eso no cambia el repo activo, pero sí es una dependencia operativa a vigilar.

## Línea base verificada en Fase 0
- `.\npm-local.cmd test`: pasando
- `.\npm-local.cmd run build`: pasando
- `vite.config.js`: `frontend/` como root, proxy `/api -> http://127.0.0.1:3000`, build a `dist/`

## Estado actual tras F5.F
- F0.1-F0.9 esta cerrada, commiteada y pusheada.
- F0.9 identifico la fase real del rebuild como **F1.9**: habia trabajo acumulado de F1 a F6A, pero la foundation visual no estaba cerrada.
- La regresion disciplinada a F1 closeout ya quedo cerrada localmente en bloques F1.A-F1.I.
- F1 patterns de dominio quedo cerrado localmente con `QuestionPage`, `InfoPanel` y `AssessmentLayout`.
- F2 fue abierta como **closeout / shell hardening**, no como reconstruccion desde cero de shells.
- F2.A-F2.F quedaron cerradas localmente:
  - F2.A Shell baseline audit
  - F2.B DeviceShell dispatcher hardening
  - F2.C Responsive breakpoints + dataset policy
  - F2.D Shell contract + navigation hardening
  - F2.E Ownership map / docs
- F2.F F2 closeout validation
- F2 closeout queda cerrado localmente.
- F3 fue abierta como **Auth + Survey refine** en subfases pequeñas.
- F3.A Auth + Survey baseline audit quedo cerrada localmente con `docs/rebuild/audit/F3.A-auth-survey-baseline-audit.md`.
- F3.A no implemento cambios en `AuthView.jsx` ni `SurveyView.jsx`; solo definio matriz de decision y alcance F3.B-F3.G.
- F3.B AuthView closeout minimo quedo cerrado localmente con `docs/rebuild/audit/F3.B-authview-closeout.md`.
- F3.B solo toco `AuthView.jsx`, `test/f3-auth-survey-smoke.test.js` y docs. No toco auth core, hooks ni services.
- F3.C Survey primitives + a11y pass quedo cerrado localmente con `docs/rebuild/audit/F3.C-survey-primitives-a11y.md`.
- F3.C migro opciones `single` a `Radio`, opciones `multi` a `Checkbox`, retiro `SurveyChoiceCard`, y conecto `fieldset`/`legend`/`aria-describedby`/`aria-invalid`/`aria-required` sin tocar `useAssessmentFlow`, scoring, services ni backend.
- F3.D Survey layout / patterns pass quedo cerrado localmente con `docs/rebuild/audit/F3.D-survey-layout-patterns.md`.
- F3.D adopto `QuestionPage`, `AssessmentLayout` e `InfoPanel` para la escena activa de preguntas. Tambien endurecio `QuestionPage` con `aria-describedby` externo, `errorId`, `errorTitle` y `aria-required`, e hizo que `InfoPanel` acepte `as` para evitar aside anidado.
- F3.D no cambio intro/loading/results, `showIntro`, flow, hooks, scoring, services ni backend.
- F3.E Survey flow hardening quedo cerrado localmente con `docs/rebuild/audit/F3.E-survey-flow-hardening.md`.
- F3.E centralizo el gate de intro, agrego reset pendiente para reinicio real, resolvio render con `activeSurveyScene`, y anuncio loading con `role="status"`, `aria-live` y `aria-busy`.
- F3.E no cambio results/CTA, hooks, scoring, services ni backend.
- F3.F Results / perfil / CTA closeout quedo cerrado localmente con `docs/rebuild/audit/F3.F-results-profile-cta.md`.
- F3.F migro results a `AssessmentLayout`, retiro `WorkspaceLayout`/grid local de results, tokenizo el perfil/riesgo, hizo semantica la lista de recomendaciones, y dejo `Ver mi ruta` como CTA primario `size="lg"` con fallback `courseError` accesible.
- F3.F verifico el wiring de `resolveActiveRoute.jsx` en lectura, pero no lo modifico.
- F3.G F3 closeout validation quedo cerrada localmente con `docs/rebuild/audit/F3.G-f3-closeout-validation.md`.
- F3.G valido `.\npm-local.cmd test` (53/53), `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`.
- F3.G no implemento cambios nuevos en vistas ni logica; solo documento el cierre y actualizo contexto de agente.
- F3 Auth + Survey refine queda cerrado localmente.
- F4.A Dashboard / Courses baseline audit quedo cerrada localmente con `docs/rebuild/audit/F4.A-dashboard-courses-baseline-audit.md`.
- F4.A audito `CoursesView.jsx` y su red de dependencias sin tocar implementacion.
- F4.A refinada quedo cerrada localmente con `docs/rebuild/audit/F4.A-courses-baseline-audit.md` como baseline definitivo de UX para `CoursesView`.
- F4.A refinada separo densidad, jerarquia, CTA, simetria y comodidad visual de problemas que pertenecen a F5.
- F4.A confirmo que el siguiente frente de trabajo es F4.B - Information architecture / density pass y que no conviene abrir F5/F6/F7 sin autorizacion explicita.
- F4.B Information architecture / density pass quedo cerrada localmente con `docs/rebuild/audit/F4.B-information-density.md`.
- F4.B redujo densidad en `CoursesView.jsx`: retiro stats/badges secundarios, copy redundante, `ProgressSummary` duplicado, contadores de rail, metadata de continuidad y lecturas laterales repetidas.
- F4.B agrego `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` (61/61) + `.\npm-local.cmd run build`.
- F4.C Hero + continuity + CTA pass quedo cerrada localmente con `docs/rebuild/audit/F4.C-hero-continuity-cta.md`.
- F4.C hizo que `RouteHero` oriente sin competir con CTA y que `ContinuityConsole` sea la region dominante de accion usando `SurfaceCard variant="command" tone="inverse"`.
- F4.C movio el CTA primario antes del progreso de apoyo, agrego `data-sd-primary-cta="courses-continuity"` y dejo `aria-label` especifico por modulo.
- F4.C amplio `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` (63/63).
- F4.D Route navigator + module detail pass quedo cerrada localmente con `docs/rebuild/audit/F4.D-route-navigator-module-detail.md`.
- F4.D bajo el rail de modulos a `SurfaceCard variant="support"`, retiro hacks inversos locales, mejoro wrapping/estado de `RouteModulePill` y conecto lista -> detalle con atributos estables.
- F4.D hizo que `ModuleMissionBoard` muestre CTA local antes del progreso de apoyo y retiro metadata secundaria de ultimo cierre/actividades.
- F4.D amplio `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` (67/67).
- F4.E Progress / stats / adjustments pass quedo cerrada localmente con `docs/rebuild/audit/F4.E-progress-stats-adjustments.md`.
- F4.E priorizo stats accionables en `ProgressScene`: ruta, fortaleza y gap; retiro `Shield`, snapshots vacios y lecturas decorativas.
- F4.E hizo que `SettingsScene` sea una superficie secundaria de control con `tone="support"`, `variant="panel"`, resumen de temas priorizados y CTA `data-sd-settings-cta="courses-regenerate"`.
- F4.E amplio `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` (70/70).
- F4.F Shell/layout comfort pass quedo cerrada localmente con `docs/rebuild/audit/F4.F-shell-layout-comfort.md`.
- F4.F renderizo `JourneyStepper` desde `DashboardSceneBar`, marco `data-sd-route-layout`, balanceo columnas por shell y retiro el sticky interno incomodo de `ModuleMissionBoard`.
- F4.F hizo que `SettingsScene` use `md:grid-cols-2 xl:grid-cols-3` para evitar tres selects apretados en tablet.
- F4.F amplio `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` (74/74).
- F4.G F4 closeout validation quedo cerrada localmente con `docs/rebuild/audit/F4.G-f4-closeout-validation.md`.
- F4.G valido `.\npm-local.cmd test` (74/74), `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`.
- F4.G no implemento cambios nuevos en `CoursesView.jsx`; solo documento el cierre y actualizo contexto de agente.
- F4 refine queda cerrada localmente.
- F5.A Lesson shell / activity chrome baseline audit quedo cerrada localmente con `docs/rebuild/audit/F5.A-lesson-shell-activity-chrome-baseline-audit.md`.
- F5.A audito `LessonView.jsx`, `ActivityRenderer.jsx`, `activityRegistry.js`, `sharedActivityUi.jsx`, `FeedbackPanel.jsx`, actividades basicas y simulaciones en lectura.
- F5.A confirmo que `LessonView` ya usa foundation/patterns, pero todavia debe cerrar la frontera `LessonActivityStage` -> `ActivityChrome`.
- F5.A confirmo que `ActivityRenderer` y `activityRegistry` siguen siendo contratos sensibles congelados.
- F5.A separo F5 de F6: F5 cubre lesson shell, generic activity chrome, feedback, module complete y actividades basicas; F6 cubre WhatsApp/SMS/Inbox/ScenarioFlow/CallSimulation/WebLab.
- F5.A no implemento cambios en vistas, actividades, renderer, registry, estilos, dominio ni backend.
- Luego el usuario redefinio F5 como **F5 expandida - Route -> Lesson -> Experience refine**, absorbiendo ruta, transicion a lesson, lesson shell y activity chrome como una sola familia de experiencia.
- F5.A Experience baseline audit quedo cerrada localmente con `docs/rebuild/audit/F5.A-experience-baseline-audit.md`.
- F5.A unificada confirmo problemas de top shelf fragmentado, exceso de columnas, contraste pobre, lesson demasiado dashboard, actividad con poco ancho util y falta de sensacion fullscreen/demo-ready.
- F5.B Route top / continuity / CTA refactor quedo cerrada localmente con `docs/rebuild/audit/F5.B-route-top-continuity-cta.md`.
- F5.B unifico `RouteHero` + `ContinuityConsole` + `TopSupportBand` en `RouteBriefing`, una sola superficie `command`/`inverse` con CTA dominante y progreso inline.
- F5.C Route density / symmetry / contrast cleanup quedo cerrada localmente con `docs/rebuild/audit/F5.C-route-density-symmetry-contrast.md`.
- F5.C aplano la pestana Ruta a dos paneles desktop, elimino `RouteInsightRail`, compacto `RouteModulePill`/`ModuleActivityList`, simplifico `ModuleMissionBoard`, `ProgressScene` y `SettingsScene`.
- F5.D Route-to-lesson transition pass quedo cerrada localmente con `docs/rebuild/audit/F5.D-route-to-lesson-transition.md`.
- F5.D alineo `LessonMissionHero` con el lenguaje visual de `RouteBriefing`: `SurfaceCard variant="command" tone="inverse"`, `sd-title-display`, CTA ghost para volver a ruta, progreso inline con `ProgressBar`, `data-sd-lesson-source="courses-continuity"` y animacion `sd-lesson-enter`.
- F5.D agrego `test/f5-lesson-transition-smoke.test.js`.
- F5.D valido `.\npm-local.cmd test` (79/79), `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`.
- F5.D no toco `ActivityRenderer`, `activityRegistry`, simulaciones, hooks de dominio, services, backend, contracts, scoring, `app.css` ni `legacy.css`.
- F5.E Lesson shell layout refactor (content-first / fullscreen) quedo cerrada localmente con `docs/rebuild/audit/F5.E-lesson-shell-fullscreen.md`.
- F5.E agrego deteccion pasiva `guided`/`immersive` en `LessonView` para `sim_chat`, `inbox`, `web_lab`, `call_sim` y `scenario_flow`.
- F5.E elimino el uso de `WorkspaceLayout` en el render principal de `LessonView` y lo reemplazo por `data-sd-lesson-layout="immersive-fullscreen"` o `"guided-two-pane"`.
- F5.E hizo que actividades inmersivas rendericen el `ActivityRenderer` sin `SurfaceCard spotlight` ni panel de lesson anidado.
- F5.E extendio `ActivityChrome` para bypass del chrome generico en todas las inmersivas, preservando `sd-chat-activity-shell` para `sim_chat`.
- F5.E movio mapa/contexto de inmersivas debajo de la practica y lo hizo compact/collapsable.
- F5.E oculta `LessonInsightRail` cuando no hay historial ni ultima reentrada.
- F5.E agrego `test/f5-lesson-shell-smoke.test.js`.
- F5.E valido `.\npm-local.cmd test` (83/83), `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`.
- F5.E no toco `ActivityRenderer`, `activityRegistry`, simulaciones internas, hooks de dominio, services, backend, contracts, scoring, `app.css` ni `legacy.css`.
- F5.F Activity chrome + instructions + feedback integration quedo cerrada localmente con `docs/rebuild/audit/F5.F-activity-chrome-feedback.md`.
- F5.F hizo que `LessonActivityStage` delegue el briefing visible a `ActivityChrome` y elimino instrucciones duplicadas dentro del stage guiado.
- F5.F convirtio el briefing guiado de `ActivityChrome` en una superficie colapsable unica con `data-sd-briefing="activity-chrome"`.
- F5.F hizo que `SimulationGuide` sea siempre colapsable y secundaria, sin card permanente.
- F5.F compacto `FeedbackPanel` a una sola superficie con secciones internas ligeras y `data-sd-feedback-panel="true"`.
- F5.F agrego `test/f5-activity-chrome-smoke.test.js`.
- F5.F valido `.\npm-local.cmd test` (88/88), `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`.
- F5.F no toco `ActivityRenderer`, `activityRegistry`, simulaciones internas, hooks de dominio, services, backend, contracts, scoring, `CoursesView.jsx`, `app.css` ni `legacy.css`.
- El siguiente frente recomendado es F5.G - Comfort / jugabilidad / responsiveness pass.
- No abrir F5.G/F6/F7 ni retomar WIP de simulaciones sin autorizacion explicita del usuario.
- Storybook ya existe en `package.json` (`storybook` y `build-storybook`) y hay configuracion en `.storybook/`.

## Núcleo funcional preservado por defecto
No tocar como eje del rebuild:

- hooks de dominio
- services / API contracts
- backend como dominio
- DB schema
- scoring engine
- assessment engine
- course generation logic
- progress logic
- sync remoto/local
- auth flow core
- `activityRegistry` como contrato
- `ActivityRenderer` como dispatcher/chrome base salvo adaptación mínima aprobada
- `courseRules`
- feedback rules
- scenario selection core
- analytics aggregation core

## Archivos críticos de verdad operativa
Estos archivos son fuente primaria para decisiones del rebuild:

- `frontend/src/App.jsx`
- `frontend/src/hooks/useResponsiveLayout.js`
- `frontend/src/components/CoursesView.jsx`
- `frontend/src/components/LessonView.jsx`
- `frontend/src/components/activities/ActivityRenderer.jsx`
- `frontend/src/components/activities/activityRegistry.js`
- `frontend/src/components/ChatDrawer.jsx`
- `frontend/src/styles/app.css`
- `frontend/src/styles/legacy.css`

## Lectura actual del repo
- `App.jsx` concentra coordinación de estado, route switch manual, responsive, chat y admin.
- `useResponsiveLayout.js` usa buckets de viewport y escribe `body.dataset.*`.
- `CoursesView.jsx` y `LessonView.jsx` combinan layout con derivación de estado/presentación.
- `ActivityRenderer.jsx` y `activityRegistry.js` forman un contrato central sensible.
- `ChatDrawer.jsx` ya es una superficie transversal, pero no debe rediseñarse antes de su fase.
- `app.css` y `legacy.css` conviven y sostienen parte importante del layout actual.

## Orden oficial de fases
1. Fase 0 — Auditoría y Guardrails
2. Fase 1 — Foundation visual
3. Fase 2 — Shells y navegación
4. Fase 3 — Auth + Survey
5. Fase 4 — Dashboard / Ruta
6. Fase 5 — Lesson shell + activity chrome
7. Fase 6 — Simulaciones
8. Fase 7 — Chat + Admin
9. Fase 8 — Hardening y cleanup
10. Fase 9 — Rollout controlado

## Orden oficial de simulaciones
1. WhatsApp / chat
2. SMS
3. Inbox / correo
4. ScenarioFlow
5. CallSimulation
6. WebLab / páginas clonadas

## Reglas duras para cualquier agente
- No convertir el rebuild en reescritura general del producto.
- No abrir backend como frente principal.
- No tocar el dominio por conveniencia visual.
- No migrar por parchecitos dentro de una misma experiencia.
- No dejar mezcla larga entre legacy y nuevo en una superficie protagonista.
- No tocar `activityRegistry` ni `ActivityRenderer` salvo cambios mínimos aprobados y justificados.
- No abrir `legacy.css` cleanup antes de la fase correspondiente.
- No mezclar en una misma tarea shells + simulaciones complejas + admin.

## Tamaño ideal de tarea
Una tarea debe cubrir solo uno de estos tipos:

- auditoría de un bloque
- foundation de un grupo de primitives/patterns
- split de shell/orquestación
- migración completa de una vista
- migración de una familia de simulación
- pase de accesibilidad
- pase de performance
- cleanup puntual

No mezclar en un mismo prompt varias superficies protagonistas complejas.

## Validación mínima por bloque
Cada bloque debe cerrar con evidencia en cuatro planos:

- funcional
- visual
- accesibilidad
- performance

Y además:

- `.\npm-local.cmd test`
- `.\npm-local.cmd run build`
- smoke del flujo afectado

## Riesgos inmediatos detectados antes de Fase 1
- `App.jsx` está demasiado cargado y será el cuello de botella del split futuro.
- `useResponsiveLayout.js` está acoplado a `body.dataset.viewport`, lo que complica la migración a shells reales.
- `app.css` y `legacy.css` sostienen layout y apariencia al mismo tiempo; retirar esto sin ownership claro sería riesgoso.
- `CoursesView.jsx` y `LessonView.jsx` no deben tocarse a la vez en una sola tarea.
- `CallSimulation` y `WebLab` deben entrar tarde, con base visual madura.
- Storybook ya existe; MSW, Playwright y skills locales aún no están formalizados para este rebuild. Fase 1 debe decidir si incorpora algo más.

## Índice de outputs de Fase 0
- `docs/rebuild/00-no-tocar-matrix.md`
- `docs/rebuild/01-golden-flows.md`
- `docs/rebuild/02-legacy-new-ownership-map.md`
- `docs/rebuild/03-phase-prompt-templates.md`
- `docs/rebuild/04-validation-checklists.md`
- `docs/rebuild/05-shell-contract.md`
- `docs/rebuild/06-simulation-order-and-rules.md`
- `docs/rebuild/07-skills-usage-plan.md`
- `docs/rebuild/audit/F0.1-inventory.md`
- `docs/rebuild/audit/F0.2-design-system-audit.md`
- `docs/rebuild/audit/F0.3-primitives-audit.md`
- `docs/rebuild/audit/F0.4-shells-audit.md`
- `docs/rebuild/audit/F0.5-patterns-audit.md`
- `docs/rebuild/audit/F0.6-views-audit.md`
- `docs/rebuild/audit/F0.7-functional-check.md`
- `docs/rebuild/audit/F0.8-legacy-inventory.md`
- `docs/rebuild/audit/F0.9-synthesis-and-next-steps.md`
