import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const signalActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/signalActivities.jsx', import.meta.url),
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

describe('F6.E WhatsApp/chat refine guards', () => {
  test('WhatsAppSimulation declares chat semantics, composer help and readable live regions', () => {
    const block = exportedFunctionBlock(signalActivitiesSource, 'WhatsAppSimulation', 'CompareDomainsActivity');

    assert.match(block, /role="log"/);
    assert.match(block, /aria-live="polite"/);
    assert.match(block, /aria-relevant="additions text"/);
    assert.match(block, /aria-label=\{threadLabel\}/);
    assert.match(block, /sd-chat-composer-help/);
    assert.match(block, /aria-describedby="sd-chat-composer-help"/);
    assert.match(block, /Enviar respuesta sugerida:/);
    assert.match(block, /sd-chat-insight/);
    assert.match(block, /sd-chat-complete-note/);
  });

  test('WhatsApp/chat styles keep composer readable and let R10.D stack insight below the stage', () => {
    assert.match(tailwindSource, /\.sd-immersive-activity-shell\[data-sd-r10d-stage='dominant'\] \.sd-simulation-main-stage,[\s\S]*\.sd-immersive-activity-shell\[data-sd-r10d-stage='dominant'\] \.sd-chat-sim-desktop \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(tailwindSource, /\.sd-chat-thread \{[\s\S]*overscroll-behavior: contain;[\s\S]*scrollbar-gutter: stable;/);
    assert.match(tailwindSource, /\.sd-chat-composer-help \{/);
    assert.match(tailwindSource, /\.sd-immersive-activity-shell\[data-sd-r10d-stage='dominant'\] \[data-sd-stage-rail='subordinate'\] \{[\s\S]*position: static;[\s\S]*max-height: none;[\s\S]*overflow: visible/);
    assert.match(tailwindSource, /@media \(max-width: 47\.99rem\) \{[\s\S]*\.sd-chat-composer \{[\s\S]*position: sticky;[\s\S]*bottom: 0\.75rem;/);
    assert.match(tailwindSource, /body\[data-theme='dark'\] \.sd-chat-composer \{/);
  });
});
