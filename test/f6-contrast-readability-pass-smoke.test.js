import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const tailwindSource = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');
const surveySource = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
const coursesSource = readFileSync(new URL('../frontend/src/components/CoursesView.jsx', import.meta.url), 'utf8');
const lessonSource = readFileSync(new URL('../frontend/src/components/LessonView.jsx', import.meta.url), 'utf8');
const sharedActivityUiSource = readFileSync(
  new URL('../frontend/src/components/activities/sharedActivityUi.jsx', import.meta.url),
  'utf8'
);
const signalActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/signalActivities.jsx', import.meta.url),
  'utf8'
);
const immersivePrimitivesSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/immersivePrimitives.jsx', import.meta.url),
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

const immersiveSources = [
  ['InboxActivity.jsx', inboxSource],
  ['WebLabActivity.jsx', webLabSource],
  ['ScenarioFlowActivity.jsx', scenarioSource],
];

describe('F6.R6 contrast and readability guards', () => {
  test('base text tokens are stronger for light and inverse surfaces', () => {
    assert.match(tailwindSource, /--sd-text-soft: #33445f;/);
    assert.match(tailwindSource, /--sd-muted: #4b5d78;/);
    assert.match(tailwindSource, /--sd-text-inverse-soft: #dce7f8;/);
    assert.match(tailwindSource, /\.sd-route-briefing\.sd-surface-tone-inverse \.text-sd-text-inverse-soft/);
    assert.match(tailwindSource, /body\[data-theme='light'\] :is\(\s*\.sd-route-briefing:not\(\.sd-surface-tone-inverse\)/);
    assert.match(tailwindSource, /\.sd-simulation-category \.text-sd-muted/);
  });

  test('route, survey and lesson no longer lean on weak inverse copy for critical text', () => {
    assert.doesNotMatch(coursesSource, /text-sd-text-inverse-soft/);
    assert.doesNotMatch(lessonSource, /text-sd-text-inverse-soft/);
    assert.doesNotMatch(surveySource, /text-sd-text-inverse-soft/);
    assert.doesNotMatch(surveySource, /bg-white\/8/);
    assert.doesNotMatch(surveySource, /bg-sd-surface-subtle/);
  });

  test('shared activity feedback and briefing copy use readable text classes', () => {
    assert.doesNotMatch(sharedActivityUiSource, /text-sd-text-soft">\{instructionMeta\.quickTip\}/);
    assert.match(sharedActivityUiSource, /text-sd-text">\{instructionMeta\.quickTip\}/);
    assert.doesNotMatch(signalActivitiesSource, /text-sd-text-soft">\{repairPossibleMojibake\(feedback\./);
    assert.match(immersivePrimitivesSource, /text-sd-text">\{body\}/);
  });

  test('immersive simulations avoid muted text and translucent white washes', () => {
    for (const [name, source] of immersiveSources) {
      assert.doesNotMatch(source, /text-sd-muted/, `${name} should not use muted text in F6.R6 surfaces`);
      assert.doesNotMatch(source, /bg-white\/(?:65|70|75|78|80)/, `${name} should not use washed white panels`);
    }
  });

  test('inbox, web and scenario surfaces use tokenized readable panels', () => {
    assert.match(inboxSource, /border-sd-border-strong bg-sd-surface hover:-translate-y-0\.5 hover:bg-sd-surface-raised/);
    assert.match(inboxSource, /border-sd-border-strong bg-sd-surface p-4 text-sm text-sd-text-soft/);
    assert.match(webLabSource, /border-sd-border-strong bg-sd-surface hover:-translate-y-0\.5 hover:bg-sd-surface-raised/);
    assert.match(webLabSource, /border-sd-border-strong bg-sd-surface-raised px-4 py-4 text-left text-sm text-sd-text/);
    assert.match(scenarioSource, /border-sd-border-strong bg-sd-surface p-5/);
    assert.match(scenarioSource, /border-sd-border-strong bg-sd-surface-raised px-4 py-4 text-left/);
  });
});
