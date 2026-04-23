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
import { ActionCluster, PanelHeader } from '../../patterns/index.js';
import { Badge, SurfaceCard } from '../ui/index.js';

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

  if (compact) {
    return (
      <details className="rounded-[22px] border border-sd-border-strong bg-white/76 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
          Ver guía rápida
        </summary>
        <div className="mt-4 grid gap-3">
          {steps.map((step, index) => (
            <div
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[18px] border border-sd-border bg-white p-3"
              key={step}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sd-border bg-sd-surface-subtle text-xs font-semibold text-sd-text">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="m-0 text-sm leading-6 text-sd-text-soft">{step}</p>
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <SurfaceCard padding="compact" variant="support">
      <PanelHeader
        eyebrow="Guía breve"
        title="Cómo resolver esta actividad"
        subtitle="Solo dejamos los pasos que sí ayudan a decidir mejor."
        meta={<Badge tone="neutral">{`${steps.length} pasos`}</Badge>}
        divider
      />

      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[18px] border border-sd-border bg-white p-3"
            key={step}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sd-border bg-sd-surface-subtle text-xs font-semibold text-sd-text">
              {String(index + 1).padStart(2, '0')}
            </span>
            <p className="m-0 text-sm leading-6 text-sd-text-soft">{step}</p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

export function ActivityChrome({ module, activity, compact = false, children }) {
  const theme = moduleThemeMeta(module);
  const instructionMeta = getActivityInstructionMeta(activity?.tipo, module);
  const categoryLabel = CATEGORY_LABELS[theme.category] || theme.badge;
  const levelLabel = LEVEL_LABELS[theme.level] || theme.label;
  const activityLabel = ACTIVITY_LABELS[activity?.tipo] || activity?.tipo || 'Actividad';
  const isChatSimulation = activity?.tipo === 'sim_chat';

  if (isChatSimulation) {
    return (
      <div className="sd-chat-activity-shell" data-sd-container="true">
        {children}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <SurfaceCard padding="compact" variant="subtle" className="border-sd-border-strong">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <strong className="text-sm text-sd-text">
                {repairPossibleMojibake(activity?.titulo || 'Actividad')}
              </strong>
              <p className="m-0 text-sm leading-6 text-sd-text-soft">{instructionMeta.quickTip}</p>
            </div>

            <ActionCluster collapse="wrap">
              <Badge tone="accent">{activityLabel}</Badge>
              <Badge tone="soft">{categoryLabel}</Badge>
              <Badge tone="neutral">{levelLabel}</Badge>
            </ActionCluster>
          </div>

          <div className={compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
            <SurfaceCard padding="compact" variant="panel">
              <strong className="block text-sm text-sd-text">Qué debes observar</strong>
              <p className="mt-2 text-sm leading-6 text-sd-text-soft">{instructionMeta.whatToDo}</p>
            </SurfaceCard>

            <SurfaceCard padding="compact" variant="panel">
              <strong className="block text-sm text-sd-text">Qué cuenta como buen resultado</strong>
              <p className="mt-2 text-sm leading-6 text-sd-text-soft">{instructionMeta.scoring}</p>
            </SurfaceCard>
          </div>
        </div>
      </SurfaceCard>

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
    <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
      {visibleItems.map((item) => (
        <SurfaceCard key={item.label} padding="compact" variant="subtle">
          <strong className="block text-xs font-semibold uppercase tracking-[0.14em] text-sd-text-soft">
            {item.label}
          </strong>
          <p className="mt-2 text-base font-semibold leading-6 text-sd-text">{item.value}</p>
          {item.caption ? <p className="mt-2 text-sm leading-6 text-sd-text-soft">{item.caption}</p> : null}
        </SurfaceCard>
      ))}
    </div>
  );
}
