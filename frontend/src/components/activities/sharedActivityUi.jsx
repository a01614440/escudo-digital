import { splitParagraphs } from '../../lib/format.js';
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  repairPossibleMojibake,
} from '../../lib/course.js';
import {
  buildActivityFeedbackPayload,
  completeActivityPayload,
  formatActivityPercent,
} from '../../lib/activityFeedback.js';
import { getActivityInstructionMeta } from '../../lib/journeyGuidance.js';
import { getSimulationGuide, moduleThemeMeta } from '../../lib/scenarioSelector.js';
import { cn } from '../../lib/ui.js';
import { ActionCluster } from '../../patterns/index.js';
import { Badge, SurfaceCard } from '../ui/index.js';
import { getSimulationCategory, getSimulationCategoryClass } from './immersive/shared.js';

const IMMERSIVE_ACTIVITY_TYPES = new Set(['sim_chat', 'inbox', 'web_lab', 'call_sim', 'scenario_flow']);

export function Paragraphs({ text, className = 'activity-copy' }) {
  const lines = splitParagraphs(repairPossibleMojibake(text));
  if (!lines.length) return null;

  return (
    <div className={className}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

export function SimulationGuide({ activity, compact = false }) {
  const steps = getSimulationGuide(activity?.tipo);
  if (!steps?.length) return null;
  const guideTitle = compact ? 'Ver guia rapida' : 'Guia rapida de resolucion';

  return (
    <details
      className="sd-simulation-guide sd-simulation-readable-surface p-4"
      data-sd-simulation-guide="collapsed"
      data-sd-text-density="compact"
    >
      <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
        <span>{guideTitle}</span>
        <Badge tone="neutral">{`${steps.length} pasos`}</Badge>
      </summary>

      <div className="sd-simulation-guide-list">
        {steps.map((step, index) => (
          <div className="sd-simulation-guide-step" key={step}>
            <span className="sd-simulation-guide-index">
              {String(index + 1).padStart(2, '0')}
            </span>
            <p>{step}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

export function ActivityChrome({ module, activity, compact = false, children }) {
  const theme = moduleThemeMeta(module);
  const instructionMeta = getActivityInstructionMeta(activity?.tipo, module);
  const categoryLabel = CATEGORY_LABELS[theme.category] || theme.badge;
  const levelLabel = LEVEL_LABELS[theme.level] || theme.label;
  const activityLabel = ACTIVITY_LABELS[activity?.tipo] || activity?.tipo || 'Actividad';
  const activityType = String(activity?.tipo || '').toLowerCase();
  const isImmersiveActivity = IMMERSIVE_ACTIVITY_TYPES.has(activityType);
  const simulationCategory = getSimulationCategory(activity);
  const simulationCategoryClassName = getSimulationCategoryClass(simulationCategory);

  if (isImmersiveActivity) {
    const immersiveShellClassName =
      activityType === 'sim_chat'
        ? 'sd-immersive-activity-shell sd-chat-activity-shell'
        : 'sd-immersive-activity-shell';

    return (
      <div
        className={cn(immersiveShellClassName, simulationCategoryClassName)}
        data-sd-activity-chrome="immersive"
        data-sd-activity-type={activityType}
        data-sd-simulation-category={simulationCategory}
        data-sd-stage-dominance="primary"
        data-sd-stage-layout="fullscreen"
        data-sd-container="true"
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn('sd-activity-chrome grid gap-4', simulationCategoryClassName)}
      data-sd-activity-chrome="guided"
      data-sd-activity-type={activityType}
      data-sd-simulation-category={simulationCategory}
    >
      <details
        className="sd-activity-briefing sd-simulation-readable-surface p-4"
        data-sd-briefing="activity-chrome"
        data-sd-text-density="compact"
        open={!compact}
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
          <span>Briefing de actividad</span>
          <Badge tone="accent">{activityLabel}</Badge>
        </summary>

        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <strong className="text-sm text-sd-text">
                {repairPossibleMojibake(activity?.titulo || 'Actividad')}
              </strong>
              <p className="m-0 text-sm leading-6 text-sd-text-soft">{instructionMeta.quickTip}</p>
            </div>

            <ActionCluster collapse="wrap">
              <Badge tone="soft">{categoryLabel}</Badge>
              <Badge tone="neutral">{levelLabel}</Badge>
            </ActionCluster>
          </div>

          <dl className={compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
            <div className="sd-activity-briefing-item">
              <dt>Que observar</dt>
              <dd>{instructionMeta.whatToDo}</dd>
            </div>

            <div className="sd-activity-briefing-item">
              <dt>Buen resultado</dt>
              <dd>{instructionMeta.scoring}</dd>
            </div>
          </dl>
        </div>
      </details>

      <SimulationGuide activity={activity} compact={compact} />
      {children}
    </div>
  );
}

export function completeActivity(startedAtRef, onComplete, score, feedback, details = null) {
  onComplete(completeActivityPayload(startedAtRef, score, feedback, details));
}

export function buildActivityFeedback({ title, score, signal, risk, action, extra, detected, missed }) {
  return buildActivityFeedbackPayload({
    title,
    score,
    signal,
    risk,
    action,
    extra,
    detected,
    missed,
  });
}

export function formatPercent(score) {
  return formatActivityPercent(score);
}

export function ActivitySummaryBar({ items = [] }) {
  const visibleItems = items.filter((item) => item && item.label && item.value !== undefined && item.value !== null);
  if (!visibleItems.length) return null;

  return (
    <div className="sd-activity-summary-grid" data-sd-activity-summary="compact">
      {visibleItems.map((item) => (
        <SurfaceCard
          key={item.label}
          padding="compact"
          variant="support"
          className="sd-activity-summary-card"
          data-sd-activity-summary-card="true"
        >
          <strong className="sd-activity-summary-label">
            {item.label}
          </strong>
          <p className="sd-activity-summary-value">{item.value}</p>
          {item.caption ? <p className="sd-activity-summary-caption">{item.caption}</p> : null}
        </SurfaceCard>
      ))}
    </div>
  );
}
