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

const feedbackSource = readFileSync(
  new URL('../frontend/src/components/FeedbackPanel.jsx', import.meta.url),
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

function exportedFunctionBlock(source, name, nextExport) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextExport
    ? source.indexOf(`export function ${nextExport}`, start + 1)
    : source.length;

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('F5.F Activity chrome, instructions, and feedback guards', () => {
  test('LessonActivityStage delegates visible briefing to ActivityChrome', () => {
    const block = functionBlock(lessonSource, 'LessonActivityStage', 'LessonInsightRail');

    assert.match(block, /data-sd-briefing-source="activity-chrome"/);
    assert.match(block, /data-sd-lesson-stage="guided"/);
    assert.match(block, /sd-lesson-renderer-frame/);
    assert.doesNotMatch(block, /instructionMeta\.whatToDo/);
    assert.doesNotMatch(block, /instructionMeta\.scoring/);
    assert.doesNotMatch(block, /Que debes hacer/);
    assert.doesNotMatch(block, /Como se evalua/);
  });

  test('ActivityChrome owns one collapsible briefing instead of nested instruction cards', () => {
    const block = exportedFunctionBlock(sharedActivityUiSource, 'ActivityChrome', 'completeActivity');

    assert.match(block, /data-sd-activity-chrome="guided"/);
    assert.match(block, /data-sd-briefing="activity-chrome"/);
    assert.match(block, /className="sd-activity-briefing /);
    assert.match(block, /<details/);
    assert.match(block, /<dl className=/);
    assert.doesNotMatch(block, /variant="panel"/);
    assert.doesNotMatch(block, /padding="compact" variant="subtle"/);
  });

  test('SimulationGuide is collapsible for both compact and regular activity chrome', () => {
    const block = exportedFunctionBlock(sharedActivityUiSource, 'SimulationGuide', 'ActivityChrome');

    assert.match(block, /data-sd-simulation-guide="collapsed"/);
    assert.match(block, /className="sd-simulation-guide /);
    assert.match(block, /<details/);
    assert.doesNotMatch(block, /<SurfaceCard/);
    assert.doesNotMatch(block, /if \(compact\)/);
  });

  test('FeedbackPanel uses one compact feedback surface with lightweight internal sections', () => {
    assert.match(feedbackSource, /data-sd-feedback-panel="true"/);
    assert.match(feedbackSource, /sd-feedback-summary-grid/);
    assert.match(feedbackSource, /sd-feedback-signal-grid/);
    assert.match(feedbackSource, /function FeedbackItem/);
    assert.doesNotMatch(feedbackSource, /function FeedbackBlock/);
    assert.doesNotMatch(feedbackSource, /<SurfaceCard padding="compact" variant="subtle">/);
  });

  test('Tailwind layer exposes F5.F hooks for briefing and feedback chrome', () => {
    assert.match(tailwindSource, /\.sd-activity-briefing summary/);
    assert.match(tailwindSource, /\.sd-simulation-guide summary/);
    assert.match(tailwindSource, /\.sd-activity-briefing-item/);
    assert.match(tailwindSource, /\.sd-feedback-panel/);
    assert.match(tailwindSource, /\.sd-feedback-item/);
    assert.match(tailwindSource, /\.sd-feedback-list/);
  });
});
