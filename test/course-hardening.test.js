import assert from 'node:assert/strict';
import test, { afterEach, beforeEach, describe } from 'node:test';

import {
  ensureCourseProgress,
  ensureCourseState,
  pickNextActivityIndex,
  withCompletedActivity,
} from '../frontend/src/lib/course.js';
import {
  createInitialLearningState,
  deriveCurrentView,
  normalizeLessonPosition,
} from '../frontend/src/lib/courseRules.js';
import {
  readSessionToken,
  writeLocalState,
  writeSessionToken,
} from '../frontend/src/lib/storage.js';
import { rawCoursePlan } from '../test-support/sampleCourseData.js';

function createStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

beforeEach(() => {
  global.localStorage = createStorageMock();
});

afterEach(() => {
  delete global.localStorage;
});

describe('course continuity hardening', () => {
  test('restores a persisted learning state safely', () => {
    const coursePlan = ensureCourseState(rawCoursePlan);
    let courseProgress = ensureCourseProgress(coursePlan);
    courseProgress = withCompletedActivity({
      plan: coursePlan,
      progress: courseProgress,
      moduleIndex: 0,
      activityIndex: 0,
      score: 0.92,
      feedback: 'Buena decisión',
      durationMs: 45000,
    });

    writeLocalState({
      answers: { priority: 'web' },
      assessment: { nivel: 'Medio', resumen: 'Buen avance base.' },
      coursePlan,
      courseProgress,
    });

    const restored = createInitialLearningState();

    assert.equal(restored.answers.priority, 'web');
    assert.equal(restored.assessment?.nivel, 'Medio');
    assert.equal(restored.coursePlan?.ruta?.[0]?.id, 'module-web-1');
    assert.equal(restored.courseProgress?.completed?.['activity-web-1']?.score, 0.92);
  });

  test('continues at the first incomplete activity and falls back to weakest score after completion', () => {
    const coursePlan = ensureCourseState(rawCoursePlan);
    let courseProgress = ensureCourseProgress(coursePlan);

    assert.equal(pickNextActivityIndex(coursePlan, courseProgress, 0), 0);

    courseProgress = withCompletedActivity({
      plan: coursePlan,
      progress: courseProgress,
      moduleIndex: 0,
      activityIndex: 0,
      score: 0.95,
      feedback: 'Correcto',
      durationMs: 30000,
    });

    assert.equal(pickNextActivityIndex(coursePlan, courseProgress, 0), 1);

    courseProgress = withCompletedActivity({
      plan: coursePlan,
      progress: courseProgress,
      moduleIndex: 0,
      activityIndex: 1,
      score: 0.35,
      feedback: 'Necesita refuerzo',
      durationMs: 30000,
    });

    assert.equal(pickNextActivityIndex(coursePlan, courseProgress, 0), 1);
  });

  test('guards session restore state and current lesson routing', () => {
    const coursePlan = ensureCourseState(rawCoursePlan);
    const courseProgress = ensureCourseProgress(coursePlan);

    writeSessionToken('token-demo');
    assert.equal(readSessionToken(), 'token-demo');

    const currentLesson = normalizeLessonPosition({ moduleIndex: 0, activityIndex: 1 });
    assert.deepEqual(currentLesson, { moduleIndex: 0, activityIndex: 1 });

    const view = deriveCurrentView({
      requestedView: 'lesson',
      user: { role: 'user' },
      coursePlan,
      courseProgress,
      assessment: { nivel: 'Medio' },
      currentLesson,
    });

    assert.equal(view, 'lesson');
    assert.equal(
      deriveCurrentView({
        requestedView: 'admin',
        user: { role: 'user' },
        coursePlan,
        courseProgress,
        assessment: { nivel: 'Medio' },
        currentLesson,
      }),
      'survey'
    );
  });
});
