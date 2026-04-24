import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const signalActivitiesSource = readFileSync(
  new URL('../frontend/src/components/activities/signalActivities.jsx', import.meta.url),
  'utf8'
);

const webLabSource = readFileSync(
  new URL('../frontend/src/components/activities/immersive/WebLabActivity.jsx', import.meta.url),
  'utf8'
);

describe('activity feedback panel imports', () => {
  test('signalActivities imports FeedbackPanel before using it in closeout states', () => {
    assert.match(signalActivitiesSource, /import FeedbackPanel from '\.\.\/FeedbackPanel\.jsx';/);
    assert.match(signalActivitiesSource, /<FeedbackPanel feedback=\{feedback\} \/>/);
  });

  test('WebLabActivity imports FeedbackPanel before using it in the review surface', () => {
    assert.match(webLabSource, /import FeedbackPanel from '\.\.\/\.\.\/FeedbackPanel\.jsx';/);
    assert.match(webLabSource, /<FeedbackPanel feedback=\{feedback\} \/>/);
  });
});
