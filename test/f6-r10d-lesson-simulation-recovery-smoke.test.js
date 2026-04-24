import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const lessonSource = readFileSync(
  new URL('../frontend/src/components/LessonView.jsx', import.meta.url),
  'utf8'
);
const sharedActivityUiSource = readFileSync(
  new URL('../frontend/src/components/activities/sharedActivityUi.jsx', import.meta.url),
  'utf8'
);
const inboxSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/InboxActivity.jsx', import.meta.url),
  'utf8'
);
const webLabSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/WebLabActivity.jsx', import.meta.url),
  'utf8'
);
const scenarioSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/ScenarioFlowActivity.jsx', import.meta.url),
  'utf8'
);
const tailwindSource = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

function defaultExportBlock(source, name) {
  const start = source.indexOf(`export default function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  return source.slice(start);
}

describe('F6.R10.D lesson and simulation visual recovery guards', () => {
  test('LessonView keeps context below the stage instead of recreating a desktop split', () => {
    const lessonView = defaultExportBlock(lessonSource, 'LessonView');

    assert.match(lessonView, /data-sd-r10d-lesson="stage-recovery"/);
    assert.match(lessonView, /data-sd-r10d-secondary="stacked"/);
    assert.doesNotMatch(lessonView, /md:grid-cols-2 xl:grid-cols-\[minmax\(0,1\.08fr\)_minmax\(20rem,0\.92fr\)\] xl:items-start/);
  });

  test('Immersive ActivityChrome exposes the R10.D dominant stage contract', () => {
    assert.match(sharedActivityUiSource, /data-sd-r10d-stage="dominant"/);
    assert.match(sharedActivityUiSource, /data-sd-stage-focus="fullscreen"/);
    assert.match(sharedActivityUiSource, /data-sd-stage-layout="fullscreen"/);
  });

  test('Specific simulation shells remove hard desktop rail grids from JSX', () => {
    assert.match(inboxSource, /data-sd-r10d-simulation="list-stack"/);
    assert.match(inboxSource, /data-sd-r10d-stage="single-column"/);
    assert.doesNotMatch(inboxSource, /xl:grid-cols-\[minmax\(18rem,22rem\)_minmax\(0,1fr\)\]/);

    assert.match(webLabSource, /data-sd-r10d-briefing="stacked"/);
    assert.match(webLabSource, /data-sd-r10d-stage="single-column"/);
    assert.doesNotMatch(webLabSource, /xl:grid-cols-\[minmax\(0,1\.82fr\)_minmax\(16rem,0\.68fr\)\]/);
    assert.doesNotMatch(webLabSource, /xl:grid-cols-\[minmax\(0,1\.25fr\)_minmax\(18rem,0\.75fr\)\]/);

    assert.match(scenarioSource, /data-sd-r10d-stage="single-column"/);
    assert.doesNotMatch(scenarioSource, /xl:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(18rem,0\.85fr\)\]/);
  });

  test('Tailwind overrides old rails with a stage-first R10.D layout', () => {
    assert.match(tailwindSource, /\[data-sd-r10d-lesson='stage-recovery'\] \.sd-lesson-secondary-grid\[data-sd-r10d-secondary='stacked'\]/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell\[data-sd-r10d-stage='dominant'\] \.sd-simulation-main-stage,[\s\S]*\.sd-simulation-main-stage\[data-sd-r10d-stage='single-column'\],[\s\S]*\.sd-immersive-activity-shell\[data-sd-r10d-stage='dominant'\] \.sd-chat-sim-desktop \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(tailwindSource, /\.sd-simulation-briefing-strip\[data-sd-r10d-briefing='stacked'\] \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell\[data-sd-r10d-stage='dominant'\] \[data-sd-stage-rail='subordinate'\] \{[\s\S]*position: static;[\s\S]*max-height: none;[\s\S]*overflow: visible/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage\[data-sd-r10d-stage='single-column'\] \[data-sd-stage-rail='subordinate'\],[\s\S]*\.sd-simulation-briefing-strip\[data-sd-r10d-briefing='stacked'\] \[data-sd-stage-rail='subordinate'\] \{[\s\S]*position: static;[\s\S]*max-height: none;[\s\S]*overflow: visible/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell\[data-sd-r10d-stage='dominant'\] :is\(h1, h2, h3, h4, strong, p, span, button\) \{[\s\S]*overflow-wrap: normal;[\s\S]*word-break: normal/);
  });
});
