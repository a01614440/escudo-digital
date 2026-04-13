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
import { getSimulationGuide, moduleThemeMeta } from '../../lib/scenarioSelector.js';

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
      <details className="activity-guide compact-guide activity-guide-disclosure">
        <summary>
          <span>Cómo resolver esta actividad</span>
          <span>{`${steps.length} pasos`}</span>
        </summary>
        <div className="summary-list">
          {steps.map((step, index) => (
            <div className="summary-item activity-guide-item" key={step}>
              <span className="activity-guide-index">{String(index + 1).padStart(2, '0')}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <section className="activity-guide compact-guide">
      <div className="activity-guide-head">
        <p className="eyebrow">Cómo resolver esta actividad</p>
        <span className="activity-guide-count">{`${steps.length} pasos`}</span>
      </div>
      <div className="summary-list">
        {steps.map((step, index) => (
          <div className="summary-item activity-guide-item" key={step}>
            <span className="activity-guide-index">{String(index + 1).padStart(2, '0')}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivityChrome({ module, activity, compact = false, children }) {
  const theme = moduleThemeMeta(module);

  return (
    <div
      className={`activity-shell activity-shell-${theme.category} activity-shell-${theme.level}`.trim()}
    >
      <div className="activity-head activity-head-rich">
        <div className="activity-head-copy">
          <p className="eyebrow">{theme.eyebrow}</p>
          <p className="activity-title">{repairPossibleMojibake(activity.titulo || 'Actividad')}</p>
          <p className="activity-head-blurb">
            {repairPossibleMojibake(
              activity.intro || activity.escenario || activity.prompt || theme.blurb
            )}
          </p>
        </div>
        <div className="activity-head-badges">
          <span className="activity-type">
            {ACTIVITY_LABELS[activity.tipo] || activity.tipo || 'Actividad'}
          </span>
          <span className="activity-kicker-pill">
            {CATEGORY_LABELS[theme.category] || theme.badge}
          </span>
          <span className="activity-kicker-pill subtle">
            {LEVEL_LABELS[theme.level] || theme.label}
          </span>
          <span className="activity-kicker-pill subtle">{theme.brief}</span>
        </div>
      </div>
      <SimulationGuide activity={activity} compact={compact} />
      {children}
    </div>
  );
}

export function completeActivity(startedAtRef, onComplete, score, feedback, details = null) {
  onComplete(completeActivityPayload(startedAtRef, score, feedback, details));
}

export function buildActivityFeedback({
  title,
  score,
  signal,
  risk,
  action,
  extra,
  detected,
  missed,
}) {
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
  const visibleItems = items.filter(
    (item) => item && item.label && item.value !== undefined && item.value !== null
  );
  if (!visibleItems.length) return null;

  return (
    <div className="activity-summary-bar">
      {visibleItems.map((item) => (
        <article className="activity-summary-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.caption ? <p>{item.caption}</p> : null}
        </article>
      ))}
    </div>
  );
}
