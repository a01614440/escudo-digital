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
    assert.match(block, /Elige un bloque sin perder continuidad\./);
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
    assert.match(settings, /Ritmo, foco y regeneracion de la ruta/);
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
