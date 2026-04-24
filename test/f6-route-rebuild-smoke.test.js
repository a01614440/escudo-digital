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

    assert.match(block, /data-sd-route-shelf="integrated"/);
    assert.match(block, /<DashboardSceneBar/);
    assert.match(block, /<Badge tone="accent">Siguiente paso<\/Badge>/);
    assert.match(block, /data-sd-primary-cta="courses-continuity"/);
    assert.match(block, /sd-route-briefing-progress/);
  });

  test('DashboardSceneBar becomes an embedded console for tabs instead of a separate card surface', () => {
    const block = functionBlock('DashboardSceneBar', 'RouteModulePill');

    assert.match(block, /data-sd-route-console="integrated"/);
    assert.match(block, /tone="inverse"/);
    assert.doesNotMatch(block, /<SurfaceCard/);
    assert.doesNotMatch(block, /<PanelHeader/);
  });

  test('CoursesView promotes module detail before the route rail in a detail-first layout', () => {
    const block = coursesViewBlock();
    const detailIndex = block.indexOf('<ModuleMissionBoard');
    const railIndex = block.indexOf('<RouteNavigatorRail');

    assert.match(block, /'tablet-stack'/);
    assert.match(block, /'desktop-detail-first'/);
    assert.match(block, /data-sd-route-comfort=\{shellFamily === 'desktop' \? 'detail-first' : 'stacked'\}/);
    assert.ok(detailIndex > -1, 'CoursesView should render module detail');
    assert.ok(railIndex > -1, 'CoursesView should keep the route rail');
    assert.ok(detailIndex < railIndex, 'module detail should render before the secondary rail');
  });
});
