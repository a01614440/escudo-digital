import { repairPossibleMojibake } from '../lib/course.js';

function getFeedbackTone(feedback) {
  const score = Number(feedback?.score);
  if (Number.isFinite(score)) {
    if (score >= 0.85) return 'good';
    if (score >= 0.6) return 'warn';
    return 'risk';
  }

  const title = repairPossibleMojibake(String(feedback?.title || '').toLowerCase());
  if (title.includes('buena') || title.includes('correcto') || title.includes('complet')) {
    return 'good';
  }
  if (title.includes('regular') || title.includes('sin evaluacion') || title.includes('sin evaluación')) {
    return 'warn';
  }
  if (title.includes('riesg') || title.includes('falta')) {
    return 'risk';
  }
  return 'neutral';
}

function formatScore(score) {
  const safe = Number(score);
  if (!Number.isFinite(safe)) return '';
  return `${Math.round(Math.max(0, Math.min(1, safe)) * 100)}%`;
}

export default function FeedbackPanel({ feedback }) {
  if (!feedback || (typeof feedback === 'string' && !feedback.trim())) return null;

  if (typeof feedback === 'string') {
    return (
      <div className="feedback">
        {feedback
          .split('\n')
          .map((line) => repairPossibleMojibake(line).trim())
          .filter(Boolean)
          .map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
      </div>
    );
  }

  const tone = getFeedbackTone(feedback);
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
    <div className={`feedback feedback-${tone}`}>
      {title || scoreLabel ? (
        <div className="feedback-head">
          {title ? <div className="feedback-pill">{title}</div> : null}
          {scoreLabel ? (
            <div className="feedback-score">
              <strong>{scoreLabel}</strong>
              <span>desempeño</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {signal ? (
        <div>
          <span className="feedback-label">Señal detectada</span>
          <p>{signal}</p>
        </div>
      ) : null}

      {risk ? (
        <div>
          <span className="feedback-label">Riesgo</span>
          <p>{risk}</p>
        </div>
      ) : null}

      {action ? (
        <div>
          <span className="feedback-label">Acción segura</span>
          <p>{action}</p>
        </div>
      ) : null}

      {extra ? (
        <div>
          <span className="feedback-label">Qué hacer ahora</span>
          <p>{extra}</p>
        </div>
      ) : null}

      {detected.length ? (
        <div>
          <span className="feedback-label">Señales detectadas</span>
          <ul>
            {detected.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {missed.length ? (
        <div>
          <span className="feedback-label">Te faltó revisar</span>
          <ul>
            {missed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
