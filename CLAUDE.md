# CLAUDE.md

Escudo Digital — rebuild visual del frontend. Ver `AGENTS.md` para contexto completo del producto.

## Fuentes de verdad obligatorias

Todo agente que trabaje en este repo debe leer y respetar estos documentos antes de ejecutar cualquier tarea del rebuild:

- `AGENTS.md` — contexto de producto, stack, reglas del rebuild
- `docs/rebuild/00-no-tocar-matrix.md` — perímetro duro del rebuild (qué está congelado)
- `docs/rebuild/01-golden-flows.md` — journeys que no se pueden romper
- `docs/rebuild/02-legacy-new-ownership-map.md` — ownership legacy / new UI por superficie
- `docs/rebuild/03-phase-prompt-templates.md` — plantillas estándar de prompts por fase
- `docs/rebuild/04-validation-checklists.md` — checklists funcional / visual / a11y / performance por bloque
- `docs/rebuild/05-shell-contract.md` — contrato de MobileShell / TabletShell / DesktopShell
- `docs/rebuild/06-simulation-order-and-rules.md` — orden y reglas de las simulaciones 6A–6F
- `docs/rebuild/07-skills-usage-plan.md` — workflows / skills propuestos para el rebuild

`AGENTS.md` es fuente de verdad del producto. `docs/rebuild/00..07` es el marco operativo. Ambos son normativos.

## Reglas operativas para Claude Code

Estas reglas son específicas de esta herramienta y complementan lo definido en `AGENTS.md` y `docs/rebuild/`.

1. **Reporte por subfase.** Al terminar cada subfase (F0.X, F1.X, etc.), reportar exactamente con el formato establecido por el prompt de la fase (ej.: `F0.X COMPLETADA — [nombre]`, con deliverable, hallazgos, problemas, commit, espera de autorización).
2. **Gate de autorización explícita entre subfases.** No avanzar de F0.X a F0.Y (ni de FN.X a FN.Y) sin recibir del usuario `OK F0.X continuar a F0.Y` (o equivalente) por escrito. No asumir autorización implícita. No avanzar por iniciativa propia.
3. **F0 cerrada.** La auditoría F0.1-F0.9 ya está cerrada, commiteada y pusheada. No reabrir F0 salvo instrucción explícita del usuario.
4. **Perímetro por fase.** No tocar código fuera del alcance autorizado por la fase en curso. La matriz `docs/rebuild/00-no-tocar-matrix.md` y el mapa `docs/rebuild/02-legacy-new-ownership-map.md` definen qué es intocable y qué pertenece a qué fase.
5. **Repo activo.** El único repo de trabajo autorizado es `C:\Users\emili\OneDrive\Documentos\GitHub\escudo-digital`. No tocar la copia paralela en `C:\Users\emili\OneDrive\Documentos\New project` bajo ninguna circunstancia, aunque comparta archivos o historial.
6. **Un prompt = un bloque coherente.** No mezclar shells + vistas + simulaciones + admin en la misma tarea. Seguir el tamaño ideal de tarea definido en `AGENTS.md`.
7. **No push sin autorización.** Los commits locales son permitidos según las reglas anteriores; `git push` requiere instrucción explícita del usuario.

## Fase actual

**F7.A Chat + Admin baseline audit abierta localmente. Siguiente frente recomendado: F7.B Chat drawer accessibility pass.**

F6.J cerró el borde transversal compartido de las simulaciones:

- `SimulationCloseout` unifica el tramo final de feedback, resumen y acciones.
- `basicActivities`, `signalActivities`, `WebLabActivity`, `InboxActivity`, `ScenarioFlowActivity` y `CallSimulationActivity` comparten el mismo contenedor de cierre.
- `test/f6-cross-simulation-closeout-smoke.test.js` protege el wrapper y sus consumos.
- La capa compartida de estilos expone `sd-simulation-closeout` para mantener la misma densidad visual en todos los finales.

F0.9 identifico que la fase real del rebuild era **F1.9**: habia trabajo acumulado de F1 a F6A, pero la foundation visual estaba incompleta.

La regresion disciplinada a F1 closeout ya se ejecuto localmente:

- F1.A typography tokens
- F1.B educational tokens
- F1.C InlineMessage role / aria-live
- F1.D OverlayFrame focus trap
- F1.E Checkbox + Radio
- F1.F IconButton
- F1.G SurfaceCard `tone="inverse"`
- F1.H ProgressSummary + JourneyStepper
- F1.I closeout final

El bloque **F1 patterns de dominio** tambien quedo ejecutado localmente:

- `QuestionPage`
- `InfoPanel`
- `AssessmentLayout`

F2 fue abierta como **closeout tecnico**, no como reconstruccion de shells desde cero. La decision vigente es:

- no reconstruir `MobileShell`, `TabletShell` ni `DesktopShell`;
- no redisenar vistas grandes;
- endurecer dispatcher, breakpoints, datasets, contrato de slots, navigation policy y docs;
- dejar la capa shell estable para poder abrir F3 despues de F2.F.

Subfases F2 cerradas localmente:

- F2.A Shell baseline audit
- F2.B DeviceShell dispatcher hardening
- F2.C Responsive breakpoints + dataset policy
- F2.D Shell contract + navigation hardening
- F2.E Ownership map / docs
- F2.F F2 closeout validation

F3 debe ejecutarse en subfases pequeñas:

- F3.A Auth + Survey baseline audit
- F3.B AuthView closeout minimo
- F3.C Survey primitives + a11y pass
- F3.D Survey layout / patterns pass
- F3.E Survey flow hardening
- F3.F Results / perfil / CTA closeout
- F3.G F3 closeout validation

F3.A solo audito y genero `docs/rebuild/audit/F3.A-auth-survey-baseline-audit.md`. No implemento cambios en `AuthView.jsx` ni `SurveyView.jsx`.

F3.B cerro AuthView de forma minima:

- `SurfaceCard tone="inverse"` reemplaza hacks `text-white` / shadow arbitrario en loading.
- wrapper `sd-page-shell py[...]` retirado fuera de mobile.
- override local de grid en `SplitHeroLayout` retirado.
- guard agregado en `test/f3-auth-survey-smoke.test.js`.

F3.C cerro Survey primitives + a11y pass de forma minima:

- opciones `single` migradas a `Radio`;
- opciones `multi` migradas a `Checkbox`;
- `SurveyChoiceCard` local retirado;
- preguntas agrupadas con `fieldset` / `legend`;
- `aria-describedby`, `aria-invalid` y `aria-required` conectados a controles;
- `InlineMessage` de flujo y validacion enlazado por id;
- `Select` y `TextArea` reciben id/name/required/invalid/aria-describedby;
- guard agregado en `test/f3-auth-survey-smoke.test.js`.

F3.D cerro Survey layout / patterns pass de forma minima:

- `QuestionBoard` delega en `QuestionPage`;
- `QuestionPage` soporta `aria-describedby` externo, `errorId`, `errorTitle` y `aria-required`;
- `SurveyStageScene` usa `AssessmentLayout`;
- `SurveyInsightDeck` usa `InfoPanel`;
- `InfoPanel` soporta prop `as` para evitar aside anidado;
- se retiraron overrides locales `!grid-cols` del progreso de la escena activa;
- no se tocaron intro/loading/results ni flow.

F3.E cerro Survey flow hardening de forma minima:

- `shouldShowSurveyIntro` centraliza el gate de intro;
- `introResetPendingRef` permite reabrir intro tras reinicio real desde results/loading, sin reaparecer por borrar respuestas;
- `getSurveyScene` / `activeSurveyScene` aseguran una sola escena visible;
- loading usa `role="status"`, `aria-live="polite"` y `aria-busy="true"`;
- loading usa `SurfaceCard tone="inverse"` y tokens tipograficos, sin hacks locales `text-white` / shadow arbitrario;
- no se tocaron results/CTA ni hooks de dominio.

F3.F cerro Results / perfil / CTA closeout de forma minima:

- `ResultsScene` usa `AssessmentLayout`;
- results ya no usa `WorkspaceLayout` ni grid local desktop;
- perfil/riesgo usa `sd-title` y radius tokenizado, sin tracking negativo;
- recomendaciones se renderizan como lista semantica;
- CTA `Ver mi ruta` es `Button variant="primary" size="lg"` y mantiene `onTakeCourses`;
- `courseError` usa fallback `Intentar abrir mi ruta de nuevo` y queda enlazado por `aria-describedby`;
- wiring de `resolveActiveRoute.jsx` fue verificado en lectura y no se modifico.

F3.G cerro F3 closeout validation:

- genero `docs/rebuild/audit/F3.G-f3-closeout-validation.md`;
- valido `.\npm-local.cmd test` con 53/53 tests pasando;
- valido `.\npm-local.cmd run build`;
- valido `.\npm-local.cmd run build-storybook`;
- valido `git diff --check`;
- confirmo que F3 solo toco Auth/Survey/patterns/docs/tests permitidos;
- confirmo que no se tocaron vistas grandes posteriores, simulaciones, dominio, backend, contracts, hooks, `app.css` ni `legacy.css`.

F4.A Dashboard / Courses baseline audit quedo cerrada localmente:

- genero `docs/rebuild/audit/F4.A-dashboard-courses-baseline-audit.md`;
- audito `CoursesView.jsx` como monolito de 1702 lineas y confirme su red de dependencias, pruebas y deuda visible;
- confirme que `CoursesView` sigue siendo la unica superficie de F4 por ahora;
- confirme que no se toco implementacion, solo auditoria y contexto;
- luego se ejecuto F4.A refinada como baseline definitivo de UX en `docs/rebuild/audit/F4.A-courses-baseline-audit.md`;
- la F4.A refinada audito densidad, jerarquia, CTA, simetria, comodidad visual y separacion F4 vs F5;
- F4.B Information architecture / density pass quedo cerrada localmente con `docs/rebuild/audit/F4.B-information-density.md`;
- F4.B redujo densidad en `CoursesView.jsx`: retiro stats/badges secundarios, copy redundante, `ProgressSummary` duplicado, contadores de rail, metadata de continuidad y lecturas laterales repetidas;
- F4.B agrego `test/f4-courses-dashboard-smoke.test.js` para evitar regresion de densidad;
- F4.B valido `.\npm-local.cmd test` con 61/61 y `.\npm-local.cmd run build`;
- F4.C Hero + continuity + CTA pass quedo cerrada localmente con `docs/rebuild/audit/F4.C-hero-continuity-cta.md`;
- F4.C hizo que `RouteHero` oriente sin competir con CTA y que `ContinuityConsole` sea la region dominante de accion usando `SurfaceCard variant="command" tone="inverse"`;
- F4.C movio el CTA primario antes del progreso de apoyo, agrego `data-sd-primary-cta="courses-continuity"` y dejo `aria-label` especifico por modulo;
- F4.C valido `.\npm-local.cmd test` con 63/63;
- F4.D Route navigator + module detail pass quedo cerrada localmente con `docs/rebuild/audit/F4.D-route-navigator-module-detail.md`;
- F4.D bajo el rail de modulos a `SurfaceCard variant="support"`, retiro hacks inversos locales, mejoro wrapping/estado de `RouteModulePill` y conecto lista -> detalle con atributos estables;
- F4.D hizo que `ModuleMissionBoard` muestre CTA local antes del progreso de apoyo y retiro metadata secundaria de ultimo cierre/actividades;
- F4.D amplio `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` con 67/67;
- F4.E Progress / stats / adjustments pass quedo cerrada localmente con `docs/rebuild/audit/F4.E-progress-stats-adjustments.md`;
- F4.E priorizo stats accionables en `ProgressScene`: ruta, fortaleza y gap; retiro `Shield`, snapshots vacios y lecturas decorativas;
- F4.E hizo que `SettingsScene` sea una superficie secundaria de control con `tone="support"`, `variant="panel"`, resumen de temas priorizados y CTA `data-sd-settings-cta="courses-regenerate"`;
- F4.E amplio `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` con 70/70;
- F4.F Shell/layout comfort pass quedo cerrada localmente con `docs/rebuild/audit/F4.F-shell-layout-comfort.md`;
- F4.F renderizo `JourneyStepper` desde `DashboardSceneBar`, marco `data-sd-route-layout`, balanceo columnas por shell y retiro el sticky interno incomodo de `ModuleMissionBoard`;
- F4.F hizo que `SettingsScene` use `md:grid-cols-2 xl:grid-cols-3` para evitar tres selects apretados en tablet;
- F4.F amplio `test/f4-courses-dashboard-smoke.test.js` y valido `.\npm-local.cmd test` con 74/74;
- F4.G F4 closeout validation quedo cerrada localmente con `docs/rebuild/audit/F4.G-f4-closeout-validation.md`;
- F4.G valido `.\npm-local.cmd test` con 74/74, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F4.G no implemento cambios nuevos en `CoursesView.jsx`; solo documento el cierre y actualizo contexto de agente;
- F4 refine queda cerrada localmente;
- F5.A Lesson shell / activity chrome baseline audit quedo cerrada localmente con `docs/rebuild/audit/F5.A-lesson-shell-activity-chrome-baseline-audit.md`;
- F5.A audito `LessonView.jsx`, `ActivityRenderer.jsx`, `activityRegistry.js`, `sharedActivityUi.jsx`, `FeedbackPanel.jsx`, actividades basicas y simulaciones en lectura;
- F5.A confirmo que `LessonView` ya usa foundation/patterns, pero todavia debe cerrar la frontera `LessonActivityStage` -> `ActivityChrome`;
- F5.A confirmo que `ActivityRenderer` y `activityRegistry` siguen siendo contratos sensibles congelados;
- F5.A separo F5 de F6: F5 cubre lesson shell, generic activity chrome, feedback, module complete y actividades basicas; F6 cubre WhatsApp/SMS/Inbox/ScenarioFlow/CallSimulation/WebLab;
- F5.A no implemento cambios en vistas, actividades, renderer, registry, estilos, dominio ni backend;
- luego el usuario redefinio F5 como **F5 expandida - Route -> Lesson -> Experience refine**, absorbiendo ruta, transicion a lesson, lesson shell y activity chrome como una sola familia de experiencia;
- F5.A Experience baseline audit quedo cerrada localmente con `docs/rebuild/audit/F5.A-experience-baseline-audit.md`;
- F5.A unificada confirmo problemas de top shelf fragmentado, exceso de columnas, contraste pobre, lesson demasiado dashboard, actividad con poco ancho util y falta de sensacion fullscreen/demo-ready;
- F5.B Route top / continuity / CTA refactor quedo cerrada localmente con `docs/rebuild/audit/F5.B-route-top-continuity-cta.md`;
- F5.B unifico `RouteHero` + `ContinuityConsole` + `TopSupportBand` en `RouteBriefing`, una sola superficie `command`/`inverse` con CTA dominante y progreso inline;
- F5.C Route density / symmetry / contrast cleanup quedo cerrada localmente con `docs/rebuild/audit/F5.C-route-density-symmetry-contrast.md`;
- F5.C aplanó la pestaña Ruta a dos paneles desktop, eliminó `RouteInsightRail`, compactó `RouteModulePill`/`ModuleActivityList`, simplificó `ModuleMissionBoard`, `ProgressScene` y `SettingsScene`;
- F5.D Route-to-lesson transition pass quedo cerrada localmente con `docs/rebuild/audit/F5.D-route-to-lesson-transition.md`;
- F5.D alineo `LessonMissionHero` con el lenguaje visual de `RouteBriefing`: `SurfaceCard variant="command" tone="inverse"`, `sd-title-display`, CTA ghost para volver a ruta, progreso inline con `ProgressBar`, `data-sd-lesson-source="courses-continuity"` y animacion `sd-lesson-enter`;
- F5.D agrego `test/f5-lesson-transition-smoke.test.js`;
- F5.D valido `.\npm-local.cmd test` con 79/79, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F5.D no toco `ActivityRenderer`, `activityRegistry`, simulaciones, hooks de dominio, services, backend, contracts, scoring, `app.css` ni `legacy.css`;
- F5.E Lesson shell layout refactor (content-first / fullscreen) quedo cerrada localmente con `docs/rebuild/audit/F5.E-lesson-shell-fullscreen.md`;
- F5.E agrego deteccion pasiva `guided`/`immersive` en `LessonView` para `sim_chat`, `inbox`, `web_lab`, `call_sim` y `scenario_flow`;
- F5.E elimino el uso de `WorkspaceLayout` en el render principal de `LessonView` y lo reemplazo por `data-sd-lesson-layout="immersive-fullscreen"` o `"guided-two-pane"`;
- F5.E hizo que actividades inmersivas rendericen el `ActivityRenderer` sin `SurfaceCard spotlight` ni panel de lesson anidado;
- F5.E extendio `ActivityChrome` para bypass del chrome generico en todas las inmersivas, preservando `sd-chat-activity-shell` para `sim_chat`;
- F5.E movio mapa/contexto de inmersivas debajo de la practica y lo hizo compact/collapsable;
- F5.E oculta `LessonInsightRail` cuando no hay historial ni ultima reentrada;
- F5.E agrego `test/f5-lesson-shell-smoke.test.js`;
- F5.E valido `.\npm-local.cmd test` con 83/83, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F5.E no toco `ActivityRenderer`, `activityRegistry`, simulaciones internas, hooks de dominio, services, backend, contracts, scoring, `app.css` ni `legacy.css`;
- F5.F Activity chrome + instructions + feedback integration quedo cerrada localmente con `docs/rebuild/audit/F5.F-activity-chrome-feedback.md`;
- F5.F hizo que `LessonActivityStage` delegue el briefing visible a `ActivityChrome` y elimino instrucciones duplicadas dentro del stage guiado;
- F5.F convirtio el briefing guiado de `ActivityChrome` en una superficie colapsable unica con `data-sd-briefing="activity-chrome"`;
- F5.F hizo que `SimulationGuide` sea siempre colapsable y secundaria, sin card permanente;
- F5.F compacto `FeedbackPanel` a una sola superficie con secciones internas ligeras y `data-sd-feedback-panel="true"`;
- F5.F agrego `test/f5-activity-chrome-smoke.test.js`;
- F5.F valido `.\npm-local.cmd test` con 88/88, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F5.F no toco `ActivityRenderer`, `activityRegistry`, simulaciones internas, hooks de dominio, services, backend, contracts, scoring, `CoursesView.jsx`, `app.css` ni `legacy.css`;
- F5.G Comfort / jugabilidad / responsiveness pass quedo cerrada localmente con `docs/rebuild/audit/F5.G-comfort-jugabilidad-responsiveness.md`;
- F5.G ajusto proporciones de ruta a `data-sd-route-comfort="balanced-two-pane"` con ratios menos agresivos en tablet/desktop;
- F5.G hizo que `JourneyStepper` viva en `details.sd-dashboard-stepper-toggle` como contexto secundario;
- F5.G compacto el `LessonActivityStage` guiado con `padding="md"`, `data-sd-stage-comfort="compact"` y menor padding del renderer frame;
- F5.G hizo que el mapa del modulo en `LessonCommandRail` sea secundario/collapsable en todos los shells con `data-sd-lesson-map="secondary"`;
- F5.G reforzo hooks CSS de contraste para pills seleccionadas/recomendadas y dio min-height fullscreen a `.sd-immersive-activity-shell`;
- F5.G agrego `test/f5-comfort-responsive-smoke.test.js` y actualizo ratios esperados en `test/f4-courses-dashboard-smoke.test.js`;
- F5.G valido `.\npm-local.cmd test` con 91/91, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F5.G no toco `ActivityRenderer`, `activityRegistry`, simulaciones internas, hooks de dominio, services, backend, contracts, scoring, `app.css` ni `legacy.css`;
- F5.H F5 closeout validation quedo cerrada localmente con `docs/rebuild/audit/F5.H-f5-closeout-validation.md`;
- F5.H valido `.\npm-local.cmd test` con 91/91, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F5.H confirmo line counts al cierre: `CoursesView.jsx` 1066, `LessonView.jsx` 796, `sharedActivityUi.jsx` 157, `FeedbackPanel.jsx` 142;
- F5.H confirmo sin coincidencias prohibidas para `legacy`, `WorkspaceLayout`, `activityRegistry` ni `useSimulationEngine` en superficies F5 cerradas;
- F5.H actualizo `docs/rebuild/02-legacy-new-ownership-map.md` para reflejar F5 expandida cerrada;
- F5 expandida queda cerrada localmente: ruta, transicion route->lesson, lesson shell, activity chrome, feedback y comfort responsive;
- F6.A WhatsApp / chat baseline audit quedo cerrada localmente con `docs/rebuild/audit/F6.A-whatsapp-chat-baseline-audit.md`;
- luego el usuario redefinio F6 como **Simulation Experience Refine** global, absorbiendo toda la familia de simulaciones como la superficie critica del producto;
- F6.A Simulation baseline audit global quedo cerrada localmente con `docs/rebuild/audit/F6.A-simulation-baseline-audit.md`;
- F6.A global audito WhatsApp/chat, SMS, Inbox/email, WebLab, CallSimulation, ScenarioFlow, compare/signal analysis, wrappers comunes, estilos y tests relevantes en lectura;
- F6.A global confirmo problemas sistemicos de contraste, texto demasiado visible, falta de dominancia fullscreen, identidad desigual por categoria, feedback/completion pesado y demo-readiness insuficiente;
- F6.A global confirmo que `ActivityRenderer.jsx`, `activityRegistry.js`, `requestSimulationTurn`, scoring, hooks, backend, services y contracts deben mantenerse congelados;
- F6.A global no implemento cambios en vistas, simulaciones, estilos ni logica; solo documento alcance, riesgos, matriz de problemas y plan F6.B-F6.K;
- F6.B Contrast / readability / text-density system pass quedo cerrada localmente con `docs/rebuild/audit/F6.B-contrast-readability-text-density.md`;
- F6.B reforzo legibilidad compartida en `ActivitySummaryBar`, `SimulationGuide`, `ActivityChrome`, `FeedbackPanel`, `immersivePrimitives`, `immersive/shared.js` y `tailwind.css`;
- F6.B reemplazo washes compartidos `bg-white/75`, `bg-white/60`, `bg-white/76`, `bg-white/84` por superficies tokenizadas `bg-sd-surface` / `bg-sd-surface-raised` y bordes fuertes en primitives inmersivos;
- F6.B agrego hooks `sd-simulation-readable-surface`, `sd-activity-summary-*`, `sd-immersive-progress-*` y `data-sd-text-density="compact"`;
- F6.B agrego `test/f6-simulation-experience-smoke.test.js`;
- F6.B no toco simulaciones especificas por canal, `ActivityRenderer.jsx`, `activityRegistry.js`, hooks, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.C Category identity / color semantics pass quedo cerrada localmente con `docs/rebuild/audit/F6.C-category-identity-color-semantics.md`;
- F6.C agrego `SIMULATION_CATEGORY_META`, `getSimulationCategory(activity)` y `getSimulationCategoryClass(category)` en `frontend/src/components/activities/immersive/shared.js`;
- F6.C conecto `ActivityChrome` y las raices principales de WhatsApp/chat, SMS/Inbox, WebLab, ScenarioFlow y CallSimulation a `sd-simulation-category-*` y `data-sd-simulation-category`;
- F6.C agrego variables CSS scoped por categoria en `frontend/src/styles/tailwind.css` para `chat`, `sms`, `email`, `web`, `call`, `scenario` y `analysis`, incluyendo adaptacion dark-theme;
- F6.C agrego `test/f6-category-identity-smoke.test.js`;
- F6.C valido `.\npm-local.cmd test` con 101/101, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F6.C no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.D Fullscreen / stage-dominance / layout pass quedo cerrada localmente con `docs/rebuild/audit/F6.D-fullscreen-stage-dominance-layout.md`;
- F6.D agrego `data-sd-stage-dominance="primary"` y `data-sd-stage-layout="fullscreen"` al `ActivityChrome` inmersivo;
- F6.D marco roots de WhatsApp/chat, SMS/Inbox, WebLab, ScenarioFlow y CallSimulation como primary stage sin tocar scoring ni contratos;
- F6.D agrego `sd-simulation-main-stage`, `sd-simulation-briefing-strip` y layouts declarativos `list-detail`, `weblab-workbench` y `scenario-flow`;
- F6.D reforzo `frontend/src/styles/tailwind.css` para que el stage inmersivo use `--sd-simulation-stage-min-block: clamp(38rem, 80vh, 72rem)`, max-width de 96rem y reglas responsive de mayor dominancia;
- F6.D ensancho `sd-chat-sim` de 46rem a 76rem y reemplazo limites fijos del thread por clamps mas amplios;
- F6.D agrego `test/f6-stage-dominance-smoke.test.js` y actualizo el guard de `test/f5-comfort-responsive-smoke.test.js`;
- F6.D valido `.\npm-local.cmd test` con 105/105, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F6.D no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.E WhatsApp / Chat refine quedo cerrada localmente con mejoras en el hilo del chat, composer persistente, panel de apoyo desktop y guardas de a11y para el stage;
- F6.E agrego `test/f6-whatsapp-chat-smoke.test.js`;
- F6.E ajusto `frontend/src/styles/tailwind.css` para que `sd-chat-sim-desktop` use dos columnas, `sd-chat-insight` quede sticky y el composer gane presencia en mobile;
- F6.E no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.F SMS refine quedo cerrada localmente con una rama SMS propia dentro de `InboxActivity.jsx`, el skin `sms-*` activado y guardas de a11y/legibilidad para separar el canal de email;
- F6.F agrego `test/f6-sms-refine-smoke.test.js`;
- F6.F valido `.\npm-local.cmd test` con 109/109, `.\npm-local.cmd run build` y `git diff --check`;
- F6.F no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.G Inbox / email refine quedo cerrada localmente con una rama de correo propia dentro de `InboxActivity.jsx`, un banner mail-specific, lector de correo mas claro y reglas CSS dedicadas para separar el canal de SMS;
- F6.G agrego `test/f6-email-refine-smoke.test.js`;
- F6.G valido `.\npm-local.cmd test`, `.\npm-local.cmd run build` y `git diff --check`;
- F6.G no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.H WebLab / web simulation refine quedo cerrada localmente con una barra de navegador real, tema visual derivado del contenido, briefing mas browser-like y workbench mas inmersivo;
- F6.H agrego `test/f6-weblab-refine-smoke.test.js`;
- F6.H valido `.\npm-local.cmd test`, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F6.H no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.I Calls / other simulation refine quedo cerrada localmente con banner de fase para CallSimulation, transcript log anunciado y superficies guiadas para CompareDomains y SignalHunt;
- F6.I agrego `test/f6-call-other-refine-smoke.test.js`;
- F6.I valido `.\npm-local.cmd test`, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F6.I no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.J Cross-simulation functionality + polish pass quedo cerrada localmente con `SimulationCloseout` y el wrapper transversal de feedback/resumen/acciones;
- F6.J agrego `test/f6-cross-simulation-closeout-smoke.test.js`;
- F6.J valido `.\npm-local.cmd test`, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F6.J no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F6.K F6 closeout validation quedo cerrada localmente con `docs/rebuild/audit/F6.K-f6-closeout-validation.md`;
- F6.K confirmo como referencia tecnica el cierre de fase ya validado en F6.J: `.\npm-local.cmd test` con 119/119, `.\npm-local.cmd run build`, `.\npm-local.cmd run build-storybook` y `git diff --check`;
- F6.K no toco `ActivityRenderer.jsx`, `activityRegistry.js`, hooks de dominio, backend, services, contracts, scoring, `CoursesView.jsx`, `LessonView.jsx`, `app.css` ni `legacy.css`;
- F7.A Chat + Admin baseline audit quedo abierta localmente con `docs/rebuild/audit/F7.A-chat-admin-baseline-audit.md`;
- F7.A solo audita el estado real de `ChatDrawer.jsx`, `AdminView.jsx`, `SessionBar.jsx`, `buildShellSlots.jsx` y la policy de navegacion asociada; no implementa cambios;
- el siguiente paso recomendado es abrir F7.B - Chat drawer accessibility pass.

No abrir F8 ni retomar WIP de cleanup masivo sin autorizacion explicita del usuario.
