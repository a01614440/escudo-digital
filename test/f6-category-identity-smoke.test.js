import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const sharedActivityUiSource = readFileSync(
  new URL('../frontend/src/components/activities/sharedActivityUi.jsx', import.meta.url),
  'utf8'
);

const immersiveSharedSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/shared.js', import.meta.url),
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

const webLabSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/WebLabActivity.jsx', import.meta.url),
  'utf8'
);

const scenarioSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/ScenarioFlowActivity.jsx', import.meta.url),
  'utf8'
);

const callSource = readFileSync(
  new URL('../frontend/src/components/activities/CallSimulationActivity.jsx', import.meta.url),
  'utf8'
);

const tailwindSource = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

function exportedFunctionBlock(source, name, nextExport) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextExport ? source.indexOf(`export function ${nextExport}`, start + 1) : source.length;

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('F6.C simulation category identity and color semantics guards', () => {
  test('shared immersive metadata defines every simulation category and resolver', () => {
    for (const category of ['chat', 'sms', 'email', 'web', 'call', 'scenario', 'analysis']) {
      assert.match(immersiveSharedSource, new RegExp(`${category}: \\{`));
    }

    assert.match(immersiveSharedSource, /export function getSimulationCategory\(activity\)/);
    assert.match(immersiveSharedSource, /type === 'sim_chat'/);
    assert.match(immersiveSharedSource, /activity\?\.kind === 'sms' \? 'sms' : 'email'/);
    assert.match(immersiveSharedSource, /type === 'web_lab'/);
    assert.match(immersiveSharedSource, /type === 'call_sim'/);
    assert.match(immersiveSharedSource, /type === 'scenario_flow'/);
    assert.match(immersiveSharedSource, /type === 'compare_domains' \|\| type === 'signal_hunt'/);
    assert.match(immersiveSharedSource, /sd-simulation-category-\$\{safeCategory\}/);
  });

  test('ActivityChrome exposes category classes and data attributes for guided and immersive activities', () => {
    const block = exportedFunctionBlock(sharedActivityUiSource, 'ActivityChrome', 'completeActivity');

    assert.match(block, /const simulationCategory = getSimulationCategory\(activity\)/);
    assert.match(block, /const simulationCategoryClassName = getSimulationCategoryClass\(simulationCategory\)/);
    assert.match(block, /className=\{cn\(immersiveShellClassName,\s*simulationCategoryClassName\)\}/);
    assert.match(block, /className=\{cn\('sd-activity-chrome grid gap-4',\s*simulationCategoryClassName\)\}/);
    assert.match(block, /data-sd-simulation-category=\{simulationCategory\}/);
  });

  test('main simulation roots expose stable category and channel attributes', () => {
    assert.match(signalActivitiesSource, /getSimulationCategoryClass\('chat'\)/);
    assert.match(signalActivitiesSource, /data-sd-simulation-category="chat"/);
    assert.match(signalActivitiesSource, /data-sd-simulation-channel="whatsapp"/);

    assert.match(inboxSource, /const isSms = kind === 'sms';/);
    assert.match(inboxSource, /const simulationCategory = isSms \? 'sms' : 'email'/);
    assert.match(inboxSource, /getSimulationCategoryClass\(simulationCategory\)/);
    assert.match(inboxSource, /data-sd-simulation-category=\{simulationCategory\}/);
    assert.match(inboxSource, /data-sd-simulation-channel=\{isSms \? 'sms' : 'email'\}/);

    assert.match(webLabSource, /getSimulationCategoryClass\('web'\)/);
    assert.match(webLabSource, /data-sd-simulation-category="web"/);
    assert.match(webLabSource, /data-sd-simulation-channel="weblab"/);

    assert.match(scenarioSource, /getSimulationCategoryClass\('scenario'\)/);
    assert.match(scenarioSource, /data-sd-simulation-category="scenario"/);
    assert.match(scenarioSource, /data-sd-simulation-channel="scenario-flow"/);

    assert.match(callSource, /getSimulationCategoryClass\('call'\)/);
    assert.match(callSource, /data-sd-simulation-category="call"/);
    assert.match(callSource, /data-sd-simulation-channel="call"/);
  });

  test('Tailwind defines scoped category variables for every F6 simulation family', () => {
    for (const category of ['chat', 'sms', 'email', 'web', 'call', 'scenario', 'analysis']) {
      assert.match(tailwindSource, new RegExp(`\\.sd-simulation-category-${category} \\{`));
    }

    for (const token of [
      '--sd-simulation-category-accent',
      '--sd-simulation-category-accent-strong',
      '--sd-simulation-category-soft',
      '--sd-simulation-category-surface',
      '--sd-simulation-category-border',
      '--sd-simulation-category-glow',
    ]) {
      assert.match(tailwindSource, new RegExp(token));
    }

    assert.match(tailwindSource, /body\[data-theme='dark'\] \.sd-simulation-category/);
  });

  test('category tokens feed badges, summaries and immersive panels without per-channel hacks', () => {
    assert.match(tailwindSource, /\.sd-simulation-category \.eyebrow/);
    assert.match(tailwindSource, /\.sd-simulation-category \.sd-badge-accent/);
    assert.match(tailwindSource, /\.sd-simulation-category \.sd-badge-soft/);
    assert.match(tailwindSource, /\.sd-simulation-category \.sd-activity-summary-card/);
    assert.match(tailwindSource, /\.sd-simulation-category \.sd-simulation-readable-surface/);
    assert.match(tailwindSource, /\.sd-simulation-category \.sd-immersive-panel/);
    assert.match(tailwindSource, /\.sd-simulation-category \.sd-immersive-aside-panel/);
    assert.match(tailwindSource, /\.sd-simulation-category \.sd-immersive-progress-pill/);
    assert.match(tailwindSource, /linear-gradient\(180deg, var\(--sd-simulation-category-surface\), var\(--sd-surface\)\)/);
  });
});
