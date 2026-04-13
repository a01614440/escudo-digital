import { useMemo } from 'react';
import { sanitizeScenarioContent } from '../../lib/scenarioSelector.js';
import { useSimulationEngine } from '../../hooks/useSimulationEngine.js';
import { resolveActivityComponent } from './activityRegistry.js';
import { ActivityChrome } from './sharedActivityUi.jsx';

const COMPACT_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact']);

export default function ActivityRenderer({
  viewport = 'desktop',
  module,
  activity,
  answers,
  assessment,
  onComplete,
}) {
  const { startedAtRef } = useSimulationEngine({
    moduleId: module?.id,
    activityId: activity?.id,
  });
  const compact = COMPACT_VIEWPORTS.has(viewport);
  const safeModule = useMemo(() => sanitizeScenarioContent(module || {}), [module]);
  const safeActivity = useMemo(() => sanitizeScenarioContent(activity || {}), [activity]);
  const ActivityComponent = resolveActivityComponent(safeActivity.tipo);

  return (
    <ActivityChrome module={safeModule} activity={safeActivity} compact={compact}>
      <ActivityComponent
        viewport={viewport}
        module={safeModule}
        activity={safeActivity}
        answers={answers}
        assessment={assessment}
        startedAtRef={startedAtRef}
        onComplete={onComplete}
      />
    </ActivityChrome>
  );
}
