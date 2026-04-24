import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const tailwindSource = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');
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

describe('F6.R9 fullscreen stage dominance pass', () => {
  test('immersive chrome and simulation roots expose fullscreen stage intent', () => {
    assert.match(sharedActivityUiSource, /data-sd-stage-focus="fullscreen"/);
    assert.match(signalActivitiesSource, /data-sd-stage-focus="fullscreen"/);
    assert.match(callSource, /data-sd-stage-focus="fullscreen"/);
    assert.match(inboxSource, /data-sd-stage-focus="fullscreen"[\s\S]*data-sd-stage-layout="list-detail"/);
    assert.match(webLabSource, /data-sd-stage-focus="fullscreen"[\s\S]*data-sd-stage-layout="weblab-workbench"/);
    assert.match(scenarioSource, /data-sd-stage-focus="fullscreen"[\s\S]*data-sd-stage-layout="scenario-flow"/);
  });

  test('support rails are explicitly subordinate to the main simulation stage', () => {
    assert.match(signalActivitiesSource, /<aside className="sd-chat-insight" data-sd-stage-rail="subordinate">/);
    assert.match(inboxSource, /<ImmersivePanel className="email-sidebar" data-sd-stage-rail="subordinate">/);
    assert.match(webLabSource, /data-sd-stage-rail="subordinate"/);
    assert.match(scenarioSource, /<aside className="scenario-flow-rail grid gap-4" data-sd-stage-rail="subordinate">/);
  });

  test('shared CSS gives the stage more width, height and rail subordination', () => {
    assert.match(tailwindSource, /--sd-simulation-stage-min-block: clamp\(42rem, 86vh, 82rem\)/);
    assert.match(tailwindSource, /--sd-simulation-stage-max-inline: 104rem/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell\[data-sd-stage-dominance='primary'\] \{[\s\S]*width: min\(100%, var\(--sd-simulation-stage-max-inline\)\)/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage \{[\s\S]*min-height: clamp\(34rem, 70vh, 68rem\)/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage\[data-sd-stage-focus='fullscreen'\] \{[\s\S]*width: min\(100%, var\(--sd-simulation-stage-max-inline\)\)/);
    assert.match(tailwindSource, /\[data-sd-stage-rail='subordinate'\][\s\S]*max-height: min\(100%, 74vh\)/);
  });

  test('desktop layouts reserve more space for the activity than for support rails', () => {
    assert.match(tailwindSource, /grid-template-columns: minmax\(14rem, 18rem\) minmax\(0, 1fr\)/);
    assert.match(tailwindSource, /grid-template-columns: minmax\(0, 4\.2fr\) minmax\(14rem, 0\.72fr\)/);
    assert.match(tailwindSource, /grid-template-columns: minmax\(0, 3\.2fr\) minmax\(14rem, 0\.62fr\)/);
    assert.match(tailwindSource, /grid-template-columns: minmax\(0, 2\.25fr\) minmax\(14rem, 0\.62fr\)/);
  });

  test('chat uses a centered phone stage while calls keep expanded play space', () => {
    assert.match(tailwindSource, /\.sd-chat-sim \{[\s\S]*width: min\(100%, 94rem\)/);
    assert.match(tailwindSource, /\.sd-chat-sim-desktop \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(tailwindSource, /\.sd-chat-sim-desktop \{[\s\S]*justify-items: center/);
    assert.match(tailwindSource, /\.sd-chat-surface \{[\s\S]*width: min\(100%, 31rem\)/);
    assert.match(tailwindSource, /\.sd-chat-surface \{[\s\S]*min-height: clamp\(42rem, 78vh, 56rem\)/);
    assert.match(tailwindSource, /\.sd-chat-thread \{[\s\S]*min-height: clamp\(24rem, 52vh, 38rem\)/);
    assert.match(tailwindSource, /\.sd-chat-thread \{[\s\S]*max-height: clamp\(30rem, 62vh, 44rem\)/);
    assert.match(tailwindSource, /\.call-immersive-shell\[data-sd-stage-dominance='primary'\] \{[\s\S]*width: min\(100%, 92rem\)/);
    assert.match(tailwindSource, /\.call-immersive-phone \{[\s\S]*min-height: clamp\(40rem, 78vh, 72rem\)/);
  });
});
