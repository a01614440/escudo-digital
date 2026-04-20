# Fase 0 — Shell Contract

## Objetivo
Cerrar la doctrina de shells antes de abrir Fase 1 y Fase 2.

## Tesis
- Hay una sola base lógica compartida.
- Deben existir tres shells reales:
  - `MobileShell`
  - `TabletShell`
  - `DesktopShell`
- El shell decide la organización macro.
- Los layouts por dominio deciden la composición de la superficie.
- Los patterns internos se adaptan por espacio útil, no con hacks globales.

## Realidad actual del repo
Hoy el responsive macro vive principalmente en:

- `frontend/src/App.jsx`
- `frontend/src/hooks/useResponsiveLayout.js`
- `frontend/src/styles/app.css`
- `frontend/src/styles/legacy.css`

`useResponsiveLayout.js` hoy expone estos perfiles:

- `phone-small`
- `phone`
- `tablet-compact`
- `tablet`
- `laptop`
- `desktop`

Y además escribe:

- `body.dataset.theme`
- `body.dataset.viewport`
- `body.dataset.inputMode`

## Decisión cerrada para el rebuild
Los buckets actuales se reinterpretan así:

| Viewport actual | Familia de shell |
|---|---|
| `phone-small` | `MobileShell` |
| `phone` | `MobileShell` |
| `tablet-compact` | `TabletShell` |
| `tablet` | `TabletShell` |
| `laptop` | `DesktopShell` |
| `desktop` | `DesktopShell` |

Los seis perfiles pueden seguir existiendo como hints de layout fino, pero el ownership macro debe pasar a tres familias.

## Criterio de selección
- No se elige shell por marketing name del dispositivo.
- Se elige por espacio útil y modo de uso.
- El viewport decide la familia macro.
- La composición interna la deciden layouts y patterns locales.

## Contrato de cada shell

### `MobileShell`
- una tarea principal por pantalla
- chrome mínimo
- navegación compacta
- panel secundario no persistente
- inspector en sheet/drawer si aplica

### `TabletShell`
- se permiten dos paneles cuando aportan claridad
- split pane válido si evita pasos extra
- la superficie principal sigue dominando

### `DesktopShell`
- puede mantener paneles persistentes
- válido para list/detail/inspector
- navegación y contexto simultáneo cuando aporte productividad

## Piezas conceptuales que deben existir después

### `AppCoordinator`
- conserva estado de alto nivel
- no debe ser shell visual final

### `DeviceProfileProvider`
- traduce viewport/espacio útil a familia de shell y hints secundarios

### `RouteContainer`
- conecta dominio con una superficie
- no resuelve el diseño final por sí solo

### `DeviceShell`
- aplica organización macro de la experiencia

### `PresentationalSections`
- resuelven la composición concreta de la vista

## Archivos reales implicados en el futuro split
- `frontend/src/App.jsx`
- `frontend/src/hooks/useResponsiveLayout.js`
- `frontend/src/components/SessionBar.jsx`
- `frontend/src/components/ChatDrawer.jsx`

## Garantías no negociables del shell contract
- cambiar de shell no debe resetear auth
- cambiar de shell no debe resetear assessment
- cambiar de shell no debe resetear ruta ni progreso
- cambiar de shell no debe resetear `currentLesson`
- cambiar de shell no debe resetear chat abierto/cerrado o estado de conversación
- cambiar de shell no debe romper admin preview

## Política de overlays y paneles
- overlays son secundarios
- no deben contener la superficie principal
- el inspector puede ser persistente solo cuando el shell lo soporte
- en móvil no debe existir panel lateral persistente

## Ambigüedades todavía abiertas antes de Fase 1
- si `useResponsiveLayout.js` se envuelve tal como está o se simplifica gradualmente
- qué slots exactos tendrá cada shell en el primer corte real
- qué hints finos de viewport vale la pena conservar además de la familia macro
