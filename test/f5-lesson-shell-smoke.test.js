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

const tailwindSource = readFileSync(
  new URL('../frontend/src/styles/tailwind.css', import.meta.url),
  'utf8'
);

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextName
    ? source.indexOf(`function ${nextName}`, start + 1)
    : source.indexOf('export default function LessonView', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

function lessonViewBlock() {
  const start = lessonSource.indexOf('export default function LessonView');
  assert.notEqual(start, -1, 'LessonView should exist');
  return lessonSource.slice(start);
}

describe('F5.E Lesson shell content-first fullscreen guards', () => {
  test('LessonView chooses a dynamic guided or immersive layout without WorkspaceLayout', () => {
    const block = lessonViewBlock();

    assert.match(block, /const stageMode = getLessonStageMode\(info\.activity\)/);
    assert.match(block, /data-sd-activity-mode=\{stageMode\}/);
    assert.match(block, /data-sd-lesson-layout=\{isImmersive \? 'immersive-fullscreen' : 'guided-two-pane'\}/);
    assert.match(block, /sd-lesson-layout-immersive/);
    assert.match(block, /sd-lesson-layout-guided/);
    assert.doesNotMatch(block, /<WorkspaceLayout/);
  });

  test('LessonActivityStage gives immersive activities the renderer without nested lesson cards', () => {
    const block = functionBlock(lessonSource, 'LessonActivityStage', 'LessonInsightRail');

    assert.match(block, /stageMode = 'guided'/);
    assert.match(block, /const isImmersive = stageMode === 'immersive'/);
    assert.match(block, /data-sd-lesson-stage="immersive"/);
    assert.match(block, /data-sd-activity-type=\{String\(activity\?\.tipo \|\| ''\)\}/);
    assert.match(block, /sd-lesson-renderer-frame/);
    assert.match(block, /data-sd-lesson-stage="guided"/);
  });

  test('ActivityChrome bypasses the generic chrome for all immersive activity types', () => {
    assert.match(sharedActivityUiSource, /const IMMERSIVE_ACTIVITY_TYPES = new Set\(\['sim_chat', 'inbox', 'web_lab', 'call_sim', 'scenario_flow'\]\)/);
    assert.match(sharedActivityUiSource, /const isImmersiveActivity = IMMERSIVE_ACTIVITY_TYPES\.has\(activityType\)/);
    assert.match(sharedActivityUiSource, /data-sd-activity-chrome="immersive"/);
    assert.match(sharedActivityUiSource, /sd-immersive-activity-shell/);
    assert.match(sharedActivityUiSource, /sd-chat-activity-shell/);
    assert.doesNotMatch(sharedActivityUiSource, /const isChatSimulation = activity\?\.tipo === 'sim_chat'/);
  });

  test('Lesson context and fullscreen hooks are present in the Tailwind layer', () => {
    assert.match(tailwindSource, /\.sd-lesson-layout-immersive/);
    assert.match(tailwindSource, /\.sd-lesson-layout-guided/);
    assert.match(tailwindSource, /\.sd-lesson-stage-immersive/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell/);
  });
});
