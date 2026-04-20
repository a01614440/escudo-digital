# Fase 0 — Mapa De Ownership Legacy / New UI

## Objetivo
Evitar híbridos largos y frágiles entre la UI actual y la nueva UI.

## Regla base
La convivencia temporal correcta no es “una misma pantalla con parches viejos y nuevos”, sino:

- superficie aún owned by legacy
- superficie ya owned by new UI

## Estados posibles
- `legacy`: la superficie sigue dependiendo estructuralmente del sistema actual
- `transition`: se permite solo como etapa corta y controlada
- `new-ui`: la superficie ya es responsabilidad del sistema nuevo
- `frozen-contract`: no se migra como capa visual principal; se protege como contrato

## Ownership actual al cierre de Fase 0

| Superficie | Estado actual | Fuente principal |
|---|---|---|
| App coordinator / route switch | `legacy` | `frontend/src/App.jsx` |
| Responsive macro actual | `legacy` | `frontend/src/hooks/useResponsiveLayout.js` |
| Auth | `legacy` | `frontend/src/components/AuthView.jsx` |
| Survey | `legacy` | `frontend/src/components/SurveyView.jsx` |
| Dashboard / ruta | `legacy` | `frontend/src/components/CoursesView.jsx` |
| Lesson shell | `legacy` | `frontend/src/components/LessonView.jsx` |
| Activity chrome | `legacy` | `frontend/src/components/activities/ActivityRenderer.jsx`, `sharedActivityUi.jsx` |
| Activity registry | `frozen-contract` | `frontend/src/components/activities/activityRegistry.js` |
| Simulaciones | `legacy` | `frontend/src/components/activities/*` |
| Chat global | `legacy` | `frontend/src/components/ChatDrawer.jsx` |
| Admin | `legacy` | `frontend/src/components/AdminView.jsx` |
| CSS global nuevo/transicional | `legacy` | `frontend/src/styles/app.css` |
| CSS heredado | `legacy` | `frontend/src/styles/legacy.css` |

## Ownership especial por archivo crítico

### `frontend/src/App.jsx`
- Estado: `legacy`
- Regla: no reestructurarlo todavía en Fase 0
- Futuro owner: Fase 2

### `frontend/src/hooks/useResponsiveLayout.js`
- Estado: `legacy`
- Regla: fuente de verdad del responsive actual; no convertirlo aún
- Futuro owner: Fase 2

### `frontend/src/components/CoursesView.jsx`
- Estado: `legacy`
- Regla: no abrir cambios visuales todavía
- Futuro owner: Fase 4

### `frontend/src/components/LessonView.jsx`
- Estado: `legacy`
- Regla: no tocar hasta Fase 5
- Futuro owner: Fase 5

### `frontend/src/components/activities/ActivityRenderer.jsx`
- Estado: `frozen-contract`
- Regla: no tocar salvo lectura hasta su fase
- Futuro owner visual: Fase 5

### `frontend/src/components/activities/activityRegistry.js`
- Estado: `frozen-contract`
- Regla: contrato central congelado por defecto
- Futuro owner: sigue siendo contrato central; cualquier ajuste debe ser mínimo

### `frontend/src/components/ChatDrawer.jsx`
- Estado: `legacy`
- Regla: no rehacerlo antes de Fase 7
- En Fase 2 solo se admite definir su slot/mount dentro de shells nuevos

### `frontend/src/styles/app.css`
- Estado: `legacy`
- Regla: capa transicional actual, no cleanup todavía
- Futuro owner: retiro progresivo por superficie y limpieza fuerte en Fase 8

### `frontend/src/styles/legacy.css`
- Estado: `legacy`
- Regla: read-only durante Fase 0
- Futuro owner: retiro ordenado en Fase 8

## Regla de corte por superficie
Una superficie solo puede pasar a `new-ui` cuando cumpla:

1. paridad funcional,
2. ownership visual nuevo casi total,
3. ausencia de dependencia estructural de `legacy.css`,
4. gates de validación aprobados.

## Ambigüedades todavía abiertas antes de Fase 1
- Qué tanto de `app.css` se conserva como capa transicional durante varias fases.
- Qué primitives actuales se marcan como `transition` versus `new-ui`.
- Cómo etiquetar ownership de patterns que todavía no existen en el repo.
