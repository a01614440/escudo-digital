import { normalizeRiskLevel } from '../lib/course.js';

function renderInput(question, value, onChange) {
  if (question.type === 'single') {
    return (
      <div className="question-body">
        {question.options.map((option) => (
          <label key={option.value} className="option">
            <input
              type="radio"
              name={question.id}
              checked={value === option.value}
              onChange={() => onChange(question.id, option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'multi') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="question-body">
        {question.options.map((option) => (
          <label key={option.value} className="option">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((item) => item !== option.value);
                onChange(question.id, next);
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'select') {
    return (
      <div className="question-body">
        <select value={value || ''} onChange={(event) => onChange(question.id, event.target.value)}>
          <option value="">Selecciona una opcion</option>
          {question.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="question-body">
      <textarea
        placeholder={question.placeholder || 'Escribe aqui...'}
        value={value || ''}
        onChange={(event) => onChange(question.id, event.target.value)}
      />
    </div>
  );
}

export default function SurveyView({
  answers,
  visibleQuestions,
  surveyIndex,
  surveyStage,
  assessment,
  resultLead,
  validationError,
  onAnswerChange,
  onPrev,
  onNext,
  onRestart,
  onTakeCourses,
}) {
  const question = visibleQuestions[surveyIndex];
  const total = visibleQuestions.length || 1;
  const progress = Math.round(((surveyIndex + 1) / total) * 100);

  return (
    <div id="surveyView">
      <header id="hero" className="hero">
        <p className="eyebrow">Mexico | Prevencion de estafas digitales</p>
        <h1>Escudo Digital</h1>
        <p className="lead">
          Una encuesta rapida y dinamica para entender tu nivel de riesgo y recomendarte el
          aprendizaje ideal.
        </p>
      </header>

      <section className={`panel ${surveyStage === 'survey' ? '' : 'hidden'}`} id="surveySection">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Encuesta inicial</p>
            <h2>Conozcamos tu situacion</h2>
            <p className="hint">
              Tus respuestas se analizan con IA para ajustar el contenido. No pedimos datos
              personales sensibles.
            </p>
          </div>
          <div className="progress">
            <span>{`Paso ${surveyIndex + 1} de ${total}`}</span>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {question ? (
          <div className="question-card">
            <p className="question-eyebrow">{`Pregunta ${surveyIndex + 1}`}</p>
            <h3>{question.title}</h3>
            <p className="hint">{question.helper}</p>
            {renderInput(question, answers[question.id], onAnswerChange)}
            <div className={`alert ${validationError ? '' : 'hidden'}`}>{validationError}</div>
            <div className="actions">
              <button className="btn ghost" type="button" onClick={onPrev} disabled={surveyIndex === 0}>
                Atras
              </button>
              <button className="btn primary" type="button" onClick={onNext}>
                {surveyIndex === total - 1 ? 'Finalizar' : 'Siguiente'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section id="loadingSection" className={`panel ${surveyStage === 'loading' ? '' : 'hidden'}`}>
        <p className="eyebrow">Analisis en curso</p>
        <h2>Estamos revisando tus respuestas</h2>
        <p className="lead">
          La IA esta evaluando tu perfil para darte un resultado mas preciso. Esto puede tardar unos
          segundos.
        </p>
        <div className="loader">
          <div className="loader-bar" />
        </div>
        <p className="hint">No cierres la pagina.</p>
      </section>

      <section id="resultSection" className={`panel ${surveyStage === 'results' ? '' : 'hidden'}`}>
        <p className="eyebrow">Resultado preliminar</p>
        <h2>Tu perfil de riesgo</h2>
        <p className="lead">{resultLead}</p>

        <div className="result-grid">
          <div className="result-card">
            <h3>Nivel estimado</h3>
            <p className="risk-level">{normalizeRiskLevel(assessment?.nivel || 'Medio')}</p>
            <p className="hint">{assessment?.resumen || 'Todavia no tenemos un resultado disponible.'}</p>
            <div className="result-reco">
              <h4>Recomendaciones IA</h4>
              <ul className="result-list">
                {(Array.isArray(assessment?.recomendaciones) ? assessment.recomendaciones : []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="result-card">
            <h3>Proximos pasos</h3>
            <div className="steps-grid">
              {(Array.isArray(assessment?.proximos_pasos) ? assessment.proximos_pasos : []).map((step, index) => (
                <div key={step.titulo || step.title || index} className="summary-item">
                  <strong>{step.titulo || step.title || `Paso ${index + 1}`}</strong>
                  <p>{step.descripcion || step.description || ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row">
          <button className="btn primary" type="button" onClick={onTakeCourses}>
            Tomar cursos
          </button>
          <button className="btn ghost" type="button" onClick={onRestart}>
            Reiniciar encuesta
          </button>
        </div>
      </section>

      <section className="panel info-panel" id="infoSection">
        <div>
          <h3>Tipos de estafa que cubrimos</h3>
          <div className="pill-row">
            <span className="pill">SMS con enlaces falsos</span>
            <span className="pill">WhatsApp y suplantacion</span>
            <span className="pill">Paginas web clonadas</span>
            <span className="pill">Llamadas fraudulentas</span>
            <span className="pill">Correos y phishing</span>
          </div>
        </div>
        <div>
          <h3>Como funciona la IA</h3>
          <p className="hint">
            Analizamos habitos, exposicion y experiencia previa para estimar tu probabilidad de ser
            victima. Con eso adaptamos el contenido a lo que mas necesitas.
          </p>
        </div>
      </section>
    </div>
  );
}
