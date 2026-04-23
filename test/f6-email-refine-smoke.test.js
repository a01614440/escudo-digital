import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const inboxSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/InboxActivity.jsx', import.meta.url),
  'utf8'
);

const appCssSource = readFileSync(new URL('../frontend/src/styles/app.css', import.meta.url), 'utf8');

describe('F6.G inbox / email refine guards', () => {
  test('InboxActivity keeps the email branch distinct from SMS and exposes mail-specific hooks', () => {
    assert.match(inboxSource, /email-sim inbox-sim-mail email-summary-shell/);
    assert.match(inboxSource, /inbox-stage-banner is-mail/);
    assert.match(inboxSource, /email-sidebar-head-mail/);
    assert.match(inboxSource, /email-thread-layout/);
    assert.match(inboxSource, /email-reader-body/);
    assert.match(inboxSource, /email-body-card/);
    assert.match(inboxSource, /email-message-bubble/);
    assert.match(inboxSource, /email-link-preview/);
    assert.match(inboxSource, /email-classify-actions/);
    assert.match(inboxSource, /email-review-card/);
    assert.match(inboxSource, /data-sd-simulation-channel=\{isSms \? 'sms' : 'email'\}/);
  });

  test('Email styles give the mail branch its own readable identity', () => {
    assert.match(appCssSource, /\.email-summary-shell \.activity-summary-stat \{/);
    assert.match(appCssSource, /\.email-sim\.inbox-sim-mail \{/);
    assert.match(appCssSource, /\.inbox-stage-banner\.is-mail \{/);
    assert.match(appCssSource, /\.email-sidebar-head-mail \{/);
    assert.match(appCssSource, /\.email-thread-layout \{/);
    assert.match(appCssSource, /\.email-reader-body \{/);
    assert.match(appCssSource, /\.email-body-card \{/);
    assert.match(appCssSource, /\.email-message-bubble \{/);
    assert.match(appCssSource, /\.email-link-preview \{/);
    assert.match(appCssSource, /\.email-reader-footer \{/);
    assert.match(appCssSource, /\.email-review-card \{/);
  });
});
