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

## Estado actual tras F3.A
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
- El siguiente bloque recomendado es pedir autorizacion humana para abrir **F3.B - AuthView closeout minimo**.
- No abrir F3.B/F3.C/F3.D/F3.E/F3.F/F3.G/F4/F5/F6/F7 ni retomar WIP de simulaciones sin autorizacion explicita del usuario.
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
