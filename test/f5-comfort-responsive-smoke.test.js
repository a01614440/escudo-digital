import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const coursesSource = readFileSync(
  new URL('../frontend/src/components/CoursesView.jsx', import.meta.url),
  'utf8'
);

const lessonSource = readFileSync(
  new URL('../frontend/src/components/LessonView.jsx', import.meta.url),
  'utf8'
);

const tailwindSource = readFileSync(
  new URL('../frontend/src/styles/tailwind.css', import.meta.url),
  'utf8'
);

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextName
    ? source.indexOf(`function ${nextName}`, start + 1)
    : source.indexOf('export default function', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

function defaultExportBlock(source, name) {
  const start = source.indexOf(`export default function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  return source.slice(start);
}

describe('F5.G Comfort, playability, and responsive guards', () => {
  test('Courses route keeps the stepper context embedded while promoting a detail-first route layout', () => {
    const sceneBar = functionBlock(coursesSource, 'DashboardSceneBar', 'RouteModulePill');
    const block = defaultExportBlock(coursesSource, 'CoursesView');

    assert.match(sceneBar, /className="sd-dashboard-stepper-toggle /);
    assert.match(sceneBar, /data-sd-route-console="integrated"/);
    assert.match(sceneBar, /data-sd-journey-stepper="courses-route"/);
    assert.match(sceneBar, /<summary[\s\S]*Ver progreso de la ruta/);
    assert.match(block, /data-sd-route-comfort="hard-rebuild"/);
    assert.match(block, /const routeLayoutMode = 'hard-stack'/);
    assert.doesNotMatch(block, /'tablet-stack'/);
    assert.doesNotMatch(block, /'desktop-detail-first'/);
    assert.doesNotMatch(block, /xl:grid-cols-\[minmax\(0,1\.18fr\)_minmax\(16rem,18rem\)\]/);
    assert.doesNotMatch(block, /minmax\(0,1\.5fr\)/);
    assert.doesNotMatch(block, /minmax\(0,1\.6fr\)/);
  });

  test('Lesson guided stage reduces wrapper padding and keeps map context secondary', () => {
    const commandRail = functionBlock(lessonSource, 'LessonCommandRail', 'LessonActivityStage');
    const stage = functionBlock(lessonSource, 'LessonActivityStage', 'LessonInsightRail');
    const lessonView = defaultExportBlock(lessonSource, 'LessonView');

    assert.match(commandRail, /data-sd-lesson-map="secondary"/);
    assert.match(stage, /data-sd-stage-comfort="dominant"/);
    assert.match(stage, /rounded-\[26px\]/);
    assert.doesNotMatch(stage, /<PanelHeader/);
    assert.doesNotMatch(stage, /padding=\{shellFamily === 'mobile' \? 'md' : 'lg'\}/);
    assert.match(lessonView, /data-sd-lesson-comfort="stage-first"/);
    assert.match(lessonView, /data-sd-r10d-secondary="stacked"/);
    assert.doesNotMatch(lessonView, /md:grid-cols-2 xl:grid-cols-\[minmax\(0,1\.08fr\)_minmax\(20rem,0\.92fr\)\] xl:items-start/);
  });

  test('Tailwind exposes final comfort hooks for contrast, fullscreen and collapsible context', () => {
    assert.match(tailwindSource, /\.sd-route-pill\[aria-current='true'\]/);
    assert.match(tailwindSource, /\.sd-dashboard-stepper-toggle summary/);
    assert.match(tailwindSource, /\.sd-lesson-map-toggle summary/);
    assert.match(tailwindSource, /\.sd-lesson-insight-toggle summary/);
    assert.match(tailwindSource, /\.sd-lesson-stage-guided\[data-sd-stage-comfort='dominant'\]/);
    assert.match(tailwindSource, /\.sd-lesson-support-card/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell \{[\s\S]*--sd-simulation-stage-min-block: clamp\(42rem, 86vh, 82rem\)/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell \{[\s\S]*min-height: var\(--sd-simulation-stage-min-block\)/);
  });
});
