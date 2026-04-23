import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('F3 Auth + Survey closeout guards', () => {
  test('AuthView uses foundation inverse tone instead of local inverse hacks', () => {
    const source = readFileSync(new URL('../frontend/src/components/AuthView.jsx', import.meta.url), 'utf8');

    assert.match(source, /<SurfaceCard[\s\S]*variant="command"[\s\S]*tone="inverse"/);
    assert.match(source, /<strong className="sd-heading-sm m-0">/);
    assert.match(source, /<p className="sd-copy-sm m-0">/);
    assert.doesNotMatch(source, /text-white/);
    assert.doesNotMatch(source, /shadow-\[0_28px_80px/);
    assert.doesNotMatch(source, /\[&_\.text-sd-text\]:text-white/);
  });

  test('AuthView avoids the duplicate shell page wrapper outside mobile padding', () => {
    const source = readFileSync(new URL('../frontend/src/components/AuthView.jsx', import.meta.url), 'utf8');

    assert.match(source, /id="authView"/);
    assert.match(source, /className=\{shellFamily === 'mobile' \? 'sd-page-shell' : undefined\}/);
    assert.doesNotMatch(source, /className="sd-page-shell py-\[var\(--sd-shell-padding-block\)\]"/);
    assert.doesNotMatch(source, /data-sd-container="true"[\s\S]*<SplitHeroLayout/);
    assert.doesNotMatch(source, /md:grid-cols-\[minmax\(0,1\.08fr\)_minmax\(23rem,0\.92fr\)\]/);
  });
});
