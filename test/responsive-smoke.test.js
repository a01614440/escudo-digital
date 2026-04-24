import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { describe } from 'node:test';

import { getShellFamily, getViewportProfile } from '../frontend/src/hooks/useResponsiveLayout.js';
import { buildAdminOverviewCards } from '../frontend/src/lib/adminAnalytics.js';
import {
  DEFAULT_CHAT_SUGGESTIONS,
  formatChatMessage,
} from '../frontend/src/lib/chatFormatting.js';
import {
  getNavigationItems,
  normalizeRequestedView,
} from '../frontend/src/shells/navigationPolicy.js';

describe('responsive and presentation smoke validations', () => {
  test('maps representative widths to the expected viewport profiles', () => {
    assert.equal(getViewportProfile(390), 'phone-small');
    assert.equal(getViewportProfile(540), 'phone');
    assert.equal(getViewportProfile(767), 'phone');
    assert.equal(getViewportProfile(768), 'tablet-compact');
    assert.equal(getViewportProfile(960), 'tablet');
    assert.equal(getViewportProfile(1023), 'tablet');
    assert.equal(getViewportProfile(1024), 'laptop');
    assert.equal(getViewportProfile(1180), 'laptop');
    assert.equal(getViewportProfile(1280), 'laptop');
    assert.equal(getViewportProfile(1440), 'desktop');
  });

  test('groups viewport profiles into the expected shell families', () => {
    assert.equal(getShellFamily('phone-small'), 'mobile');
    assert.equal(getShellFamily('phone'), 'mobile');
    assert.equal(getShellFamily('tablet-compact'), 'tablet');
    assert.equal(getShellFamily('tablet'), 'tablet');
    assert.equal(getShellFamily('laptop'), 'desktop');
    assert.equal(getShellFamily('desktop'), 'desktop');
  });

  test('aligns shell family breakpoints with shell spacing media queries', () => {
    const css = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

    assert.match(css, /@media \(min-width: 48rem\)\s*\{\s*:root\s*\{[^}]*--sd-shell-padding-inline: var\(--sd-shell-tablet-inline\)/s);
    assert.match(css, /@media \(min-width: 64rem\)\s*\{\s*:root\s*\{[^}]*--sd-shell-padding-inline: var\(--sd-shell-desktop-inline\)/s);
    assert.doesNotMatch(css, /@media \(min-width: 80rem\)\s*\{\s*:root\s*\{[^}]*--sd-shell-padding-inline: var\(--sd-shell-desktop-inline\)/s);
  });

  test('keeps only body layout datasets that still have consumers', () => {
    const source = readFileSync(new URL('../frontend/src/hooks/useResponsiveLayout.js', import.meta.url), 'utf8');

    assert.match(source, /document\.body\.dataset\.theme = PRESENTATION_THEME/);
    assert.match(source, /document\.body\.dataset\.viewport = profile\.viewport/);
    assert.match(source, /document\.body\.dataset\.inputMode = profile\.inputMode/);
    assert.doesNotMatch(source, /document\.body\.dataset\.shell/);
    assert.doesNotMatch(source, /delete document\.body\.dataset\.shell/);
  });

  test('normalizes navigation targets and activates the correct macro item', () => {
    assert.equal(normalizeRequestedView('lesson'), 'courses');
    assert.equal(normalizeRequestedView('admin', { isAdmin: false }), null);
    assert.equal(normalizeRequestedView('admin', { isAdmin: true }), 'admin');

    const items = getNavigationItems({ currentView: 'lesson', isAdmin: true });
    assert.equal(items.length, 3);
    assert.equal(items.find((item) => item.id === 'courses')?.active, true);
    assert.equal(items.find((item) => item.id === 'admin')?.active, false);
  });

  test('formats admin overview cards with readable analytics values', () => {
    const cards = buildAdminOverviewCards({
      totalUsers: 18,
      activeUsers7d: 6,
      averageShield: 71,
      averageImprovement: 11,
      moduleCompletionRate: 53,
      activityCompletionRate: 66,
      avgDaysToImprove: 4,
    });

    assert.equal(cards.length, 4);
    assert.equal(cards[0].value, '18');
    assert.match(cards[1].value, /71%/);
    assert.match(cards[2].note, /66%/);
  });

  test('keeps chat suggestions available and formats bullet responses as lists', () => {
    assert.ok(DEFAULT_CHAT_SUGGESTIONS.length >= 3);

    const html = formatChatMessage('Haz esto:\n- Verifica el dominio\n- Llama al canal oficial');

    assert.match(html, /<ul/);
    assert.match(html, /Verifica el dominio/);
    assert.match(html, /Llama al canal oficial/);
  });
});
