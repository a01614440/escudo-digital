import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  a11yRules,
  blurTokens,
  containerAwarenessRules,
  colorTokens,
  educationalTokens,
  foundationInventory,
  interactionRules,
  motionTokens,
  overlayInventory,
  shellSpacingTokens,
  typographyTokens,
  zIndexTokens,
} from '../frontend/src/design-system/tokens.js';

test('foundation tokens expose region surfaces and shell spacing', () => {
  assert.ok(colorTokens.regionSurface.includes('--sd-surface-hero'));
  assert.ok(colorTokens.regionSurface.includes('--sd-surface-command'));
  assert.ok(colorTokens.regionSurface.includes('--sd-surface-support'));
  assert.ok(shellSpacingTokens.desktop.heroGap);
  assert.ok(shellSpacingTokens.widths.rail);
  assert.ok(blurTokens.hero);
});

test('foundation exposes typography tokens for reusable type roles', () => {
  assert.equal(typographyTokens.fontFamily.display.includes('Unbounded'), true);
  assert.equal(typographyTokens.size.displayLarge, '3.25rem');
  assert.equal(typographyTokens.leading.body, '1.75');
  assert.equal(typographyTokens.tracking.display, '0em');
  assert.equal(typographyTokens.roles.display.family, 'display');
  assert.equal(typographyTokens.roles.body.size, 'body');
});

test('foundation typography classes consume CSS variables', () => {
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');
  assert.match(css, /--sd-type-size-display:/);
  assert.match(css, /\.sd-title-display\s*\{[^}]*var\(--sd-type-role-display-size\)/s);
  assert.match(css, /\.sd-heading-md\s*\{[^}]*var\(--sd-type-role-heading-md-size\)/s);
  assert.match(css, /\.sd-copy\s*\{[^}]*var\(--sd-type-size-body\)/s);
  assert.doesNotMatch(css, /\.sd-title-display\s*\{[^}]*text-\[/s);
});

test('foundation exposes educational semantic tokens', () => {
  assert.ok(colorTokens.educational.includes('--sd-evidence'));
  assert.ok(colorTokens.educational.includes('--sd-safe-action'));
  assert.ok(colorTokens.educational.includes('--sd-coach'));
  assert.ok(colorTokens.educational.includes('--sd-simulation-surface'));
  assert.equal(educationalTokens.evidence.base, '--sd-evidence');
  assert.equal(educationalTokens.progress.fill, '--sd-progress-fill');
  assert.match(educationalTokens.safeAction.use, /Acciones seguras/i);
  assert.match(educationalTokens.simulation.use, /chat, inbox, llamada/i);
});

test('foundation educational tokens are mirrored as CSS variables', () => {
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');
  assert.match(css, /--sd-evidence:/);
  assert.match(css, /--sd-safe-action:/);
  assert.match(css, /--sd-coach:/);
  assert.match(css, /--sd-simulation-surface:/);
  assert.match(css, /--color-sd-progress-fill: var\(--sd-progress-fill\)/);
  assert.match(css, /--color-sd-simulation-glow: var\(--sd-simulation-glow\)/);
});

test('InlineMessage exposes live-region semantics by tone', () => {
  const source = readFileSync(new URL('../frontend/src/components/ui/InlineMessage.jsx', import.meta.url), 'utf8');
  assert.match(source, /info:\s*\{\s*role:\s*'status',\s*'aria-live':\s*'polite'\s*\}/);
  assert.match(source, /success:\s*\{\s*role:\s*'status',\s*'aria-live':\s*'polite'\s*\}/);
  assert.match(source, /warning:\s*\{\s*role:\s*'alert',\s*'aria-live':\s*'assertive'\s*\}/);
  assert.match(source, /danger:\s*\{\s*role:\s*'alert',\s*'aria-live':\s*'assertive'\s*\}/);
  assert.match(source, /role=\{role \?\? a11y\.role\}/);
  assert.match(source, /aria-live=\{ariaLive \?\? a11y\['aria-live'\]\}/);
  assert.match(source, /aria-atomic=\{ariaAtomic \?\? 'true'\}/);
  assert.doesNotMatch(source, /tracking-\[-/);
});

test('OverlayFrame traps focus, closes on Escape, and restores focus', () => {
  const source = readFileSync(new URL('../frontend/src/components/ui/OverlayFrame.jsx', import.meta.url), 'utf8');
  assert.match(source, /const FOCUSABLE_SELECTOR = \[/);
  assert.match(source, /document\.addEventListener\('keydown', handleKeyDown\)/);
  assert.match(source, /document\.addEventListener\('focusin', handleFocusIn\)/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /restoreFocusRef\.current = document\.activeElement/);
  assert.match(source, /restoreTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /aria-hidden="true"/);
});

test('foundation exposes native Checkbox and Radio primitives', () => {
  const checkbox = readFileSync(new URL('../frontend/src/components/ui/Checkbox.jsx', import.meta.url), 'utf8');
  const radio = readFileSync(new URL('../frontend/src/components/ui/Radio.jsx', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../frontend/src/components/ui/index.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

  assert.ok(foundationInventory.primitives.includes('Checkbox'));
  assert.ok(foundationInventory.primitives.includes('Radio'));
  assert.match(index, /export \{ default as Checkbox \}/);
  assert.match(index, /export \{ default as Radio \}/);
  assert.match(checkbox, /type="checkbox"/);
  assert.match(radio, /type="radio"/);
  assert.match(checkbox, /aria-describedby=\{mergeDescribedBy\(ariaDescribedBy, errorId, hintId\)\}/);
  assert.match(radio, /aria-invalid=\{isInvalid \? 'true' : ariaInvalid\}/);
  assert.match(checkbox, /role="alert"/);
  assert.match(radio, /role="alert"/);
  assert.match(css, /\.sd-choice-input:focus-visible \+ \.sd-choice-control/);
  assert.match(css, /\.sd-choice-input:checked \+ \.sd-choice-control/);
  assert.match(css, /\.sd-choice-input\[aria-invalid='true'\] \+ \.sd-choice-control/);
});

test('foundation exposes an accessible IconButton primitive', () => {
  const source = readFileSync(new URL('../frontend/src/components/ui/IconButton.jsx', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../frontend/src/components/ui/index.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

  assert.ok(foundationInventory.primitives.includes('IconButton'));
  assert.match(index, /export \{ default as IconButton \}/);
  assert.match(source, /const accessibleLabel = ariaLabel \|\| label/);
  assert.match(source, /aria-label=\{ariaLabel\}/);
  assert.match(source, /aria-busy=\{loading \? 'true' : undefined\}/);
  assert.match(source, /disabled=\{disabled \|\| loading\}/);
  assert.match(source, /<span className="sr-only">\{label\}<\/span>/);
  assert.match(css, /\.sd-icon-button\s*\{/);
  assert.match(css, /\.sd-icon-button-md\s*\{[^}]*height: 2\.75rem/s);
  assert.match(css, /\.sd-icon-button-glyph\s*\{/);
});

test('SurfaceCard supports inverse tone as a reusable foundation surface', () => {
  const source = readFileSync(new URL('../frontend/src/components/ui/SurfaceCard.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');
  const story = readFileSync(new URL('../frontend/src/components/ui/SurfaceCard.stories.jsx', import.meta.url), 'utf8');

  assert.match(source, /const TONE_STYLES = \{/);
  assert.match(source, /inverse: 'sd-surface-tone-inverse'/);
  assert.match(source, /tone = 'default'/);
  assert.match(source, /data-tone=\{tone !== 'default' \? tone : undefined\}/);
  assert.match(css, /\.sd-surface-tone-inverse\s*\{/);
  assert.match(css, /background:[\s\S]*var\(--sd-surface-inverse\)/);
  assert.match(css, /\.sd-surface-tone-inverse \.sd-copy[\s\S]*var\(--sd-text-inverse\)/);
  assert.match(story, /tone="inverse"/);
});

test('ProgressSummary enables its container layout query', () => {
  const source = readFileSync(new URL('../frontend/src/patterns/ProgressSummary.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

  assert.match(source, /data-sd-container="true"/);
  assert.match(source, /sd-progress-summary-layout/);
  assert.match(source, /sd-progress-summary-main/);
  assert.match(source, /sd-progress-summary-aside/);
  assert.match(css, /@container \(min-width: 54rem\)\s*\{\s*\.sd-progress-summary-layout/s);
  assert.match(css, /\.sd-progress-summary-value\s*\{[^}]*var\(--sd-type-size-title\)/s);
  assert.doesNotMatch(css, /\.sd-progress-summary-value\s*\{[^}]*tracking-\[-/s);
});

test('JourneyStepper uses tokenized styles and semantic progress markup', () => {
  const source = readFileSync(new URL('../frontend/src/patterns/JourneyStepper.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

  assert.match(source, /<ol/);
  assert.match(source, /aria-current=\{state === 'current' \? 'step' : undefined\}/);
  assert.match(source, /normalizeStepState/);
  assert.match(source, /sd-journey-stepper-shell/);
  assert.match(source, /data-sd-container="true"/);
  assert.doesNotMatch(source, /shadow-\[/);
  assert.match(css, /\.sd-journey-step-card\s*\{/);
  assert.match(css, /var\(--sd-shadow-sm\)/);
  assert.match(css, /var\(--sd-safe-action\)/);
  assert.match(css, /@container \(min-width: 34rem\)\s*\{\s*\.sd-journey-stepper/s);
});

test('foundation exposes domain assessment patterns', () => {
  const questionPage = readFileSync(new URL('../frontend/src/patterns/QuestionPage.jsx', import.meta.url), 'utf8');
  const infoPanel = readFileSync(new URL('../frontend/src/patterns/InfoPanel.jsx', import.meta.url), 'utf8');
  const patternIndex = readFileSync(new URL('../frontend/src/patterns/index.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

  assert.ok(foundationInventory.patterns.includes('QuestionPage'));
  assert.ok(foundationInventory.patterns.includes('InfoPanel'));
  assert.ok(containerAwarenessRules.requiredFor.includes('QuestionPage'));
  assert.ok(containerAwarenessRules.requiredFor.includes('InfoPanel'));
  assert.match(patternIndex, /export \{ default as QuestionPage \}/);
  assert.match(patternIndex, /export \{ default as InfoPanel \}/);
  assert.match(questionPage, /import \{ Checkbox, InlineMessage, Radio, Select, SurfaceCard, TextArea \}/);
  assert.match(questionPage, /<fieldset/);
  assert.match(questionPage, /<legend className="sr-only">/);
  assert.match(questionPage, /aria-labelledby=\{headingId\}/);
  assert.match(questionPage, /data-sd-container="true"/);
  assert.match(infoPanel, /const TONE_VARIANTS = \{/);
  assert.match(infoPanel, /data-tone=\{resolvedTone\}/);
  assert.match(infoPanel, /sd-info-panel-item/);
  assert.match(css, /\.sd-question-page\s*\{/);
  assert.match(css, /\.sd-question-options\[data-type='multi'\]/);
  assert.match(css, /\.sd-info-panel-evidence\s*\{/);
  assert.match(css, /var\(--sd-safe-action\)/);
});

test('foundation exposes AssessmentLayout as a domain layout', () => {
  const source = readFileSync(new URL('../frontend/src/layouts/AssessmentLayout.jsx', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../frontend/src/layouts/index.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');
  const story = readFileSync(new URL('../frontend/src/layouts/FoundationLayouts.stories.jsx', import.meta.url), 'utf8');

  assert.ok(foundationInventory.layouts.includes('AssessmentLayout'));
  assert.ok(containerAwarenessRules.requiredFor.includes('AssessmentLayout'));
  assert.match(index, /export \{ default as AssessmentLayout \}/);
  assert.match(source, /data-layout="assessment"/);
  assert.match(source, /data-shell-family=\{shellFamily\}/);
  assert.match(source, /sd-assessment-question/);
  assert.match(source, /sd-assessment-insight/);
  assert.match(source, /data-sd-container="true"/);
  assert.match(css, /\.sd-assessment-layout\s*\{/);
  assert.match(css, /\.sd-assessment-layout-desktop\s*\{/);
  assert.match(story, /<AssessmentLayout/);
});

test('foundation documents interaction and layout inventory', () => {
  assert.equal(motionTokens.enter, '480ms');
  assert.equal(zIndexTokens.scrim, 55);
  assert.match(interactionRules.focus, /focus ring/i);
  assert.match(a11yRules.semantics, /ARIA|roles|semantica/i);
  assert.ok(overlayInventory.primitives.includes('Dialog'));
  assert.ok(overlayInventory.primitives.includes('Drawer'));
  assert.ok(containerAwarenessRules.requiredFor.includes('ProgressSummary'));
  assert.ok(foundationInventory.patterns.includes('StageHero'));
  assert.ok(foundationInventory.patterns.includes('SupportRail'));
  assert.ok(foundationInventory.patterns.includes('ActionCluster'));
  assert.ok(foundationInventory.patterns.includes('PanelHeader'));
  assert.ok(foundationInventory.layouts.includes('SplitHeroLayout'));
  assert.ok(foundationInventory.layouts.includes('WorkspaceLayout'));
  assert.ok(foundationInventory.layouts.includes('AssessmentLayout'));
});
