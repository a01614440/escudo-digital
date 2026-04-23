import assert from 'node:assert/strict';
import test from 'node:test';

import {
  a11yRules,
  blurTokens,
  containerAwarenessRules,
  colorTokens,
  foundationInventory,
  interactionRules,
  motionTokens,
  overlayInventory,
  shellSpacingTokens,
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
