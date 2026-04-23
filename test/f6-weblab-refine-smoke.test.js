import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const webLabSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/WebLabActivity.jsx', import.meta.url),
  'utf8'
);

const appCssSource = readFileSync(new URL('../frontend/src/styles/app.css', import.meta.url), 'utf8');

describe('F6.H WebLab refine guards', () => {
  test('WebLabActivity applies the immersive browser theme and browser chrome', () => {
    assert.match(webLabSource, /web-lab-immersive/);
    assert.match(webLabSource, /theme-neon|theme-premium|theme-sage|theme-street/);
    assert.match(webLabSource, /data-sd-web-lab-theme=\{webLabTheme\}/);
    assert.match(webLabSource, /data-sd-web-lab-stage=\{stage\}/);
    assert.match(webLabSource, /web-lab-mission/);
    assert.match(webLabSource, /web-lab-brief/);
    assert.match(webLabSource, /web-lab-browser-bar/);
    assert.match(webLabSource, /web-lab-browser-meta/);
    assert.match(webLabSource, /web-lab-browser-tabs/);
    assert.match(webLabSource, /web-lab-domain/);
    assert.match(webLabSource, /web-lab-workbench/);
  });

  test('WebLab styles still expose the browser shell and theme surfaces', () => {
    assert.match(appCssSource, /\.web-lab-immersive \{/);
    assert.match(appCssSource, /\.web-lab-browser-bar \{/);
    assert.match(appCssSource, /\.web-lab-domain \{/);
    assert.match(appCssSource, /\.web-lab-mission \{/);
    assert.match(appCssSource, /\.web-lab-brief \{/);
    assert.match(appCssSource, /\.web-lab-immersive\.theme-neon \{/);
    assert.match(appCssSource, /\.web-lab-immersive\.theme-premium \{/);
  });
});
