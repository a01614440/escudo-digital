function getFeedbackTone(feedback) {
  const score = Number(feedback?.score);
  if (Number.isFinite(score)) {
    if (score >= 0.85) return 'good';
    if (score >= 0.6) return 'warn';
    return 'risk';
  }

  const title = String(feedback?.title || '').toLowerCase();
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
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
      </div>
    );
  }

  const tone = getFeedbackTone(feedback);
  const scoreLabel = formatScore(feedback.score);

  return (
    <div className={`feedback feedback-${tone}`}>
      {feedback.title || scoreLabel ? (
        <div className="feedback-head">
          {feedback.title ? <div className="feedback-pill">{feedback.title}</div> : null}
          {scoreLabel ? (
            <div className="feedback-score">
              <strong>{scoreLabel}</strong>
              <span>desempeño</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {feedback.signal ? (
        <div>
          <span className="feedback-label">Señal detectada</span>
          <p>{feedback.signal}</p>
        </div>
      ) : null}

      {feedback.risk ? (
        <div>
          <span className="feedback-label">Riesgo</span>
          <p>{feedback.risk}</p>
        </div>
      ) : null}

      {feedback.action ? (
        <div>
          <span className="feedback-label">Acción segura</span>
          <p>{feedback.action}</p>
        </div>
      ) : null}

      {feedback.extra ? (
        <div>
          <span className="feedback-label">Qué hacer ahora</span>
          <p>{feedback.extra}</p>
        </div>
      ) : null}

      {Array.isArray(feedback.detected) && feedback.detected.length ? (
        <div>
          <span className="feedback-label">Señales detectadas</span>
          <ul>
            {feedback.detected.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(feedback.missed) && feedback.missed.length ? (
        <div>
          <span className="feedback-label">Te faltó revisar</span>
          <ul>
            {feedback.missed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
