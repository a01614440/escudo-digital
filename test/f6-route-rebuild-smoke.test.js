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

describe('F6.R3 Mi ruta rebuild guards', () => {
  test('RouteBriefing merges continuity, tabs and progress into one integrated shelf', () => {
    const block = functionBlock('RouteBriefing', 'DashboardSceneBar');

    assert.match(block, /data-sd-route-shelf="hard-rebuild"/);
    assert.match(block, /<DashboardSceneBar/);
    assert.match(block, /<Badge tone="accent">Siguiente paso<\/Badge>/);
    assert.match(block, /data-sd-primary-cta="courses-continuity"/);
    assert.match(block, /sd-route-briefing-progress/);
  });

  test('DashboardSceneBar becomes an embedded console for tabs instead of a separate card surface', () => {
    const block = functionBlock('DashboardSceneBar', 'RouteModulePill');

    assert.match(block, /data-sd-route-console="integrated"/);
    assert.doesNotMatch(block, /tone="inverse"/);
    assert.match(block, /border border-sd-border bg-sd-surface/);
    assert.doesNotMatch(block, /<SurfaceCard/);
    assert.doesNotMatch(block, /<PanelHeader/);
  });

  test('CoursesView renders route detail and modules in one hard-stack layout', () => {
    const block = coursesViewBlock();
    const detailIndex = block.indexOf('<ModuleMissionBoard');
    const railIndex = block.indexOf('<RouteNavigatorRail');

    assert.match(block, /const routeLayoutMode = 'hard-stack'/);
    assert.match(block, /data-sd-route-comfort="hard-rebuild"/);
    assert.ok(detailIndex > -1, 'CoursesView should render module detail');
    assert.ok(railIndex > -1, 'CoursesView should keep modules available as a readable block');
    assert.ok(detailIndex < railIndex, 'module detail should render before the full module list');
    assert.doesNotMatch(block, /xl:grid-cols-\[minmax\(0,1\.18fr\)_minmax\(16rem,18rem\)\]/);
    assert.doesNotMatch(block, /desktop-detail-first/);
  });
});
