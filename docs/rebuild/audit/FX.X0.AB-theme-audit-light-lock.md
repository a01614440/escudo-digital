# FX.X0.A/B — Theme audit + light mode lock

Fecha: 2026-04-24

## Alcance

Esta subfase abre FASE X sin tocar layout, simulaciones ni flujos. El objetivo fue bloquear la app en modo claro para la presentacion y quitar la opcion visible de modo oscuro.

## Auditoria breve

La causa raiz del conflicto light/dark estaba concentrada en tres puntos:

1. `useResponsiveLayout` inicializaba `theme` desde `readThemePreference()`.
2. `readThemePreference()` aceptaba `dark` persistido en `localStorage`.
3. `SessionBar` renderizaba el boton `Modo oscuro` / `Modo claro`, por lo que cualquier usuario podia volver a activar dark.

Eso hacia que una sesion vieja, iPad/Safari o produccion pudieran entrar con `body[data-theme="dark"]` o con mezclas visuales que no coincidian con las capturas esperadas para presentacion.

## Cambios implementados

### Light mode unico

- `storage.js` declara `PRESENTATION_THEME = 'light'`.
- `readThemePreference()` ahora normaliza cualquier `escudo_theme_v1 = dark` a `light`.
- `writeThemePreference()` ya no acepta dark; siempre persiste `light`.

### DOM estable

- `useResponsiveLayout()` ya no lee el tema guardado para decidir entre light/dark.
- El DOM siempre recibe:
  - `document.body.dataset.theme = PRESENTATION_THEME`
  - `document.documentElement.style.colorScheme = PRESENTATION_THEME`
- `toggleTheme` y `setTheme` quedan como no-op seguro que vuelve a escribir light, para no romper contratos internos existentes.

### Opcion visible removida

- `SessionBar` ya no renderiza el boton `Modo oscuro` / `Modo claro`.
- `buildShellSlots` y `App` dejaron de pasar `onThemeToggle` al header.

## Archivos modificados

- `frontend/src/lib/storage.js`
- `frontend/src/hooks/useResponsiveLayout.js`
- `frontend/src/components/SessionBar.jsx`
- `frontend/src/shells/buildShellSlots.jsx`
- `frontend/src/App.jsx`
- `test/responsive-smoke.test.js`
- `test/fx-light-mode-lock-smoke.test.js`
- `CLAUDE.md`

## Validacion visual/manual

Se levanto Vite localmente y se cargo la app con:

- `localStorage.escudo_theme_v1 = dark`
- sesion autenticada mockeada
- vista `courses`

Resultado observado:

- `bodyTheme: light`
- `colorScheme: light`
- `storedTheme: light`
- `hasDarkButton: false`

Captura generada:

- `docs/rebuild/audit/FX.X0.AB-light-mode-lock-header.png`

## Guards

Se agrego `test/fx-light-mode-lock-smoke.test.js` para proteger que:

- storage siempre normalice a light;
- responsive layout aplique solo `PRESENTATION_THEME`;
- `SessionBar`, `buildShellSlots` y `App` no expongan `onThemeToggle` ni textos `Modo oscuro` / `Modo claro`.

## Fuera de alcance respetado

No se tocaron:

- backend
- DB
- hooks de dominio
- services
- contracts API
- scoring engine
- `ActivityRenderer.jsx`
- `activityRegistry.js`
- layouts de `Mi ruta`
- simulaciones

## Cierre

FX.X0.A/B queda cerrada localmente: la app carga en light aunque exista dark guardado y el usuario ya no ve opcion para activar modo oscuro.
