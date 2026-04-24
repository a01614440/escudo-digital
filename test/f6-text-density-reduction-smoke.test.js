import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const surveySource = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
const coursesSource = readFileSync(new URL('../frontend/src/components/CoursesView.jsx', import.meta.url), 'utf8');
const lessonSource = readFileSync(new URL('../frontend/src/components/LessonView.jsx', import.meta.url), 'utf8');
const feedbackSource = readFileSync(new URL('../frontend/src/components/FeedbackPanel.jsx', import.meta.url), 'utf8');
const sharedActivityUiSource = readFileSync(
  new URL('../frontend/src/components/activities/sharedActivityUi.jsx', import.meta.url),
  'utf8'
);
const signalActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/signalActivities.jsx', import.meta.url),
  'utf8'
);
const inboxSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/InboxActivity.jsx', import.meta.url),
  'utf8'
);
const callSource = readFileSync(
  new URL('../frontend/src/components/activities/CallSimulationActivity.jsx', import.meta.url),
  'utf8'
);

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.length;
  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

function exportedFunctionBlock(source, name, nextExport) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = nextExport ? source.indexOf(`export function ${nextExport}`, start + 1) : source.length;
  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('F6.R7 text density reduction guards', () => {
  test('shared activity summary bars default to two visible facts and hidden captions', () => {
    const block = exportedFunctionBlock(sharedActivityUiSource, 'ActivitySummaryBar', 'SimulationCloseout');

    assert.match(block, /maxItems = 2/);
    assert.match(block, /\.slice\(0, maxItems\)/);
    assert.match(block, /showCaptions && item\.caption/);
  });

  test('feedback keeps primary advice visible and collapses secondary detail', () => {
    assert.match(feedbackSource, /const primaryItems = \[/);
    assert.match(feedbackSource, /data-sd-feedback-visible="primary"/);
    assert.match(feedbackSource, /<details className="sd-feedback-secondary"/);
    assert.match(feedbackSource, /data-sd-feedback-secondary="collapsed"/);
    assert.doesNotMatch(feedbackSource, /La decision general fue segura; conserva esa misma rutina\./);
  });

  test('survey results and loading reduce open lists before route handoff', () => {
    assert.match(surveySource, /LOADING_PIPELINE\.slice\(0, 2\)/);
    assert.match(surveySource, /recommendations\.slice\(0, 2\)/);
    assert.match(surveySource, /nextSteps\.slice\(0, 1\)/);
    assert.match(surveySource, /subtitle="Abre el modulo recomendado\."/);
    assert.doesNotMatch(surveySource, /Puedes volver atras sin perder respuestas\./);
  });

  test('route and lesson hide secondary context behind compact affordances', () => {
    assert.match(coursesSource, /Siguiente actividad: \$\{nextActivityTitle\}\./);
    assert.match(coursesSource, /supportFacts\.slice\(0, 2\)/);
    assert.match(coursesSource, /<summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">Objetivo<\/summary>/);

    const lessonStage = functionBlock(lessonSource, 'LessonActivityStage', 'LessonInsightRail');
    assert.doesNotMatch(lessonStage, /cleanText\(activity\?\.intro \|\| activity\?\.escenario \|\| activity\?\.prompt/);
    assert.match(lessonSource, /data-sd-lesson-objective="collapsed"/);
  });

  test('simulation-specific passes cap support lists and collapse review-heavy surfaces', () => {
    assert.match(signalActivitiesSource, /signals\.slice\(0, 2\)\.map/);
    assert.match(inboxSource, /result\.review\.slice\(0, 3\)\.map/);
    assert.match(callSource, /data-sd-call-transcript-preview="collapsed"/);
  });
});
