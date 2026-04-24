# FX.X2 - Explora tu ruta expandable modules

Fecha: 2026-04-24

## Alcance

Esta subfase convierte los modulos de `Explora tu ruta` en disclosures locales. El objetivo fue que el usuario reciba respuesta inmediata donde hizo click/tap, sin depender de que el detalle cambie en otra zona de la pantalla.

No se redisenaron simulaciones, lesson shell, backend ni dominio.

## Auditoria breve

El problema principal era de feedback espacial:

- la card de modulo parecia interactiva;
- al hacer click, el detalle cambiaba en el panel superior o en otra region;
- el usuario no veia informacion nueva en el lugar de la interaccion;
- el CTA del modulo no estaba dentro de la card donde acababa de tocar;
- el estado seleccionado existia, pero la expansion local no.

Esto hacia que `Explora tu ruta` se sintiera menos clickeable y menos natural, especialmente en tablet/touch.

## Cambios implementados

### Disclosure semantico por modulo

- `RouteModulePill` dejo de renderizar como `button` de superficie completa.
- La superficie ahora es `SurfaceCard as="article"`.
- El trigger interactivo real es un `button.sd-route-pill-trigger`.
- El trigger expone:
  - `aria-expanded`
  - `aria-controls`
  - `aria-label`
  - focus visible

### Expansion local

Cuando un modulo se expande, la card muestra en el mismo lugar:

- descripcion breve del modulo;
- siguiente actividad;
- progreso del modulo;
- CTA local para abrir, continuar o reiniciar segun estado.

La region expandida usa:

- `role="region"`
- `aria-labelledby`
- `data-sd-route-module-disclosure="true"`

### Estado separado de seleccion

`CoursesView` ahora mantiene dos estados distintos:

- `selectedModuleId`: modulo activo para el detalle principal.
- `expandedModuleId`: modulo abierto dentro de `Explora tu ruta`.

Esto permite que seleccionar y expandir no se mezclen accidentalmente. Al cambiar nivel o perder disponibilidad, la expansion se limpia.

### CTA local

El CTA de cada modulo expandido usa `getModuleCtaLabel({ locked, adminAccess, stats })`, por lo que respeta:

- modulo bloqueado;
- avance parcial;
- modulo completado;
- modo admin.

### Estilos y affordance

Se agregaron reglas para:

- focus visible del trigger;
- estado expandido mas claro;
- animacion ligera de apertura;
- CTA local con presencia;
- contenido interno con `min-width: 0` para evitar overflow.

## Archivos modificados

- `frontend/src/components/CoursesView.jsx`
- `frontend/src/styles/tailwind.css`
- `test/f4-courses-dashboard-smoke.test.js`
- `test/fx-route-expandable-modules-smoke.test.js`
- `docs/rebuild/audit/FX.X2-route-expandable-modules.md`

## Validacion visual/manual

Se levanto Vite localmente y se cargo `Mi ruta` con sesion mockeada y datos de curso de prueba.

Capturas generadas:

- `docs/rebuild/audit/FX.X2-route-modules-closed.png`
- `docs/rebuild/audit/FX.X2-route-module-expanded.png`

Resultado observado:

- modulos cerrados muestran titulo, estado, recomendacion y progreso sin disclosure visible;
- al tocar el primer modulo, la misma card se expande;
- el disclosure queda conectado por `aria-expanded="true"` y `aria-controls`;
- aparece CTA local `Abrir modulo`;
- la app sigue bloqueada en `body[data-theme="light"]`;
- no aparece boton de modo oscuro.

Metricas de la captura:

```json
{
  "bodyTheme": "light",
  "colorScheme": "light",
  "storedTheme": "light",
  "hasDarkButton": false,
  "disclosureCount": 1
}
```

## Guards

Se agrego `test/fx-route-expandable-modules-smoke.test.js` para proteger que:

- `RouteModulePill` sea disclosure semantico y no nested button;
- exista `aria-expanded`, `aria-controls`, `role="region"` y `aria-labelledby`;
- el contexto y CTA aparezcan dentro del modulo expandido;
- `selectedModuleId` y `expandedModuleId` sean estados separados;
- existan estilos de focus, expanded state y disclosure.

Tambien se actualizo `test/f4-courses-dashboard-smoke.test.js` para aceptar el nuevo copy y la nueva semantica del rail.

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
- simulaciones especificas
- `LessonView.jsx`
- `SurveyView.jsx`

## Cierre

FX.X2 queda cerrada localmente: `Explora tu ruta` ahora responde en el mismo punto de interaccion con disclosure accesible, informacion breve, progreso y CTA local.
