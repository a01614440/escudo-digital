import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import { ensureCourseProgress, withCompletedActivity } from '../frontend/src/lib/course.js';
import {
  buildResumeTarget,
  getModuleStats,
  getPrioritySummary,
  getRecommendedIndex,
  getUnlockedLimit,
} from '../frontend/src/components/course-dashboard/viewModel.js';
import { rawCoursePlan } from '../test-support/sampleCourseData.js';

describe('course dashboard view model', () => {
  test('picks the first incomplete module as the resume target', () => {
    const plan = rawCoursePlan;
    let progress = ensureCourseProgress(plan);

    const entries = plan.ruta.map((module, index) => ({
      module,
      index,
      stats: getModuleStats(module, progress),
    }));

    assert.equal(buildResumeTarget(entries)?.moduleIndex, 0);

    progress = withCompletedActivity({
      plan,
      progress,
      moduleIndex: 0,
      activityIndex: 0,
      score: 0.9,
      feedback: 'Buen criterio',
      durationMs: 25000,
    });

    const updatedEntries = plan.ruta.map((module, index) => ({
      module,
      index,
      stats: getModuleStats(module, progress),
    }));

    assert.equal(buildResumeTarget(updatedEntries)?.moduleIndex, 0);
    assert.equal(buildResumeTarget(updatedEntries)?.nextActivity?.id, 'activity-web-2');
  });

  test('keeps the first pending module as recommended and unlocked limit', () => {
    const plan = rawCoursePlan;
    const progress = ensureCourseProgress(plan);

    assert.equal(getRecommendedIndex(plan.ruta, progress), 0);
    assert.equal(getUnlockedLimit(plan.ruta, progress), 0);
  });

  test('builds a priority summary from user focus and assessment fallback', () => {
    assert.match(
      getPrioritySummary({ priority: 'web' }, null),
      /empezamos por ahi/i
    );
    assert.match(
      getPrioritySummary({}, { nivel: 'Medio' }),
      /evaluacion medio/i
    );
  });
});
