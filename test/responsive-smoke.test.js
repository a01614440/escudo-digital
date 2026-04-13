import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import { getViewportProfile } from '../frontend/src/hooks/useResponsiveLayout.js';
import { buildAdminOverviewCards } from '../frontend/src/lib/adminAnalytics.js';
import {
  DEFAULT_CHAT_SUGGESTIONS,
  formatChatMessage,
} from '../frontend/src/lib/chatFormatting.js';

describe('responsive and presentation smoke validations', () => {
  test('maps representative widths to the expected viewport profiles', () => {
    assert.equal(getViewportProfile(390), 'phone-small');
    assert.equal(getViewportProfile(540), 'phone');
    assert.equal(getViewportProfile(768), 'tablet-compact');
    assert.equal(getViewportProfile(960), 'tablet');
    assert.equal(getViewportProfile(1180), 'laptop');
    assert.equal(getViewportProfile(1440), 'desktop');
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
