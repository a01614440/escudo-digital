import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';

const tailwindSource = readFileSync('frontend/src/styles/tailwind.css', 'utf8');
const coursesSource = readFileSync('frontend/src/components/CoursesView.jsx', 'utf8');

function getFunctionBlock(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} not found`);

  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe('Fase X.0.C/D light text visibility guards', () => {
  test('default overline text is not inverse-only in locked light mode', () => {
    const overlineBlock = tailwindSource.match(/\.sd-overline\s*\{[\s\S]*?\n  \}/)?.[0] || '';

    assert.match(overlineBlock, /color:\s*var\(--sd-muted\)/);
    assert.doesNotMatch(overlineBlock, /--sd-text-inverse/);
  });

  test('route inverse-soft override only applies to real inverse surfaces', () => {
    assert.match(
      tailwindSource,
      /\.sd-route-briefing\.sd-surface-tone-inverse \.text-sd-text-inverse-soft/
    );
    assert.doesNotMatch(
      tailwindSource,
      /\.sd-route-briefing \.text-sd-text-inverse-soft/
    );
  });

  test('light critical surfaces scrub accidental inverse text tokens', () => {
    assert.match(tailwindSource, /body\[data-theme='light'\] :is\(/);
    assert.match(tailwindSource, /\.sd-route-briefing:not\(\.sd-surface-tone-inverse\)/);
    assert.match(tailwindSource, /\.sd-route-navigator-block/);
    assert.match(tailwindSource, /\.sd-simulation-readable-surface/);
    assert.match(
      tailwindSource,
      /:is\(\.text-sd-text-inverse, \.text-sd-text-inverse-soft, \.sd-copy-inverse, \.sd-overline\)/
    );
    assert.match(tailwindSource, /color:\s*var\(--sd-text\) !important/);
  });

  test('Mi Ruta hero remains a light surface without inverse text tokens', () => {
    const routeBriefing = getFunctionBlock(coursesSource, 'RouteBriefing');

    assert.match(routeBriefing, /data-sd-route-shelf="hard-rebuild"/);
    assert.doesNotMatch(routeBriefing, /tone="inverse"/);
    assert.doesNotMatch(routeBriefing, /text-sd-text-inverse/);
  });
});
