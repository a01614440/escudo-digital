import { useEffect, useState } from 'react';
import { feedbackToText } from '../../../lib/course.js';
import { getDecisionRatingLabel } from '../../../lib/activityScoring.js';
import FeedbackPanel from '../../FeedbackPanel.jsx';
import Button from '../../ui/Button.jsx';
import {
  ActivitySummaryBar,
  buildActivityFeedback,
  completeActivity,
  formatPercent,
} from '../sharedActivityUi.jsx';
import { ImmersiveAsidePanel, ImmersivePanel } from './immersivePrimitives.jsx';
import { cleanText, getSimulationCategoryClass } from './shared.js';
import { countSafeChoices, resolveScenarioNextStepIndex } from './scenarioFlowUtils.js';

export default function ScenarioFlowActivity({ activity, startedAtRef, onComplete }) {
  const steps = Array.isArray(activity?.pasos) ? activity.pasos : [];
  const [stepIndex, setStepIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [flowChoices, setFlowChoices] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [pendingNext, setPendingNext] = useState(null);
  const [answeredSteps, setAnsweredSteps] = useState([]);
  const currentStep = steps[stepIndex] || null;
  const finished = !currentStep && steps.length > 0;
  const finalScore = scores.length ? scores.reduce((total, value) => total + value, 0) / scores.length : 1;
  const safeChoices = countSafeChoices(scores);
  const latestChoice = flowChoices[flowChoices.length - 1] || null;

  useEffect(() => {
    setStepIndex(0);
    setScores([]);
    setFlowChoices([]);
    setFeedback(null);
    setPendingNext(null);
    setAnsweredSteps([]);
  }, [activity?.id]);

  const chooseOption = (step, option) => {
    const score = Math.max(0, Math.min(1, Number(option?.puntaje) || 0.6));
    const nextAnsweredSteps = answeredSteps.includes(stepIndex) ? answeredSteps : [...answeredSteps, stepIndex];

    setScores((current) => [...current, score]);
    setFlowChoices((current) => [
      ...current,
      {
        step: cleanText(step?.texto || ''),
        choice: cleanText(option?.texto || ''),
        score,
      },
    ]);
    setAnsweredSteps(nextAnsweredSteps);
    setFeedback(
      buildActivityFeedback({
        title: getDecisionRatingLabel(score),
        score,
        signal:
          score >= 0.75
            ? 'Mantuviste la rutina segura y no respondiste por impulso.'
            : 'Viste parte del riesgo, pero la decisión todavía te dejaba margen de exposición.',
        risk: 'La prisa, la confianza o el contexto cotidiano pueden hacerte bajar la guardia sin darte cuenta.',
        action: cleanText(option?.feedback || 'En la vida real, pausa y verifica por un canal oficial antes de seguir.'),
        extra: cleanText(step?.texto || 'Cada decisión cambia el escenario siguiente.'),
      })
    );

    const nextIndex = resolveScenarioNextStepIndex({
      steps,
      stepIndex,
      requestedNext: option?.siguiente,
      answeredIndexes: nextAnsweredSteps,
    });

    setPendingNext(() => () => {
      setFeedback(null);
      setPendingNext(null);
      setStepIndex(nextIndex);
    });
  };

  return (
    <div
      className={`${getSimulationCategoryClass('scenario')} grid gap-4`}
      data-sd-simulation-category="scenario"
      data-sd-simulation-channel="scenario-flow"
      data-sd-stage-dominance="primary"
    >
      <ActivitySummaryBar
        items={[
          {
            label: 'Paso',
            value: finished ? 'Finalizado' : `${Math.min(stepIndex + 1, steps.length)}/${steps.length || 1}`,
            caption: 'Cada decisión cambia el escenario siguiente.',
          },
          {
            label: 'Decisiones seguras',
            value: `${safeChoices}/${scores.length || 0}`,
            caption: 'Tu rutina se fortalece cuando repites buenas decisiones.',
          },
          {
            label: 'Meta',
            value: 'Pausa y verifica',
            caption: 'No avances por impulso ni bajo presión.',
          },
        ]}
      />

      <section
        className="sd-simulation-main-stage grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]"
        data-sd-stage-layout="scenario-flow"
      >
        <ImmersivePanel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Decisión guiada</p>
              <h3 className="font-display text-2xl tracking-[-0.04em] text-sd-text">
                Convierte criterio en una rutina repetible
              </h3>
              <p className="mt-2 max-w-[60ch] text-sm leading-6 text-sd-muted">
                {cleanText(activity?.intro || 'Cada situación cambia, pero tu secuencia segura debe mantenerse estable.')}
              </p>
            </div>
            <span className="sd-badge sd-badge-soft">{`${safeChoices}/${scores.length || 0} decisiones firmes`}</span>
          </div>

          {currentStep ? (
            <div className="mt-5 rounded-[24px] border border-sd-border bg-white/75 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Situación actual</p>
                  <h4 className="text-xl font-semibold text-sd-text">¿Qué haces primero?</h4>
                </div>
                <span className="sd-badge sd-badge-accent">{`Paso ${stepIndex + 1}`}</span>
              </div>
              <p className="mt-4 text-base leading-7 text-sd-text">{cleanText(currentStep?.texto)}</p>
              <div className="mt-5 grid gap-3">
                {(Array.isArray(currentStep?.opciones) ? currentStep.opciones : []).map((option) => (
                  <button
                    className="rounded-[20px] border border-sd-border bg-white/80 px-4 py-4 text-left text-sm font-medium text-sd-text transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(feedback)}
                    key={option?.id || option?.texto}
                    type="button"
                    onClick={() => chooseOption(currentStep, option)}
                  >
                    {cleanText(option?.texto)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-sd-border bg-white/75 p-5">
              <p className="text-sm leading-6 text-sd-muted">
                Terminaste este escenario. Ya puedes registrar tu resultado y volver al tablero.
              </p>
            </div>
          )}
        </ImmersivePanel>

        <aside className="grid gap-4">
          <ImmersiveAsidePanel eyebrow="Bitácora de decisiones">
            <div className="space-y-3">
              {flowChoices.length ? (
                flowChoices.map((entry, index) => (
                  <article className="rounded-[18px] border border-sd-border bg-white/80 px-4 py-3" key={`${entry.step}-${index}`}>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sd-muted">
                      Paso {index + 1}
                    </span>
                    <p className="mt-2 text-sm font-medium text-sd-text">{entry.choice}</p>
                    <p className="mt-2 text-xs leading-5 text-sd-muted">{entry.step}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm leading-6 text-sd-muted">Aún no has tomado decisiones dentro del flujo.</p>
              )}
            </div>
          </ImmersiveAsidePanel>

          <ImmersiveAsidePanel eyebrow="Rutina segura">
            <div className="space-y-3 text-sm leading-6 text-sd-muted">
              <p>1. Pausa aunque el escenario parezca cotidiano.</p>
              <p>2. Verifica por un canal que tú controles.</p>
              <p>3. No compartas datos ni avances por costumbre.</p>
            </div>
          </ImmersiveAsidePanel>
        </aside>
      </section>

      <FeedbackPanel feedback={feedback} />

      {finished ? (
        <div className="review-grid">
          <article className="review-card correct">
            <div className="review-card-head">
              <strong>Promedio de criterio</strong>
              <span>{formatPercent(finalScore)}</span>
            </div>
            <p>Tu mejor defensa fue mantener la rutina incluso cuando el escenario parecía cotidiano o creíble.</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Decisiones seguras</strong>
              <span>{`${safeChoices}/${scores.length || 0}`}</span>
            </div>
            <p>Las decisiones firmes son las que cortan la prisa y te sacan del canal sospechoso.</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Última respuesta</strong>
              <span>{latestChoice ? 'Registrada' : 'Sin dato'}</span>
            </div>
            <p>{latestChoice?.choice || 'Terminaste el flujo sin una respuesta final registrada.'}</p>
          </article>
        </div>
      ) : null}

      <div className="activity-actions">
        {feedback && pendingNext ? (
          <Button variant="primary" type="button" onClick={pendingNext}>
            Siguiente
          </Button>
        ) : null}
        {finished ? (
          <Button
            variant="primary"
            type="button"
            onClick={() =>
              completeActivity(
                startedAtRef,
                onComplete,
                finalScore,
                feedbackToText(
                  buildActivityFeedback({
                    title: getDecisionRatingLabel(finalScore),
                    score: finalScore,
                    signal: 'Aplicaste tu rutina de verificación en una situación cotidiana.',
                    risk: 'Cuando la rutina se rompe, la urgencia o la confianza pueden tomar el control.',
                    action: 'Mantén la secuencia: pausa, verifica y confirma por un canal oficial.',
                  })
                ),
                { flowChoices }
              )
            }
          >
            Continuar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
