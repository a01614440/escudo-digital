import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const inboxSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/InboxActivity.jsx', import.meta.url),
  'utf8'
);
const appCssSource = readFileSync(new URL('../frontend/src/styles/app.css', import.meta.url), 'utf8');

describe('F6.F SMS refine guards', () => {
  test('InboxActivity activates the SMS skin and keeps the email branch separate', () => {
    assert.match(inboxSource, /email-sim inbox-sim-sms sms-summary-shell/);
    assert.match(inboxSource, /email-sim inbox-sim-mail/);
    assert.match(inboxSource, /sms-app-topbar/);
    assert.match(inboxSource, /sms-app-header/);
    assert.match(inboxSource, /sms-sidebar-head/);
    assert.match(inboxSource, /sms-thread-layout/);
    assert.match(inboxSource, /sms-reader-topbar/);
    assert.match(inboxSource, /sms-classify-actions/);
    assert.match(inboxSource, /email-list-item/);
    assert.match(inboxSource, /email-list-status/);
  });

  test('SMS styles keep the channel compact, distinct and readable', () => {
    assert.match(appCssSource, /\.sms-summary-shell \.activity-summary-stat \{/);
    assert.match(appCssSource, /\.email-sim\.inbox-sim-sms \{/);
    assert.match(appCssSource, /\.email-sim\.inbox-sim-sms \.email-sidebar \{/);
    assert.match(appCssSource, /\.sms-reader-body \{/);
    assert.match(appCssSource, /\.sms-message-bubble \{/);
    assert.match(appCssSource, /\.sms-classify-actions \{/);
    assert.match(appCssSource, /\.sms-review-card \{/);
  });
});
