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

**F0 cerrada. Decisión humana pendiente antes de iniciar F1.**

F0.9 identifica que la fase real del rebuild es **F1.9**: hay trabajo acumulado de F1 a F6A, pero la foundation visual quedó incompleta. El siguiente paso recomendado es **F1 closeout** antes de continuar F6A/F6B/F7.

No iniciar F1 closeout, F6A ni ningún cambio de código sin autorización explícita del usuario.
