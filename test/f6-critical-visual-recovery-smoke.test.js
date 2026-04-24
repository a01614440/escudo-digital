import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const coursesSource = readFileSync(
  new URL('../frontend/src/components/CoursesView.jsx', import.meta.url),
  'utf8'
);
const tailwindSource = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

function functionBlock(name, nextName) {
  const start = coursesSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextName
    ? coursesSource.indexOf(`function ${nextName}`, start + 1)
    : coursesSource.indexOf('export default function CoursesView', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return coursesSource.slice(start, end);
}

function coursesViewBlock() {
  const start = coursesSource.indexOf('export default function CoursesView');
  assert.notEqual(start, -1, 'CoursesView should exist');
  return coursesSource.slice(start);
}

describe('F6.R10.C hard layout rebuild', () => {
  test('route tabs avoid inverse hero buttons on the light route shelf', () => {
    const block = functionBlock('DashboardTabs', 'LevelFilter');

    assert.match(block, /activeTab === tab\.id\s*\?\s*'primary'/);
    assert.doesNotMatch(block, /\?\s*tone === 'inverse'\s*\?\s*'primary'\s*:\s*'hero'/);
  });

  test('Mi ruta hero uses a hard high-contrast shelf instead of washed editorial copy', () => {
    const block = functionBlock('RouteBriefing', 'DashboardSceneBar');

    assert.match(block, /variant="panel"/);
    assert.match(block, /data-sd-route-shelf="hard-rebuild"/);
    assert.match(block, /sd-route-continuity-card/);
    assert.match(block, /sd-route-progress-number/);
    assert.match(block, /data-sd-primary-cta="courses-continuity"/);
    assert.match(tailwindSource, /\.sd-route-briefing\[data-sd-route-shelf='hard-rebuild'\][\s\S]*width: min\(100%, 80rem\)/);
    assert.match(tailwindSource, /\.sd-route-briefing\[data-sd-route-shelf='hard-rebuild'\] > \.grid[\s\S]*width: 100%/);
    assert.doesNotMatch(block, /tone="inverse"/);
    assert.doesNotMatch(block, /text-sd-text-inverse/);
    assert.doesNotMatch(block, /xl:grid-cols-\[minmax\(0,1\.16fr\)_minmax\(18rem,0\.84fr\)\]/);
  });

  test('route modules render as one readable module list, not a narrow rail grid', () => {
    const block = functionBlock('RouteNavigatorRail', 'ModuleActivityList');

    assert.match(block, /className="sd-route-navigator-block overflow-hidden"/);
    assert.match(block, /data-sd-route-rail="module-list"/);
    assert.match(block, /data-sd-route-module-list="single-column"/);
    assert.doesNotMatch(block, /sm:grid-cols-2/);
    assert.doesNotMatch(block, /xl:grid-cols-3/);
    assert.doesNotMatch(block, /sticky/);
    assert.doesNotMatch(block, /2xl:top-6/);
  });

  test('module titles avoid vertical word splitting', () => {
    const pill = functionBlock('RouteModulePill', 'RouteNavigatorRail');
    const activities = functionBlock('ModuleActivityList', 'ModuleMissionBoard');

    assert.match(pill, /sd-route-pill-title block text-base leading-6 text-sd-text/);
    assert.match(activities, /sd-module-activity-title block text-sm leading-6 text-sd-text/);
    assert.doesNotMatch(pill, /sd-route-pill-title min-w-0 flex-1/);
    assert.doesNotMatch(pill, /break-words/);
    assert.doesNotMatch(activities, /break-words/);
    assert.match(tailwindSource, /\.sd-route-pill-title[\s\S]*-webkit-line-clamp: 2/);
    assert.match(tailwindSource, /\.sd-module-activity-title[\s\S]*word-break: normal/);
  });

  test('CoursesView route body no longer forces the detail and navigator into desktop columns', () => {
    const block = coursesViewBlock();

    assert.match(block, /const routeLayoutMode = 'hard-stack'/);
    assert.match(block, /data-sd-route-comfort="hard-rebuild"/);
    assert.doesNotMatch(block, /xl:grid-cols-\[minmax\(0,1\.18fr\)_minmax\(16rem,18rem\)\]/);
    assert.doesNotMatch(block, /'desktop-detail-first'/);
  });
});
