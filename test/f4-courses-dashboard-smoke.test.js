import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const source = readFileSync(
  new URL('../frontend/src/components/CoursesView.jsx', import.meta.url),
  'utf8'
);

function functionBlock(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextName
    ? source.indexOf(`function ${nextName}`, start + 1)
    : source.indexOf('export default function CoursesView', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

function coursesViewBlock() {
  const start = source.indexOf('export default function CoursesView');
  assert.notEqual(start, -1, 'CoursesView should exist');
  return source.slice(start);
}

describe('F4.B Courses dashboard information density guards', () => {
  test('DashboardSceneBar and RouteModulePill avoid extra counters in the route rail', () => {
    const sceneBar = functionBlock('DashboardSceneBar', 'RouteModulePill');
    const pill = functionBlock('RouteModulePill', 'RouteNavigatorRail');

    assert.doesNotMatch(sceneBar, /modulos cerrados/);
    assert.doesNotMatch(pill, /entry\.stats\.durationLabel/);
    assert.doesNotMatch(pill, /entry\.stats\.completedCount/);
    assert.match(pill, /getModuleStatusLabel\(entry\.stats\.status\)/);
  });

  test('RouteNavigatorRail removes the visible-count badge and shortens filter copy', () => {
    const block = functionBlock('RouteNavigatorRail', 'ModuleActivityList');

    assert.doesNotMatch(block, /visibles/);
    assert.match(block, /Escanea estado, prioridad y detalle seleccionado\./);
    assert.match(block, /Filtra sin romper el orden\./);
  });

  test('ModuleMissionBoard trims secondary stats and local layout overrides', () => {
    const block = functionBlock('ModuleMissionBoard', 'ProgressScene');

    assert.match(block, /<ProgressSummary/);
    assert.doesNotMatch(block, /key: 'time'/);
    assert.doesNotMatch(block, /key: 'visits'/);
    assert.doesNotMatch(block, /Objetivo claro, siguiente actividad visible/);
    assert.doesNotMatch(block, /!grid-cols-1/);
  });

  test('Progress and settings heroes remove the least useful headline stats', () => {
    const progress = functionBlock('ProgressScene', 'SettingsScene');
    const settings = functionBlock('SettingsScene');

    assert.doesNotMatch(progress, /Ultimo acceso/);
    assert.doesNotMatch(progress, /Fortaleza:/);
    assert.doesNotMatch(progress, /Gap:/);
    assert.doesNotMatch(settings, /key: 'duration'/);
    assert.match(settings, /Ajustes de ruta sin perder progreso/);
  });
});

describe('F4.E Courses progress, stats and adjustments guards', () => {
  test('ProgressScene prioritizes route, focus and gap instead of decorative shield stats', () => {
    const block = functionBlock('ProgressScene', 'SettingsScene');

    assert.match(block, /const progressStrip = \[/);
    assert.match(block, /key: 'route'/);
    assert.match(block, /key: 'focus'/);
    assert.match(block, /key: 'gap'/);
    assert.match(block, /title="Progreso util de tu ruta"/);
    assert.match(block, /items=\{progressStrip\}/);
    assert.doesNotMatch(block, /key: 'shield'/);
    assert.doesNotMatch(block, /Shield/);
  });

  test('ProgressScene keeps snapshots conditional and focuses signals without duplicating the gap', () => {
    const block = functionBlock('ProgressScene', 'SettingsScene');

    assert.match(block, /\{history\.length \? \(/);
    assert.match(block, /eyebrow="Historial reciente"/);
    assert.doesNotMatch(block, /Sin snapshots todavia/);
    assert.match(block, /title="Senales de aprendizaje"/);
    assert.doesNotMatch(block, /eyebrow="Siguiente foco"/);
    assert.doesNotMatch(block, /tone="warning"/);
    assert.doesNotMatch(block, /key: 'prefs'/);
  });

  test('SettingsScene treats adjustments as a single compact surface with explicit regeneration CTA', () => {
    const block = functionBlock('SettingsScene');

    assert.match(block, /const selectedTopicCount = Array\.isArray\(coursePrefs\?\.temas\) \? coursePrefs\.temas\.length : 0/);
    assert.match(block, /title="Ajustes de ruta sin perder progreso"/);
    assert.match(block, /variant="panel"/);
    assert.match(block, /data-sd-settings-cta="courses-regenerate"/);
    assert.match(block, /aria-label="Actualizar ruta con estas preferencias"/);
    assert.doesNotMatch(block, /variant="hero"/);
    assert.doesNotMatch(block, /<SplitHeroLayout/);
    assert.doesNotMatch(block, /<StageHero/);
    assert.doesNotMatch(block, /<StatStrip/);
    assert.doesNotMatch(block, /<SupportRail/);
    assert.doesNotMatch(block, /settingsStrip/);
    assert.doesNotMatch(block, /key: 'topics'/);
  });
});

describe('F4.F Courses shell layout comfort guards', () => {
  test('DashboardSceneBar resolves the previously unused journey steps as compact context', () => {
    const block = functionBlock('DashboardSceneBar', 'RouteModulePill');

    assert.match(block, /journeySteps = \[\]/);
    assert.match(block, /const hasJourneySteps = Array\.isArray\(journeySteps\) && journeySteps\.length > 0/);
    assert.match(block, /data-sd-journey-stepper="courses-route"/);
    assert.match(block, /<JourneyStepper[\s\S]*steps=\{journeySteps\}[\s\S]*compact=\{shellFamily !== 'desktop'\}/);
  });

  test('CoursesView exposes explicit route layout modes and keeps desktop to two panes', () => {
    const block = coursesViewBlock();

    assert.match(block, /const routeLayoutMode = isMobile/);
    assert.match(block, /'mobile-stack'/);
    assert.match(block, /'tablet-two-pane'/);
    assert.match(block, /'desktop-two-pane'/);
    assert.match(block, /data-sd-route-layout=\{routeLayoutMode\}/);
    assert.match(block, /lg:grid-cols-\[minmax\(17rem,19rem\)_minmax\(0,1fr\)\]/);
    assert.match(block, /xl:grid-cols-\[minmax\(18rem,20rem\)_minmax\(0,1fr\)\]/);
    assert.doesNotMatch(block, /<WorkspaceLayout/);
    assert.doesNotMatch(block, /xl:grid-cols-\[minmax\(18rem,20rem\)_minmax\(0,1\.55fr\)_minmax\(16\.5rem,18\.5rem\)\]/);
    assert.doesNotMatch(block, /<RouteInsightRail/);
  });

  test('ModuleMissionBoard drops the nested two-pane layout and exposes a flat structure', () => {
    const block = functionBlock('ModuleMissionBoard', 'ProgressScene');

    assert.match(block, /data-sd-module-layout=\{shellFamily === 'desktop' \? 'desktop-flat' : 'stacked-flat'\}/);
    assert.doesNotMatch(block, /2xl:grid-cols-\[minmax\(0,1fr\)_minmax\(17rem,0\.62fr\)\]/);
    assert.doesNotMatch(block, /lg:grid-cols-\[minmax\(0,1\.04fr\)_minmax\(17rem,0\.96fr\)\]/);
    assert.doesNotMatch(block, /sticky=\{shellFamily === 'desktop'\}/);
  });

  test('SettingsScene keeps tablet controls from collapsing into three tight columns', () => {
    const block = functionBlock('SettingsScene');

    assert.match(block, /md:grid-cols-2 xl:grid-cols-3/);
    assert.doesNotMatch(block, /md:grid-cols-3/);
  });
});

describe('F4.D Courses route navigator and module detail guards', () => {
  test('RouteNavigatorRail uses a quieter foundation surface instead of local inverse rail hacks', () => {
    const block = functionBlock('RouteNavigatorRail', 'ModuleActivityList');

    assert.match(block, /variant="support"/);
    assert.match(block, /title="Ruta por modulos"/);
    assert.doesNotMatch(block, /bg-\[linear-gradient/);
    assert.doesNotMatch(block, /text-white/);
    assert.doesNotMatch(block, /shadow-\[0_36px_90px/);
  });

  test('RouteModulePill exposes selected state, readable wrapping and semantic status badges', () => {
    const block = functionBlock('RouteModulePill', 'RouteNavigatorRail');

    assert.match(block, /aria-current=\{selected \? 'true' : undefined\}/);
    assert.match(block, /aria-label=\{`\$\{displayModuleTitle\(entry\.module\)\}: \$\{statusLabel\}, \$\{categoryLabel\}, \$\{levelLabel\}`\}/);
    assert.match(block, /data-route-module-state=\{locked \? 'locked' : recommended \? 'recommended' : entry\.stats\.status\}/);
    assert.match(block, /break-words text-base leading-6/);
    assert.match(block, /<Badge tone=\{statusTone\}>\{statusLabel\}<\/Badge>/);
    assert.doesNotMatch(block, /shadow-\[0_24px_50px/);
  });

  test('ModuleActivityList marks the next activity as the current step', () => {
    const block = functionBlock('ModuleActivityList', 'ModuleMissionBoard');

    assert.match(block, /aria-current=\{isNext \? 'step' : undefined\}/);
    assert.match(block, /data-activity-state=\{completed \? 'completed' : isNext \? 'next' : 'pending'\}/);
    assert.doesNotMatch(block, /tracking-\[0\.14em\]/);
  });

  test('ModuleMissionBoard connects selected detail to a local CTA before support metadata', () => {
    const block = functionBlock('ModuleMissionBoard', 'ProgressScene');
    const actionIndex = block.indexOf('data-sd-module-cta="courses-detail"');
    const progressIndex = block.indexOf('<ProgressSummary');

    assert.match(block, /data-route-detail="module"/);
    assert.match(block, /data-selected-module-id=\{module\.id\}/);
    assert.match(block, /const moduleTitle = displayModuleTitle\(module\)/);
    assert.match(block, /const nextActivityTitle = displayActivityTitle\(stats\.nextActivity, 'Actividad pendiente'\)/);
    assert.ok(actionIndex > -1, 'Module detail should expose a local CTA marker');
    assert.ok(progressIndex > -1, 'Module detail should keep supporting progress');
    assert.ok(actionIndex < progressIndex, 'local CTA should appear before supporting progress');
    assert.match(block, /aria-label=\{`\$\{getModuleCtaLabel\(\{ locked, adminAccess, stats \}\)\}: \$\{moduleTitle\}`\}/);
    assert.doesNotMatch(block, /<KeyValueBlock/);
    assert.doesNotMatch(block, /Ultimo cierre/);
  });
});

describe('F5.B Route top / continuity / CTA unification guards', () => {
  test('RouteBriefing fuses hero, continuity and CTA into a single inverse surface', () => {
    const block = functionBlock('RouteBriefing', 'DashboardSceneBar');
    const actionIndex = block.indexOf('<ActionCluster');
    const progressIndex = block.indexOf('<ProgressBar');

    assert.match(block, /variant="command"/);
    assert.match(block, /tone="inverse"/);
    assert.match(block, /className="sd-route-briefing/);
    assert.match(block, /data-sd-container="true"/);
    assert.match(block, /Tu ruta ya esta lista para continuar\./);
    assert.match(block, /const primaryLabel = target\?\.stats\.completedCount \? 'Continuar mi ruta' : 'Abrir modulo recomendado'/);
    assert.match(block, /data-sd-primary-cta="courses-continuity"/);
    assert.match(block, /aria-label=\{`\$\{primaryLabel\}: \$\{moduleTitle\}`\}/);
    assert.match(block, /Ver en la ruta/);
    assert.match(block, /variant="ghost"/);
    assert.ok(actionIndex > -1, 'RouteBriefing should render a single action cluster');
    assert.ok(progressIndex > -1, 'RouteBriefing should render a single inline progress bar');
    assert.ok(actionIndex < progressIndex, 'primary CTA should appear before supporting progress');
    assert.doesNotMatch(block, /<StatStrip/);
    assert.doesNotMatch(block, /<ProgressSummary/);
    assert.doesNotMatch(block, /<SupportRail/);
    assert.doesNotMatch(block, /<PanelHeader/);
    assert.doesNotMatch(block, /<StageHero/);
  });

  test('DashboardEmptyState collapses the split-hero shelf into a single dominant block', () => {
    const block = functionBlock('DashboardEmptyState', 'RouteBriefing');

    assert.match(block, /<SurfaceCard[\s\S]+variant="command"[\s\S]+tone="inverse"/);
    assert.match(block, /className="sd-route-briefing/);
    assert.match(block, /<Spinner/);
    assert.match(block, /variant="primary"/);
    assert.doesNotMatch(block, /<SplitHeroLayout/);
    assert.doesNotMatch(block, /<SupportRail/);
    assert.doesNotMatch(block, /<StageHero/);
    assert.doesNotMatch(block, /<PanelHeader/);
    assert.doesNotMatch(block, /<StatStrip/);
    assert.doesNotMatch(block, /EMPTY_STRIP/);
    assert.doesNotMatch(block, /variant="hero"/);
  });

  test('CoursesView top shelf renders a single RouteBriefing block and drops the quick-guide wiring', () => {
    const block = coursesViewBlock();

    assert.match(block, /<RouteBriefing[\s\S]+target=\{nextRouteTarget\}/);
    assert.match(block, /onContinue=\{onOpenModule\}/);
    assert.match(block, /onShowInRoute=\{handleShowInRoute\}/);
    assert.doesNotMatch(block, /<RouteHero\b/);
    assert.doesNotMatch(block, /<ContinuityConsole\b/);
    assert.doesNotMatch(block, /<TopSupportBand\b/);
    assert.doesNotMatch(block, /quickGuide/);
    assert.doesNotMatch(block, /buildCourseQuickGuide/);
    assert.doesNotMatch(block, /EMPTY_STRIP/);
  });
});

describe('F5.C Route density / symmetry / contrast cleanup guards', () => {
  test('RouteModulePill relies on border contrast without bg-sd-accent-soft washes', () => {
    const block = functionBlock('RouteModulePill', 'RouteNavigatorRail');

    assert.match(block, /'sd-route-pill /);
    assert.match(block, /border-2 border-sd-accent/);
    assert.match(block, /Siguiente recomendado/);
    assert.doesNotMatch(block, /bg-sd-accent-soft/);
    assert.doesNotMatch(block, /categoryLabel\} · \$\{levelLabel\}/);
  });

  test('ModuleActivityList renders a compact list without descriptive paragraphs', () => {
    const block = functionBlock('ModuleActivityList', 'ModuleMissionBoard');

    assert.match(block, /<ol className="sd-module-activity-list/);
    assert.match(block, /border-l-4 bg-white/);
    assert.doesNotMatch(block, /bg-sd-accent-soft/);
    assert.doesNotMatch(block, /activity\?\.descripcion/);
    assert.doesNotMatch(block, /bg-white\/72/);
  });

  test('ModuleMissionBoard flattens to a single panel with inline gap + next-unlock metadata and a collapsible activity list', () => {
    const block = functionBlock('ModuleMissionBoard', 'ProgressScene');

    assert.match(block, /className="sd-module-mission-board/);
    assert.match(block, /weakestTopic/);
    assert.match(block, /nextUnlockEntry/);
    assert.match(block, /<details className="sd-module-activities-toggle/);
    assert.match(block, /Ver actividades del modulo/);
    assert.doesNotMatch(block, /<StageHero/);
    assert.doesNotMatch(block, /<StatStrip/);
    assert.doesNotMatch(block, /<SupportRail/);
    assert.doesNotMatch(block, /<KeyValueBlock/);
  });

  test('ProgressScene flattens to a single column and removes duplicate side progress reading', () => {
    const block = functionBlock('ProgressScene', 'SettingsScene');

    assert.doesNotMatch(block, /eyebrow="Siguiente foco"/);
    assert.doesNotMatch(block, /xl:grid-cols-\[minmax\(0,1\.18fr\)_minmax\(17rem,0\.82fr\)\]/);
    assert.doesNotMatch(block, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,0\.8fr\)\]/);
    assert.match(block, /<SupportRail/);
    assert.match(block, /<KeyValueBlock/);
  });

  test('CoursesView ruta body uses a single two-pane grid and no permanent insight column', () => {
    const block = coursesViewBlock();

    assert.match(block, /data-sd-route-comfort="balanced-two-pane"/);
    assert.match(block, /xl:grid-cols-\[minmax\(18rem,20rem\)_minmax\(0,1fr\)\]/);
    assert.doesNotMatch(block, /<WorkspaceLayout/);
    assert.doesNotMatch(block, /<RouteInsightRail/);
    assert.doesNotMatch(block, /function RouteInsightRail/);
    assert.doesNotMatch(block, /buildJourneyProgress/);
    assert.doesNotMatch(block, /journeySteps=\{journeySteps\}/);
  });
});
