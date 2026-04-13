import { useState } from 'react';
import { feedbackRatingLabel, feedbackToText, repairPossibleMojibake } from '../../lib/course.js';
import { clampScore } from '../../lib/feedbackRules.js';
import { gradeOpenAnswer } from '../../services/courseService.js';
import FeedbackPanel from '../FeedbackPanel.jsx';
import {
  ActivitySummaryBar,
  buildActivityFeedback,
  completeActivity,
  Paragraphs,
} from './sharedActivityUi.jsx';

export function ConceptActivity({ activity, startedAtRef, onComplete }) {
  const blocks = (Array.isArray(activity.bloques) ? activity.bloques : []).map((block) => ({
    ...block,
    titulo: repairPossibleMojibake(block?.titulo || ''),
    texto: repairPossibleMojibake(block?.texto || ''),
  }));
  const leadBlock = blocks[0] || null;
  const supportBlocks = leadBlock ? blocks.slice(1) : blocks;
  const narrative = String(repairPossibleMojibake(activity.contenido || ''))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const takeawayItems = (
    Array.isArray(activity.claves) && activity.claves.length
      ? activity.claves.map((item) => repairPossibleMojibake(item))
      : supportBlocks.length
        ? supportBlocks
            .slice(0, 3)
            .map(
              (block) =>
                `${repairPossibleMojibake(block.titulo)}: ${repairPossibleMojibake(block.texto)}`
            )
        : narrative.slice(0, 3)
  ).filter(Boolean);

  return (
    <>
      <ActivitySummaryBar
        items={[
          {
            label: 'Meta',
            value: 'Entender antes de actuar',
            caption: 'Primero internaliza la idea; luego la aplicas en la práctica.',
          },
          {
            label: 'Ideas clave',
            value: Math.max(blocks.length, takeawayItems.length) || 1,
            caption: 'Quédate con una o dos reglas para recordar después.',
          },
          {
            label: 'Al cerrar',
            value: 'Rutina segura',
            caption: 'La meta es que puedas repetir la verificación sin improvisar.',
          },
        ]}
      />
      <section className="concept-stage">
        <article className="concept-hero-card">
          <span className="concept-kicker">Idea central</span>
          <h3>
            {repairPossibleMojibake(
              leadBlock?.titulo || activity.titulo || 'Qué debes recordar'
            )}
          </h3>
          <p>
            {repairPossibleMojibake(
              leadBlock?.texto ||
                narrative[0] ||
                'Esta actividad resume la señal principal que debes reconocer antes de avanzar.'
            )}
          </p>
          <div className="concept-callout">
            <strong>Cómo se traduce en una decisión segura</strong>
            <p>
              {repairPossibleMojibake(
                narrative[1] ||
                  'No basta con detectar la señal: la clave es pausar, verificar y salir del canal sospechoso si hace falta.'
              )}
            </p>
          </div>
        </article>
        {supportBlocks.length ? (
          <div className="concept-grid enhanced">
            {supportBlocks.map((block) => (
              <article className="concept-card" key={`${block.titulo}-${block.texto}`}>
                <span className="concept-card-index">Clave</span>
                <p className="concept-card-title">{repairPossibleMojibake(block.titulo)}</p>
                <p className="concept-card-text">{repairPossibleMojibake(block.texto)}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      {narrative.length ? (
        <section className="info-panel concept-detail-panel">
          <p className="eyebrow">Qué debes aplicar al salir de aquí</p>
          <div className="activity-copy">
            {narrative.slice(leadBlock ? 1 : 0).map((line) => (
              <p key={line}>{repairPossibleMojibake(line)}</p>
            ))}
          </div>
        </section>
      ) : null}
      {takeawayItems.length ? (
        <section className="result-card concept-takeaways">
          <div className="feedback-head">
            <div>
              <p className="eyebrow">Antes de continuar</p>
              <h3>Qué te conviene llevarte de esta idea</h3>
            </div>
            <div className="feedback-pill">Resumen útil</div>
          </div>
          <div className="summary-list">
            {takeawayItems.map((item) => (
              <div className="summary-item concept-takeaway-item" key={item}>
                <p>{repairPossibleMojibake(item)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <div className="activity-actions">
        <p className="activity-inline-note">
          Cuando esta idea ya te quede clara, pasa a la práctica para convertirla en hábito.
        </p>
        <button
          className="btn primary"
          type="button"
          onClick={() =>
            completeActivity(startedAtRef, onComplete, 1, 'Actividad completada.', {
              viewed: true,
            })
          }
        >
          Continuar
        </button>
      </div>
    </>
  );
}

export function QuizActivity({ activity, startedAtRef, onComplete }) {
  const [selection, setSelection] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const options = Array.isArray(activity.opciones) ? activity.opciones : [];
  const correctIndex = Number.isFinite(Number(activity.correcta)) ? Number(activity.correcta) : 0;
  const isAnswered = selection !== null;

  const handleSelect = (index) => {
    if (isAnswered) return;
    setSelection(index);
    const isCorrect = index === correctIndex;
    const score = isCorrect ? 1 : 0.45;
    setFeedback(
      buildActivityFeedback({
        title: feedbackRatingLabel(score),
        score,
        signal:
          activity.senal ||
          (isCorrect
            ? 'Detectaste la señal principal del escenario.'
            : 'La señal clave estaba en la urgencia, el canal o la petición.'),
        risk:
          activity.riesgo ||
          'Responder sin verificar puede exponerte a robo de datos, dinero o acceso.',
        action:
          activity.accion ||
          (options[correctIndex]
            ? `La acción segura era: ${options[correctIndex]}`
            : 'Verifica por un canal oficial antes de actuar.'),
        extra:
          activity.explicacion ||
          (isCorrect ? 'Buena decisión.' : 'Valía la pena frenar y revisar mejor la situación.'),
      })
    );
  };

  return (
    <>
      <Paragraphs text={activity.escenario} />
      <ActivitySummaryBar
        items={[
          {
            label: 'Opciones',
            value: options.length || 0,
            caption: 'Revisa todas antes de elegir.',
          },
          {
            label: 'Meta',
            value: 'Elegir con criterio',
            caption: 'La mejor respuesta no siempre es la más rápida.',
          },
        ]}
      />
      <div className="option-grid">
        {options.map((option, index) => {
          const status =
            selection === null
              ? ''
              : index === correctIndex
                ? 'correct'
                : selection === index
                  ? 'wrong'
                  : '';
          return (
            <button
              key={`${option}-${index}`}
              className={`option-btn ${status}`.trim()}
              type="button"
              onClick={() => handleSelect(index)}
              disabled={isAnswered}
            >
              {option}
            </button>
          );
        })}
      </div>
      <FeedbackPanel feedback={feedback} />
      <div className="activity-actions">
        {feedback ? (
          <>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                completeActivity(
                  startedAtRef,
                  onComplete,
                  selection === correctIndex ? 1 : 0.6,
                  feedbackToText(feedback),
                  {
                    selectedIndex: selection,
                    selectedText: options[selection] || '',
                    correctIndex,
                    correctText: options[correctIndex] || '',
                  }
                )
              }
            >
              Continuar
            </button>
            {selection !== correctIndex ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setSelection(null);
                  setFeedback(null);
                }}
              >
                Reintentar
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

export function ChecklistActivity({ activity, startedAtRef, onComplete }) {
  const items = Array.isArray(activity.items) ? activity.items : [];
  const [checked, setChecked] = useState(
    () => Object.fromEntries(items.map((item) => [item, false]))
  );
  const [feedback, setFeedback] = useState(null);
  const selectedCount = items.filter((item) => checked[item]).length;
  const remainingItems = items.filter((item) => !checked[item]);
  const allChecked = items.length > 0 && remainingItems.length === 0;

  const toggleItem = (item) => {
    setChecked((current) => ({ ...current, [item]: !current[item] }));
  };

  const submit = () => {
    if (!allChecked) {
      setFeedback(
        buildActivityFeedback({
          title: 'Falta completar el checklist',
          score: selectedCount / Math.max(items.length, 1),
          signal: `Marcaste ${selectedCount} de ${items.length} pasos.`,
          risk: 'Si omites un paso de verificación, tu rutina se debilita justo cuando necesitas claridad.',
          action: 'Completa los pasos restantes antes de avanzar.',
          missed: remainingItems.slice(0, 4),
          extra: 'La idea es fijar un hábito completo, no marcar solo lo más fácil.',
        })
      );
      return;
    }

    completeActivity(
      startedAtRef,
      onComplete,
      1,
      feedbackToText(
        buildActivityFeedback({
          title: 'Buena',
          signal: 'Repasaste los pasos clave sin saltarte ninguno.',
          risk:
            'Si omites un paso de verificación, aumenta la probabilidad de actuar con prisa.',
          action:
            'Usa este checklist como rutina rápida cuando un mensaje o llamada te meta presión.',
        })
      ),
      { checkedItems: items, totalItems: items.length }
    );
  };

  return (
    <>
      <Paragraphs text={activity.intro || 'Marca cada punto antes de continuar.'} />
      <ActivitySummaryBar
        items={[
          {
            label: 'Pasos',
            value: items.length || 0,
            caption: 'Tu rutina mínima de verificación.',
          },
          {
            label: 'Completados',
            value: `${selectedCount}/${items.length}`,
            caption: allChecked ? 'Rutina completa.' : 'Aún faltan pasos por marcar.',
          },
          {
            label: 'Meta',
            value: 'No saltarte ninguno',
            caption: 'La consistencia vale más que la velocidad.',
          },
        ]}
      />
      <div className="question-body">
        {items.map((item) => (
          <label className="option" key={item}>
            <input
              type="checkbox"
              checked={Boolean(checked[item])}
              onChange={() => toggleItem(item)}
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      <FeedbackPanel feedback={feedback} />
      <div className="activity-actions">
        <button className="btn primary" type="button" onClick={submit}>
          Listo
        </button>
      </div>
    </>
  );
}

export function OpenAnswerActivity({
  module,
  activity,
  answers,
  assessment,
  startedAtRef,
  onComplete,
}) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [gradedScore, setGradedScore] = useState(null);

  const submit = async () => {
    if (answer.trim().length < 6) {
      setFeedback('Escribe un poco más para poder evaluarlo.');
      return;
    }

    setBusy(true);
    try {
      const response = await gradeOpenAnswer({
        prompt: activity.prompt,
        answer: answer.trim(),
        module,
        activity,
        user: { answers, assessment },
      });
      const score = clampScore(response?.score);
      const text = String(response?.feedback || 'Buen intento.').trim();
      setGradedScore(score);
      setFeedback(
        buildActivityFeedback({
          title: feedbackRatingLabel(score),
          score,
          signal: 'Tu respuesta mostró cómo identificar o frenar el riesgo.',
          risk: 'La idea es no resolver desde el canal sospechoso ni compartir datos.',
          action:
            'Quédate con una frase corta, clara y orientada a verificar por canales oficiales.',
          extra: text,
        })
      );
    } catch (error) {
      setGradedScore(0.4);
      setFeedback(
        buildActivityFeedback({
          title: 'Sin evaluación',
          score: 0.4,
          signal: 'No se pudo revisar esta respuesta con IA.',
          action:
            'Puedes reintentar y mantener la misma regla: no compartas datos y verifica por canales oficiales.',
          extra: error.message || '',
        })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Paragraphs text={activity.prompt} />
      <ActivitySummaryBar
        items={[
          {
            label: 'Formato',
            value: 'Respuesta abierta',
            caption: 'Describe tu criterio con claridad.',
          },
          {
            label: 'Meta',
            value: 'Explicar y justificar',
            caption: 'Cuenta cómo pausarías, verificarías o cortarías el riesgo.',
          },
        ]}
      />
      {Array.isArray(activity.pistas) && activity.pistas.length ? (
        <p className="hint">{`Tip: ${activity.pistas.join(' · ')}`}</p>
      ) : null}
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Escribe tu respuesta. Evita compartir datos reales."
      />
      <FeedbackPanel feedback={feedback} />
      <div className="activity-actions">
        <button className="btn primary" type="button" onClick={submit} disabled={busy}>
          {busy ? 'Analizando...' : 'Enviar'}
        </button>
        {feedback ? (
          <>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setFeedback(null);
                setGradedScore(null);
              }}
            >
              Mejorar respuesta
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                completeActivity(
                  startedAtRef,
                  onComplete,
                  gradedScore ?? 0.7,
                  feedbackToText(feedback),
                  { answer: answer.trim().slice(0, 600) }
                )
              }
            >
              Continuar
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
