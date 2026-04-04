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

  return (
    <div className="feedback">
      {feedback.title ? <div className="feedback-pill">{feedback.title}</div> : null}

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
