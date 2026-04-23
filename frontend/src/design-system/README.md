# Foundation visual normativa

## Objetivo
Esta carpeta define una foundation que no solo resuelve primitives, sino que impone una **gramatica de pantalla** para el rebuild:

- contraste real entre regiones;
- superficies con rol;
- profundidad visible;
- layouts base para hero, rail y workspace;
- overlays base con semantica consistente;
- y reglas suficientes para que Fase 2-5 no recaigan en "la misma pantalla con componentes nuevos".

## Principios visuales
- La UI no debe sentirse como una pila uniforme de cards.
- Cada pantalla debe poder distinguir al menos tres capas: **direccion**, **trabajo principal** y **apoyo/insight**.
- La jerarquia no se resuelve solo con tamano de texto; se resuelve con contraste de superficie, espaciado y profundidad.
- `hero`, `command`, `support`, `insight` y `spotlight` son roles visuales distintos, no solo variaciones cosmeticas.
- Las acciones importantes deben vivir cerca de la continuidad y del contenido principal; la foundation no debe esconderlas en una barra generica.
- Los overlays no deben nacer ad hoc en fases posteriores; la base ya define su semantica y su comportamiento visual.

## Tokens normativos

### Color
- canvas: `--sd-canvas`, `--sd-canvas-muted`
- surface base: `--sd-surface`, `--sd-surface-subtle`, `--sd-surface-raised`, `--sd-panel`
- region surface: `--sd-surface-hero`, `--sd-surface-command`, `--sd-surface-support`, `--sd-surface-insight`, `--sd-surface-spotlight`, `--sd-surface-inverse`
- border: `--sd-border-soft`, `--sd-border`, `--sd-border-strong`, `--sd-border-accent`
- text: `--sd-text-strong`, `--sd-text`, `--sd-text-soft`, `--sd-muted`, `--sd-text-inverse`, `--sd-text-inverse-soft`
- accent: `--sd-accent`, `--sd-accent-strong`, `--sd-accent-soft`, `--sd-accent-glow`, `--sd-accent-contrast`
- semantic: success, warning, danger con sus versiones soft

### Spacing
- escala `1-11`
- region gaps: `sm`, `md`, `lg`, `xl`
- shell spacing: `mobile`, `tablet`, `desktop` con `inline`, `block`, `sectionGap`, `paneGap`, `railGap`, `heroGap`

### Radius
- `xs`, `sm`, `md`, `lg`, `xl`, `pill`

### Shadow
- `xs`, `sm`, `panel`, `md`, `lg`, `spotlight`, `floating`

### Blur
- `soft`, `panel`, `hero`

### Motion
- duraciones: `fast`, `base`, `slow`, `enter`
- curvas: `standard`, `emphasis`, `decisive`

### Z-index
- `base`, `sticky`, `dropdown`, `drawer`, `scrim`, `modal`, `toast`, `overlay`

## Primitives cerradas
- `Button`
- `Input`
- `TextArea`
- `Select`
- `Field`
- `Badge`
- `InlineMessage`
- `ProgressBar`
- `SkeletonBlock`
- `Spinner`
- `SurfaceCard`
- `OverlayFrame`
- `Dialog`
- `Drawer`
- `Sheet`

## Patterns cerrados
- `ActionCluster`
- `SectionHeader`
- `PanelHeader`
- `EmptyState`
- `MetricCard`
- `KeyValueBlock`
- `ProgressSummary`
- `StageHero`
- `SupportRail`
- `StatStrip`

## Layouts base cerrados
- `SplitHeroLayout`
- `WorkspaceLayout`

## Contraste de regiones
- `hero`: zona de apertura fuerte, alta profundidad y lectura dominante.
- `command`: zona de control o navegacion de alto contraste, ideal para tabs, modos y continuidad.
- `support`: superficie clara para apoyo o contexto secundario.
- `insight`: superficie liviana para explicacion, diagnostico, hints o detalle complementario.
- `spotlight`: superficie de enfasis editorial o de hallazgo.
- `editorial`: superficie suave para lectura o narrativa sin competir con el hero.

## Estados normativos
- hover: eleva ligeramente superficies interactivas y fortalece el borde.
- focus: usa focus ring con halo, nunca solo cambio de color.
- active/selected: marca borde y glow antes que pintar todo de accent.
- disabled: apaga elevacion, no legibilidad.
- loading: mantiene la geometria original con spinner o skeleton.
- error: borde + halo + mensaje contextual.
- success: usar para confirmacion y avance, no para CTA principal.

## Overlays base
- `OverlayFrame` es la capa base de scrim + surface + z-index.
- `Dialog` es la opcion bloqueante centrada.
- `Drawer` es la opcion lateral para detalle o herramientas.
- `Sheet` es la opcion inferior, especialmente util en contextos moviles.
- `Panel` no existe como primitive adicional porque `SurfaceCard + PanelHeader` ya cubren ese rol sin duplicar piezas.

## Base de accesibilidad
- controls con label explicita o `aria-label`
- focus visible obligatorio en acciones y cierres de overlay
- `aria-invalid` y texto de ayuda/error en inputs
- `aria-busy` o `role=status` en loading
- overlays con `role="dialog"` y `aria-modal="true"`
- feedback y progreso con roles/semantica base ya resueltos
- disabled legible y no dependiente solo de opacidad

## Container-awareness
- `SplitHeroLayout`, `WorkspaceLayout`, `StageHero`, `SupportRail`, `StatStrip`, `KeyValueBlock` y `ProgressSummary` se marcan con `data-sd-container="true"`.
- la foundation ya incluye reglas de container query para clusters de acciones, bloques clave/valor y resúmenes de progreso.
- la politica es: primero adaptacion por espacio util del contenedor; despues, si hace falta, decision macro del shell.

## Reutilizacion obligatoria en fases siguientes
- `SplitHeroLayout` debe ser el punto de partida para auth, intro, loading o resultados donde haya hero + panel.
- `WorkspaceLayout` debe ser el punto de partida para dashboard, lesson shell y superficies con control / contenido / insight.
- `StageHero` debe resolver heroes; no volver a armar heroes con divs sueltos y cards anidadas.
- `SupportRail` debe resolver railes secundarios; no inventar sidebars ad hoc.
- `StatStrip` y `MetricCard` deben ser la base de continuidad y progreso.
- `ActionCluster` debe agrupar CTAs y evitar barras de botones improvisadas.
- `PanelHeader` debe encabezar paneles de soporte, detalle o settings.
- `KeyValueBlock` debe resolver resumenes, perfiles y metadata.
- `ProgressSummary` debe resolver progreso concentrado sin rearmar combinaciones manuales de heading + bar + meta.
- `SurfaceCard` solo debe usarse con variantes de region claras; evitar repetir `panel` para todo.

## Limites
- Esta foundation no migra vistas.
- No toca dominio, hooks, services ni contracts.
- No hace cleanup fuerte de `app.css` ni `legacy.css`.
- No sustituye los shells; los prepara.

## Riesgo abierto
La foundation ya es bastante mas normativa, pero sigue existiendo convivencia con clases legacy (`btn`, `badge`, `panel`) por compatibilidad. El riesgo antes de Fase 2 no es que falten primitives, sino permitir que las proximas fases ignoren estos layouts y patterns y vuelvan a resolver pantallas con estructura heredada.
