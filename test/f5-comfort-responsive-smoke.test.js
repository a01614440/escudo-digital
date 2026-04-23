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
  test('Courses route keeps a balanced two-pane layout and secondary stepper context', () => {
    const sceneBar = functionBlock(coursesSource, 'DashboardSceneBar', 'RouteModulePill');
    const block = defaultExportBlock(coursesSource, 'CoursesView');

    assert.match(sceneBar, /className="sd-dashboard-stepper-toggle /);
    assert.match(sceneBar, /data-sd-journey-stepper="courses-route"/);
    assert.match(sceneBar, /<summary[\s\S]*Ver progreso de la ruta/);
    assert.match(block, /data-sd-route-comfort="balanced-two-pane"/);
    assert.match(block, /lg:grid-cols-\[minmax\(17rem,19rem\)_minmax\(0,1fr\)\]/);
    assert.match(block, /xl:grid-cols-\[minmax\(18rem,20rem\)_minmax\(0,1fr\)\]/);
    assert.doesNotMatch(block, /minmax\(0,1\.5fr\)/);
    assert.doesNotMatch(block, /minmax\(0,1\.6fr\)/);
  });

  test('Lesson guided stage reduces wrapper padding and keeps map context secondary', () => {
    const commandRail = functionBlock(lessonSource, 'LessonCommandRail', 'LessonActivityStage');
    const stage = functionBlock(lessonSource, 'LessonActivityStage', 'LessonInsightRail');
    const lessonView = defaultExportBlock(lessonSource, 'LessonView');

    assert.match(commandRail, /data-sd-lesson-map="secondary"/);
    assert.match(stage, /padding="md"/);
    assert.match(stage, /data-sd-stage-comfort="compact"/);
    assert.match(stage, /rounded-\[22px\]/);
    assert.doesNotMatch(stage, /padding=\{shellFamily === 'mobile' \? 'md' : 'lg'\}/);
    assert.match(lessonView, /data-sd-lesson-comfort="content-first"/);
    assert.match(lessonView, /md:grid-cols-\[minmax\(15\.5rem,18rem\)_minmax\(0,1fr\)\]/);
  });

  test('Tailwind exposes final comfort hooks for contrast, fullscreen and collapsible context', () => {
    assert.match(tailwindSource, /\.sd-route-pill\[aria-current='true'\]/);
    assert.match(tailwindSource, /\.sd-dashboard-stepper-toggle summary/);
    assert.match(tailwindSource, /\.sd-lesson-map-toggle summary/);
    assert.match(tailwindSource, /\.sd-lesson-stage-guided\[data-sd-stage-comfort='compact'\]/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell \{[\s\S]*--sd-simulation-stage-min-block: clamp\(38rem, 80vh, 72rem\)/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell \{[\s\S]*min-height: var\(--sd-simulation-stage-min-block\)/);
  });
});
