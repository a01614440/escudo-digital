import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

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

describe('F6.R10 specific simulation passes', () => {
  test('each major simulation exposes a channel-specific pass marker', () => {
    assert.match(signalActivitiesSource, /data-sd-specific-simulation-pass="chat"/);
    assert.match(inboxSource, /data-sd-specific-simulation-pass=\{simulationCategory\}/);
    assert.match(webLabSource, /data-sd-specific-simulation-pass="weblab"/);
    assert.match(scenarioSource, /data-sd-specific-simulation-pass="scenario"/);
    assert.match(callSource, /data-sd-specific-simulation-pass="call"/);
  });

  test('specific channel strips clarify the primary interaction without adding large panels', () => {
    assert.match(signalActivitiesSource, /sd-chat-stage-cues[\s\S]*data-sd-specific-strip="chat"/);
    assert.match(signalActivitiesSource, /analysis-action-strip[\s\S]*data-sd-specific-strip="analysis"/);
    assert.match(inboxSource, /inbox-action-strip[\s\S]*data-sd-specific-strip="inbox"/);
    assert.match(webLabSource, /web-lab-stage-tabs[\s\S]*data-sd-specific-strip="weblab"/);
    assert.match(scenarioSource, /scenario-choice-stack[\s\S]*data-sd-specific-strip="scenario"/);
    assert.match(callSource, /call-safety-strip[\s\S]*data-sd-specific-strip="call"/);
  });

  test('WebLab, scenario and call expose stronger interaction affordances', () => {
    assert.match(webLabSource, /aria-current=\{stage === value \? 'step' : undefined\}/);
    assert.match(scenarioSource, /scenario-decision-card/);
    assert.match(scenarioSource, /scenario-option-card/);
    assert.match(scenarioSource, /scenario-flow-rail/);
    assert.match(callSource, /data-sd-call-phase=\{phase\}/);
    assert.match(callSource, /data-sd-call-control-dock="true"/);
  });

  test('Tailwind contains the shared F6.R10 polish hooks', () => {
    assert.match(tailwindSource, /\[data-sd-specific-strip\]/);
    assert.match(tailwindSource, /\.sd-chat-stage-cues/);
    assert.match(tailwindSource, /\.inbox-action-strip/);
    assert.match(tailwindSource, /\.analysis-action-strip/);
    assert.match(tailwindSource, /\.web-lab-stage-tabs/);
    assert.match(tailwindSource, /\.scenario-decision-card/);
    assert.match(tailwindSource, /\.scenario-option-card/);
    assert.match(tailwindSource, /\.call-safety-strip/);
    assert.match(tailwindSource, /\.call-controls-bar\[data-sd-call-control-dock='true'\]/);
  });
});
