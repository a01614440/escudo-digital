# Fase 0 — Matriz De No Tocar

## Objetivo
Definir el perímetro duro del rebuild visual para evitar que la migración derive en reescritura de dominio.

## Regla maestra
Por defecto, todo lo que resuelve lógica de negocio, scoring, evaluación, persistencia, sincronización o contratos API queda **congelado**.

## Matriz

| Capa / área | Estado en Fase 0 | Qué significa |
|---|---|---|
| Backend Express | No tocar como eje | Se lee para entender contratos y health, no para reescribir flujo |
| DB schema | No tocar | Fuera de alcance del rebuild visual |
| API contracts | No tocar | El frontend nuevo debe adaptarse a los contratos existentes |
| Auth flow core | No tocar | La experiencia visual puede cambiar; el flujo base no |
| Assessment engine | No tocar | Se preserva scoring, cálculo y payloads |
| Course generation logic | No tocar | No rediseñar motor de ruta |
| Progress logic | No tocar | No cambiar shape, reglas ni reconstrucción |
| Remote/local sync | No tocar | No tocar `useRemoteProgressSync` ni payloads salvo necesidad extraordinaria aprobada |
| Chat logic | No tocar | Se rehace la superficie, no la lógica central |
| Analytics aggregation core | No tocar | Se preserva el cálculo, solo cambia la presentación |
| `activityRegistry.js` | Congelado | Contrato central del motor de actividades |
| `ActivityRenderer.jsx` | Congelado por defecto | Solo lectura como fuente de verdad hasta la fase correspondiente |
| `courseRules.js` | Congelado | Shape de estado y payload remoto preservados |
| feedback rules | Congelado | No cambiar evaluación por actividad |
| scenario selection core | Congelado | No tocar selector ni sanitización central |

## Archivos y zonas explícitamente congelados

### Frontend dominio
- `frontend/src/hooks/useAssessmentFlow.js`
- `frontend/src/hooks/useAuthSession.js`
- `frontend/src/hooks/useCourseProgress.js`
- `frontend/src/hooks/useRemoteProgressSync.js`
- `frontend/src/hooks/useChatSession.js`
- `frontend/src/hooks/useSimulationEngine.js`
- `frontend/src/services/authService.js`
- `frontend/src/services/courseService.js`
- `frontend/src/services/progressService.js`
- `frontend/src/services/chatService.js`
- `frontend/src/lib/courseRules.js`
- `frontend/src/lib/course.js`
- `frontend/src/lib/activityScoring.js`
- `frontend/src/lib/activityFeedback.js`
- `frontend/src/lib/scenarioSelector.js`
- `frontend/src/lib/adminAnalytics.js`

### Actividades como contrato
- `frontend/src/components/activities/activityRegistry.js`
- `frontend/src/components/activities/ActivityRenderer.jsx`

### Backend y DB
- `server.js`
- `db.js`

## Zonas mixtas que sí pueden tocarse después, pero no en Fase 0
Estas piezas mezclan presentación y wiring. No son “intocables” para siempre, pero en Fase 0 quedan congeladas:

- `frontend/src/App.jsx`
- `frontend/src/hooks/useResponsiveLayout.js`
- `frontend/src/components/CoursesView.jsx`
- `frontend/src/components/LessonView.jsx`
- `frontend/src/components/ChatDrawer.jsx`
- `frontend/src/styles/app.css`
- `frontend/src/styles/legacy.css`

## Qué sí está dentro del alcance del rebuild
- shells
- route containers
- presenters
- wrappers visuales
- design system
- patterns
- layouts por dominio
- chrome visual
- composición adaptativa por shell
- reacomodo visual de superficies

## Qué no debe justificarse con “es más limpio”
No son razones suficientes para romper el freeze:

- “ya que estamos aquí”
- “sería más moderno”
- “queda mejor con otra arquitectura”
- “sería más fácil rehacerlo”
- “aprovechemos para cambiar el backend”

## Umbral para cruzar el freeze
Solo se debe tocar una zona congelada si se cumplen las tres:

1. existe bloqueo real de la capa visual,
2. no hay adapter o wrapper razonable,
3. el cambio está explícitamente aprobado y documentado.

## Ambigüedades que siguen abiertas antes de Fase 1
- Qué primitives actuales se adaptan versus se reemplazan.
- Si `useResponsiveLayout.js` se envuelve o se transforma gradualmente.
- Qué tanto de `app.css` puede seguir activo como capa transicional antes del cleanup fuerte.
