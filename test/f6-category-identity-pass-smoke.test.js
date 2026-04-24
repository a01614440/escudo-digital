import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const sharedSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/shared.js', import.meta.url),
  'utf8'
);

const sharedActivityUiSource = readFileSync(
  new URL('../frontend/src/components/activities/sharedActivityUi.jsx', import.meta.url),
  'utf8'
);

const tailwindSource = readFileSync(
  new URL('../frontend/src/styles/tailwind.css', import.meta.url),
  'utf8'
);

function exportedFunctionBlock(source, name, nextExport) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextExport ? source.indexOf(`export function ${nextExport}`, start + 1) : source.length;
  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('F6.R8 category identity pass guards', () => {
  test('shared metadata gives every category a visible product signature', () => {
    for (const category of ['chat', 'sms', 'email', 'web', 'call', 'scenario', 'analysis', 'concept']) {
      assert.match(sharedSource, new RegExp(`${category}: \\{[\\s\\S]*signature:`));
      assert.match(sharedSource, new RegExp(`${category}: \\{[\\s\\S]*cue:`));
      assert.match(sharedSource, new RegExp(`${category}: \\{[\\s\\S]*rhythm:`));
    }

    assert.match(sharedSource, /export function getSimulationCategoryMeta\(category\)/);
    assert.match(sharedSource, /\['concepto', 'quiz', 'checklist', 'abierta', 'simulacion'\]\.includes\(type\)/);
    assert.match(sharedSource, /return 'concept'/);
  });

  test('ActivityChrome renders a compact category identity band for guided and immersive stages', () => {
    const band = exportedFunctionBlock(sharedActivityUiSource, 'SimulationIdentityBand', 'SimulationGuide');
    const chrome = exportedFunctionBlock(sharedActivityUiSource, 'ActivityChrome', 'completeActivity');

    assert.match(band, /getSimulationCategoryMeta\(category\)/);
    assert.match(band, /className=\{cn\('sd-simulation-identity-band'/);
    assert.match(band, /data-sd-category-channel=\{meta\.channel\}/);
    assert.match(band, /data-sd-category-rhythm=\{meta\.rhythm\}/);
    assert.match(band, /sd-simulation-identity-cue/);
    assert.match(chrome, /<SimulationIdentityBand category=\{simulationCategory\} compact \/>/);
    assert.match(chrome, /<SimulationIdentityBand category=\{simulationCategory\} compact=\{compact\} \/>/);
  });

  test('category CSS exposes distinct ink, pattern, rail and concept identity tokens', () => {
    for (const token of [
      '--sd-simulation-category-ink',
      '--sd-simulation-category-rail',
      '--sd-simulation-category-pattern',
    ]) {
      assert.match(tailwindSource, new RegExp(token));
    }

    assert.match(tailwindSource, /\.sd-simulation-category-concept \{/);
    assert.match(tailwindSource, /\.sd-simulation-category::before \{/);
    assert.match(tailwindSource, /\.sd-simulation-category > \* \{/);
    assert.match(tailwindSource, /\.sd-simulation-identity-band \{/);
    assert.match(tailwindSource, /\.sd-simulation-identity-dot \{/);
  });

  test('major simulation families consume category variables instead of generic accent color', () => {
    assert.match(tailwindSource, /\.sd-chat-bubble\.is-user \{[\s\S]*background: var\(--sd-simulation-category-rail\)/);
    assert.match(tailwindSource, /\.sd-chat-suggestions \.sd-button \{[\s\S]*var\(--sd-simulation-category-accent\)/);
    assert.match(tailwindSource, /\.sd-simulation-category-sms\.email-sim\.inbox-sim-sms/);
    assert.match(tailwindSource, /\.sd-simulation-category-email\.email-sim\.inbox-sim-mail/);
    assert.match(tailwindSource, /\.sd-simulation-category-web\.web-lab-immersive/);
    assert.match(tailwindSource, /\.sd-simulation-category-call\.call-immersive-shell/);
    assert.match(tailwindSource, /\.sd-simulation-category-concept \.concept-hero-card/);
    assert.match(tailwindSource, /\.sd-simulation-category-analysis \.domain-card/);
  });
});
