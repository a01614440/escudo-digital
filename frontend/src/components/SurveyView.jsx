import { useEffect, useMemo, useState } from 'react';
import { normalizeRiskLevel } from '../lib/course.js';
import { buildJourneyProgress } from '../lib/journeyGuidance.js';
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

function JourneyStepper({ steps }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {steps.map((step, index) => (
        <article
          key={step.id}
          className={[
            'rounded-[22px] border px-4 py-4 transition',
            step.state === 'current'
              ? 'border-sd-accent bg-sd-accent-soft'
              : step.state === 'done'
                ? 'border-emerald-200 bg-emerald-50/80'
                : 'border-sd-border bg-white/68',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                {`Paso ${index + 1}`}
              </p>
              <strong className="mt-2 block text-base text-sd-text">{step.label}</strong>
            </div>
            <span
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold uppercase tracking-[0.14em]',
                step.state === 'current'
                  ? 'bg-sd-accent text-white'
                  : step.state === 'done'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600',
              ].join(' ')}
            >
              {step.state === 'done' ? 'OK' : String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-sd-muted">{step.description}</p>
        </article>
      ))}
    </div>
  );
}

function IntroStage({ onStart }) {
  return (
    <SurfaceCard padding="lg" className="min-w-0 overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div>
          <p className="eyebrow">Antes de empezar</p>
          <h2 className="sd-title text-[1.9rem] sm:text-[2.25rem]">
            Te vamos a guiar paso a paso
          </h2>
          <p className="mt-4 text-base leading-7 text-sd-muted">
            Primero respondes una encuesta corta, luego te mostramos tu diagnóstico y al final
            recibes una ruta personalizada con módulos prácticos para tu nivel.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-sd-border bg-white/76 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                Qué harás
              </span>
              <strong className="mt-2 block text-base text-sd-text">
                Responder y practicar
              </strong>
            </div>
            <div className="rounded-[22px] border border-sd-border bg-white/76 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                Cuánto tarda
              </span>
              <strong className="mt-2 block text-base text-sd-text">
                Menos de 3 minutos
              </strong>
            </div>
            <div className="rounded-[22px] border border-sd-border bg-white/76 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                Qué obtienes
              </span>
              <strong className="mt-2 block text-base text-sd-text">
                Diagnóstico y ruta
              </strong>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" type="button" onClick={onStart}>
              Comenzar encuesta
            </Button>
          </div>
        </div>

        <div className="rounded-[28px] border border-sd-border bg-gradient-to-br from-white via-sky-50/70 to-sd-accent-soft p-5">
          <p className="eyebrow">Qué vas a entrenar</p>
          <div className="mt-4 grid gap-3">
            {[
              'WhatsApp y suplantación',
              'SMS con enlaces falsos',
              'Páginas clonadas',
              'Llamadas fraudulentas',
              'Correo y phishing',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/80 bg-white/78 px-4 py-3 text-sm font-medium text-sd-text"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function InfoPanel() {
  return (
    <div className="grid gap-6">
      <div>
        <h3 className="text-lg font-semibold text-sd-text">Qué hace la plataforma</h3>
        <p className="hint mt-3">
          Combina una encuesta corta con actividades prácticas para enseñarte a frenar, verificar y
          decidir mejor frente a mensajes, enlaces, llamadas y páginas sospechosas.
        </p>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-sd-text">Qué esperar del resultado</h3>
        <p className="hint mt-3">
          Te mostraremos un resumen claro de riesgo, las señales que más conviene reforzar y una
          ruta de módulos para empezar sin perderte.
        </p>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-sd-text">Qué no pedimos</h3>
        <p className="hint mt-3">
          No necesitas compartir cuentas reales, contraseñas ni información financiera para usar
          esta experiencia.
        </p>
      </div>
    </div>
  );
}

export default function SurveyView({
  viewport = 'desktop',
  currentView = 'survey',
  answers,
  visibleQuestions,
  surveyIndex,
  surveyStage,
  assessment,
  courseError,
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
  const hasAnswers = useMemo(
    () =>
      Object.values(answers || {}).some((value) =>
        Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim())
      ),
    [answers]
  );
  const [showIntro, setShowIntro] = useState(
    !assessment && surveyStage === 'survey' && surveyIndex === 0 && !hasAnswers
  );

  const journeySteps = useMemo(
    () =>
      buildJourneyProgress({
        currentView,
        surveyStage,
        hasAssessment: Boolean(assessment),
        hasCoursePlan: false,
      }),
    [assessment, currentView, surveyStage]
  );

  useEffect(() => {
    if (surveyStage !== 'survey' || surveyIndex > 0 || hasAnswers || assessment) {
      setShowIntro(false);
    }
  }, [assessment, hasAnswers, surveyIndex, surveyStage]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [showIntro, surveyIndex, surveyStage]);

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
          <div className="max-w-[760px]">
            <h1 className="sd-title max-w-[12ch]">Escudo Digital</h1>
            <p className="lead sd-subtitle">
              Una ruta guiada para entender tu riesgo, practicar con claridad y seguir el siguiente
              paso sin perderte.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="accent" className="activity-pill">
              Encuesta guiada
            </Badge>
            <Badge tone="soft" className="activity-pill">
              Diagnóstico con IA
            </Badge>
            <Badge tone="neutral" className="activity-pill">
              Ruta personalizada
            </Badge>
          </div>
        </div>

        <div className="mt-6">
          <JourneyStepper steps={journeySteps} />
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:min-w-0">
        {showIntro ? <IntroStage onStart={() => setShowIntro(false)} /> : null}

        <SurfaceCard
          padding="lg"
          className={`${surveyStage === 'survey' && !showIntro ? '' : 'hidden'} min-w-0`}
          id="surveySection"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Encuesta inicial</p>
              <h2 className="sd-title text-[1.9rem] sm:text-[2.2rem]">Conozcamos tu situación</h2>
              <p className="hint sd-subtitle">
                Responde con honestidad. Al terminar te diremos qué señales te conviene reforzar y
                qué módulo abrir primero.
              </p>
            </div>
            <div className="min-w-[220px] rounded-[22px] border border-sd-border bg-white/72 px-4 py-4">
              <span className="text-sm font-medium text-sd-text">{`Paso ${surveyIndex + 1} de ${total}`}</span>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sd-accent" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-sd-muted">
                Vas bien. Solo faltan unas cuantas preguntas para generar tu diagnóstico.
              </p>
            </div>
          </div>

          {flowError ? <div className="alert mt-5">{flowError}</div> : null}

          {question ? (
            <div className="mt-6 rounded-[28px] border border-sd-border bg-white/72 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="question-eyebrow">{`Pregunta ${surveyIndex + 1}`}</p>
                  <h3>{question.title}</h3>
                  <p className="hint">{question.helper}</p>
                </div>
                <Badge tone="soft">{surveyIndex === total - 1 ? 'Última pregunta' : 'Siguiente: diagnóstico'}</Badge>
              </div>

              {renderInput(question, answers[question.id], onAnswerChange)}

              {validationError ? <div className="alert">{validationError}</div> : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-sd-muted">
                  Si necesitas cambiar algo, puedes volver atrás sin perder tus respuestas.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={onPrev}
                    disabled={surveyIndex === 0}
                  >
                    Atrás
                  </Button>
                  <Button variant="primary" type="button" onClick={onNext}>
                    {surveyIndex === total - 1 ? 'Finalizar y ver diagnóstico' : 'Siguiente'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard
          padding="lg"
          id="loadingSection"
          className={`${surveyStage === 'loading' ? '' : 'hidden'}`}
        >
          <p className="eyebrow">Diagnóstico en proceso</p>
          <h2 className="sd-title text-[2rem] sm:text-[2.2rem]">Estamos armando tu diagnóstico</h2>
          <p className="lead sd-subtitle">
            La IA está revisando tu perfil para recomendarte una ruta clara y útil. Esto tarda solo
            unos segundos.
          </p>
          <div className="loader">
            <div className="loader-bar" />
          </div>
          <p className="hint">Qué sigue: verás un resumen de riesgo y después podrás abrir tu ruta.</p>
        </SurfaceCard>

        <SurfaceCard
          padding="lg"
          id="resultSection"
          className={`${surveyStage === 'results' ? '' : 'hidden'}`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="eyebrow">Diagnóstico listo</p>
              <h2 className="sd-title text-[2rem] sm:text-[2.2rem]">Tu perfil de riesgo</h2>
              <p className="lead sd-subtitle">{resultLead}</p>
            </div>
            <Badge tone="accent">Siguiente: abrir tu ruta</Badge>
          </div>

          {courseError ? <div className="alert mt-5">{courseError}</div> : null}

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="result-card">
              <h3>Nivel estimado</h3>
              <p className="risk-level">{normalizeRiskLevel(assessment?.nivel || 'Medio')}</p>
              <p className="hint">
                {assessment?.resumen || 'Todavía no tenemos un resultado disponible.'}
              </p>
              <div className="result-reco">
                <h4>Qué vimos en tus respuestas</h4>
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
              <h3>Qué sigue</h3>
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
              <div className="mt-4 rounded-[22px] border border-sd-border bg-white/76 px-4 py-4 text-sm leading-6 text-sd-muted">
                Pulsa <strong className="text-sd-text">“Ver mi ruta”</strong> para pasar al módulo
                recomendado. Si algo falla, aquí mismo verás el mensaje y podrás reintentar.
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" type="button" onClick={onTakeCourses}>
              {courseError ? 'Intentar de nuevo' : 'Ver mi ruta'}
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
            <summary>Ver guía rápida</summary>
            <div className="mt-4">
              <InfoPanel />
            </div>
          </details>
        ) : (
          <InfoPanel />
        )}
      </SurfaceCard>
    </div>
  );
}
