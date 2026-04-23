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

function FeedbackBlock({ title, body }) {
  if (!body) return null;

  return (
    <SurfaceCard padding="compact" variant="subtle">
      <strong className="block text-sm text-sd-text">{title}</strong>
      <p className="mt-2 text-sm leading-6 text-sd-text-soft">{body}</p>
    </SurfaceCard>
  );
}

function FeedbackList({ title, items = [] }) {
  if (!items.length) return null;

  return (
    <SurfaceCard padding="compact" variant="subtle">
      <strong className="block text-sm text-sd-text">{title}</strong>
      <ul className="mt-3 grid gap-2 pl-5 text-sm leading-6 text-sd-text-soft">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </SurfaceCard>
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
      <SurfaceCard padding="md" variant="support" className="border-sd-border-strong">
        <PanelHeader
          eyebrow="Retroalimentación"
          title="Lo importante de este resultado"
          subtitle="Un resumen corto para decidir el siguiente paso sin romper el foco."
          divider
        />
        <div className="grid gap-3">
          {lines.map((line, index) => (
            <p key={`${line}-${index}`} className="m-0 text-sm leading-6 text-sd-text-soft">
              {line}
            </p>
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

  return (
    <SurfaceCard
      padding="md"
      variant={tone === 'good' ? 'spotlight' : tone === 'risk' ? 'editorial' : 'support'}
      className={cn('border-sd-border-strong', tone === 'risk' ? '[&_.sd-heading-sm]:text-sd-text' : '')}
    >
      <PanelHeader
        eyebrow="Retroalimentación"
        title={title || 'Lectura del resultado'}
        subtitle="Qué hiciste bien, qué conviene revisar y cómo trasladarlo a la vida real."
        meta={
          <div className="flex flex-wrap gap-2">
            {scoreLabel ? <Badge tone={tone === 'risk' ? 'warning' : tone === 'good' ? 'accent' : 'neutral'}>{scoreLabel}</Badge> : null}
          </div>
        }
        divider
      />

      <InlineMessage tone={inlineTone} title={tone === 'good' ? 'Buen criterio' : tone === 'risk' ? 'Hay que corregir el criterio' : 'Todavía hay margen de mejora'}>
        {tone === 'good'
          ? 'La decisión general fue segura y ahora conviene fijar esa misma rutina.'
          : tone === 'risk'
            ? 'La lectura del riesgo todavía quedó corta; esta devolución te dice qué corregir antes de seguir.'
            : 'La decisión rescató parte del contexto, pero aún conviene afinar la rutina.'}
      </InlineMessage>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FeedbackBlock title="Qué sí viste" body={signal} />
        <FeedbackBlock title="Qué faltó notar" body={risk} />
        <FeedbackBlock title="Qué harías en la vida real" body={action} />
        <FeedbackBlock title="Qué sigue" body={extra} />
      </div>

      {detected.length || missed.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FeedbackList title="Señales detectadas" items={detected} />
          <FeedbackList title="Te faltó revisar" items={missed} />
        </div>
      ) : null}
    </SurfaceCard>
  );
}
