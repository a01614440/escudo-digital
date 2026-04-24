import { repairPossibleMojibake } from '../lib/course.js';
import { cn } from '../lib/ui.js';
import { PanelHeader } from '../patterns/index.js';
import { Badge, InlineMessage, SurfaceCard } from './ui/index.js';

function getFeedbackTone(feedback) {
  const score = Number(feedback?.score);
  if (Number.isFinite(score)) {
    if (score >= 0.85) return 'good';
    if (score >= 0.55) return 'warn';
    return 'risk';
  }

  const title = repairPossibleMojibake(String(feedback?.title || '').toLowerCase());
  if (title.includes('buena') || title.includes('correcto') || title.includes('complet')) return 'good';
  if (title.includes('riesg') || title.includes('parcial')) return 'warn';
  if (title.includes('incorrect') || title.includes('falta')) return 'risk';
  return 'neutral';
}

function getInlineTone(tone) {
  if (tone === 'good') return 'success';
  if (tone === 'warn') return 'warning';
  if (tone === 'risk') return 'danger';
  return 'info';
}

function formatScore(score) {
  const safe = Number(score);
  if (!Number.isFinite(safe)) return '';
  return `${Math.round(Math.max(0, Math.min(1, safe)) * 100)}%`;
}

function FeedbackItem({ title, body }) {
  if (!body) return null;

  return (
    <section className="sd-feedback-item">
      <h4>{title}</h4>
      <p>{body}</p>
    </section>
  );
}

function FeedbackList({ title, items = [] }) {
  if (!items.length) return null;

  return (
    <section className="sd-feedback-list">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function FeedbackPanel({ feedback }) {
  if (!feedback || (typeof feedback === 'string' && !feedback.trim())) return null;

  if (typeof feedback === 'string') {
    const lines = feedback
      .split('\n')
      .map((line) => repairPossibleMojibake(line).trim())
      .filter(Boolean);

    return (
      <SurfaceCard
        padding="compact"
        variant="support"
        className="sd-feedback-panel border-sd-border-strong"
        data-sd-feedback-panel="true"
        data-sd-text-density="compact"
      >
        <PanelHeader
          eyebrow="Retroalimentacion"
          title="Lo importante de este resultado"
          subtitle="Resumen corto para decidir el siguiente paso."
          divider
        />
        <div className="sd-feedback-copy">
          {lines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </div>
      </SurfaceCard>
    );
  }

  const tone = getFeedbackTone(feedback);
  const inlineTone = getInlineTone(tone);
  const scoreLabel = formatScore(feedback.score);
  const title = repairPossibleMojibake(feedback.title || '');
  const signal = repairPossibleMojibake(feedback.signal || '');
  const risk = repairPossibleMojibake(feedback.risk || '');
  const action = repairPossibleMojibake(feedback.action || '');
  const extra = repairPossibleMojibake(feedback.extra || '');
  const detected = Array.isArray(feedback.detected)
    ? feedback.detected.map((item) => repairPossibleMojibake(item)).filter(Boolean)
    : [];
  const missed = Array.isArray(feedback.missed)
    ? feedback.missed.map((item) => repairPossibleMojibake(item)).filter(Boolean)
    : [];
  const primaryItems = [
    { title: 'Que viste', body: signal },
    { title: 'Accion real', body: action },
  ].filter((item) => item.body);
  const secondaryItems = [
    { title: 'Que falto', body: risk },
    { title: 'Siguiente paso', body: extra },
  ].filter((item) => item.body);

  return (
    <SurfaceCard
      padding="compact"
      variant={tone === 'good' ? 'spotlight' : tone === 'risk' ? 'editorial' : 'support'}
      className={cn(
        'sd-feedback-panel border-sd-border-strong',
        tone === 'risk' ? '[&_.sd-heading-sm]:text-sd-text' : ''
      )}
      data-sd-feedback-panel="true"
      data-sd-text-density="compact"
    >
      <PanelHeader
        eyebrow="Retroalimentacion"
        title={title || 'Lectura del resultado'}
        subtitle="Resultado breve."
        meta={
          <div className="flex flex-wrap gap-2">
            {scoreLabel ? (
              <Badge tone={tone === 'risk' ? 'warning' : tone === 'good' ? 'accent' : 'neutral'}>
                {scoreLabel}
              </Badge>
            ) : null}
          </div>
        }
        divider
      />

      <InlineMessage
        tone={inlineTone}
        title={tone === 'good' ? 'Buen criterio' : tone === 'risk' ? 'Corrige el criterio' : 'Hay margen de mejora'}
      >
        {tone === 'good'
          ? 'Conserva esa rutina.'
          : tone === 'risk'
            ? 'Revisa el ajuste antes de avanzar.'
            : 'Afina la rutina y sigue.'}
      </InlineMessage>

      {primaryItems.length ? (
        <div className="sd-feedback-summary-grid" data-sd-feedback-visible="primary">
          {primaryItems.map((item) => (
            <FeedbackItem key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      ) : null}

      {secondaryItems.length || detected.length || missed.length ? (
        <details className="sd-feedback-secondary" data-sd-feedback-secondary="collapsed">
          <summary>Ver detalle</summary>
          {secondaryItems.length ? (
            <div className="sd-feedback-summary-grid">
              {secondaryItems.map((item) => (
                <FeedbackItem key={item.title} title={item.title} body={item.body} />
              ))}
            </div>
          ) : null}
          {detected.length || missed.length ? (
            <div className="sd-feedback-signal-grid">
              <FeedbackList title="Senales detectadas" items={detected} />
              <FeedbackList title="Falto revisar" items={missed} />
            </div>
          ) : null}
        </details>
      ) : null}
    </SurfaceCard>
  );
}
