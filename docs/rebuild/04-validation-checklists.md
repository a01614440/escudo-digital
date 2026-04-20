# Fase 0 — Checklists De Validación

## Objetivo
Homogeneizar la forma en que se aprueba cada bloque del rebuild.

## Comandos base del repo
- Instalar: `.\npm-local.cmd install`
- Tests: `.\npm-local.cmd test`
- Build: `.\npm-local.cmd run build`
- Backend: `.\node-local.cmd server.js`
- Build + backend: `.\start-local.cmd`

## Baseline verificada en Fase 0
- `.\npm-local.cmd test`: pasando
- `.\npm-local.cmd run build`: pasando

## Los cuatro planos obligatorios
Cada bloque se valida en:

1. funcional
2. visual
3. accesibilidad
4. performance

## Checklist universal por bloque

### Funcional
- el flujo principal del bloque sigue funcionando
- no se perdió estado al navegar dentro del bloque
- no se rompieron auth, assessment, route, progress o chat por efecto colateral
- build pasa
- tests pasan

### Visual
- la superficie se percibe como owned by new-ui o claramente legacy, no híbrida
- no hay mezcla visual evidente entre patrones viejos y nuevos
- la jerarquía visual es consistente con la fase
- los estados `loading / empty / error / success` existen cuando aplican

### Accesibilidad
- foco visible
- orden de tab razonable
- labels/roles correctos
- overlays con trap y cierre por `Escape` cuando aplica
- targets táctiles suficientes
- keyboard parity en desktop

### Performance
- no hay CLS raro por drawers, panels o shell switching
- no hay scroll jumps inesperados
- no hay lag perceptible por re-renders obvios
- el bloque no introduce inflación innecesaria de DOM/CSS

## Gates por fase

| Fase | Funcional | Visual | A11y | Performance |
|---|---|---|---|---|
| F0 | contratos y golden flows documentados | ownership y mezcla legacy mapeados | riesgos a11y identificados | baseline registrada |
| F1 | primitives no rompen la app | foundation consistente | primitives usables por teclado | sin inflación base absurda |
| F2 | shell switch no resetea estado | macro layouts claros por shell | overlays y navegación correctos | sin reflow grave por shell |
| F3 | auth/survey íntegros | sin mezcla evidente legacy/nuevo | forms y stepper correctos | sin CLS raro |
| F4 | ruta/progreso/ajustes intactos | dashboard claro y coherente | filtros/tabs/cards accesibles | interacción fluida |
| F5 | lesson flow y feedback intactos | activity chrome estable | acciones y mapa navegables | sin reset de actividad |
| F6 | scoring/feedback/progress intactos | simulación creíble por shell | controles e inspector correctos | sin lag ni resets |
| F7 | chat/admin intactos | superficies integradas al sistema nuevo | drawer/panels/tablas accesibles | overlays y tablas fluidas |
| F8 | cleanup no rompe rutas | sin mezcla legacy/nuevo | issues críticos cerrados | candidate limpio |
| F9 | smoke final completo | coherencia de release | checklist final cerrada | release candidate estable |

## Smoke checklist mínimo
- login
- encuesta completa
- ver mi ruta
- abrir módulo
- completar actividad
- abrir/cerrar chat
- entrar a admin si aplica
- `GET /api/health`

## Evidencia que debe guardarse por tarea
- comando corrido
- resultado resumido
- flujo probado
- warnings detectados

## Warnings inmediatos detectados en Fase 0
- `node-local.cmd` y `start-local.cmd` dependen de un runtime bajo `New project\tools`
- el responsive actual depende de `body.dataset.viewport`
- `app.css` y `legacy.css` siguen teniendo responsabilidad estructural
