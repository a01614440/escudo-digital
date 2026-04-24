import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

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
    : source.indexOf('export default function LessonView', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

function lessonViewBlock() {
  const start = lessonSource.indexOf('export default function LessonView');
  assert.notEqual(start, -1, 'LessonView should exist');
  return lessonSource.slice(start);
}

describe('F5.D Route-to-lesson transition guards', () => {
  test('LessonMissionHero keeps continuity but renders as a real light-mode panel', () => {
    const block = functionBlock(lessonSource, 'LessonMissionHero', 'ActivityMapList');

    assert.match(block, /variant="panel"/);
    assert.doesNotMatch(block, /tone="inverse"/);
    assert.match(block, /className="sd-lesson-briefing sd-lesson-mission-hero /);
    assert.match(block, /data-sd-container="true"/);
    assert.match(block, /sd-title-display/);
    assert.match(block, /<ProgressBar/);
    assert.match(block, /tone="accent"/);
    assert.match(block, /size="lg"/);
    assert.match(block, /data-sd-lesson-back="courses"/);
    assert.match(block, /variant="ghost"/);
    assert.doesNotMatch(block, /<StageHero/);
    assert.doesNotMatch(block, /<StatStrip/);
    assert.doesNotMatch(block, /<ProgressSummary/);
    assert.doesNotMatch(block, /variant="secondary"/);
  });

  test('LessonView root exposes a continuity marker and an enter animation hook', () => {
    const block = lessonViewBlock();

    assert.match(block, /className="sd-page-shell sd-lesson-enter /);
    assert.match(block, /data-sd-lesson-source="courses-continuity"/);
    assert.match(block, /id="lessonView"/);
  });

  test('Tailwind layer defines the sd-lesson-enter animation with a bounded duration', () => {
    assert.match(tailwindSource, /@keyframes sd-lesson-enter/);
    assert.match(tailwindSource, /\.sd-lesson-enter \{[\s\S]*animation: sd-lesson-enter \d+ms/);
  });

  test('Lesson mission hero has a dedicated light-safe contrast class', () => {
    assert.match(tailwindSource, /\.sd-lesson-mission-hero \{/);
    assert.match(tailwindSource, /\.sd-lesson-mission-hero \{[\s\S]*background-color: #ffffff !important/);
    assert.match(tailwindSource, /\.sd-lesson-mission-hero \{[\s\S]*color: var\(--sd-text\) !important/);
    assert.match(tailwindSource, /\.sd-lesson-mission-hero \.sd-title-display \{[\s\S]*color: var\(--sd-text-strong\) !important/);
  });
});
