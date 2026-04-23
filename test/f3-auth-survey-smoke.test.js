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

  test('SurveyView uses foundation choice primitives instead of improvised choice cards', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');

    assert.match(source, /Checkbox,/);
    assert.match(source, /Radio,/);
    assert.match(source, /<Radio[\s\S]*checked=\{value === option\.value\}/);
    assert.match(source, /<Checkbox[\s\S]*checked=\{selected\.includes\(option\.value\)\}/);
    assert.match(source, /buildNextMultiAnswer\(question\.options, selected, option\.value, event\.target\.checked\)/);
    assert.doesNotMatch(source, /function SurveyChoiceCard/);
    assert.doesNotMatch(source, /<input className="sr-only"/);
    assert.doesNotMatch(source, /shadow-\[0_24px_50px/);
  });

  test('SurveyView wires question controls to accessible descriptions and errors', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');

    assert.match(source, /function mergeDescribedBy/);
    assert.match(source, /<fieldset[\s\S]*aria-describedby=\{describedBy\}[\s\S]*aria-invalid=\{invalid \? 'true' : undefined\}/);
    assert.match(source, /aria-required="true"/);
    assert.match(source, /<legend className="sr-only">\{question\.title\}<\/legend>/);
    assert.match(source, /id=\{validationErrorId\} tone="warning"/);
    assert.match(source, /id=\{flowErrorId\} tone="danger"/);
    assert.match(source, /<Select[\s\S]*id=\{`\$\{questionDomId\}-select`\}[\s\S]*required[\s\S]*invalid=\{invalid\}[\s\S]*aria-describedby=\{describedBy\}/);
    assert.match(source, /<TextArea[\s\S]*id=\{`\$\{questionDomId\}-text`\}[\s\S]*required[\s\S]*invalid=\{invalid\}[\s\S]*aria-describedby=\{describedBy\}/);
  });
});
