import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

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

describe('F6.D simulation fullscreen and stage-dominance guards', () => {
  test('ActivityChrome marks immersive simulations as the primary stage', () => {
    const block = exportedFunctionBlock(sharedActivityUiSource, 'ActivityChrome', 'completeActivity');

    assert.match(sharedActivityUiSource, /import \{ cn \} from '\.\.\/\.\.\/lib\/ui\.js'/);
    assert.match(block, /data-sd-activity-chrome="immersive"/);
    assert.match(block, /data-sd-stage-dominance="primary"/);
    assert.match(block, /data-sd-stage-focus="fullscreen"/);
    assert.match(block, /data-sd-stage-layout="fullscreen"/);
  });

  test('simulation roots expose stage dominance and layout intent without touching renderer contracts', () => {
    assert.match(signalActivitiesSource, /data-sd-simulation-channel="whatsapp"[\s\S]*data-sd-stage-dominance="primary"/);
    assert.match(inboxSource, /data-sd-simulation-channel=\{isSms \? 'sms' : 'email'\}[\s\S]*data-sd-stage-dominance="primary"/);
    assert.match(webLabSource, /data-sd-simulation-channel="weblab"[\s\S]*data-sd-stage-dominance="primary"/);
    assert.match(scenarioSource, /data-sd-simulation-channel="scenario-flow"[\s\S]*data-sd-stage-dominance="primary"/);
    assert.match(callSource, /data-sd-simulation-channel="call"[\s\S]*data-sd-stage-dominance="primary"/);

    assert.match(inboxSource, /className="sd-simulation-main-stage[\s\S]*data-sd-stage-layout="list-detail"/);
    assert.match(webLabSource, /className="web-lab-mission sd-simulation-briefing-strip[\s\S]*data-sd-stage-layout="briefing"/);
    assert.match(webLabSource, /className="sd-simulation-main-stage[\s\S]*data-sd-stage-layout="weblab-workbench"/);
    assert.match(scenarioSource, /className="sd-simulation-main-stage[\s\S]*data-sd-stage-layout="scenario-flow"/);
  });

  test('Tailwind stage hooks give immersive simulations more screen dominance', () => {
    assert.match(tailwindSource, /--sd-simulation-stage-min-block: clamp\(42rem, 86vh, 82rem\)/);
    assert.match(tailwindSource, /--sd-simulation-stage-max-inline: 104rem/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell\[data-sd-stage-dominance='primary'\]/);
    assert.match(tailwindSource, /\.sd-simulation-category\[data-sd-stage-dominance='primary'\]/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage \{/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage\[data-sd-stage-focus='fullscreen'\]/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage\[data-sd-stage-layout='list-detail'\]/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage\[data-sd-stage-layout='weblab-workbench'\]/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage\[data-sd-stage-layout='scenario-flow'\]/);
    assert.match(tailwindSource, /\[data-sd-stage-rail='subordinate'\]/);
    assert.match(tailwindSource, /\.call-immersive-shell\[data-sd-stage-dominance='primary'\]/);
  });

  test('chat stage no longer carries the narrow pre-F6.D limit', () => {
    assert.match(tailwindSource, /\.sd-chat-sim \{[\s\S]*width: min\(100%, 94rem\)/);
    assert.match(tailwindSource, /\.sd-chat-sim\.sd-simulation-category\[data-sd-stage-dominance='primary'\]/);
    assert.match(tailwindSource, /\.sd-chat-thread \{[\s\S]*min-height: clamp\(30rem, 62vh, 50rem\)/);
    assert.match(tailwindSource, /\.sd-chat-thread \{[\s\S]*max-height: clamp\(38rem, 76vh, 64rem\)/);
    assert.doesNotMatch(tailwindSource, /width: min\(100%, 46rem\)/);
    assert.doesNotMatch(tailwindSource, /max-height: 32rem/);
  });
});
