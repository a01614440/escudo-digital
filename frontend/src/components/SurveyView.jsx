import { normalizeRiskLevel } from '../lib/course.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

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
        <select
          className="sd-input"
          value={value || ''}
          onChange={(event) => onChange(question.id, event.target.value)}
        >
          <option value="">Selecciona una opción</option>
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
        className="sd-input min-h-[152px]"
        placeholder={question.placeholder || 'Escribe aquí...'}
        value={value || ''}
        onChange={(event) => onChange(question.id, event.target.value)}
      />
    </div>
  );
}

export default function SurveyView({
  viewport = 'desktop',
  answers,
  visibleQuestions,
  surveyIndex,
  surveyStage,
  assessment,
  resultLead,
  validationError,
  flowError,
  onAnswerChange,
  onPrev,
  onNext,
  onRestart,
  onTakeCourses,
}) {
  const question = visibleQuestions[surveyIndex];
  const total = visibleQuestions.length || 1;
  const progress = Math.round(((surveyIndex + 1) / total) * 100);
  const isCompact = ['phone-small', 'phone', 'tablet-compact'].includes(viewport);

  const infoPanel = (
    <div className="grid gap-6">
      <div>
        <h3 className="text-lg font-semibold text-sd-text">Tipos de estafa que cubrimos</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="pill">SMS con enlaces falsos</span>
          <span className="pill">WhatsApp y suplantación</span>
          <span className="pill">Páginas web clonadas</span>
          <span className="pill">Llamadas fraudulentas</span>
          <span className="pill">Correos y phishing</span>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-sd-text">Cómo funciona la IA</h3>
        <p className="hint mt-3">
          Analizamos hábitos, exposición y experiencia previa para estimar tu probabilidad de ser
          víctima. Con eso adaptamos el contenido a lo que más necesitas.
        </p>
      </div>
    </div>
  );

  return (
    <div
      id="surveyView"
      className={`survey-layout survey-layout-${viewport} sd-page-shell grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start`}
    >
      <SurfaceCard
        as="header"
        padding="lg"
        id="hero"
        className="hero survey-hero overflow-hidden xl:col-span-2"
      >
        <p className="eyebrow">México | Prevención de estafas digitales</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <h1 className="sd-title max-w-[11ch]">Escudo Digital</h1>
            <p className="lead sd-subtitle">
              Una encuesta rápida y dinámica para entender tu nivel de riesgo y recomendarte el
              aprendizaje ideal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="accent" className="activity-pill">
              Encuesta guiada
            </Badge>
            <Badge tone="soft" className="activity-pill">
              Diagnóstico con IA
            </Badge>
            {!isCompact ? (
              <Badge tone="neutral" className="activity-pill">
                Ruta personalizada
              </Badge>
            ) : null}
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:min-w-0">
        <SurfaceCard
          padding="lg"
          className={`${surveyStage === 'survey' ? '' : 'hidden'} min-w-0`}
          id="surveySection"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Encuesta inicial</p>
              <h2 className="sd-title text-[1.9rem] sm:text-[2.2rem]">Conozcamos tu situación</h2>
              <p className="hint sd-subtitle">
                Tus respuestas se analizan con IA para ajustar el contenido. No pedimos datos
                personales sensibles.
              </p>
            </div>
            <div className="min-w-[220px] rounded-[22px] border border-sd-border bg-white/72 px-4 py-4">
              <span className="text-sm font-medium text-sd-text">{`Paso ${surveyIndex + 1} de ${total}`}</span>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sd-accent" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {flowError ? <div className="alert mt-5">{flowError}</div> : null}

          {question ? (
            <div className="mt-6 rounded-[28px] border border-sd-border bg-white/72 p-5 sm:p-6">
              <p className="question-eyebrow">{`Pregunta ${surveyIndex + 1}`}</p>
              <h3>{question.title}</h3>
              <p className="hint">{question.helper}</p>
              {renderInput(question, answers[question.id], onAnswerChange)}
              <div className={`alert ${validationError ? '' : 'hidden'}`}>{validationError}</div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={onPrev}
                  disabled={surveyIndex === 0}
                >
                  Atrás
                </Button>
                <Button variant="primary" type="button" onClick={onNext}>
                  {surveyIndex === total - 1 ? 'Finalizar' : 'Siguiente'}
                </Button>
              </div>
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard
          padding="lg"
          id="loadingSection"
          className={`${surveyStage === 'loading' ? '' : 'hidden'}`}
        >
          <p className="eyebrow">Análisis en curso</p>
          <h2 className="sd-title text-[2rem] sm:text-[2.2rem]">Estamos revisando tus respuestas</h2>
          <p className="lead sd-subtitle">
            La IA está evaluando tu perfil para darte un resultado más preciso. Esto puede tardar
            unos segundos.
          </p>
          <div className="loader">
            <div className="loader-bar" />
          </div>
          <p className="hint">No cierres la página.</p>
        </SurfaceCard>

        <SurfaceCard
          padding="lg"
          id="resultSection"
          className={`${surveyStage === 'results' ? '' : 'hidden'}`}
        >
          <p className="eyebrow">Resultado preliminar</p>
          <h2 className="sd-title text-[2rem] sm:text-[2.2rem]">Tu perfil de riesgo</h2>
          <p className="lead sd-subtitle">{resultLead}</p>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="result-card">
              <h3>Nivel estimado</h3>
              <p className="risk-level">{normalizeRiskLevel(assessment?.nivel || 'Medio')}</p>
              <p className="hint">
                {assessment?.resumen || 'Todavía no tenemos un resultado disponible.'}
              </p>
              <div className="result-reco">
                <h4>Recomendaciones IA</h4>
                <ul className="result-list">
                  {(Array.isArray(assessment?.recomendaciones)
                    ? assessment.recomendaciones
                    : []
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="result-card">
              <h3>Próximos pasos</h3>
              <div className="steps-grid">
                {(Array.isArray(assessment?.proximos_pasos) ? assessment.proximos_pasos : []).map(
                  (step, index) => (
                    <div key={step.titulo || step.title || index} className="summary-item">
                      <strong>{step.titulo || step.title || `Paso ${index + 1}`}</strong>
                      <p>{step.descripcion || step.description || ''}</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" type="button" onClick={onTakeCourses}>
              Tomar cursos
            </Button>
            <Button variant="ghost" type="button" onClick={onRestart}>
              Reiniciar encuesta
            </Button>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard
        padding="md"
        className="info-panel survey-info-panel xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-auto"
        id="infoSection"
      >
        {isCompact ? (
          <details className="info-disclosure" open>
            <summary>Ver qué cubre la plataforma</summary>
            <div className="mt-4">{infoPanel}</div>
          </details>
        ) : (
          infoPanel
        )}
      </SurfaceCard>
    </div>
  );
}
