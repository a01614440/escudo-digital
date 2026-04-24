import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';

const buttonSource = readFileSync('frontend/src/components/ui/Button.jsx', 'utf8');
const iconButtonSource = readFileSync('frontend/src/components/ui/IconButton.jsx', 'utf8');
const surfaceCardSource = readFileSync('frontend/src/components/ui/SurfaceCard.jsx', 'utf8');
const tailwindSource = readFileSync('frontend/src/styles/tailwind.css', 'utf8');

describe('Fase X.3 button, tap and active feedback pass', () => {
  test('foundation controls expose stable interaction markers', () => {
    assert.match(buttonSource, /data-sd-interaction="button"/);
    assert.match(iconButtonSource, /data-sd-interaction="button"/);
    assert.match(surfaceCardSource, /data-sd-interaction=\{interactive \? 'surface' : undefined\}/);
  });

  test('foundation buttons have explicit pointer, touch, active and selected feedback', () => {
    assert.match(tailwindSource, /\.sd-button \{/);
    assert.match(tailwindSource, /cursor: pointer;/);
    assert.match(tailwindSource, /touch-action: manipulation;/);
    assert.match(tailwindSource, /-webkit-tap-highlight-color: transparent;/);
    assert.match(tailwindSource, /\.sd-button:active:not\(:disabled\)/);
    assert.match(tailwindSource, /transform: translateY\(1px\) scale\(0\.985\);/);
    assert.match(tailwindSource, /\.sd-button\[data-active='true'\]/);
  });

  test('interactive surfaces and route module triggers respond to focus and tap', () => {
    assert.match(tailwindSource, /\.sd-interactive-surface:focus-within/);
    assert.match(tailwindSource, /\.sd-interactive-surface:active/);
    assert.match(tailwindSource, /\.sd-route-pill-trigger:active/);
    assert.match(tailwindSource, /\.sd-route-pill-trigger:focus-visible/);
  });

  test('legacy-visible simulation controls get the same feedback layer without touching logic', () => {
    assert.match(tailwindSource, /\.btn,/);
    assert.match(tailwindSource, /\.option-btn,/);
    assert.match(tailwindSource, /\.domain-btn,/);
    assert.match(tailwindSource, /\.email-list-item,/);
    assert.match(tailwindSource, /\.web-lab-domain,/);
    assert.match(tailwindSource, /\.scenario-option-card,/);
    assert.match(tailwindSource, /\.call-control-btn/);
    assert.match(tailwindSource, /:focus-visible \{/);
    assert.match(tailwindSource, /\.web-lab-stage-tabs \.sd-button\[aria-current='step'\]/);
  });
});
