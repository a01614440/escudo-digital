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
});
