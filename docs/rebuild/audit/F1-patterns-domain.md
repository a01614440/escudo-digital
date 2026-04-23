# F1 patterns de dominio - cierre

Fecha: 2026-04-23

## Objetivo

Crear los tres patterns de dominio autorizados por F0.9 para preparar F3.refine sin tocar vistas grandes ni avanzar a F2:

- `QuestionPage`
- `InfoPanel`
- `AssessmentLayout`

## Alcance implementado

| Pieza | Estado | Evidencia |
|---|---|---|
| `QuestionPage` | Cerrado | Nuevo pattern en `frontend/src/patterns/QuestionPage.jsx`; soporta `single`, `multi`, `select` y `text`; usa primitives foundation (`Radio`, `Checkbox`, `Select`, `TextArea`, `InlineMessage`, `SurfaceCard`). |
| `InfoPanel` | Cerrado | Nuevo pattern en `frontend/src/patterns/InfoPanel.jsx`; soporta tonos `info`, `evidence`, `coach`, `safeAction`, `warning`; usa tokens educativos y `SectionHeader`. |
| `AssessmentLayout` | Cerrado | Nuevo layout en `frontend/src/layouts/AssessmentLayout.jsx`; compone hero, progreso, pregunta, rail de insight y footer sin meter logica de dominio. |
| Barrels | Cerrado | `patterns/index.js` exporta `QuestionPage` e `InfoPanel`; `layouts/index.js` exporta `AssessmentLayout`. |
| Tokens/inventario | Cerrado | `foundationInventory` y `containerAwarenessRules.requiredFor` incluyen los nuevos patterns/layout. |
| Stories | Cerrado | `FoundationPatterns.stories.jsx` muestra QuestionPage en los 4 tipos requeridos; `FoundationLayouts.stories.jsx` muestra `AssessmentLayout`. |
| Tests | Cerrado | `foundation-smoke.test.js` cubre exports, clases, inventario y semantica fuente de las nuevas piezas. |

## Fuera de alcance respetado

- No se toco `SurveyView.jsx`.
- No se toco `AuthView.jsx`.
- No se toco `CoursesView.jsx`.
- No se toco `LessonView.jsx`.
- No se tocaron simulaciones.
- No se tocaron hooks, services, backend, DB, scoring ni contracts.
- No se hizo cleanup de `app.css` / `legacy.css`.
- No se abrio F2.

## Validacion

- `.\npm-local.cmd test` - PASS, 38/38 tests.
- `.\npm-local.cmd run build` - PASS.
- `.\npm-local.cmd run build-storybook` - PASS.
- `git diff --check` - PASS, sin errores de whitespace. Solo avisos normales LF -> CRLF.

Nota: `build-storybook` mantiene el warning conocido de chunks mayores a 500 kB por Storybook/axe/iframe. No bloquea este cierre.

## Veredicto

F1 patterns de dominio queda cerrado. El repo queda listo para que el usuario explique y autorice Fase 2 antes de abrirla.
