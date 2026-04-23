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
  test('RouteHero keeps only route and focus summary signals', () => {
    const block = functionBlock('RouteHero', 'ContinuityConsole');

    assert.match(block, /key: 'modules'/);
    assert.match(block, /key: 'focus'/);
    assert.doesNotMatch(block, /Score total/);
    assert.doesNotMatch(block, /Ultimo acceso/);
    assert.doesNotMatch(block, /assessment\?\.nivel/);
  });

  test('ContinuityConsole keeps the primary action area free of redundant metadata', () => {
    const block = functionBlock('ContinuityConsole', 'TopSupportBand');

    assert.match(block, /Que sigue ahora/);
    assert.doesNotMatch(block, /key: 'category'/);
    assert.doesNotMatch(block, /key: 'time'/);
    assert.doesNotMatch(block, /!grid-cols-1/);
  });

  test('TopSupportBand no longer duplicates progress insight already shown elsewhere', () => {
    const block = functionBlock('TopSupportBand', 'DashboardSceneBar');

    assert.match(block, /quickGuide\.slice\(0, 2\)/);
    assert.doesNotMatch(block, /ProgressSummary/);
    assert.doesNotMatch(block, /prioritySummary/);
    assert.doesNotMatch(block, /strongestTopic/);
  });

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
    const block = functionBlock('ModuleMissionBoard', 'RouteInsightRail');

    assert.match(block, /key: 'progress'/);
    assert.doesNotMatch(block, /key: 'time'/);
    assert.doesNotMatch(block, /key: 'visits'/);
    assert.doesNotMatch(block, /Objetivo claro, siguiente actividad visible/);
    assert.doesNotMatch(block, /!grid-cols-1/);
  });

  test('RouteInsightRail keeps only route progress, gap, unlock and admin context', () => {
    const block = functionBlock('RouteInsightRail', 'ProgressScene');

    assert.match(block, /key: 'gap'/);
    assert.match(block, /key: 'next'/);
    assert.doesNotMatch(block, /quickGuide/);
    assert.doesNotMatch(block, /key: 'fortaleza'/);
    assert.doesNotMatch(block, /selectedStats/);
    assert.doesNotMatch(block, /Lectura del modulo seleccionado/);
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

  test('ProgressScene keeps snapshots conditional and makes the side rail actionable', () => {
    const block = functionBlock('ProgressScene', 'SettingsScene');

    assert.match(block, /\{history\.length \? \(/);
    assert.match(block, /eyebrow="Historial reciente"/);
    assert.doesNotMatch(block, /Sin snapshots todavia/);
    assert.match(block, /eyebrow="Siguiente foco"/);
    assert.match(block, /title=\{weakestTopic \? CATEGORY_LABELS\[weakestTopic\[0\]\] : 'Sin gap dominante'\}/);
    assert.match(block, /tone="warning"/);
    assert.match(block, /title="Senales de aprendizaje"/);
    assert.doesNotMatch(block, /key: 'prefs'/);
  });

  test('SettingsScene treats adjustments as secondary controls with explicit regeneration CTA', () => {
    const block = functionBlock('SettingsScene');

    assert.match(block, /const selectedTopicCount = Array\.isArray\(coursePrefs\?\.temas\) \? coursePrefs\.temas\.length : 0/);
    assert.match(block, /tone="support"/);
    assert.match(block, /title="Ajustes de ruta sin perder progreso"/);
    assert.match(block, /variant="panel"/);
    assert.match(block, /key: 'topics'/);
    assert.match(block, /data-sd-settings-cta="courses-regenerate"/);
    assert.match(block, /aria-label="Actualizar ruta con estas preferencias"/);
    assert.doesNotMatch(block, /variant="hero"/);
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

  test('CoursesView exposes explicit route layout modes and gives desktop more room for detail', () => {
    const block = coursesViewBlock();

    assert.match(block, /const routeLayoutMode = isMobile/);
    assert.match(block, /'mobile-stack'/);
    assert.match(block, /'tablet-two-pane'/);
    assert.match(block, /'desktop-balanced'/);
    assert.match(block, /data-sd-route-layout=\{routeLayoutMode\}/);
    assert.match(block, /lg:grid-cols-\[minmax\(18rem,20rem\)_minmax\(0,1\.18fr\)\]/);
    assert.match(block, /xl:grid-cols-\[minmax\(18rem,20rem\)_minmax\(0,1\.55fr\)_minmax\(16\.5rem,18\.5rem\)\]/);
    assert.doesNotMatch(block, /minmax\(20\.5rem,22rem\)_minmax\(0,1\.32fr\)_minmax\(18\.75rem,20\.5rem\)/);
  });

  test('ModuleMissionBoard avoids cramped tablet nesting and only splits the detail on wide desktop', () => {
    const block = functionBlock('ModuleMissionBoard', 'RouteInsightRail');

    assert.match(block, /data-sd-module-layout=\{shellFamily === 'desktop' \? 'desktop-comfort' : 'stacked-comfort'\}/);
    assert.match(block, /2xl:grid-cols-\[minmax\(0,1fr\)_minmax\(17rem,0\.62fr\)\]/);
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
    const block = functionBlock('ModuleMissionBoard', 'RouteInsightRail');
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

describe('F4.C Courses hero, continuity and CTA guards', () => {
  test('RouteHero frames the route without competing with the continuity CTA', () => {
    const block = functionBlock('RouteHero', 'ContinuityConsole');

    assert.match(block, /Tu ruta ya esta lista para continuar\./);
    assert.match(block, /subtitle=\{prioritySummary\}/);
    assert.doesNotMatch(block, /assessment\?\.resumen/);
    assert.doesNotMatch(block, /data-sd-primary-cta/);
    assert.doesNotMatch(block, /<Button/);
  });

  test('ContinuityConsole owns the primary CTA before supporting progress', () => {
    const block = functionBlock('ContinuityConsole', 'TopSupportBand');
    const actionIndex = block.indexOf('<ActionCluster');
    const progressIndex = block.indexOf('<ProgressSummary');

    assert.match(block, /variant="command"/);
    assert.match(block, /tone="inverse"/);
    assert.ok(actionIndex > -1, 'ContinuityConsole should render an action cluster');
    assert.ok(progressIndex > -1, 'ContinuityConsole should render supporting progress');
    assert.ok(actionIndex < progressIndex, 'the primary CTA should appear before supporting progress');
    assert.match(block, /data-sd-primary-cta="courses-continuity"/);
    assert.match(block, /const primaryLabel = target\?\.stats\.completedCount \? 'Continuar mi ruta' : 'Abrir modulo recomendado'/);
    assert.match(block, /aria-label=\{`\$\{primaryLabel\}: \$\{displayModuleTitle\(target\.module\)\}`\}/);
    assert.match(block, /Ver en la ruta/);
    assert.doesNotMatch(block, /Continuar donde me quede/);
  });
});
