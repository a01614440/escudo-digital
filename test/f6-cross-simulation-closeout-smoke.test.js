import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const sharedActivityUiSource = readFileSync(
  new URL('../frontend/src/components/activities/sharedActivityUi.jsx', import.meta.url),
  'utf8'
);

const tailwindSource = readFileSync(
  new URL('../frontend/src/styles/tailwind.css', import.meta.url),
  'utf8'
);

const basicActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/basicActivities.jsx', import.meta.url),
  'utf8'
);

const signalActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/signalActivities.jsx', import.meta.url),
  'utf8'
);

const webLabSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/WebLabActivity.jsx', import.meta.url),
  'utf8'
);

const inboxSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/InboxActivity.jsx', import.meta.url),
  'utf8'
);

const scenarioFlowSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/ScenarioFlowActivity.jsx', import.meta.url),
  'utf8'
);

const callSimulationSource = readFileSync(
  new URL('../frontend/src/components/activities/CallSimulationActivity.jsx', import.meta.url),
  'utf8'
);

describe('F6.J cross-simulation closeout guards', () => {
  test('shared closeout wrapper exists and marks the shared final surface', () => {
    assert.match(sharedActivityUiSource, /export function SimulationCloseout/);
    assert.match(sharedActivityUiSource, /data-sd-simulation-closeout="true"/);
    assert.match(sharedActivityUiSource, /sd-simulation-closeout-actions/);
  });

  test('tailwind exposes a shared closeout container for all simulation endings', () => {
    assert.match(tailwindSource, /\.sd-simulation-closeout \{[\s\S]*grid gap-4/);
  });

  test('basic and signal activities use the shared closeout wrapper', () => {
    assert.match(basicActivitiesSource, /SimulationCloseout/);
    assert.match(signalActivitiesSource, /SimulationCloseout/);
  });

  test('immersive simulations share the same closeout wrapper on their ending surfaces', () => {
    assert.match(webLabSource, /SimulationCloseout/);
    assert.match(inboxSource, /SimulationCloseout/);
    assert.match(scenarioFlowSource, /SimulationCloseout/);
    assert.match(callSimulationSource, /SimulationCloseout/);
  });
});
