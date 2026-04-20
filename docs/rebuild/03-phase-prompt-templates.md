# Fase 0 — Plantillas De Prompts Por Fase

## Objetivo
Estandarizar los prompts para Codex y evitar saturación, scopes ambiguos o aperturas de frente innecesarias.

## Estructura universal que debe llevar cualquier prompt

### Contexto
- fase actual
- objetivo de esa tarea
- contrato del rebuild que no se debe romper
- archivos críticos relacionados

### Alcance permitido
- archivos o carpetas que sí se pueden tocar
- superficies exactas incluidas

### Límites
- archivos prohibidos
- zonas congeladas
- cosas que explícitamente no debe hacer el agente

### Entregables
- qué debe quedar construido o documentado
- qué no se espera todavía

### Criterios de aceptación
- qué debe funcionar
- qué debe verse correcto
- qué validaciones debe correr

## Plantilla 1 — Audit Prompt
Usar en Fase 0 o al iniciar una fase compleja.

```md
Contexto:
- Estamos en [fase].
- El rebuild es visual, no de dominio.
- El núcleo funcional preservado incluye hooks, services, contracts, backend, DB, scoring, assessment y progress.

Objetivo:
- Auditar [bloque] y devolver mapa técnico-operativo exacto.

Archivos permitidos:
- [lista]

Archivos prohibidos:
- [lista]

Entregables:
- inventario del bloque
- riesgos
- ownership
- recomendaciones de corte

Validación:
- no cambios funcionales
- evidencia de archivos leídos

Límites:
- no implementar
- no reestructurar dominio
```

## Plantilla 2 — Foundation Prompt
Usar en Fase 1.

```md
Contexto:
- Estamos en Fase 1 — Foundation visual.
- No migrar todavía vistas grandes.

Objetivo:
- crear o adaptar [tokens/primitives/patterns] como base reusable.

Archivos permitidos:
- [design-system]
- [components/ui]
- [styles/tailwind.css]

Archivos prohibidos:
- App.jsx
- CoursesView.jsx
- LessonView.jsx
- ActivityRenderer.jsx
- activityRegistry.js
- ChatDrawer.jsx

Entregables:
- [lista clara]

Validación:
- build
- tests
- verificación visual mínima

Límites:
- no migrar auth/survey/dashboard/lesson
- no abrir cleanup legacy
```

## Plantilla 3 — Route / Shell Split Prompt
Usar en Fase 2.

```md
Contexto:
- Estamos en Fase 2 — Shells y navegación.
- Deben existir tres shells reales.

Objetivo:
- separar App coordinator, route container y shell macro sin resetear estado.

Archivos permitidos:
- App.jsx
- main.jsx
- useResponsiveLayout.js
- SessionBar.jsx
- nuevas carpetas de shells/route-containers

Archivos prohibidos:
- domain hooks
- services
- CoursesView.jsx
- LessonView.jsx
- ActivityRenderer.jsx
- activityRegistry.js

Entregables:
- shell contract implementado
- estado importante preservado arriba

Validación:
- auth/progreso/chat no se resetean
- build y tests

Límites:
- no migrar vistas todavía
```

## Plantilla 4 — Block Migration Prompt
Usar en Fases 3, 4, 5 y 7.

```md
Contexto:
- Estamos en [fase].
- El shell y la foundation ya existen.

Objetivo:
- reemplazar visualmente por completo [superficie] sin tocar su cerebro funcional.

Archivos permitidos:
- [vista]
- [patterns/layouts asociados]
- wiring mínimo en App si es necesario

Archivos prohibidos:
- hooks de dominio
- services
- activityRegistry.js
- backend

Entregables:
- nueva superficie completa
- sin mezcla visual evidente legacy/nuevo

Validación:
- tests
- build
- smoke del flujo afectado
- checklist funcional/visual/a11y/perf del bloque

Límites:
- no abrir otra superficie grande en el mismo prompt
```

## Plantilla 5 — Simulation Wrapper Prompt
Usar en Fase 6.

```md
Contexto:
- Estamos en [subfase de simulación].
- La surface debe obedecer shell contract y reglas de simulación.

Objetivo:
- rehacer la experiencia visual de [simulación] preservando scoring, feedback y contrato actual.

Archivos permitidos:
- [componentes de la simulación]
- patterns inmersivos asociados
- wiring mínimo en ActivityRenderer solo si es estrictamente necesario

Archivos prohibidos:
- activityRegistry.js salvo redirección mínima aprobada
- scoring core
- feedback rules
- backend como eje

Entregables:
- wrapper visual nuevo por shell
- inspector/overlays según reglas

Validación:
- build
- tests
- smoke de simulación
- no reset de estado

Límites:
- no mezclar dos simulaciones complejas en el mismo prompt
```

## Plantilla 6 — Accessibility Pass Prompt
Usar después de cerrar un bloque visual.

```md
Objetivo:
- revisar y corregir foco, labels, trap, targets, keyboard parity y live regions de [bloque].

Archivos permitidos:
- solo la superficie cerrada y sus patterns

Archivos prohibidos:
- dominio y contratos

Validación:
- checklist a11y del bloque
```

## Plantilla 7 — Performance Pass Prompt
Usar cuando el bloque ya es funcional y visualmente estable.

```md
Objetivo:
- reducir deuda visual/perf de [bloque] sin cambiar comportamiento.

Archivos permitidos:
- superficie y styles asociados

Archivos prohibidos:
- contratos funcionales
- cambios de alcance

Validación:
- build
- no CLS raro
- interacción fluida
```

## Plantilla 8 — Cleanup Prompt
Usar en Fase 8.

```md
Objetivo:
- retirar dependencia residual de legacy/app.css de [superficie ya migrada].

Archivos permitidos:
- styles relacionados
- superficie ya owned by new-ui

Archivos prohibidos:
- superficies todavía legacy

Validación:
- build
- tests
- no regresión visual
```

## Reglas de disciplina
- Un prompt = un bloque coherente.
- No mezclar shells + dashboard + simulaciones.
- No mezclar CallSimulation con otra simulación compleja.
- No mezclar cleanup con migración inicial de una superficie.
