# Fase 0 — Skills Usage Plan

## Objetivo
Definir cómo se usará Codex de manera disciplinada durante el rebuild.

## Nota importante
Los nombres siguientes representan **workflows operativos propuestos** por la estrategia del rebuild.
En esta sesión no existen todavía como skills locales instalados con esos nombres.

Hasta que se formalicen como skills reales, deben usarse como:

- procedimientos operativos
- plantillas de prompts
- checklists de ejecución

## Tabla principal

| Skill / workflow | Momento | Objetivo | Entregable |
|---|---|---|---|
| `ui-audit-map` | Fase 0 | mapear superficies, contratos, ownership y riesgos | mapa operativo y guardrails |
| `token-sync` | Fase 1 | traducir dirección visual a tokens, spacing, motion y primitives | foundation visual inicial |
| `route-shell-splitter` | Fase 2 | separar coordinador, route containers y shells sin resetear estado | arquitectura macro de shells |
| `component-migrate` | Fases 3, 4, 5 y 7 | migrar una superficie completa al nuevo sistema visual | vista o bloque migrado |
| `a11y-guard` | después de cada bloque visual | revisar foco, labels, trap, targets y keyboard parity | correcciones y checklist a11y |
| `visual-regression-triage` | al cerrar cada bloque importante | detectar mezcla legacy/nuevo o regresión visual | reporte de diferencias y fixes |
| `test-author` | desde Fase 0 y durante todo el rebuild | mantener smoke packs y pruebas mínimas por bloque | evidencia de regresión controlada |
| `voice-adapter` | Fase 6E y posterior | encapsular la capa visual de voz browser-first y preparar futuro fallback | adapter o contrato de voz |

## Momento correcto de uso

### Fase 0
- `ui-audit-map`
- `test-author`

### Fase 1
- `token-sync`
- `a11y-guard`

### Fase 2
- `route-shell-splitter`
- `a11y-guard`

### Fases 3–5
- `component-migrate`
- `a11y-guard`
- `visual-regression-triage`
- `test-author`

### Fase 6
- `component-migrate`
- `visual-regression-triage`
- `a11y-guard`
- `voice-adapter` solo cuando llegue `CallSimulation`

### Fase 7
- `component-migrate`
- `a11y-guard`
- `visual-regression-triage`

### Fases 8–9
- `visual-regression-triage`
- `test-author`
- `a11y-guard`

## Reglas de uso disciplinado
- No invocar un workflow grande para varias superficies complejas a la vez.
- Un workflow de migración debe trabajar sobre un bloque completo, no sobre tres bloques mezclados.
- `voice-adapter` no debe entrar antes de `CallSimulation`.
- `route-shell-splitter` no debe mezclarse con simulaciones.
- `visual-regression-triage` debe correr después de que el bloque ya esté funcionalmente cerrado.

## Cómo se traduce esto a prompts reales
Estos workflows se aterrizan con:

- `docs/rebuild/03-phase-prompt-templates.md`
- `docs/rebuild/04-validation-checklists.md`

## Hueco operativo actual antes de Fase 1
- No hay todavía skills locales formalizados con estos nombres.
- No hay Storybook / MSW / Playwright configurados aún.
- No bloquea Fase 1, pero sí conviene decidir en Foundation qué parte de ese soporte entra desde el inicio.
