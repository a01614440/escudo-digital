import { useMemo, useRef, useState } from 'react';
import { postJson } from '../../lib/api.js';
import { useEffect } from 'react';
import { splitParagraphs } from '../../lib/format.js';
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  feedbackRatingLabel,
  feedbackToText,
  LEVEL_LABELS,
  repairPossibleMojibake,
} from '../../lib/course.js';
import FeedbackPanel from '../FeedbackPanel.jsx';
import CallSimulationActivity from './CallSimulationActivity.jsx';

function Paragraphs({ text, className = 'activity-copy' }) {
  const lines = splitParagraphs(repairPossibleMojibake(text));
  if (!lines.length) return null;
  return (
    <div className={className}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

const SIMULATION_GUIDES = {
  quiz: [
    'Lee el escenario completo antes de responder.',
    'Elige la opción más segura, no la más rápida.',
    'Revisa el feedback para entender por qué esa decisión era mejor.',
  ],
  simulacion: [
    'Lee el escenario completo antes de responder.',
    'Elige la opción más segura, no la más rápida.',
    'Revisa el feedback para entender por qué esa decisión era mejor.',
  ],
  sim_chat: [
    'Responde como si fuera una conversación real.',
    'La meta es detectar el riesgo, no agradar al contacto.',
    'Si dudas, pausa y verifica por fuera del chat.',
  ],
  compare_domains: [
    'Busca cambios mínimos en letras, terminaciones o estructura.',
    'El dominio más confiable suele ser el más simple y coherente.',
    'Si sigues dudando, escribe tú mismo la dirección oficial.',
  ],
  signal_hunt: [
    'Marca solo las señales que realmente indiquen riesgo.',
    'No necesitas marcar todo: importa la precisión.',
    'Piensa qué parte del mensaje te quiere presionar o engañar.',
  ],
  inbox: [
    'Abre el mensaje y revísalo antes de clasificarlo.',
    'Fíjate en remitente, asunto, cuerpo y enlaces visibles.',
    'No te guíes solo por el diseño: busca incoherencias concretas.',
  ],
  web_lab: [
    'Recorre la página como si fueras a comprar o registrarte.',
    'Marca hallazgos sospechosos mientras avanzas.',
    'Al final decide si seguirías o saldrías del sitio.',
  ],
  call_sim: [
    'Lee cada paso como si estuvieras en una llamada real.',
    'Prioriza cortar, pausar o verificar por fuera de la llamada.',
    'No compartas datos ni resuelvas bajo presión.',
  ],
  scenario_flow: [
    'Cada decisión cambia el escenario siguiente.',
    'Piensa en la rutina segura antes de responder.',
    'La meta es reducir riesgo, no terminar rápido.',
  ],
  abierta: [
    'Explica qué harías con tus propias palabras.',
    'Incluye cómo pausarías, verificarías o cortarías el riesgo.',
    'No hace falta escribir mucho, pero sí ser claro.',
  ],
  checklist: [
    'Marca cada paso solo si realmente lo revisarías.',
    'Úsalo como una rutina mínima de verificación.',
    'La idea es convertirlo en hábito, no avanzar por avanzar.',
  ],
};

function SimulationGuide({ activity, compact = false }) {
  const steps = SIMULATION_GUIDES[activity?.tipo];
  if (!steps?.length) return null;

  if (compact) {
    return (
      <details className="activity-guide compact-guide activity-guide-disclosure">
        <summary>
          <span>Cómo resolver esta actividad</span>
          <span>{`${steps.length} pasos`}</span>
        </summary>
        <div className="summary-list">
          {steps.map((step, index) => (
            <div className="summary-item activity-guide-item" key={step}>
              <span className="activity-guide-index">{String(index + 1).padStart(2, '0')}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </details>
    );
  }

  return (
    <section className="activity-guide compact-guide">
      <div className="activity-guide-head">
        <p className="eyebrow">Cómo resolver esta actividad</p>
        <span className="activity-guide-count">{`${steps.length} pasos`}</span>
      </div>
      <div className="summary-list">
        {steps.map((step, index) => (
          <div className="summary-item activity-guide-item" key={step}>
            <span className="activity-guide-index">{String(index + 1).padStart(2, '0')}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityChrome({ module, activity, compact = false, children }) {
  const theme = moduleThemeMeta(module);
  return (
    <div
      className={`activity-shell activity-shell-${theme.category} activity-shell-${theme.level}`.trim()}
    >
      <div className="activity-head activity-head-rich">
        <div className="activity-head-copy">
          <p className="eyebrow">{theme.eyebrow}</p>
          <p className="activity-title">{repairPossibleMojibake(activity.titulo || 'Actividad')}</p>
          <p className="activity-head-blurb">
            {repairPossibleMojibake(
              activity.intro ||
                activity.escenario ||
                activity.prompt ||
                theme.blurb
            )}
          </p>
        </div>
        <div className="activity-head-badges">
          <span className="activity-type">{ACTIVITY_LABELS[activity.tipo] || activity.tipo || 'Actividad'}</span>
          <span className="activity-kicker-pill">{CATEGORY_LABELS[theme.category] || theme.badge}</span>
          <span className="activity-kicker-pill subtle">
            {LEVEL_LABELS[theme.level] || theme.label}
          </span>
          <span className="activity-kicker-pill subtle">{theme.brief}</span>
        </div>
      </div>
      <SimulationGuide activity={activity} compact={compact} />
      {children}
    </div>
  );
}

function completePayload(startedAtRef, onComplete, score, feedback, details = null) {
  onComplete({
    score,
    feedback,
    details,
    durationMs: Math.max(0, Date.now() - startedAtRef.current),
  });
}

function clampScore(score) {
  const safe = Number(score);
  if (!Number.isFinite(safe)) return 0;
  return Math.max(0, Math.min(1, safe));
}

function formatPercent(score) {
  return `${Math.round(clampScore(score) * 100)}%`;
}

function buildFeedback({ title, score, signal, risk, action, extra, detected, missed }) {
  return {
    title,
    score,
    signal,
    risk,
    action,
    extra,
    detected,
    missed,
  };
}

function ActivitySummaryBar({ items = [] }) {
  const visibleItems = items.filter((item) => item && item.label && item.value !== undefined && item.value !== null);
  if (!visibleItems.length) return null;

  return (
    <div className="activity-summary-bar">
      {visibleItems.map((item) => (
        <article className="activity-summary-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.caption ? <p>{item.caption}</p> : null}
        </article>
      ))}
    </div>
  );
}

function ConceptActivity({ activity, startedAtRef, onComplete }) {
  const blocks = (Array.isArray(activity.bloques) ? activity.bloques : []).map((block) => ({
    ...block,
    titulo: repairPossibleMojibake(block?.titulo || ''),
    texto: repairPossibleMojibake(block?.texto || ''),
  }));
  const leadBlock = blocks[0] || null;
  const supportBlocks = leadBlock ? blocks.slice(1) : blocks;
  const narrative = splitParagraphs(repairPossibleMojibake(activity.contenido));
  const takeawayItems = (
    Array.isArray(activity.claves) && activity.claves.length
      ? activity.claves.map((item) => repairPossibleMojibake(item))
      : supportBlocks.length
        ? supportBlocks.slice(0, 3).map((block) => `${repairPossibleMojibake(block.titulo)}: ${repairPossibleMojibake(block.texto)}`)
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
          <h3>{repairPossibleMojibake(leadBlock?.titulo || activity.titulo || 'Qué debes recordar')}</h3>
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
            completePayload(startedAtRef, onComplete, 1, 'Actividad completada.', {
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

function QuizActivity({ activity, startedAtRef, onComplete }) {
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
      buildFeedback({
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
          (isCorrect
            ? 'Buena decisión.'
            : 'Valía la pena frenar y revisar mejor la situación.'),
      })
    );
  };

  return (
    <>
      <Paragraphs text={activity.escenario} />
      <ActivitySummaryBar
        items={[
          { label: 'Opciones', value: options.length || 0, caption: 'Revisa todas antes de elegir.' },
          { label: 'Meta', value: 'Elegir con criterio', caption: 'La mejor respuesta no siempre es la más rápida.' },
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
                completePayload(
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

function ChecklistActivity({ activity, startedAtRef, onComplete }) {
  const items = Array.isArray(activity.items) ? activity.items : [];
  const [checked, setChecked] = useState(() => Object.fromEntries(items.map((item) => [item, false])));
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
        buildFeedback({
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
    completePayload(
      startedAtRef,
      onComplete,
      1,
      feedbackToText(
        buildFeedback({
          title: 'Buena',
          signal: 'Repasaste los pasos clave sin saltarte ninguno.',
          risk: 'Si omites un paso de verificación, aumenta la probabilidad de actuar con prisa.',
          action: 'Usa este checklist como rutina rápida cuando un mensaje o llamada te meta presión.',
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
          { label: 'Pasos', value: items.length || 0, caption: 'Tu rutina mínima de verificación.' },
          { label: 'Completados', value: `${selectedCount}/${items.length}`, caption: allChecked ? 'Rutina completa.' : 'Aún faltan pasos por marcar.' },
          { label: 'Meta', value: 'No saltarte ninguno', caption: 'La consistencia vale más que la velocidad.' },
        ]}
      />
      <div className="question-body">
        {items.map((item) => (
          <label className="option" key={item}>
            <input type="checkbox" checked={Boolean(checked[item])} onChange={() => toggleItem(item)} />
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

function OpenAnswerActivity({ module, activity, answers, assessment, startedAtRef, onComplete }) {
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
      const response = await postJson('/api/course/grade-open', {
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
        buildFeedback({
          title: feedbackRatingLabel(score),
          score,
          signal: 'Tu respuesta mostró cómo identificar o frenar el riesgo.',
          risk: 'La idea es no resolver desde el canal sospechoso ni compartir datos.',
          action: 'Quédate con una frase corta, clara y orientada a verificar por canales oficiales.',
          extra: text,
        })
      );
    } catch (error) {
      setGradedScore(0.4);
      setFeedback(
        buildFeedback({
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
          { label: 'Formato', value: 'Respuesta abierta', caption: 'Describe tu criterio con claridad.' },
          { label: 'Meta', value: 'Explicar y justificar', caption: 'Cuenta cómo pausarías, verificarías o cortarías el riesgo.' },
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
                completePayload(
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

function WhatsAppSimulation({ activity, answers, assessment, startedAtRef, onComplete }) {
  const [history, setHistory] = useState(() =>
    activity.inicio ? [{ role: 'scammer', content: activity.inicio }] : []
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const quickReplies = Array.isArray(activity.quickReplies) ? activity.quickReplies : [];
  const userTurns = history.filter((message) => message.role === 'user').length;
  const contactName = repairPossibleMojibake(activity.contactName || 'Contacto desconocido');
  const contactStatus = repairPossibleMojibake(activity.contactStatus || 'en línea');
  const avatarLabel = repairPossibleMojibake(
    activity.avatarLabel || contactName.slice(0, 2).toUpperCase() || 'WA'
  );
  const threatNote =
    userTurns > 0
      ? 'El estafador ya consiguió mantenerte dentro del chat. Tu meta ahora es cerrar el canal sin justificarte de más.'
      : 'La presión empieza desde el primer mensaje. Responde como si fuera un chat real, pero sin darle control a la conversación.';

  const chatTimestamp = (index) => {
    const baseMinutes = 22;
    const totalMinutes = baseMinutes + index * 2;
    const hour = 11 + Math.floor(totalMinutes / 60);
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hour}:${minutes}`;
  };

  const finishSimulation = () => {
    const score = bestScore || (userTurns ? 0.72 : 0.45);
    if (!feedback) {
      setFeedback(
        buildFeedback({
          title: feedbackRatingLabel(score),
          score,
          signal: 'Cerraste la conversación sin seguir el ritmo del estafador.',
          risk: 'El mayor riesgo en este tipo de chat es quedarte resolviendo dentro del mismo canal.',
          action: 'Corta la conversación y verifica por una llamada o canal oficial que tú controles.',
          extra: 'Usa un cierre corto, firme y sin justificarte demasiado.',
        })
      );
    }
    setDone(true);
  };

  const sendMessage = async (presetMessage) => {
    const message = String(presetMessage ?? input).trim();
    if (!message || busy || done) return;
    const nextHistory = [...history, { role: 'user', content: message }];
    setHistory(nextHistory);
    setInput('');
    setBusy(true);

    try {
      const response = await postJson('/api/course/sim-turn', {
        scenario: activity.escenario || activity.inicio,
        history: nextHistory,
        userMessage: message,
        turn: turns + 1,
        turnos_max: activity.turnos_max || 6,
        user: { answers, assessment },
      });

      const scammerReply = String(response?.reply || '').trim();
      const responseHistory = scammerReply
        ? [...nextHistory, { role: 'scammer', content: scammerReply }]
        : nextHistory;
      const score = Math.max(0, Math.min(1, Number(response?.score) || 0));
      setTurns((current) => current + 1);
      setBestScore((current) => Math.max(current, score));
      setHistory(responseHistory);
      setFeedback(
        buildFeedback({
          title: response?.rating || feedbackRatingLabel(score),
          score,
          signal:
            response?.signal_detected ||
            'La conversación mete presión para que resuelvas dentro del mismo chat.',
          risk:
            response?.risk ||
            'Si sigues en el mismo canal, el estafador controla el contexto y tu decisión.',
          action:
            response?.safe_action ||
            'Detén la conversación y verifica por un canal oficial que tú controles.',
          extra: response?.coach_feedback || '',
        })
      );
      setDone(Boolean(response?.done) || turns + 1 >= (activity.turnos_max || 6));
    } catch (error) {
      setFeedback(
        buildFeedback({
          title: 'Sin respuesta',
          signal: 'No pudimos continuar la simulación en este momento.',
          action: 'Reintenta o continua aplicando la regla: pausa y verifica por un canal oficial.',
          extra: error.message || '',
        })
      );
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ActivitySummaryBar
        items={[
          {
            label: 'Turnos usados',
            value: `${turns}/${activity.turnos_max || 6}`,
            caption: 'Puedes cerrar cuando ya fijaste un límite claro.',
          },
          {
            label: 'Objetivo',
            value: 'Frenar y verificar',
            caption: 'No necesitas convencer al atacante para hacerlo bien.',
          },
          {
            label: 'Nivel de presión',
            value: turns >= 3 ? 'Alta' : 'En aumento',
            caption: 'Mientras más sigas en el chat, más margen tiene para manipular.',
          },
        ]}
      />
      <div className="wa-experience">
        <aside className="wa-side-panel">
          <p className="eyebrow">Qué estás entrenando</p>
          <h3>Salir del chat sin seguirle el ritmo</h3>
          <p>{threatNote}</p>
          <div className="wa-side-list">
            <article className="wa-side-card">
              <span>Busca</span>
              <strong>Urgencia, secreto o petición de dinero/códigos</strong>
            </article>
            <article className="wa-side-card">
              <span>Evita</span>
              <strong>Explicarte de más o resolver dentro del mismo chat</strong>
            </article>
            <article className="wa-side-card">
              <span>Salida segura</span>
              <strong>Llamar al contacto real o verificar desde una app oficial</strong>
            </article>
          </div>
        </aside>
        <div className="wa-phone wa-phone-pro">
          <div className="wa-device-bar">
            <span>9:41</span>
            <span>{done ? 'Chat cerrado' : 'WhatsApp'}</span>
            <span>{`${Math.max(1, activity.turnos_max || 6) - turns} turnos`}</span>
          </div>
          <div className="wa-header">
            <div className="wa-avatar">{avatarLabel}</div>
            <div className="wa-contact">
              <p className="wa-contact-name">{contactName}</p>
              <p className="wa-contact-status">{contactStatus}</p>
            </div>
            <div className="wa-contact-badges">
              <span className="wa-contact-chip">No verificado</span>
              <span className="wa-contact-chip subtle">Respuesta rápida</span>
            </div>
          </div>
          <div className="wa-stage-banner">
            <strong>Chat activo</strong>
            <p>
              {repairPossibleMojibake(activity.escenario) ||
                'Responde con una salida firme. Si dudas, corta y verifica por fuera.'}
            </p>
          </div>
          <div className="wa-screen">
            {history.map((message, index) => (
              <div
                className={`wa-row ${message.role === 'user' ? 'user' : 'bot'}`}
                key={`${message.role}-${index}`}
              >
                <div className={`wa-bubble ${message.role === 'user' ? 'user' : 'bot'}`}>
                  <p>{repairPossibleMojibake(message.content)}</p>
                  <span className="wa-bubble-time">{chatTimestamp(index)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="wa-quick-replies">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                className="btn ghost compact"
                type="button"
                disabled={busy || done}
                onClick={() => sendMessage(reply)}
              >
                {repairPossibleMojibake(reply)}
              </button>
            ))}
          </div>
          <div className="wa-inputbar">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribe una respuesta breve, firme y segura"
              disabled={busy || done}
            />
            <button className="btn primary" type="button" disabled={busy || done} onClick={() => sendMessage()}>
              {busy ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
      <FeedbackPanel feedback={feedback} />
      <div className="activity-actions">
        {!done && userTurns > 0 ? (
          <button className="btn ghost" type="button" onClick={finishSimulation} disabled={busy}>
            Cerrar simulación de forma segura
          </button>
        ) : null}
        {done ? (
          <button
            className="btn primary"
            type="button"
            onClick={() =>
              completePayload(
                startedAtRef,
                onComplete,
                bestScore || 0.6,
                  feedbackToText(feedback || 'Simulación completada.'),
                { history, turns }
              )
            }
          >
            Continuar
          </button>
        ) : null}
      </div>
    </>
  );
}

function CompareDomainsActivity({ activity, startedAtRef, onComplete }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const domains = Array.isArray(activity.dominios) ? activity.dominios : [];
  const correctIndex = Number.isFinite(Number(activity.correcta)) ? Number(activity.correcta) : 0;

  const handleSelect = (index) => {
    if (selectedIndex !== null) return;
    const isCorrect = index === correctIndex;
    const score = isCorrect ? 1 : 0.45;
    setSelectedIndex(index);
    setFeedback(
      buildFeedback({
        title: feedbackRatingLabel(score),
        score,
        signal: isCorrect
          ? 'Elegiste el dominio más consistente para verificar por tu cuenta.'
          : 'El dominio seguro suele ser el más simple y coherente con la marca real.',
        risk: 'Un cambio pequeño en letras o extensiones puede llevarte a una web clonada.',
        action: 'Si dudas, no abras el enlace desde el mensaje. Escribe tú el dominio en el navegador.',
        extra: `${activity.explicacion || ''}${activity.tip ? ` Tip: ${activity.tip}` : ''}`.trim(),
      })
    );
  };

  return (
    <>
      <Paragraphs text={activity.prompt || 'Elige el dominio legítimo.'} />
      <ActivitySummaryBar
        items={[
          { label: 'Dominios', value: domains.length || 0, caption: 'Busca el más simple y coherente.' },
          { label: 'Regla', value: 'Escribirlo tú mismo', caption: 'Si dudas, no abras el enlace desde el mensaje.' },
        ]}
      />
      <div className="option-grid">
        {domains.map((domain, index) => {
          const status =
            selectedIndex === null
              ? ''
              : index === correctIndex
                ? 'correct'
                : selectedIndex === index
                  ? 'wrong'
                  : '';
          return (
            <button
              key={domain}
              className={`domain-btn ${status}`.trim()}
              type="button"
              onClick={() => handleSelect(index)}
              disabled={selectedIndex !== null}
            >
              {domain}
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
                completePayload(
                  startedAtRef,
                  onComplete,
                  selectedIndex === correctIndex ? 1 : 0.6,
                  feedbackToText(feedback),
                  {
                    selectedDomain: domains[selectedIndex] || '',
                    correctDomain: domains[correctIndex] || '',
                  }
                )
              }
            >
              Continuar
            </button>
            {selectedIndex !== correctIndex ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setSelectedIndex(null);
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

function SignalHuntActivity({ activity, startedAtRef, onComplete }) {
  const signals = Array.isArray(activity.senales) ? activity.senales : [];
  const [selected, setSelected] = useState(() => new Set());
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);

  const toggleSignal = (signalId) => {
    if (result) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(signalId)) next.delete(signalId);
      else next.add(signalId);
      return next;
    });
  };

  const evaluate = () => {
    const correctIds = new Set(signals.filter((signal) => signal.correcta).map((signal) => signal.id));
    let tp = 0;
    let fp = 0;
    let fn = 0;

    selected.forEach((signalId) => {
      if (correctIds.has(signalId)) tp += 1;
      else fp += 1;
    });
    correctIds.forEach((signalId) => {
      if (!selected.has(signalId)) fn += 1;
    });

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const score = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const payload = buildFeedback({
      title: feedbackRatingLabel(score),
      score,
      signal: `Encontraste ${tp} de ${correctIds.size || 1} señales relevantes.`,
      risk: 'Cuando una señal pasa desapercibida, es más fácil que el mensaje te arrastre al siguiente paso.',
      action:
        activity.accion ||
        'Detén la conversación y verifica por el canal oficial antes de abrir links, pagar o responder.',
      detected: signals.filter((signal) => selected.has(signal.id) && signal.correcta).map((signal) => signal.label),
      missed: signals.filter((signal) => signal.correcta && !selected.has(signal.id)).map((signal) => signal.label),
    });
    setResult({
      score,
      selectedSignals: signals.filter((signal) => selected.has(signal.id)).map((signal) => signal.label),
    });
    setFeedback(payload);
  };

  return (
    <>
      <div className="message-box">{activity.mensaje || 'Detecta las señales de riesgo.'}</div>
      <ActivitySummaryBar
        items={[
          { label: 'Señales clave', value: signals.filter((signal) => signal.correcta).length || 0, caption: 'No necesitas marcar todo, solo lo importante.' },
          { label: 'Marcadas', value: selected.size, caption: result ? `Resultado ${formatPercent(result.score)}` : 'Puedes tocar una señal otra vez para quitarla.' },
        ]}
      />
      <div className="signal-list">
        {signals.map((signal) => {
          const chosen = selected.has(signal.id);
          const stateClass = result
            ? chosen && signal.correcta
              ? 'correct'
              : chosen && !signal.correcta
                ? 'wrong'
                : !chosen && signal.correcta
                  ? 'missed'
                  : ''
            : '';
          return (
            <label className={`signal-row ${stateClass}`.trim()} key={signal.id}>
              <input
                type="checkbox"
                checked={chosen}
                onChange={() => toggleSignal(signal.id)}
                disabled={Boolean(result)}
              />
              <span>{signal.label}</span>
            </label>
          );
        })}
      </div>
      <FeedbackPanel feedback={feedback} />
      <div className="activity-actions">
        {!result ? (
          <button className="btn primary" type="button" onClick={evaluate}>
            Evaluar
          </button>
        ) : (
          <>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                completePayload(
                  startedAtRef,
                  onComplete,
                  result.score,
                  feedbackToText(feedback),
                  { selectedSignals: result.selectedSignals }
                )
              }
            >
              Continuar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setSelected(new Set());
                setResult(null);
                setFeedback(null);
              }}
            >
              Reintentar
            </button>
          </>
        )}
      </div>
    </>
  );
}

function InboxActivity({ activity, startedAtRef, onComplete }) {
  const kind = activity.kind === 'sms' ? 'sms' : 'correo';
  const messages = Array.isArray(activity.mensajes) ? activity.mensajes : [];
  const [selectedId, setSelectedId] = useState(messages[0]?.id || '');
  const [selections, setSelections] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const selectedMessage = messages.find((message) => message.id === selectedId) || messages[0];

  const classify = (messageId, value) => {
    if (result) return;
    setSelections((current) => ({ ...current, [messageId]: value }));
  };

  const evaluate = () => {
    const total = Math.max(messages.length, 1);
    const review = messages.map((message) => {
      const picked = selections[message.id] || null;
      const correctChoice = message.correcto;
      const status = !picked ? 'missed' : picked === correctChoice ? 'correct' : 'wrong';
      return {
        id: message.id,
        label: message.subject || message.text || message.id,
        picked,
        correctChoice,
        status,
        reason:
          message.explicacion ||
          message.signal ||
          (correctChoice === 'estafa'
            ? 'Había señales de urgencia, enlace o identidad dudosa.'
            : 'No aparecían indicios claros de fraude en este ejemplo.'),
      };
    });

    const correct = review.filter((item) => item.status === 'correct').length;
    const score = correct / total;
    const missed = review.filter((item) => item.status === 'missed').map((item) => item.label);
    const mistakes = review
      .filter((item) => item.status === 'wrong')
      .map((item) => `${item.label} -> marcaste ${item.picked === 'estafa' ? 'Sospechoso' : 'Seguro'}`);

    setResult({ score, total, correct, review });
    setFeedback(
      buildFeedback({
        title: feedbackRatingLabel(score),
        score,
        signal: `Clasificaste correctamente ${correct} de ${total} mensajes.`,
        risk:
          kind === 'sms'
            ? 'Los SMS fraudulentos aprovechan urgencia, premios y enlaces acortados.'
            : 'Los correos fraudulentos intentan parecer legítimos usando remitentes o asuntos creíbles.',
        action: 'Si dudas, no respondas ni abras el enlace desde el mismo canal. Verifica por una ruta oficial.',
        detected: review.filter((item) => item.status === 'correct').map((item) => item.label),
        missed,
        extra: mistakes.length ? `Revisa estas decisiones: ${mistakes.join(' | ')}` : '',
      })
    );

    const nextFocus = review.find((item) => item.status !== 'correct');
    if (nextFocus) setSelectedId(nextFocus.id);
  };

  const selectedReview = result?.review?.find((item) => item.id === selectedMessage?.id) || null;
  const inboxTitle =
    kind === 'sms' ? 'Bandeja de mensajes' : 'Bandeja de correo';
  const inboxLead =
    kind === 'sms'
      ? 'Revisa cada mensaje como si estuvieras en tu teléfono. Marca solo lo que de verdad te haría frenar.'
      : 'Abre, revisa y clasifica cada correo como si estuvieras en una bandeja real. Busca señales concretas, no solo apariencia.';
  const isSms = kind === 'sms';
  const reviewedCount = Object.keys(selections).length;
  const selectedDisplayName = repairPossibleMojibake(
    selectedMessage?.displayName || selectedMessage?.from || 'Mensaje'
  );
  const selectedSubject = repairPossibleMojibake(
    selectedMessage?.subject || selectedMessage?.displayName || 'Mensaje'
  );
  const selectedLines = (
    selectedMessage?.body?.length ? selectedMessage.body : [selectedMessage?.text]
  )
    .filter(Boolean)
    .map((line) => repairPossibleMojibake(line));

  const getStatusLabel = (picked, resultClass) => {
    if (resultClass === 'correct') return 'Acierto';
    if (resultClass === 'wrong') return 'Error';
    if (picked === 'estafa') return 'Sospechoso';
    if (picked === 'seguro') return 'Seguro';
    return 'Sin clasificar';
  };

  const getStatusTone = (picked, resultClass) => {
    if (resultClass) return resultClass;
    if (picked === 'estafa') return 'flagged';
    if (picked === 'seguro') return 'safe';
    return 'idle';
  };

  const getAvatarLabel = (message) => {
    const source = repairPossibleMojibake(message.displayName || message.from || 'SMS');
    const parts = source
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2);
    const initials = parts.map((part) => part[0]).join('').toUpperCase();
    return initials || source.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <section className={`inbox-stage-banner ${kind === 'sms' ? 'is-sms' : 'is-mail'}`}>
        <div>
          <p className="eyebrow">{inboxTitle}</p>
          <h3>{kind === 'sms' ? 'Analiza la conversación antes de tocar el enlace' : 'Analiza remitente, cuerpo y ruta del mensaje'}</h3>
          <p>{repairPossibleMojibake(activity.intro || inboxLead)}</p>
        </div>
        <div className="inbox-stage-badges">
          <span className="activity-kicker-pill">{kind === 'sms' ? 'Teléfono' : 'Correo'}</span>
          <span className="activity-kicker-pill subtle">{messages.length} mensajes</span>
        </div>
      </section>
      <div className={isSms ? 'sms-summary-shell' : ''}>
        <ActivitySummaryBar
          items={[
            {
              label: 'Mensajes',
              value: messages.length,
              caption: kind === 'sms' ? 'Clasifica cada SMS' : 'Clasifica cada correo',
            },
            {
              label: 'Clasificados',
              value: `${reviewedCount}/${messages.length}`,
              caption: 'Puedes revisar antes de evaluar',
            },
            {
              label: 'Meta',
              value: 'Precisión',
              caption: 'No te guíes solo por la apariencia',
            },
          ]}
        />
      </div>
      <div className={`email-sim ${kind === 'sms' ? 'is-sms inbox-sim-sms' : 'inbox-sim-mail'}`}>
        {isSms ? (
          <>
            <div className="sms-app-topbar">
              <span>9:41</span>
              <span className="sms-app-signal">SMS • 4G • 87%</span>
            </div>
            <div className="sms-app-header">
              <div>
                <p className="eyebrow">Bandeja simulada</p>
                <strong>Mensajes</strong>
                <span>{messages.length} conversaciones listas para revisar</span>
              </div>
              <div className="sms-app-header-pills">
                <span className="sms-app-pill active">{reviewedCount} revisados</span>
                <span className="sms-app-pill">{messages.length - reviewedCount} pendientes</span>
              </div>
            </div>
          </>
        ) : null}
        <div className="email-sidebar">
          <div className={`email-sidebar-head ${isSms ? 'sms-sidebar-head' : ''}`.trim()}>
            <div>
              <strong>{kind === 'sms' ? 'Conversaciones' : 'Inbox principal'}</strong>
              <span>{reviewedCount} revisados</span>
            </div>
            {isSms ? <span className="sms-sidebar-chip">Bandeja móvil</span> : null}
          </div>
          {messages.map((message) => {
            const picked = selections[message.id];
            const reviewItem = result?.review?.find((item) => item.id === message.id);
            const resultClass = reviewItem ? reviewItem.status : '';
            const statusLabel = getStatusLabel(picked, resultClass);
            const toneClass = getStatusTone(picked, resultClass);
            const displayName = repairPossibleMojibake(message.displayName || message.from || 'Mensaje');
            const preview = repairPossibleMojibake(message.preview || message.text);
            const subject = repairPossibleMojibake(message.subject || message.text);
            return (
              <button
                key={message.id}
                type="button"
                className={`email-list-item ${selectedId === message.id ? 'active' : ''} ${resultClass} ${
                  isSms ? 'sms-list-item' : ''
                }`.trim()}
                onClick={() => {
                  setSelectedId(message.id);
                  setShowDetails(false);
                }}
              >
                <div className={isSms ? 'sms-thread-layout' : ''}>
                  {isSms ? (
                    <span className={`sms-thread-avatar ${toneClass}`.trim()}>{getAvatarLabel(message)}</span>
                  ) : null}
                  <div className={isSms ? 'sms-thread-main' : ''}>
                    <div className="email-list-top">
                      <span className="email-list-name">{displayName}</span>
                      <span className="email-list-date">{message.dateLabel || ''}</span>
                    </div>
                    <p className="email-list-subject">{subject}</p>
                    <p className="email-list-preview">{preview}</p>
                    <div className={isSms ? 'sms-thread-footer' : ''}>
                      {isSms ? (
                        <span className={`sms-thread-chip ${message.linkPreview ? 'has-link' : 'neutral'}`.trim()}>
                          {message.linkPreview ? 'Incluye enlace' : 'Texto directo'}
                        </span>
                      ) : null}
                      <span className={`email-list-status ${picked || 'empty'} ${resultClass} ${toneClass}`.trim()}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedMessage ? (
          <div className={`email-reader ${isSms ? 'sms-reader' : ''}`.trim()}>
            {isSms ? (
              <div className="sms-reader-topbar">
                <div className="sms-reader-contact">
                  <span className={`sms-thread-avatar large ${getStatusTone(selections[selectedMessage.id], selectedReview?.status)}`}>
                    {getAvatarLabel(selectedMessage)}
                  </span>
                  <div>
                    <strong>{selectedDisplayName}</strong>
                    <span>{selectedMessage.dateLabel || 'Hoy'} · Bandeja SMS</span>
                  </div>
                </div>
                <div className="sms-reader-status">
                  <span className="sms-reader-dot" />
                  <span>{selectedMessage.linkPreview ? 'Mensaje con enlace' : 'Mensaje simple'}</span>
                </div>
              </div>
            ) : null}
            <div className={`email-reader-head ${isSms ? 'sms-reader-head' : ''}`.trim()}>
              <div className="email-open-top">
                <div>
                  <h4 className="email-open-subject">{selectedSubject}</h4>
                  <p className="email-open-meta">
                    {`${selectedDisplayName} · ${selectedMessage.dateLabel || ''}`.trim()}
                  </p>
                </div>
                <div className={`email-open-actions ${isSms ? 'sms-open-actions' : ''}`.trim()}>
                  <button className="btn ghost compact" type="button" onClick={() => setShowDetails((current) => !current)}>
                    {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
                  </button>
                  <button
                    className="btn ghost compact"
                    type="button"
                    onClick={() => classify(selectedMessage.id, 'estafa')}
                    disabled={Boolean(result)}
                  >
                    Reportar phishing
                  </button>
                </div>
              </div>
            </div>

            <div className={`email-reader-body ${isSms ? 'sms-reader-body' : ''}`.trim()}>
              {selectedMessage.warning ? (
                <div className={`email-warning ${isSms ? 'sms-warning-card' : ''}`.trim()}>
                  {repairPossibleMojibake(selectedMessage.warning)}
                </div>
              ) : null}
              {showDetails ? (
                <div className={`email-details ${isSms ? 'sms-details-card' : ''}`.trim()}>
                  <p>
                    <strong>From:</strong>{' '}
                    {repairPossibleMojibake(selectedMessage.details?.from || selectedMessage.from || 'Sin dato')}
                  </p>
                  {selectedMessage.details?.replyTo ? (
                    <p>
                      <strong>Reply-To:</strong> {repairPossibleMojibake(selectedMessage.details.replyTo)}
                    </p>
                  ) : null}
                  {selectedMessage.details?.returnPath ? (
                    <p>
                      <strong>Return-Path:</strong> {repairPossibleMojibake(selectedMessage.details.returnPath)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className={`email-body-card ${isSms ? 'sms-body-card' : ''}`.trim()}>
                <p className="email-body-from">
                  {isSms
                    ? `SMS de ${selectedDisplayName}`
                    : `${repairPossibleMojibake(selectedMessage.displayName || 'Mensaje')} <${repairPossibleMojibake(selectedMessage.from || '')}>`}
                </p>
                <div className={isSms ? 'sms-message-stack' : ''}>
                  {selectedLines.map((line) => (
                    <p className={`email-body-line ${isSms ? 'sms-message-bubble' : ''}`.trim()} key={`${selectedMessage.id}-${line}`}>
                      {line}
                    </p>
                  ))}
                </div>
                {selectedMessage.attachments?.length ? (
                  <div className="email-attachments">
                    {selectedMessage.attachments.map((item) => (
                      <span className="email-attachment" key={item}>
                        {repairPossibleMojibake(item)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selectedMessage.linkPreview ? (
                  <div className={`email-link-preview ${isSms ? 'sms-link-preview' : ''}`.trim()}>
                    <span className="sms-link-label">Enlace detectado</span>
                    <strong>{repairPossibleMojibake(selectedMessage.linkPreview)}</strong>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`email-reader-footer ${isSms ? 'sms-reader-footer' : ''}`.trim()}>
              <p className="email-classify-title">
                {kind === 'correo' ? '¿Cómo clasificarías este correo?' : '¿Cómo clasificarías este mensaje?'}
              </p>
              <div className={`email-classify-actions ${isSms ? 'sms-classify-actions' : ''}`.trim()}>
                {['seguro', 'estafa'].map((choice) => (
                  <button
                    key={choice}
                    className={`btn ${
                      selections[selectedMessage.id] === choice ? 'primary' : 'ghost'
                    } compact`}
                    type="button"
                    onClick={() => classify(selectedMessage.id, choice)}
                    disabled={Boolean(result)}
                  >
                    {choice === 'seguro' ? 'Seguro' : 'Sospechoso'}
                  </button>
                ))}
              </div>
              {selectedReview ? (
                <div className={`message-review-card ${selectedReview.status} ${isSms ? 'sms-review-card' : ''}`.trim()}>
                  <div className="message-review-top">
                    <strong>
                      {selectedReview.status === 'correct'
                        ? 'Bien clasificado'
                        : selectedReview.status === 'wrong'
                          ? 'Hay que corregir esta decisión'
                          : 'Faltó clasificar este mensaje'}
                    </strong>
                    <span>{`Correcto: ${selectedReview.correctChoice === 'estafa' ? 'Sospechoso' : 'Seguro'}`}</span>
                  </div>
                  <p>
                    {selectedReview.picked
                      ? `Tú elegiste: ${selectedReview.picked === 'estafa' ? 'Sospechoso' : 'Seguro'}.`
                      : 'No lo clasificaste antes de evaluar.'}
                  </p>
                  <p>{selectedReview.reason}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <FeedbackPanel feedback={feedback} />
      {result ? (
        <div className="review-grid">
          {result.review.map((item) => (
            <article className={`review-card ${item.status}`.trim()} key={item.id}>
              <div className="review-card-head">
                <strong>{item.label}</strong>
                <span>
                  {item.status === 'correct'
                    ? 'Correcto'
                    : item.status === 'wrong'
                      ? 'Revisar'
                      : 'Pendiente'}
                </span>
              </div>
              <p>{item.reason}</p>
              <p className="review-card-meta">
                {item.picked
                  ? `Marcaste ${item.picked === 'estafa' ? 'Sospechoso' : 'Seguro'}`
                  : 'Sin clasificar'}{' '}
                · {`Respuesta esperada: ${item.correctChoice === 'estafa' ? 'Sospechoso' : 'Seguro'}`}
              </p>
            </article>
          ))}
        </div>
      ) : null}
      <div className="activity-actions">
        {!result ? (
          <button className="btn primary" type="button" onClick={evaluate}>
            Evaluar clasificación
          </button>
        ) : (
          <>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                completePayload(startedAtRef, onComplete, result.score, feedbackToText(feedback), {
                  selections,
                  review: result.review,
                })
              }
            >
              Continuar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setResult(null);
                setFeedback(null);
                setSelections({});
                setSelectedId(messages[0]?.id || '');
                setShowDetails(false);
              }}
            >
              Reintentar clasificación
            </button>
          </>
        )}
      </div>
    </>
  );
}

function sanitizeDeep(value) {
  if (typeof value === 'string') return repairPossibleMojibake(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeDeep(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeDeep(entry)])
    );
  }
  return value;
}

function moduleThemeMeta(module) {
  const category = String(module?.categoria || module?.category || 'habitos');
  const level = String(module?.nivel || module?.level || 'basico');

  const byCategory = {
    whatsapp: {
      eyebrow: 'Simulación conversacional',
      blurb: 'Entrena respuestas firmes frente a suplantación, cobros urgentes y enlaces sospechosos dentro de un chat que se siente real.',
      badge: 'WhatsApp',
    },
    sms: {
      eyebrow: 'Bandeja móvil',
      blurb: 'Lee SMS como lo harías en tu teléfono: detecta premios falsos, bloqueos, cobros y enlaces que quieren apurarte.',
      badge: 'SMS',
    },
    correo_redes: {
      eyebrow: 'Inbox y phishing',
      blurb: 'Analiza remitentes, asuntos, adjuntos y enlaces como si revisaras una bandeja real de correo o notificaciones sociales.',
      badge: 'Correo / Redes',
    },
    llamadas: {
      eyebrow: 'Vishing y voz',
      blurb: 'Practica llamadas convincentes donde lo importante es cortar el canal, no seguirle el juego al supuesto agente.',
      badge: 'Llamadas',
    },
    habitos: {
      eyebrow: 'Rutina de verificación',
      blurb: 'Convierte decisiones seguras en una rutina corta, repetible y útil aunque el fraude cambie de canal o de tono.',
      badge: 'Hábitos',
    },
  };

  const byLevel = {
    basico: { label: 'Básico', brief: 'Señales claras y decisiones directas.' },
    refuerzo: { label: 'Refuerzo', brief: 'Casos mixtos con más ambigüedad.' },
    avanzado: { label: 'Avanzado', brief: 'Escenarios finos con pocas pistas visibles.' },
  };

  return {
    category,
    level,
    ...(byCategory[category] || byCategory.habitos),
    ...(byLevel[level] || byLevel.basico),
  };
}

function WebLabActivity({ activity, startedAtRef, onComplete }) {
  const page = useMemo(() => {
    const source = activity.pagina && typeof activity.pagina === 'object' ? activity.pagina : {};
    return {
      ...source,
      marca: repairPossibleMojibake(source.marca || ''),
      brandMark: repairPossibleMojibake(source.brandMark || ''),
      dominio: repairPossibleMojibake(source.dominio || ''),
      browserTitle: repairPossibleMojibake(source.browserTitle || ''),
      themeVariant: repairPossibleMojibake(source.themeVariant || ''),
      layoutVariant: repairPossibleMojibake(source.layoutVariant || ''),
      guideMode: repairPossibleMojibake(source.guideMode || ''),
      headerTagline: repairPossibleMojibake(source.headerTagline || ''),
      heroTitle: repairPossibleMojibake(source.heroTitle || ''),
      heroBody: repairPossibleMojibake(source.heroBody || ''),
      sealLabel: repairPossibleMojibake(source.sealLabel || ''),
      banner: repairPossibleMojibake(source.banner || ''),
      sub: repairPossibleMojibake(source.sub || ''),
      contacto: repairPossibleMojibake(source.contacto || ''),
      shipping: repairPossibleMojibake(source.shipping || ''),
      reviews: repairPossibleMojibake(source.reviews || ''),
      reviewsLabel: repairPossibleMojibake(source.reviewsLabel || ''),
      policy: repairPossibleMojibake(source.policy || ''),
      cartHeadline: repairPossibleMojibake(source.cartHeadline || ''),
      cartNote: repairPossibleMojibake(source.cartNote || ''),
      checkoutHeadline: repairPossibleMojibake(source.checkoutHeadline || ''),
      checkoutPrompt: repairPossibleMojibake(source.checkoutPrompt || ''),
      pagos: Array.isArray(source.pagos) ? source.pagos.map((item) => repairPossibleMojibake(item)) : [],
      liveToasts: Array.isArray(source.liveToasts)
        ? source.liveToasts.map((item) => repairPossibleMojibake(item)).filter(Boolean)
        : [],
      productos: Array.isArray(source.productos)
        ? source.productos.map((product) => ({
            ...product,
            nombre: repairPossibleMojibake(product?.nombre || ''),
            antes: repairPossibleMojibake(product?.antes || ''),
            precio: repairPossibleMojibake(product?.precio || ''),
            badge: repairPossibleMojibake(product?.badge || ''),
            caption: repairPossibleMojibake(product?.caption || ''),
          }))
        : [],
    };
  }, [activity.pagina]);
  const hotspots = useMemo(
    () =>
      Array.isArray(activity.hotspots)
        ? activity.hotspots.map((hotspot) => ({
            ...hotspot,
            label: repairPossibleMojibake(hotspot?.label || ''),
            explicacion: repairPossibleMojibake(hotspot?.explicacion || ''),
          }))
        : [],
    [activity.hotspots]
  );
  const decisionPrompt = repairPossibleMojibake(activity.decisionPrompt || '');
  const decisionOptions = useMemo(
    () =>
      Array.isArray(activity.decisionOptions)
        ? activity.decisionOptions.map((option) => repairPossibleMojibake(option))
        : [],
    [activity.decisionOptions]
  );
  const products = Array.isArray(page.productos) ? page.productos : [];
  const themeVariant = page.themeVariant || 'flash';
  const layoutVariant = page.layoutVariant || 'classic';
  const guideMode = page.guideMode || 'coached';
  const hotspotMap = useMemo(() => new Map(hotspots.map((hotspot) => [hotspot.target, hotspot])), [hotspots]);
  const correctHotspots = useMemo(() => hotspots.filter((hotspot) => hotspot.correcta), [hotspots]);
  const goalCount = Math.max(1, correctHotspots.length);
  const buildGuideHint = (mode, flaggedCount = 0) => {
    if (mode === 'minimal') {
      return {
        kind: 'info',
        title: flaggedCount ? 'Lectura fina' : 'Exploración libre',
        text: flaggedCount
          ? `Marcas registradas: ${flaggedCount} de ${goalCount}. Quédate solo con lo que realmente te haría frenar la compra.`
          : 'Recorre producto, carrito y checkout. Marca solo las señales que realmente cambiarían tu decisión final.',
      };
    }
    if (mode === 'light') {
      return {
        kind: 'info',
        title: flaggedCount ? 'Sigue contrastando' : 'Explora la tienda',
        text: flaggedCount
          ? `Hallazgos marcados: ${flaggedCount} de ${goalCount}. Revisa soporte, políticas y pago antes de decidir.`
          : 'Sigue el flujo completo y marca únicamente lo que sí comprometería una compra real.',
      };
    }
    return {
      kind: 'info',
      title: flaggedCount ? 'Sigue explorando' : 'Modo exploración',
      text: flaggedCount
        ? `Hallazgos encontrados: ${flaggedCount} de ${goalCount}. Recorre producto, carrito y checkout antes de decidir.`
        : 'Encuentra las señales sospechosas integradas en la tienda antes de decidir si comprarías aquí.',
    };
  };
  const missionText =
    guideMode === 'minimal'
      ? `Explora la tienda y marca las ${goalCount} señales que realmente te harían detener la compra.`
      : guideMode === 'light'
        ? `Marca al menos ${goalCount} señales que sí cambiarían tu decisión antes de pagar.`
        : `Encuentra al menos ${goalCount} señales sospechosas antes de decidir si comprarías aquí.`;
  const [stage, setStage] = useState('product');
  const [flagged, setFlagged] = useState(() => new Set());
  const [neutralTargets, setNeutralTargets] = useState(() => new Set());
  const [decision, setDecision] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [countdown, setCountdown] = useState(754);
  const [hint, setHint] = useState(() => buildGuideHint(guideMode, 0));
  const [toastIndex, setToastIndex] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [inspectedTarget, setInspectedTarget] = useState('');
  const [inspectedNote, setInspectedNote] = useState({ kind: 'info', text: '' });
  const hintTimeoutRef = useRef(null);
  const browserUrl = page.dominio || 'cyberzone-ofertas.shop';
  const browserTitle = page.browserTitle || `${page.marca || 'Cyber Zone MX'} | Oferta especial`;
  const searchPlaceholder =
    themeVariant === 'neon'
      ? 'Buscar cámaras, audio y setups...'
      : themeVariant === 'street'
        ? 'Buscar drops, smartphones y audio...'
        : themeVariant === 'premium'
          ? 'Buscar hogar, audio y selección curada...'
          : themeVariant === 'sage'
            ? 'Buscar escritorio, audio y objetos studio...'
            : 'Buscar productos, marcas y categorías...';
  const liveToasts = useMemo(
    () =>
      page.liveToasts.length
        ? page.liveToasts
        : [
            'Laura de Guadalajara acaba de comprar una Tablet Mini.',
            'Carlos de Monterrey agregó una Laptop Air 14 al carrito.',
            'Sofía de CDMX está pagando con descuento relámpago.',
            'Miguel de Puebla apartó Audífonos Pro hace 1 min.',
          ],
    [page.liveToasts]
  );
  const targetLabels = useMemo(() => {
    const labels = {
      domain: 'Dominio visible',
      banner: 'Banner principal',
      reviews: 'Reseñas del sitio',
      shipping: 'Envío asegurado',
      contacto: 'Módulo de contacto',
      pago: 'Métodos de pago',
      policy: 'Políticas y devoluciones',
      search: 'Barra de búsqueda',
      cart_icon: 'Icono del carrito',
      order_summary: 'Resumen de compra',
      address_form: 'Formulario de envío',
    };
    products.forEach((product, index) => {
      labels[`product_${index}`] = product.nombre || `Producto ${index + 1}`;
    });
    return labels;
  }, [products]);
  const detectedSummary = (() => {
    if (!flagged.size) {
      return guideMode === 'coached'
        ? 'Todavía no has marcado ninguna alerta.'
        : guideMode === 'light'
          ? 'Aún no registras hallazgos. Revisa producto, carrito y checkout.'
          : 'Aún no registras marcas. Quédate solo con señales decisivas.';
    }
    const labels = Array.from(flagged)
      .map((target) => hotspotMap.get(target)?.label || target)
      .join(' · ');
    if (guideMode === 'coached') return labels;
    if (guideMode === 'light') return `${flagged.size} hallazgos registrados. Ajusta tu criterio antes de evaluar.`;
    return `${flagged.size} marcas registradas. Evita sobredetectar: busca solo señales decisivas.`;
  })();

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    const toastId = window.setInterval(() => {
      setToastIndex((current) => (current + 1) % liveToasts.length);
    }, 4200);
    return () => {
      window.clearInterval(timerId);
      window.clearInterval(toastId);
      if (hintTimeoutRef.current) window.clearTimeout(hintTimeoutRef.current);
    };
  }, [liveToasts.length]);

  const formatCountdown = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = String(Math.floor(safe / 60)).padStart(2, '0');
    const secs = String(safe % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const targetState = (target) => {
    if (flagged.has(target)) return 'is-risk';
    if (neutralTargets.has(target)) return 'is-neutral';
    return '';
  };

  const setTransientHint = (nextHint, flaggedCount = flagged.size) => {
    setHint(nextHint);
    if (hintTimeoutRef.current) window.clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = window.setTimeout(() => {
      setHint(buildGuideHint(guideMode, flaggedCount));
    }, 2400);
  };

  const setInlineNote = (target, note) => {
    setInspectedTarget(target);
    setInspectedNote(note);
  };

  const renderInlineNote = (target) =>
    inspectedTarget === target && inspectedNote.text ? (
      <span className={`fraud-click-note ${inspectedNote.kind}`.trim()}>{inspectedNote.text}</span>
    ) : null;

  const registerClick = (target, neutralMessage = 'Esto no es una señal clara de fraude.') => {
    if (result) return;
    const hotspot = hotspotMap.get(target);
    const label = hotspot?.label || targetLabels[target] || target;

    if (hotspot?.correcta) {
      setFlagged((current) => {
        const next = new Set(current);
        if (next.has(target)) next.delete(target);
        else next.add(target);
        const nextCount = next.size;
        const nextText = hotspot.explicacion || `${label}: aquí hay una alerta importante.`;
        setInlineNote(target, {
          kind: 'risk',
          text: nextText,
        });
        setTransientHint(
          {
            kind: 'risk',
            title: 'Señal de riesgo detectada',
            text: nextText,
          },
          nextCount
        );
        return next;
      });
      setNeutralTargets((current) => {
        const next = new Set(current);
        next.delete(target);
        return next;
      });
      return;
    }

    setNeutralTargets((current) => {
      const next = new Set(current);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
    setInlineNote(target, {
      kind: 'neutral',
      text: hotspot?.explicacion || neutralMessage,
    });
    setTransientHint({
      kind: 'neutral',
      title: 'Sigue investigando',
      text: hotspot?.explicacion || neutralMessage,
    });
  };

  const addToCart = (product) => {
    setCartItems((current) => [...current, { ...product, cartId: `${product.nombre}-${current.length}` }]);
    setInspectedTarget('');
    setInspectedNote({ kind: 'info', text: '' });
    setStage('cart');
    setTransientHint({
      kind: 'success',
      title: 'Producto agregado',
      text: `${product.nombre} entró al carrito. Ahora revisa si la tienda mantiene un flujo confiable.`,
    });
  };

  const goToCheckout = () => {
    setCheckoutBusy(true);
    window.setTimeout(() => {
      setCheckoutBusy(false);
      setInspectedTarget('');
      setInspectedNote({ kind: 'info', text: '' });
      setStage('checkout');
      setTransientHint({
        kind: 'info',
        title: 'Llegaste al checkout',
        text: 'Aquí suelen aparecer las señales más delicadas: pagos inseguros, políticas ambiguas y presión para pagar.',
      });
    }, 600);
  };

  const calculateScore = () => {
    const correctTargets = correctHotspots.map((hotspot) => hotspot.target);
    const matchedCount = correctTargets.filter((target) => flagged.has(target)).length;
    const recall = matchedCount / Math.max(correctTargets.length, 1);
    const precision = matchedCount / Math.max(matchedCount + neutralTargets.size, 1);
    const hotspotScore =
      recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision);
    const decisionScore =
      Number.isFinite(Number(activity.correctDecision)) && decisionOptions.length
        ? decision === activity.correctDecision
          ? 1
          : decision === null
            ? 0
            : 0.25
        : 1;
    return Math.max(0, Math.min(1, hotspotScore * 0.75 + decisionScore * 0.25));
  };

  const evaluate = () => {
    const matchedHotspots = correctHotspots.filter((hotspot) => flagged.has(hotspot.target));
    const missed = correctHotspots
      .filter((hotspot) => !flagged.has(hotspot.target))
      .map((hotspot) => hotspot.label);
    const wrong = Array.from(neutralTargets).map(
      (target) => targetLabels[target] || hotspotMap.get(target)?.label || target
    );
    const score = calculateScore();
    const decisionLabel =
      Number.isFinite(Number(decision)) && decisionOptions[decision]
        ? decisionOptions[decision]
        : 'Sin decisión final';

    setResult({
      score,
      matched: matchedHotspots,
      missed,
      wrong,
      decisionLabel,
      expectedCount: correctHotspots.length,
    });
    setFeedback(
      buildFeedback({
        title: feedbackRatingLabel(score),
        score,
        signal: `Detectaste ${matchedHotspots.length} de ${correctHotspots.length} señales importantes dentro de la tienda.`,
        risk: 'El riesgo aparece cuando el sitio combina urgencia, pagos inseguros, contacto ambiguo y políticas que te dejan sin respaldo.',
        action: 'Antes de pagar, valida el dominio, la empresa, las políticas y el método de pago por fuera del propio sitio.',
        detected: matchedHotspots.map((hotspot) => hotspot.label),
        missed: missed.slice(0, 5),
        extra: wrong.length
          ? `También marcaste elementos que no eran señal clara: ${wrong.join(' | ')}. Decisión final: ${decisionLabel}.`
          : `Decisión final: ${decisionLabel}.`,
      })
    );
  };

  const renderStage = () => {
    const featuredProduct = products[0] || null;
    const secondaryProducts = (layoutVariant === 'editorial' || layoutVariant === 'minimal')
      ? products.slice(1)
      : products;
    const renderProductCard = (product, index, featured = false) => (
      <article
        className={`fraud-product-card ${featured ? 'featured' : ''} ${targetState(`product_${index}`)}`.trim()}
        key={`${product.nombre}-${index}`}
      >
        <button
          className="fraud-product-media"
          type="button"
          onClick={() =>
            registerClick(
              `product_${index}`,
              'El producto por sí solo no confirma fraude. Lo importante es revisar pagos, dominio, urgencia y políticas.'
            )
          }
        >
          <span>{(product.nombre || 'P').slice(0, 1)}</span>
        </button>
        <div className="fraud-product-copy">
          <div className="fraud-product-top">
            <strong>{product.nombre || 'Producto'}</strong>
            <span className="fraud-discount-badge">{product.badge || '87% OFF'}</span>
          </div>
          <p className="fraud-product-pricing">
            {product.antes ? <span>{product.antes}</span> : null}
            <strong>{product.precio || '$0'}</strong>
          </p>
          <div className="fraud-product-notes">
            {product.caption ? <span>{product.caption}</span> : null}
            <span>{themeVariant === 'premium' || themeVariant === 'sage' ? 'Entrega curada' : 'Envío express'}</span>
            <span>{themeVariant === 'street' ? 'Drop limitado' : 'Compra protegida'}</span>
          </div>
          {renderInlineNote(`product_${index}`)}
        </div>
        <button className="fraud-primary-btn" type="button" onClick={() => addToCart(product)}>
          {featured ? 'Agregar selección principal' : 'Agregar al carrito'}
        </button>
      </article>
    );
    const reviewsPanel = (
      <section className="fraud-store-reviews-shell">
        <div className="fraud-store-section-head">
          <h4>{page.reviewsLabel || 'Lo que dicen nuestros clientes'}</h4>
          <span>4.9 / 5</span>
        </div>
        <button
          className={`fraud-store-review-strip ${targetState('reviews')}`.trim()}
          type="button"
          onClick={() => registerClick('reviews', 'Las reseñas pueden ser útiles, pero no siempre una tira de testimonios es prueba suficiente.')}
        >
          <strong>★★★★★</strong>
          <span>{page.reviews || 'Testimonios muy positivos y poco verificables.'}</span>
          {renderInlineNote('reviews')}
        </button>
      </section>
    );
    const utilityCards = (
      <section className={`fraud-store-utility-grid ${layoutVariant === 'minimal' ? 'compact' : ''}`.trim()}>
        <button
          className={`fraud-utility-card ${targetState('contacto')}`.trim()}
          type="button"
          onClick={() =>
            registerClick(
              'contacto',
              'Un módulo de atención no es suficiente si no muestra empresa, razón social o domicilio verificable.'
            )
          }
        >
          <span className="fraud-utility-label">Soporte del vendedor</span>
          <strong>{page.contacto || 'Atención rápida por chat y formulario'}</strong>
          {renderInlineNote('contacto')}
        </button>
        <button
          className={`fraud-utility-card ${targetState('shipping')}`.trim()}
          type="button"
          onClick={() =>
            registerClick(
              'shipping',
              'El envío puede ser normal, pero aquí se presenta con una promesa ambigua y sin respaldo claro.'
            )
          }
        >
          <span className="fraud-utility-label">Entrega y protección</span>
          <strong>{page.shipping || 'Entrega asegurada con costo adicional'}</strong>
          {renderInlineNote('shipping')}
        </button>
        <button
          className={`fraud-utility-card ${targetState('policy')}`.trim()}
          type="button"
          onClick={() =>
            registerClick(
              'policy',
              'Las políticas ambiguas son una señal muy importante cuando compras en una tienda nueva.'
            )
          }
        >
          <span className="fraud-utility-label">Cambios y devoluciones</span>
          <strong>{page.policy || 'Devoluciones sujetas a validación interna'}</strong>
          {renderInlineNote('policy')}
        </button>
      </section>
    );

    if (stage === 'product') {
      return (
        <>
          <section className={`fraud-store-hero ${layoutVariant}`.trim()}>
            <div className="fraud-store-sale-copy">
              <span className="fraud-store-sale-chip">{page.sealLabel || page.banner || 'Liquidación total hoy'}</span>
              <h3>{page.heroTitle || (page.marca ? `${page.marca} remata tecnología y hogar` : 'Hasta 85% de descuento hoy')}</h3>
              <p>
                {page.heroBody ||
                  page.sub ||
                  'Aprovecha precios muy bajos en tecnología, hogar y accesorios antes de que termine la oferta.'}
              </p>
            </div>
            <button
              className={`fraud-store-countdown ${targetState('banner')}`.trim()}
              type="button"
              onClick={() => registerClick('banner', 'La cuenta regresiva por sí sola no basta: revisa si además mete presión para actuar hoy.')}
            >
              <span>Termina en</span>
              <strong>{formatCountdown(countdown)}</strong>
              <small>Presión artificial para cerrar la compra rápido</small>
              {renderInlineNote('banner')}
            </button>
          </section>
          {layoutVariant === 'editorial' ? (
            <section className="fraud-editorial-layout">
              <div className="fraud-editorial-main">
                {featuredProduct ? renderProductCard(featuredProduct, 0, true) : null}
                {secondaryProducts.length ? (
                  <section className="fraud-store-product-grid editorial-secondary">
                    {secondaryProducts.map((product, offset) => renderProductCard(product, offset + 1))}
                  </section>
                ) : null}
              </div>
              <aside className="fraud-editorial-side">
                {utilityCards}
                {reviewsPanel}
              </aside>
            </section>
          ) : layoutVariant === 'minimal' ? (
            <section className="fraud-minimal-layout">
              {featuredProduct ? renderProductCard(featuredProduct, 0, true) : null}
              {utilityCards}
              {secondaryProducts.length ? (
                <section className="fraud-store-product-grid minimal-secondary">
                  {secondaryProducts.map((product, offset) => renderProductCard(product, offset + 1))}
                </section>
              ) : null}
              {reviewsPanel}
            </section>
          ) : (
            <>
              {utilityCards}
              <section className="fraud-store-product-grid">
                {products.map((product, index) => renderProductCard(product, index))}
              </section>
              {reviewsPanel}
            </>
          )}
        </>
      );
    }

    if (stage === 'cart') {
      const items = cartItems.length ? cartItems : products.slice(0, 1);
      return (
        <>
          <section className="fraud-cart-banner">
            <div>
              <span className="fraud-store-sale-chip subtle">Carrito reservado</span>
              <h4>{page.cartHeadline || 'Tus artículos siguen apartados por tiempo limitado'}</h4>
              <p>{page.cartNote || 'Si sales del checkout, la oferta se recalcula automáticamente.'}</p>
            </div>
            <button
              className={`fraud-store-reserve ${targetState('banner')}`.trim()}
              type="button"
              onClick={() => registerClick('banner', 'La reserva temporal del carrito es normal a veces, pero aquí está diseñada para apurarte.')}
            >
              <span>Tu carrito expira en</span>
              <strong>{formatCountdown(Math.max(0, countdown - 61))}</strong>
              {renderInlineNote('banner')}
            </button>
          </section>

          <div className={`fraud-cart-layout ${layoutVariant}`.trim()}>
            <div className="fraud-cart-list">
              {items.map((item, index) => (
                <article className="fraud-cart-item" key={item.cartId || `${item.nombre}-${index}`}>
                  <div className="fraud-cart-thumb">{(item.nombre || 'P').slice(0, 1)}</div>
                  <div className="fraud-cart-copy">
                    <strong>{item.nombre || 'Producto'}</strong>
                    <span>{item.precio || '$0'}</span>
                  </div>
                  <span className="fraud-cart-qty">1x</span>
                </article>
              ))}
            </div>

            <aside className="fraud-cart-summary">
              <button
                className={`fraud-signal-card ${targetState('shipping')}`.trim()}
                type="button"
                onClick={() => registerClick('shipping', 'Este cargo extra no siempre es una estafa, pero aquí el texto es ambiguo y obligatorio.')}
              >
                <span>Envío asegurado obligatorio</span>
                <strong>{page.shipping || 'Costo extra aplicado para garantizar la entrega.'}</strong>
                {renderInlineNote('shipping')}
              </button>
              <div className="fraud-summary-total">
                <span>Total</span>
                <strong>{items[0]?.precio || '$3,499'}</strong>
              </div>
                <button className="fraud-primary-btn wide" type="button" onClick={goToCheckout} disabled={checkoutBusy}>
                  {checkoutBusy ? 'Preparando checkout...' : 'Ir al checkout'}
                </button>
              </aside>
            </div>
        </>
      );
    }

    return (
      <>
        <div className={`fraud-checkout-layout ${layoutVariant}`.trim()}>
          <section className="fraud-checkout-main">
            <div className="fraud-store-section-head">
                <h4>{page.checkoutHeadline || 'Datos de envío'}</h4>
              <span>Paso 2 de 2</span>
            </div>
            <div className="fraud-form-grid">
              <button
                className={`fraud-form-field ${targetState('address_form')}`.trim()}
                type="button"
                onClick={() => registerClick('address_form', 'Pedir datos de envío es normal; aquí no está la señal principal.')}
              >
                Nombre completo
              </button>
              <button
                className={`fraud-form-field ${targetState('address_form')}`.trim()}
                type="button"
                onClick={() => registerClick('address_form', 'Este bloque es parte normal del checkout. Sigue buscando señales en pagos y políticas.')}
              >
                Dirección de entrega
              </button>
              <button
                className={`fraud-form-field ${targetState('address_form')}`.trim()}
                type="button"
                onClick={() => registerClick('address_form', 'Los datos de envío no son por sí solos una señal de fraude.')}
              >
                Telefono de contacto
              </button>
              <button
                className={`fraud-form-field ${targetState('address_form')}`.trim()}
                type="button"
                onClick={() => registerClick('address_form', 'Este campo no es una señal clara. Revisa mejor los módulos laterales.')}
              >
                Referencias
              </button>
            </div>

            <button
              className={`fraud-signal-card urgent ${targetState('banner')}`.trim()}
              type="button"
              onClick={() => registerClick('banner', 'Aquí la urgencia está integrada en el flujo final de pago para presionarte.')}
            >
              <span>Paga hoy para mantener el descuento</span>
              <strong>{page.checkoutPrompt || 'Para mantener el descuento, termina el pago hoy.'}</strong>
              {renderInlineNote('banner')}
            </button>
          </section>

          <aside className="fraud-checkout-side">
            <button
              className={`fraud-signal-card ${targetState('pago')}`.trim()}
              type="button"
              onClick={() => registerClick('pago', 'Los métodos ofrecidos te sacan de formas de pago más protegidas.')}
            >
              <span>Métodos de pago</span>
              <strong>{Array.isArray(page.pagos) ? page.pagos.join(' · ') : 'Transferencia bancaria · Pago por enlace externo'}</strong>
              {renderInlineNote('pago')}
            </button>

            <button
              className={`fraud-signal-card ${targetState('contacto')}`.trim()}
              type="button"
              onClick={() => registerClick('contacto', 'No muestra empresa, dirección ni un canal de atención confiable.')}
            >
              <span>Atención al cliente</span>
              <strong>{page.contacto || 'Atención solo por formulario. Sin razón social visible.'}</strong>
              {renderInlineNote('contacto')}
            </button>

            <button
              className={`fraud-signal-card ${targetState('policy')}`.trim()}
              type="button"
              onClick={() => registerClick('policy', 'La política no deja claro cómo devolver, reclamar o recuperar el dinero.')}
            >
              <span>Devoluciones y políticas</span>
              <strong>{page.policy || 'Devoluciones sujetas a aprobación interna.'}</strong>
              {renderInlineNote('policy')}
            </button>

            <div className="fraud-order-box">
              <div className="fraud-store-section-head tight">
                <h4>Resumen de compra</h4>
                <span>{cartItems.length || 1} item</span>
              </div>
              <button
                className={`fraud-order-line ${targetState('order_summary')}`.trim()}
                type="button"
                onClick={() => registerClick('order_summary', 'El resumen por sí solo no es una señal clara; la alerta está en pagos, urgencia y políticas.')}
              >
                <span>Subtotal</span>
                <strong>{cartItems[0]?.precio || products[0]?.precio || '$3,499'}</strong>
                {renderInlineNote('order_summary')}
              </button>
              <button
                className={`fraud-order-line ${targetState('shipping')}`.trim()}
                type="button"
                onClick={() => registerClick('shipping', 'Aquí el costo extra y el discurso de protección están integrados para presionar la compra.')}
              >
                <span>Envío asegurado</span>
                <strong>$249</strong>
                {renderInlineNote('shipping')}
              </button>
              <div className="fraud-order-total">
                <span>Total hoy</span>
                <strong>{cartItems[0]?.precio || products[0]?.precio || '$3,499'}</strong>
              </div>
            </div>
          </aside>
        </div>

        {decisionPrompt && decisionOptions.length ? (
          <div className="fraud-decision-panel">
            <div className="fraud-store-section-head">
              <h4>{decisionPrompt}</h4>
              <span>Decisión final</span>
            </div>
            <div className="fraud-decision-options">
              {decisionOptions.map((option, index) => (
                <button
                  key={option}
                  className={`fraud-decision-btn ${decision === index ? 'active' : ''}`.trim()}
                  type="button"
                  onClick={() => setDecision(index)}
                  disabled={Boolean(result)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <>
      <section className="web-lab-mission">
        <div>
          <p className="eyebrow">Objetivo de la simulación</p>
          <h3>{missionText}</h3>
        </div>
        <div className={`web-lab-progress-card ${flagged.size >= goalCount ? 'is-complete' : ''}`.trim()}>
          <span>{`Hallazgos encontrados: ${flagged.size} / ${goalCount}`}</span>
          <div className="web-lab-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.round((flagged.size / goalCount) * 100)}%` }} />
          </div>
        </div>
      </section>

      <section className={`web-lab-immersive theme-${themeVariant} layout-${layoutVariant} guide-${guideMode}`.trim()}>
        <div className={`web-lab-hint ${hint.kind}`.trim()}>
          <strong>{hint.title}</strong>
          <p>{hint.text}</p>
        </div>

        <div className="web-lab-browser-bar">
          <div className="web-lab-browser-meta">
            <div className="web-lab-browser-tabs">
              <span />
              <span />
              <span />
            </div>
            <strong>{browserTitle}</strong>
          </div>
          <button
            className={`web-lab-domain ${targetState('domain')}`.trim()}
            type="button"
            onClick={() => registerClick('domain', 'El dominio visible es uno de los primeros puntos que conviene revisar.')}
          >
            {browserUrl}
            {renderInlineNote('domain')}
          </button>
        </div>

        <div className={`fraud-store-shell theme-${themeVariant} layout-${layoutVariant} guide-${guideMode}`.trim()}>
          <header className="fraud-store-header">
            <div className="fraud-store-logo">
              <span>{page.brandMark || (page.marca || 'CZ').slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{page.marca || 'CYBER ZONE MX'}</strong>
                <small>{page.headerTagline || 'Ofertas exclusivas del día'}</small>
              </div>
            </div>

            <button
              className={`fraud-store-search ${targetState('search')}`.trim()}
              type="button"
              onClick={() => registerClick('search', 'La barra de búsqueda no es una señal de fraude por sí sola.')}
            >
              {searchPlaceholder}
            </button>

            <button
              className={`fraud-store-cart ${targetState('cart_icon')}`.trim()}
              type="button"
              onClick={() => {
                setInspectedTarget('');
                setInspectedNote({ kind: 'info', text: '' });
                setStage('cart');
                registerClick('cart_icon', 'El carrito es parte normal de una tienda. La alerta está en lo que pasa dentro del flujo de compra.');
              }}
            >
              <span>Carrito</span>
              <strong>{cartItems.length}</strong>
            </button>
          </header>

          <div className="fraud-live-toast">{liveToasts[toastIndex % liveToasts.length]}</div>

          <nav className="fraud-store-tabs">
            {[
              ['product', 'Producto'],
              ['cart', 'Carrito'],
              ['checkout', 'Checkout'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`fraud-store-tab ${stage === value ? 'active' : ''}`.trim()}
                type="button"
                onClick={() => {
                  setInspectedTarget('');
                  setInspectedNote({ kind: 'info', text: '' });
                  setStage(value);
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="fraud-store-stage">{renderStage()}</div>
        </div>

        <div className="web-lab-detective-bar">
          <div className="web-lab-detective-copy">
            <strong>Señales detectadas</strong>
            <p>{detectedSummary}</p>
          </div>
          <div className="web-lab-detective-count">{`${flagged.size}/${goalCount}`}</div>
        </div>
      </section>

      <FeedbackPanel feedback={feedback} />
      {result ? (
        <div className="review-grid">
          <article className="review-card correct">
            <div className="review-card-head">
              <strong>Detectaste bien</strong>
              <span>{`${result.matched.length}/${result.expectedCount}`}</span>
            </div>
            <p>
              {result.matched.length
                ? result.matched.map((hotspot) => hotspot.label).join(' | ')
                : 'No detectaste las señales clave esperadas en este sitio.'}
            </p>
          </article>
          <article className={`review-card ${result.missed.length ? 'wrong' : 'correct'}`.trim()}>
            <div className="review-card-head">
              <strong>Te faltó revisar</strong>
              <span>{result.missed.length}</span>
            </div>
            <p>{result.missed.length ? result.missed.join(' | ') : 'Cubriste las señales principales.'}</p>
          </article>
          <article className={`review-card ${result.wrong.length ? 'warn' : 'correct'}`.trim()}>
            <div className="review-card-head">
              <strong>Marcaste de más</strong>
              <span>{result.wrong.length}</span>
            </div>
            <p>{result.wrong.length ? result.wrong.join(' | ') : 'Tus hallazgos fueron bastante precisos.'}</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Tu decisión final</strong>
              <span>{formatPercent(result.score)}</span>
            </div>
            <p>{result.decisionLabel}</p>
          </article>
        </div>
      ) : null}
      <div className="activity-actions">
        {!result ? (
          <button className="btn primary" type="button" onClick={evaluate}>
            Evaluar hallazgos
          </button>
        ) : (
          <>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                completePayload(startedAtRef, onComplete, result.score, feedbackToText(feedback), {
                  flaggedTargets: Array.from(flagged),
                  neutralTargets: Array.from(neutralTargets),
                  decision,
                  stage,
                })
              }
            >
              Continuar
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setResult(null);
                setFeedback(null);
                setFlagged(new Set());
                setNeutralTargets(new Set());
                setDecision(null);
                setCartItems([]);
                setStage('product');
                setInspectedTarget('');
                setInspectedNote({ kind: 'info', text: '' });
                setHint(buildGuideHint(guideMode, 0));
              }}
              >
              Reintentar simulación
            </button>
          </>
        )}
      </div>
    </>
  );
}

function CallSimActivity({ activity, startedAtRef, onComplete }) {
  const steps = Array.isArray(activity.steps) ? activity.steps : [];
  const [stepIndex, setStepIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [transcript, setTranscript] = useState(() =>
    activity.opening ? [{ speaker: 'caller', text: activity.opening }] : []
  );
  const [feedback, setFeedback] = useState(null);
  const [pendingNext, setPendingNext] = useState(null);
  const [finished, setFinished] = useState(false);
  const currentStep = steps[stepIndex] || null;
  const finalScore = scores.length
    ? scores.reduce((total, value) => total + value, 0) / scores.length
    : 1;
  const safeDecisions = scores.filter((value) => value >= 0.8).length;
  const callMinutes = String(Math.min(59, 1 + stepIndex)).padStart(2, '0');
  const callSeconds = String((stepIndex * 17) % 60).padStart(2, '0');

  const chooseOption = (option) => {
    if (!currentStep || finished) return;
    const score = Math.max(0, Math.min(1, Number(option.puntaje) || 0.6));
    setScores((current) => [...current, score]);
    setTranscript((current) => [...current, { speaker: 'user', text: option.texto }]);
    setFeedback(
      buildFeedback({
        title: feedbackRatingLabel(score),
        signal: currentStep.texto,
        risk: 'Las llamadas fraudulentas intentan forzar decisiones sin darte espacio para verificar.',
        action: option.feedback || 'Cuelga y verifica por un canal oficial antes de compartir información.',
      })
    );
    setPendingNext(() => () => {
      setFeedback(null);
      setPendingNext(null);
      if (stepIndex + 1 >= steps.length) {
        setFinished(true);
        return;
      }
      setTranscript((current) => [...current, { speaker: 'caller', text: steps[stepIndex + 1]?.texto || '' }]);
      setStepIndex((current) => current + 1);
    });
  };

  return (
    <>
      <section className="call-stage-banner">
        <div>
          <p className="eyebrow">Pantalla de llamada</p>
          <h3>No resuelvas nada dentro de la llamada</h3>
          <p>
            {repairPossibleMojibake(activity.intro) ||
              'Escucha la presión, detecta la manipulación y decide cómo cortar el riesgo a tiempo.'}
          </p>
        </div>
        <div className="call-stage-meta">
          <span className="activity-kicker-pill">Llamada en curso</span>
          <span className="activity-kicker-pill subtle">{`00:${callMinutes}:${callSeconds}`}</span>
        </div>
      </section>
      <ActivitySummaryBar
        items={[
          {
            label: 'Paso actual',
            value: finished ? 'Cierre' : `${Math.min(stepIndex + 1, steps.length)}/${steps.length || 1}`,
            caption: 'Responde como si fuera una llamada real.',
          },
          {
            label: 'Decisiones firmes',
            value: `${safeDecisions}/${scores.length || 0}`,
            caption: 'Cuenta cada vez que cortaste el riesgo a tiempo.',
          },
          {
            label: 'Meta',
            value: 'Cortar y verificar',
            caption: 'No resuelvas nada dentro de la llamada.',
          },
        ]}
      />
      <div className="call-phone call-phone-pro">
        <div className="call-screen">
          <div className="call-status-bar">
            <span>Señal segura</span>
            <span>{`00:${callMinutes}:${callSeconds}`}</span>
          </div>
          <p className="call-chip">Llamada sospechosa</p>
          <div className="call-identity">
            <div className="call-avatar">
              {repairPossibleMojibake(activity.callerName || 'LL')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h3 className="call-name">{repairPossibleMojibake(activity.callerName || 'Llamada')}</h3>
              <p className="call-number">
                {repairPossibleMojibake(activity.callerNumber || 'Número no verificado')}
              </p>
            </div>
          </div>
          <div className="call-warning-strip">
            <strong>Meta de esta práctica</strong>
            <p>Cortar el canal, no convencer al supuesto agente.</p>
          </div>
          <div className="call-transcript">
            {transcript.map((entry, index) => (
              <div className={`call-bubble ${entry.speaker}`} key={`${entry.speaker}-${index}`}>
                <strong>{entry.speaker === 'caller' ? 'Llamada' : 'Tú'}</strong>
                <p>{repairPossibleMojibake(entry.text)}</p>
              </div>
            ))}
          </div>
          {!finished && currentStep ? (
            <div className="call-options">
              {currentStep.opciones.map((option) => (
                <button
                  key={option.id}
                  className="option-btn"
                  type="button"
                  onClick={() => chooseOption(option)}
                  disabled={Boolean(feedback)}
                >
                  {option.texto}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <FeedbackPanel feedback={feedback} />
      {finished ? (
        <div className="review-grid">
          <article className="review-card correct">
            <div className="review-card-head">
              <strong>Promedio de seguridad</strong>
              <span>{formatPercent(finalScore)}</span>
            </div>
            <p>Tu salida más segura fue cortar la llamada y verificar por un canal oficial controlado por ti.</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Decisiones firmes</strong>
              <span>{`${safeDecisions}/${scores.length || 0}`}</span>
            </div>
            <p>Mientras antes salgas del canal del atacante, menos margen tiene para presionarte.</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Cierre recomendado</strong>
              <span>{activity.callerName || 'Llamada'}</span>
            </div>
            <p>Cuelga, entra a tu app o llama tú mismo al número oficial, y nunca compartas códigos ni instales apps.</p>
          </article>
        </div>
      ) : null}
      <div className="activity-actions">
        {feedback && pendingNext ? (
          <button className="btn primary" type="button" onClick={pendingNext}>
            {stepIndex + 1 >= steps.length ? 'Finalizar llamada' : 'Siguiente'}
          </button>
        ) : null}
        {finished ? (
          <button
            className="btn primary"
            type="button"
            onClick={() =>
              completePayload(
                startedAtRef,
                onComplete,
                finalScore,
                feedbackToText(
                  buildFeedback({
                    title: feedbackRatingLabel(finalScore),
                    signal: 'Aplicaste tu criterio frente a una llamada presionante.',
                    risk: 'El objetivo es que no resuelvas durante la llamada ni compartas datos sensibles.',
                    action: 'Cuelga y confirma por un número oficial que tú mismo busques.',
                  })
                ),
                { transcript }
              )
            }
          >
            Continuar
          </button>
        ) : null}
      </div>
    </>
  );
}

function ScenarioFlowActivity({ activity, startedAtRef, onComplete }) {
  const steps = Array.isArray(activity.pasos) ? activity.pasos : [];
  const [stepIndex, setStepIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [flowChoices, setFlowChoices] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [pendingNext, setPendingNext] = useState(null);
  const [answeredSteps, setAnsweredSteps] = useState([]);
  const currentStep = steps[stepIndex] || null;
  const finished = !currentStep && steps.length > 0;
  const finalScore = scores.length
    ? scores.reduce((total, value) => total + value, 0) / scores.length
    : 1;
  const safeChoices = scores.filter((value) => value >= 0.8).length;
  const latestChoice = flowChoices[flowChoices.length - 1] || null;

  useEffect(() => {
    setStepIndex(0);
    setScores([]);
    setFlowChoices([]);
    setFeedback(null);
    setPendingNext(null);
    setAnsweredSteps([]);
  }, [activity?.id]);

  const resolveNextStepIndex = (requestedNext, answeredIndexes) => {
    if (!steps.length) return 0;

    const answeredSet = new Set(answeredIndexes);
    const currentIndex = stepIndex;
    const numericNext = Number(requestedNext);
    const candidateIndexes = [];

    if (Number.isFinite(numericNext)) {
      candidateIndexes.push(numericNext);
      if (numericNext > 0) candidateIndexes.push(numericNext - 1);
    }

    const validForwardCandidate = candidateIndexes.find(
      (candidate) =>
        Number.isInteger(candidate) &&
        candidate > currentIndex &&
        candidate < steps.length &&
        !answeredSet.has(candidate)
    );
    if (validForwardCandidate != null) return validForwardCandidate;

    for (let index = currentIndex + 1; index < steps.length; index += 1) {
      if (!answeredSet.has(index)) return index;
    }

    for (let index = 0; index < steps.length; index += 1) {
      if (!answeredSet.has(index)) return index;
    }

    return steps.length;
  };

  const chooseOption = (step, option) => {
    const score = Math.max(0, Math.min(1, Number(option.puntaje) || 0.6));
    setScores((current) => [...current, score]);
    setFlowChoices((current) => [...current, { step: step.texto, choice: option.texto, score }]);
    const nextAnsweredSteps = answeredSteps.includes(stepIndex)
      ? answeredSteps
      : [...answeredSteps, stepIndex];
    setAnsweredSteps(nextAnsweredSteps);
    setFeedback(
      buildFeedback({
        title: feedbackRatingLabel(score),
        signal: step.texto,
        risk: 'La prisa, la confianza o el contexto pueden hacerte bajar la guardia.',
        action: option.feedback || 'Verifica por un canal oficial antes de actuar.',
      })
    );
    const nextIndex = resolveNextStepIndex(option.siguiente, nextAnsweredSteps);
    setPendingNext(() => () => {
      setFeedback(null);
      setPendingNext(null);
      setStepIndex(nextIndex);
    });
  };

  return (
    <>
      <section className="habit-stage-banner">
        <div>
          <p className="eyebrow">Decisión guiada</p>
          <h3>Convierte criterio en una rutina repetible</h3>
          <p>
            {repairPossibleMojibake(activity.intro) ||
              'Cada situación cambia un poco, pero tu secuencia segura debe mantenerse estable.'}
          </p>
        </div>
        <div className="habit-stage-meta">
          <span className="activity-kicker-pill">Hábitos</span>
          <span className="activity-kicker-pill subtle">{`${safeChoices}/${scores.length || 0} decisiones firmes`}</span>
        </div>
      </section>
      <ActivitySummaryBar
        items={[
          {
            label: 'Paso',
            value: finished ? 'Finalizado' : `${Math.min(stepIndex + 1, steps.length)}/${steps.length || 1}`,
            caption: 'Cada decisión cambia lo que sigue.',
          },
          {
            label: 'Decisiones seguras',
            value: `${safeChoices}/${scores.length || 0}`,
            caption: 'Tu rutina se fortalece cuando repites buenas decisiones.',
          },
          {
            label: 'Meta',
            value: 'Pausa y verifica',
            caption: 'No avances por impulso.',
          },
        ]}
      />
      {currentStep ? (
        <div className="flow habit-flow">
          <div className="habit-flow-head">
            <div>
              <p className="eyebrow">Situación actual</p>
              <h4>¿Qué haces primero?</h4>
            </div>
            <span className="activity-kicker-pill subtle">{`Paso ${stepIndex + 1}`}</span>
          </div>
          <p className="flow-text">{repairPossibleMojibake(currentStep.texto)}</p>
          <div className="option-grid">
            {currentStep.opciones.map((option) => (
              <button
                key={option.id}
                className="option-btn habit-option-btn"
                type="button"
                disabled={Boolean(feedback)}
                onClick={() => chooseOption(currentStep, option)}
              >
                {repairPossibleMojibake(option.texto)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flow habit-flow">
          <p className="flow-text">
            Terminaste este escenario. Ya puedes registrar tu resultado y volver al tablero.
          </p>
        </div>
      )}
      <FeedbackPanel feedback={feedback} />
      {finished ? (
        <div className="review-grid">
          <article className="review-card correct">
            <div className="review-card-head">
              <strong>Promedio de criterio</strong>
              <span>{formatPercent(finalScore)}</span>
            </div>
            <p>Tu mejor defensa fue mantener la rutina aún cuando el escenario parecía cotidiano o creíble.</p>
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
          <button className="btn primary" type="button" onClick={pendingNext}>
            Siguiente
          </button>
        ) : null}
        {finished ? (
          <button
            className="btn primary"
            type="button"
            onClick={() =>
              completePayload(
                startedAtRef,
                onComplete,
                finalScore,
                feedbackToText(
                  buildFeedback({
                    title: feedbackRatingLabel(finalScore),
                    signal: 'Aplicaste tu rutina de verificación en una situación cotidiana.',
                    risk: 'Cuando la rutina se rompe, la urgencia o la confianza pueden tomar el control.',
                    action: 'Mantén la secuencia: pausa, verifica y confirma por canal oficial.',
                  })
                ),
                { flowChoices }
              )
            }
          >
            Continuar
          </button>
        ) : null}
      </div>
    </>
  );
}

export default function ActivityRenderer({
  viewport = 'desktop',
  module,
  activity,
  answers,
  assessment,
  onComplete,
}) {
  const startedAtRef = useRef(Date.now());
  const compact = ['phone-small', 'phone', 'tablet-compact'].includes(viewport);
  const safeModule = useMemo(() => sanitizeDeep(module || {}), [module]);
  const safeActivity = useMemo(() => sanitizeDeep(activity || {}), [activity]);
  const knownTypes = [
    'concepto',
    'quiz',
    'simulacion',
    'checklist',
    'abierta',
    'sim_chat',
    'compare_domains',
    'signal_hunt',
    'inbox',
    'web_lab',
    'call_sim',
    'scenario_flow',
  ];

  return (
    <ActivityChrome module={safeModule} activity={safeActivity} compact={compact}>
      {safeActivity.tipo === 'concepto' ? (
        <ConceptActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {safeActivity.tipo === 'quiz' || safeActivity.tipo === 'simulacion' ? (
        <QuizActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {safeActivity.tipo === 'checklist' ? (
        <ChecklistActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {safeActivity.tipo === 'abierta' ? (
        <OpenAnswerActivity
          module={safeModule}
          activity={safeActivity}
          answers={answers}
          assessment={assessment}
          startedAtRef={startedAtRef}
          onComplete={onComplete}
        />
      ) : null}
      {safeActivity.tipo === 'sim_chat' ? (
        <WhatsAppSimulation
          activity={safeActivity}
          answers={answers}
          assessment={assessment}
          startedAtRef={startedAtRef}
          onComplete={onComplete}
        />
      ) : null}
      {safeActivity.tipo === 'compare_domains' ? (
        <CompareDomainsActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {safeActivity.tipo === 'signal_hunt' ? (
        <SignalHuntActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {safeActivity.tipo === 'inbox' ? (
        <InboxActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {safeActivity.tipo === 'web_lab' ? (
        <WebLabActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {safeActivity.tipo === 'call_sim' ? (
        <CallSimulationActivity
          activity={safeActivity}
          answers={answers}
          assessment={assessment}
          startedAtRef={startedAtRef}
          onComplete={onComplete}
        />
      ) : null}
      {safeActivity.tipo === 'scenario_flow' ? (
        <ScenarioFlowActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {!knownTypes.includes(safeActivity.tipo) ? (
        <ConceptActivity activity={safeActivity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
    </ActivityChrome>
  );
}
