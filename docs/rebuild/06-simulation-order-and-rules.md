# Fase 0 — Simulation Order And Rules

## Objetivo
Cerrar el orden oficial de simulaciones y las reglas visuales obligatorias antes de ejecutar el bloque inmersivo.

## Orden oficial y cerrado
1. `6A — WhatsApp / chat`
2. `6B — SMS`
3. `6C — Inbox / correo`
4. `6D — ScenarioFlow`
5. `6E — CallSimulation`
6. `6F — WebLab / páginas clonadas`

## Por qué este orden queda cerrado
- `WhatsApp / chat` fija el patrón base `Thread + Message + Composer`.
- `SMS` deriva del lenguaje conversacional ya estabilizado.
- `Inbox / correo` introduce `ListDetail + ReadingPane + Inspector`.
- `ScenarioFlow` reutiliza parte del lenguaje conversacional, pero exige secuencia y branching.
- `CallSimulation` necesita shells, overlays, foco y voice handling ya maduros.
- `WebLab` es la superficie de mayor exigencia en fidelidad y realismo; por eso va al final.

## Mapeo del repo actual por tipo

| Subfase | Fuente actual principal |
|---|---|
| `6A WhatsApp / chat` | `frontend/src/components/activities/signalActivities.jsx` |
| `6B SMS` | `frontend/src/components/activities/immersive/InboxActivity.jsx` |
| `6C Inbox / correo` | `frontend/src/components/activities/immersive/InboxActivity.jsx` |
| `6D ScenarioFlow` | `frontend/src/components/activities/immersive/ScenarioFlowActivity.jsx` |
| `6E CallSimulation` | `frontend/src/components/activities/CallSimulationActivity.jsx` |
| `6F WebLab / páginas clonadas` | `frontend/src/components/activities/immersive/WebLabActivity.jsx` |

## Reglas macro obligatorias
- Las simulaciones son superficies protagonistas, no cards escolares dentro de una página.
- El shell decide la organización macro.
- La composición interna obedece al espacio útil y a reglas locales del pattern.
- `activityRegistry.js` se preserva como contrato central.
- `ActivityRenderer.jsx` no se convierte en laboratorio de rediseño general.

## Reglas por shell

### `MobileShell`
- una tarea principal por pantalla
- sin inspector persistente
- overlays solo para apoyo
- composer o acción primaria visibles cuando aplique

### `TabletShell`
- split pane permitido si reduce fricción
- el panel secundario puede existir, pero la simulación principal sigue dominando

### `DesktopShell`
- panel persistente permitido
- list/detail/inspector válido
- no convertir la simulación en collage de paneles si no aporta

## Regla de overlays
- overlays son secundarios
- no deben sustituir la superficie principal
- sirven para ayuda, recap, permisos, contexto o confirmación

## Regla de inspector
- el inspector vive fuera de la superficie principal
- solo puede ser persistente cuando el shell lo soporte
- en móvil debe pasar a drawer/sheet si existe

## Reglas por subfase

### `6A — WhatsApp / chat`
- Debe sentirse mensajería real.
- `Thread` protagonista, `Composer` fijo abajo en móvil.
- En tablet puede aparecer inspector contextual si ayuda.
- En desktop puede existir inspector persistente.
- No debe parecer chatbot escolar.

### `6B — SMS`
- Debe sentirse más austero, breve y urgente que WhatsApp.
- Foco en remitente, texto corto y señales rápidas.
- No se vale resolverlo como “WhatsApp con otro color”.

### `6C — Inbox / correo`
- Debe obedecer `lista + detalle`.
- En móvil: lista y lectura separadas.
- En tablet/desktop: list/detail real.
- El inspector no vive dentro del cuerpo del correo.

### `6D — ScenarioFlow`
- Debe sentirse secuencial y narrativo.
- En pantallas mayores puede existir recap/bitácora lateral.
- No convertirlo en checklist plana de botones.

### `6E — CallSimulation`
- En móvil: llamada full-screen tipo experiencia nativa.
- En tablet: llamada + transcript o panel auxiliar.
- En desktop: nunca una maqueta gigante de teléfono centrada.
- Permisos, audio y voz son secundarios, no la superficie principal.

### `6F — WebLab / páginas clonadas`
- Es una superficie premium.
- En móvil: página mobile + apoyo no persistente.
- En tablet: split controlado.
- En desktop: page clone principal + inspector externo.
- No debe haber pistas obvias de “simulación falsa”.

## Tratamiento especial — CallSimulation
- No debe tocarse demasiado pronto.
- Depende de shells maduros, overlays sólidos, foco correcto y políticas claras de audio.
- La voz sigue siendo browser-first en esta etapa; un fallback backend futuro es opcional y posterior.
- El objetivo no es hacerla más “showy”, sino estable y creíble por shell.

## Tratamiento especial — WebLab
- Va al final porque necesita máxima madurez del sistema visual.
- Requiere `PageCloneFrame`, `Inspector` y lenguaje visual de alta fidelidad.
- Debe parecer una página real, no una maqueta escolar.
- El inspector debe quedar fuera de la página y no contaminar la ilusión principal.

## Qué no se debe hacer
- No migrar dos simulaciones complejas en el mismo prompt.
- No tocar scoring o feedback para “acomodarlo al layout”.
- No abrir backend como dependencia principal de este bloque.
- No usar overlays como contenedor principal de la simulación.
- No meter pistas artificiales obvias dentro de WebLab/page clones.

## Ambigüedades reales detectadas antes de Fase 1
- SMS y correo hoy comparten parte de la misma superficie fuente.
- Todavía no existe el sistema de patterns inmersivos nuevo.
- El nivel exacto de soporte de voz más allá de browser APIs sigue abierto y no bloquea el rebuild visual.
