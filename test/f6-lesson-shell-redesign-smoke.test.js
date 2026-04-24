import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const lessonSource = readFileSync(
  new URL('../frontend/src/components/LessonView.jsx', import.meta.url),
  'utf8'
);

function functionBlock(name, nextName) {
  const start = lessonSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextName
    ? lessonSource.indexOf(`function ${nextName}`, start + 1)
    : lessonSource.indexOf('export default function LessonView', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return lessonSource.slice(start, end);
}

function lessonViewBlock() {
  const start = lessonSource.indexOf('export default function LessonView');
  assert.notEqual(start, -1, 'LessonView should exist');
  return lessonSource.slice(start);
}

describe('F6.R5 Lesson + simulation shell redesign guards', () => {
  test('ModuleEmptyState and ModuleComplete avoid split heroes and use the lesson command shell', () => {
    const empty = functionBlock('ModuleEmptyState', 'LessonMissionHero');
    const complete = functionBlock('ModuleComplete');

    assert.match(empty, /data-sd-lesson-shell="empty"/);
    assert.match(complete, /data-sd-lesson-shell="complete"/);
    assert.match(empty, /sd-lesson-shell-command/);
    assert.match(complete, /sd-lesson-shell-command/);
    assert.doesNotMatch(empty, /<SplitHeroLayout/);
    assert.doesNotMatch(complete, /<SplitHeroLayout/);
    assert.doesNotMatch(complete, /<ProgressSummary/);
  });

  test('Lesson support surfaces collapse into subordinate cards below the stage', () => {
    const command = functionBlock('LessonCommandRail', 'LessonActivityStage');
    const insight = functionBlock('LessonInsightRail', 'ModuleComplete');
    const lessonView = lessonViewBlock();

    assert.match(command, /data-sd-lesson-context=\{compact \? 'compact-map' : 'mission'\}/);
    assert.match(command, /Abrir mapa del modulo/);
    assert.match(insight, /data-sd-lesson-context="insight"/);
    assert.match(insight, /data-sd-lesson-insight="secondary"/);
    assert.match(lessonView, /data-sd-lesson-secondary="subordinate"/);
    assert.match(lessonView, /data-sd-lesson-layout=\{isImmersive \? 'immersive-stack' : 'guided-stack'\}/);
    assert.doesNotMatch(lessonView, /guided-two-pane/);
  });

  test('Guided stage becomes the dominant surface instead of another nested lesson card', () => {
    const stage = functionBlock('LessonActivityStage', 'LessonInsightRail');

    assert.match(stage, /data-sd-stage-comfort="dominant"/);
    assert.match(stage, /sd-lesson-stage-head/);
    assert.match(stage, /rounded-\[26px\]/);
    assert.doesNotMatch(stage, /<PanelHeader/);
    assert.doesNotMatch(stage, /variant="spotlight"/);
    assert.doesNotMatch(stage, /<SurfaceCard/);
  });
});
