import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const callSource = readFileSync(
  new URL('../frontend/src/components/activities/CallSimulationActivity.jsx', import.meta.url),
  'utf8'
);

const signalActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/signalActivities.jsx', import.meta.url),
  'utf8'
);

function exportedFunctionBlock(source, name, nextExport) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextExport ? source.indexOf(`export function ${nextExport}`, start + 1) : source.length;
  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('F6.I calls and other simulation refinement guards', () => {
  test('CallSimulationActivity exposes a phase banner and an announced transcript log', () => {
    assert.match(callSource, /call-stage-banner/);
    assert.match(callSource, /role="log"/);
    assert.match(callSource, /aria-live="polite"/);
    assert.match(callSource, /aria-relevant="additions text"/);
    assert.match(callSource, /aria-label="Cronología de la llamada"/);
    assert.doesNotMatch(callSource, /call-immersive-panel-head/);
  });

  test('analysis surfaces use headers and framed response areas instead of bare utility blocks', () => {
    const compareBlock = exportedFunctionBlock(signalActivitiesSource, 'CompareDomainsActivity', 'SignalHuntActivity');
    const signalBlock = exportedFunctionBlock(signalActivitiesSource, 'SignalHuntActivity');

    assert.match(compareBlock, /PanelHeader/);
    assert.match(compareBlock, /SurfaceCard/);
    assert.match(compareBlock, /ActivitySummaryBar/);
    assert.match(compareBlock, /option-grid/);
    assert.doesNotMatch(compareBlock, /Paragraphs/);

    assert.match(signalBlock, /PanelHeader/);
    assert.match(signalBlock, /SurfaceCard/);
    assert.match(signalBlock, /ActivitySummaryBar/);
    assert.match(signalBlock, /signal-list/);
    assert.doesNotMatch(signalBlock, /message-box/);
  });
});
