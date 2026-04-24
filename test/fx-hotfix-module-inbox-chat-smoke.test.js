import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const lessonSource = readFileSync(
  new URL('../frontend/src/components/LessonView.jsx', import.meta.url),
  'utf8'
);
const inboxSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/InboxActivity.jsx', import.meta.url),
  'utf8'
);
const signalActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/signalActivities.jsx', import.meta.url),
  'utf8'
);
const tailwindSource = readFileSync(new URL('../frontend/src/styles/tailwind.css', import.meta.url), 'utf8');

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.length;
  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('Fase X hotfix: module header, inbox structure and chat phone frame', () => {
  test('module lesson headers no longer use inverse/dark command styling', () => {
    const block = functionBlock(lessonSource, 'LessonMissionHero', 'ActivityMapList');

    assert.match(block, /variant="panel"/);
    assert.doesNotMatch(block, /tone="inverse"/);
    assert.match(block, /sd-lesson-mission-hero/);
    assert.match(tailwindSource, /\.sd-lesson-mission-hero \{[\s\S]*background-color: #ffffff !important/);
    assert.match(tailwindSource, /\.sd-lesson-mission-hero \{[\s\S]*color: var\(--sd-text\) !important/);
    assert.match(tailwindSource, /\.sd-lesson-mission-hero \.text-sd-text-inverse,[\s\S]*color: var\(--sd-text\) !important/);
  });

  test('SMS and email preserve list-detail layout on tablet and desktop', () => {
    assert.match(inboxSource, /data-sd-stage-layout="list-detail"/);
    assert.match(inboxSource, /data-sd-hotfix="inbox-list-detail"/);
    assert.match(tailwindSource, /\.sd-simulation-main-stage\[data-sd-hotfix='inbox-list-detail'\] \{/);
    assert.match(tailwindSource, /@media \(min-width: 48rem\) \{[\s\S]*data-sd-hotfix='inbox-list-detail'/);
    assert.match(tailwindSource, /grid-template-columns: minmax\(17rem, 22rem\) minmax\(0, 1fr\) !important/);
    assert.match(tailwindSource, /grid-template-columns: minmax\(18rem, 24rem\) minmax\(0, 1fr\)/);
  });

  test('WhatsApp simulation is constrained into a phone-like light-mode shell', () => {
    assert.match(signalActivitiesSource, /className="sd-chat-surface"/);
    assert.match(tailwindSource, /\.sd-chat-surface \{[\s\S]*width: min\(100%, 31rem\)/);
    assert.match(tailwindSource, /\.sd-chat-surface::before \{/);
    assert.match(tailwindSource, /\.sd-chat-header \{[\s\S]*color: var\(--sd-text\)/);
    assert.match(tailwindSource, /\.sd-chat-contact strong \{[\s\S]*color: var\(--sd-text-strong\)/);
  });
});
