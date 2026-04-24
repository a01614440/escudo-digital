import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const sharedActivityUiSource = readFileSync(
  new URL('../frontend/src/components/activities/sharedActivityUi.jsx', import.meta.url),
  'utf8'
);

const feedbackSource = readFileSync(
  new URL('../frontend/src/components/FeedbackPanel.jsx', import.meta.url),
  'utf8'
);

const immersiveSharedSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/shared.js', import.meta.url),
  'utf8'
);

const immersivePrimitivesSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/immersivePrimitives.jsx', import.meta.url),
  'utf8'
);

const tailwindSource = readFileSync(
  new URL('../frontend/src/styles/tailwind.css', import.meta.url),
  'utf8'
);

function exportedFunctionBlock(source, name, nextExport) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextExport
    ? source.indexOf(`export function ${nextExport}`, start + 1)
    : source.length;

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('F6.B simulation contrast, readability and text density guards', () => {
  test('ActivitySummaryBar uses compact readable summary cards instead of washed subtle panels', () => {
    const block = exportedFunctionBlock(sharedActivityUiSource, 'ActivitySummaryBar');

    assert.match(block, /data-sd-activity-summary="compact"/);
    assert.match(block, /variant="support"/);
    assert.match(block, /sd-activity-summary-card/);
    assert.match(block, /sd-activity-summary-label/);
    assert.match(block, /sd-activity-summary-value/);
    assert.match(block, /sd-activity-summary-caption/);
    assert.doesNotMatch(block, /variant="subtle"/);
    assert.doesNotMatch(block, /tracking-\[0\.14em\]/);
    assert.doesNotMatch(block, /text-sd-text-soft">\{item\.caption\}/);
  });

  test('Briefing and simulation guide share the readable F6 surface and compact density marker', () => {
    const guide = exportedFunctionBlock(sharedActivityUiSource, 'SimulationGuide', 'ActivityChrome');
    const chrome = exportedFunctionBlock(sharedActivityUiSource, 'ActivityChrome', 'completeActivity');

    assert.match(guide, /sd-simulation-readable-surface/);
    assert.match(guide, /data-sd-text-density="compact"/);
    assert.match(guide, /sd-simulation-guide-step/);
    assert.match(chrome, /sd-simulation-readable-surface/);
    assert.match(chrome, /data-sd-text-density="compact"/);
    assert.doesNotMatch(guide, /bg-white\/84/);
    assert.doesNotMatch(chrome, /bg-white p-4/);
  });

  test('Immersive primitives use raised readable surfaces without translucent white washes', () => {
    assert.match(immersiveSharedSource, /sd-immersive-panel/);
    assert.match(immersiveSharedSource, /sd-immersive-aside-panel/);
    assert.match(immersiveSharedSource, /bg-sd-surface-raised/);
    assert.match(immersiveSharedSource, /bg-sd-surface/);
    assert.doesNotMatch(immersiveSharedSource, /bg-white\/75/);
    assert.doesNotMatch(immersiveSharedSource, /bg-white\/60/);

    assert.match(immersivePrimitivesSource, /sd-immersive-progress-pill/);
    assert.match(immersivePrimitivesSource, /sd-immersive-progress-label/);
    assert.doesNotMatch(immersivePrimitivesSource, /text-sd-muted/);
    assert.doesNotMatch(immersivePrimitivesSource, /bg-white\/76/);
  });

  test('FeedbackPanel declares compact density and keeps feedback text readable', () => {
    assert.match(feedbackSource, /data-sd-text-density="compact"/);
    assert.match(feedbackSource, /Resumen corto para decidir el siguiente paso\./);
    assert.match(feedbackSource, /Resultado breve\./);
  });

  test('Tailwind exposes F6 readable surfaces, summary cards and stronger feedback text', () => {
    assert.match(tailwindSource, /\.sd-simulation-readable-surface \{[\s\S]*border-sd-border-strong[\s\S]*bg-sd-surface-raised/);
    assert.match(tailwindSource, /\.sd-simulation-guide-step \{[\s\S]*border-sd-border-strong[\s\S]*bg-sd-surface/);
    assert.match(tailwindSource, /\.sd-activity-summary-grid/);
    assert.match(tailwindSource, /\.sd-activity-summary-card \{[\s\S]*border-sd-border-strong[\s\S]*bg-sd-surface-raised/);
    assert.match(tailwindSource, /\.sd-feedback-copy \{[\s\S]*text-sd-text/);
    assert.match(tailwindSource, /\.sd-feedback-item,[\s\S]*\.sd-feedback-list \{[\s\S]*border-sd-border-strong[\s\S]*bg-sd-surface/);
    assert.match(tailwindSource, /\.sd-immersive-progress-pill \{[\s\S]*border-sd-border-strong[\s\S]*bg-sd-surface/);
  });
});
