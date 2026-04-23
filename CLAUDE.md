# CLAUDE.md

Escudo Digital — rebuild visual del frontend. Ver `AGENTS.md` para contexto completo del producto.

## Fuentes de verdad obligatorias

Todo agente que trabaje en este repo debe leer y respetar estos documentos antes de ejecutar cualquier tarea del rebuild:

- `AGENTS.md` — contexto de producto, stack, reglas del rebuild
- `docs/rebuild/00-no-tocar-matrix.md` — perímetro duro del rebuild (qué está congelado)
- `docs/rebuild/01-golden-flows.md` — journeys que no se pueden romper
- `docs/rebuild/02-legacy-new-ownership-map.md` — ownership legacy / new UI por superficie
- `docs/rebuild/03-phase-prompt-templates.md` — plantillas estándar de prompts por fase
- `docs/rebuild/04-validation-checklists.md` — checklists funcional / visual / a11y / performance por bloque
- `docs/rebuild/05-shell-contract.md` — contrato de MobileShell / TabletShell / DesktopShell
- `docs/rebuild/06-simulation-order-and-rules.md` — orden y reglas de las simulaciones 6A–6F
- `docs/rebuild/07-skills-usage-plan.md` — workflows / skills propuestos para el rebuild

`AGENTS.md` es fuente de verdad del producto. `docs/rebuild/00..07` es el marco operativo. Ambos son normativos.

## Reglas operativas para Claude Code

Estas reglas son específicas de esta herramienta y complementan lo definido en `AGENTS.md` y `docs/rebuild/`.

1. **Reporte por subfase.** Al terminar cada subfase (F0.X, F1.X, etc.), reportar exactamente con el formato establecido por el prompt de la fase (ej.: `F0.X COMPLETADA — [nombre]`, con deliverable, hallazgos, problemas, commit, espera de autorización).
2. **Gate de autorización explícita entre subfases.** No avanzar de F0.X a F0.Y (ni de FN.X a FN.Y) sin recibir del usuario `OK F0.X continuar a F0.Y` (o equivalente) por escrito. No asumir autorización implícita. No avanzar por iniciativa propia.
3. **F0 cerrada.** La auditoría F0.1-F0.9 ya está cerrada, commiteada y pusheada. No reabrir F0 salvo instrucción explícita del usuario.
4. **Perímetro por fase.** No tocar código fuera del alcance autorizado por la fase en curso. La matriz `docs/rebuild/00-no-tocar-matrix.md` y el mapa `docs/rebuild/02-legacy-new-ownership-map.md` definen qué es intocable y qué pertenece a qué fase.
5. **Repo activo.** El único repo de trabajo autorizado es `C:\Users\emili\OneDrive\Documentos\GitHub\escudo-digital`. No tocar la copia paralela en `C:\Users\emili\OneDrive\Documentos\New project` bajo ninguna circunstancia, aunque comparta archivos o historial.
6. **Un prompt = un bloque coherente.** No mezclar shells + vistas + simulaciones + admin en la misma tarea. Seguir el tamaño ideal de tarea definido en `AGENTS.md`.
7. **No push sin autorización.** Los commits locales son permitidos según las reglas anteriores; `git push` requiere instrucción explícita del usuario.

## Fase actual

**F3 Auth + Survey refine cerrado localmente. F3.A-F3.G cerradas localmente.**

F0.9 identifico que la fase real del rebuild era **F1.9**: habia trabajo acumulado de F1 a F6A, pero la foundation visual estaba incompleta.

La regresion disciplinada a F1 closeout ya se ejecuto localmente:

- F1.A typography tokens
- F1.B educational tokens
- F1.C InlineMessage role / aria-live
- F1.D OverlayFrame focus trap
- F1.E Checkbox + Radio
- F1.F IconButton
- F1.G SurfaceCard `tone="inverse"`
- F1.H ProgressSummary + JourneyStepper
- F1.I closeout final

El bloque **F1 patterns de dominio** tambien quedo ejecutado localmente:

- `QuestionPage`
- `InfoPanel`
- `AssessmentLayout`

F2 fue abierta como **closeout tecnico**, no como reconstruccion de shells desde cero. La decision vigente es:

- no reconstruir `MobileShell`, `TabletShell` ni `DesktopShell`;
- no redisenar vistas grandes;
- endurecer dispatcher, breakpoints, datasets, contrato de slots, navigation policy y docs;
- dejar la capa shell estable para poder abrir F3 despues de F2.F.

Subfases F2 cerradas localmente:

- F2.A Shell baseline audit
- F2.B DeviceShell dispatcher hardening
- F2.C Responsive breakpoints + dataset policy
- F2.D Shell contract + navigation hardening
- F2.E Ownership map / docs
- F2.F F2 closeout validation

F3 debe ejecutarse en subfases pequeñas:

- F3.A Auth + Survey baseline audit
- F3.B AuthView closeout minimo
- F3.C Survey primitives + a11y pass
- F3.D Survey layout / patterns pass
- F3.E Survey flow hardening
- F3.F Results / perfil / CTA closeout
- F3.G F3 closeout validation

F3.A solo audito y genero `docs/rebuild/audit/F3.A-auth-survey-baseline-audit.md`. No implemento cambios en `AuthView.jsx` ni `SurveyView.jsx`.

F3.B cerro AuthView de forma minima:

- `SurfaceCard tone="inverse"` reemplaza hacks `text-white` / shadow arbitrario en loading.
- wrapper `sd-page-shell py[...]` retirado fuera de mobile.
- override local de grid en `SplitHeroLayout` retirado.
- guard agregado en `test/f3-auth-survey-smoke.test.js`.

F3.C cerro Survey primitives + a11y pass de forma minima:

- opciones `single` migradas a `Radio`;
- opciones `multi` migradas a `Checkbox`;
- `SurveyChoiceCard` local retirado;
- preguntas agrupadas con `fieldset` / `legend`;
- `aria-describedby`, `aria-invalid` y `aria-required` conectados a controles;
- `InlineMessage` de flujo y validacion enlazado por id;
- `Select` y `TextArea` reciben id/name/required/invalid/aria-describedby;
- guard agregado en `test/f3-auth-survey-smoke.test.js`.

F3.D cerro Survey layout / patterns pass de forma minima:

- `QuestionBoard` delega en `QuestionPage`;
- `QuestionPage` soporta `aria-describedby` externo, `errorId`, `errorTitle` y `aria-required`;
- `SurveyStageScene` usa `AssessmentLayout`;
- `SurveyInsightDeck` usa `InfoPanel`;
- `InfoPanel` soporta prop `as` para evitar aside anidado;
- se retiraron overrides locales `!grid-cols` del progreso de la escena activa;
- no se tocaron intro/loading/results ni flow.

F3.E cerro Survey flow hardening de forma minima:

- `shouldShowSurveyIntro` centraliza el gate de intro;
- `introResetPendingRef` permite reabrir intro tras reinicio real desde results/loading, sin reaparecer por borrar respuestas;
- `getSurveyScene` / `activeSurveyScene` aseguran una sola escena visible;
- loading usa `role="status"`, `aria-live="polite"` y `aria-busy="true"`;
- loading usa `SurfaceCard tone="inverse"` y tokens tipograficos, sin hacks locales `text-white` / shadow arbitrario;
- no se tocaron results/CTA ni hooks de dominio.

F3.F cerro Results / perfil / CTA closeout de forma minima:

- `ResultsScene` usa `AssessmentLayout`;
- results ya no usa `WorkspaceLayout` ni grid local desktop;
- perfil/riesgo usa `sd-title` y radius tokenizado, sin tracking negativo;
- recomendaciones se renderizan como lista semantica;
- CTA `Ver mi ruta` es `Button variant="primary" size="lg"` y mantiene `onTakeCourses`;
- `courseError` usa fallback `Intentar abrir mi ruta de nuevo` y queda enlazado por `aria-describedby`;
- wiring de `resolveActiveRoute.jsx` fue verificado en lectura y no se modifico.

F3.G cerro F3 closeout validation:

- genero `docs/rebuild/audit/F3.G-f3-closeout-validation.md`;
- valido `.\npm-local.cmd test` con 53/53 tests pasando;
- valido `.\npm-local.cmd run build`;
- valido `.\npm-local.cmd run build-storybook`;
- valido `git diff --check`;
- confirmo que F3 solo toco Auth/Survey/patterns/docs/tests permitidos;
- confirmo que no se tocaron vistas grandes posteriores, simulaciones, dominio, backend, contracts, hooks, `app.css` ni `legacy.css`.

F4.A Dashboard / Courses baseline audit quedo cerrada localmente:

- genero `docs/rebuild/audit/F4.A-dashboard-courses-baseline-audit.md`;
- audito `CoursesView.jsx` como monolito de 1702 lineas y confirme su red de dependencias, pruebas y deuda visible;
- confirme que `CoursesView` sigue siendo la unica superficie de F4 por ahora;
- confirme que no se toco implementacion, solo auditoria y contexto;
- luego se ejecuto F4.A refinada como baseline definitivo de UX en `docs/rebuild/audit/F4.A-courses-baseline-audit.md`;
- la F4.A refinada audito densidad, jerarquia, CTA, simetria, comodidad visual y separacion F4 vs F5;
- el siguiente paso recomendado es esperar autorizacion explicita para abrir F4.B - Information architecture / density pass.

No abrir F4.B/F5/F6 ni retomar WIP de simulaciones sin autorizacion explicita del usuario.
