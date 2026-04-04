import { useMemo, useRef, useState } from 'react';
import { postJson } from '../../lib/api.js';
import { splitParagraphs } from '../../lib/format.js';
import {
  ACTIVITY_LABELS,
  feedbackRatingLabel,
  feedbackToText,
} from '../../lib/course.js';
import FeedbackPanel from '../FeedbackPanel.jsx';

function Paragraphs({ text, className = 'activity-copy' }) {
  const lines = splitParagraphs(text);
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
    'Elige la opciÃ³n mÃ¡s segura, no la mÃ¡s rÃ¡pida.',
    'Revisa el feedback para entender por quÃ© esa decisiÃ³n era mejor.',
  ],
  simulacion: [
    'Lee el escenario completo antes de responder.',
    'Elige la opciÃ³n mÃ¡s segura, no la mÃ¡s rÃ¡pida.',
    'Revisa el feedback para entender por quÃ© esa decisiÃ³n era mejor.',
  ],
  sim_chat: [
    'Responde como si fuera una conversaciÃ³n real.',
    'La meta es detectar el riesgo, no agradar al contacto.',
    'Si dudas, pausa y verifica por fuera del chat.',
  ],
  compare_domains: [
    'Busca cambios mÃ­nimos en letras, terminaciones o estructura.',
    'El dominio mÃ¡s confiable suele ser el mÃ¡s simple y coherente.',
    'Si sigues dudando, escribe tÃº mismo la direcciÃ³n oficial.',
  ],
  signal_hunt: [
    'Marca solo las seÃ±ales que realmente indiquen riesgo.',
    'No necesitas marcar todo: importa la precisiÃ³n.',
    'Piensa quÃ© parte del mensaje te quiere presionar o engaÃ±ar.',
  ],
  inbox: [
    'Abre el mensaje y revÃ­salo antes de clasificarlo.',
    'FÃ­jate en remitente, asunto, cuerpo y enlaces visibles.',
    'No te guÃ­es solo por el diseÃ±o: busca incoherencias concretas.',
  ],
  web_lab: [
    'Recorre la pÃ¡gina como si fueras a comprar o registrarte.',
    'Marca hallazgos sospechosos mientras avanzas.',
    'Al final decide si seguirÃ­as o saldrÃ­as del sitio.',
  ],
  call_sim: [
    'Lee cada paso como si estuvieras en una llamada real.',
    'Prioriza cortar, pausar o verificar por fuera de la llamada.',
    'No compartas datos ni resuelvas bajo presiÃ³n.',
  ],
  scenario_flow: [
    'Cada decisiÃ³n cambia el escenario siguiente.',
    'Piensa en la rutina segura antes de responder.',
    'La meta es reducir riesgo, no terminar rÃ¡pido.',
  ],
  abierta: [
    'Explica quÃ© harÃ­as con tus propias palabras.',
    'Incluye cÃ³mo pausarÃ­as, verificarÃ­as o cortarÃ­as el riesgo.',
    'No hace falta escribir mucho, pero sÃ­ ser claro.',
  ],
  checklist: [
    'Marca cada paso solo si realmente lo revisarÃ­as.',
    'Ãšsalo como una rutina mÃ­nima de verificaciÃ³n.',
    'La idea es convertirlo en hÃ¡bito, no avanzar por avanzar.',
  ],
};

function SimulationGuide({ activity }) {
  const steps = SIMULATION_GUIDES[activity?.tipo];
  if (!steps?.length) return null;

  return (
    <section className="panel summary-card activity-guide">
      <p className="eyebrow">CÃ³mo resolver esta actividad</p>
      <div className="summary-list">
        {steps.map((step) => (
          <div className="summary-item" key={step}>
            <p>{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityChrome({ activity, children }) {
  return (
    <div className="activity-shell">
      <div className="activity-head">
        <p className="activity-title">{activity.titulo || 'Actividad'}</p>
        <span className="activity-type">
          {ACTIVITY_LABELS[activity.tipo] || activity.tipo || 'Actividad'}
        </span>
      </div>
      <SimulationGuide activity={activity} />
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
  return (
    <>
      {Array.isArray(activity.bloques) && activity.bloques.length ? (
        <div className="concept-grid">
          {activity.bloques.map((block) => (
            <article className="concept-card" key={`${block.titulo}-${block.texto}`}>
              <p className="concept-card-title">{block.titulo}</p>
              <p className="concept-card-text">{block.texto}</p>
            </article>
          ))}
        </div>
      ) : null}
      <Paragraphs text={activity.contenido} />
      <div className="activity-actions">
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
            ? 'Detectaste la seÃ±al principal del escenario.'
            : 'La seÃ±al clave estaba en la urgencia, el canal o la peticiÃ³n.'),
        risk:
          activity.riesgo ||
          'Responder sin verificar puede exponerte a robo de datos, dinero o acceso.',
        action:
          activity.accion ||
          (options[correctIndex]
            ? `La acciÃ³n segura era: ${options[correctIndex]}`
            : 'Verifica por un canal oficial antes de actuar.'),
        extra:
          activity.explicacion ||
          (isCorrect
            ? 'Buena decisiÃ³n.'
            : 'ValÃ­a la pena frenar y revisar mejor la situaciÃ³n.'),
      })
    );
  };

  return (
    <>
      <Paragraphs text={activity.escenario} />
      <ActivitySummaryBar
        items={[
          { label: 'Opciones', value: options.length || 0, caption: 'Revisa todas antes de elegir.' },
          { label: 'Meta', value: 'Elegir con criterio', caption: 'La mejor respuesta no siempre es la mas rapida.' },
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
          risk: 'Si omites un paso de verificacion, tu rutina se debilita justo cuando necesitas claridad.',
          action: 'Completa los pasos restantes antes de avanzar.',
          missed: remainingItems.slice(0, 4),
          extra: 'La idea es fijar un habito completo, no marcar solo lo mas facil.',
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
          risk: 'Si omites un paso de verificaciÃ³n, aumenta la probabilidad de actuar con prisa.',
          action: 'Usa este checklist como rutina rÃ¡pida cuando un mensaje o llamada te meta presiÃ³n.',
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
          { label: 'Pasos', value: items.length || 0, caption: 'Tu rutina minima de verificacion.' },
          { label: 'Completados', value: `${selectedCount}/${items.length}`, caption: allChecked ? 'Rutina completa.' : 'Aun faltan pasos por marcar.' },
          { label: 'Meta', value: 'No saltarte ninguno', caption: 'La consistencia vale mas que la velocidad.' },
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
      setFeedback('Escribe un poco mÃ¡s para poder evaluarlo.');
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
          signal: 'Tu respuesta mostrÃ³ cÃ³mo identificar o frenar el riesgo.',
          risk: 'La idea es no resolver desde el canal sospechoso ni compartir datos.',
          action: 'QuÃ©date con una frase corta, clara y orientada a verificar por canales oficiales.',
          extra: text,
        })
      );
    } catch (error) {
      setGradedScore(0.4);
      setFeedback(
        buildFeedback({
          title: 'Sin evaluaciÃ³n',
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
          { label: 'Meta', value: 'Explicar y justificar', caption: 'Cuenta como pausarias, verificarias o cortarias el riesgo.' },
        ]}
      />
      {Array.isArray(activity.pistas) && activity.pistas.length ? (
        <p className="hint">{`Tip: ${activity.pistas.join(' Â· ')}`}</p>
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

  const finishSimulation = () => {
    const score = bestScore || (userTurns ? 0.72 : 0.45);
    if (!feedback) {
      setFeedback(
        buildFeedback({
          title: feedbackRatingLabel(score),
          score,
          signal: 'Cerraste la conversacion sin seguir el ritmo del estafador.',
          risk: 'El mayor riesgo en este tipo de chat es quedarte resolviendo dentro del mismo canal.',
          action: 'Corta la conversacion y verifica por una llamada o canal oficial que tu controles.',
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
            'La conversacion mete presion para que resuelvas dentro del mismo chat.',
          risk:
            response?.risk ||
            'Si sigues en el mismo canal, el estafador controla el contexto y tu decision.',
          action:
            response?.safe_action ||
            'Deten la conversacion y verifica por un canal oficial que tu controles.',
          extra: response?.coach_feedback || '',
        })
      );
      setDone(Boolean(response?.done) || turns + 1 >= (activity.turnos_max || 6));
    } catch (error) {
      setFeedback(
        buildFeedback({
          title: 'Sin respuesta',
          signal: 'No pudimos continuar la simulaciÃ³n en este momento.',
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
      {activity.escenario ? <Paragraphs text={activity.escenario} /> : null}
      <ActivitySummaryBar
        items={[
          { label: 'Turnos usados', value: `${turns}/${activity.turnos_max || 6}`, caption: 'Puedes cerrar cuando ya marcaste un limite claro.' },
          { label: 'Objetivo', value: 'Frenar y verificar', caption: 'No necesitas convencer al atacante para hacerlo bien.' },
        ]}
      />
      <div className="wa-phone">
        <div className="wa-header">
          <div className="wa-avatar">
            {activity.avatarLabel || (activity.contactName || 'ED').slice(0, 2).toUpperCase()}
          </div>
          <div className="wa-contact">
            <p className="wa-contact-name">{activity.contactName || 'Contacto'}</p>
            <p className="wa-contact-status">{activity.contactStatus || 'en linea'}</p>
          </div>
        </div>
        <div className="wa-screen">
          {history.map((message, index) => (
            <div className={`wa-row ${message.role === 'user' ? 'user' : 'bot'}`} key={`${message.role}-${index}`}>
              <div className={`wa-bubble ${message.role === 'user' ? 'user' : 'bot'}`}>
                <p>{message.content}</p>
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
              {reply}
            </button>
          ))}
        </div>
        <div className="wa-inputbar">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escribe tu respuesta segura"
            disabled={busy || done}
          />
          <button className="btn primary" type="button" disabled={busy || done} onClick={() => sendMessage()}>
            {busy ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
      <FeedbackPanel feedback={feedback} />
      <div className="activity-actions">
        {!done && userTurns > 0 ? (
          <button className="btn ghost" type="button" onClick={finishSimulation} disabled={busy}>
            Cerrar simulacion de forma segura
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
                  feedbackToText(feedback || 'SimulaciÃ³n completada.'),
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
          ? 'Elegiste el dominio mas consistente para verificar por tu cuenta.'
          : 'El dominio seguro suele ser el mas simple y coherente con la marca real.',
        risk: 'Un cambio pequeno en letras o extensiones puede llevarte a una web clonada.',
        action: 'Si dudas, no abras el enlace desde el mensaje. Escribe tu el dominio en el navegador.',
        extra: `${activity.explicacion || ''}${activity.tip ? ` Tip: ${activity.tip}` : ''}`.trim(),
      })
    );
  };

  return (
    <>
      <Paragraphs text={activity.prompt || 'Elige el dominio legÃ­timo.'} />
      <ActivitySummaryBar
        items={[
          { label: 'Dominios', value: domains.length || 0, caption: 'Busca el mas simple y coherente.' },
          { label: 'Regla', value: 'Escribirlo tu mismo', caption: 'Si dudas, no abras el enlace desde el mensaje.' },
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
      signal: `Encontraste ${tp} de ${correctIds.size || 1} seÃ±ales relevantes.`,
      risk: 'Cuando una seÃ±al pasa desapercibida, es mÃ¡s fÃ¡cil que el mensaje te arrastre al siguiente paso.',
      action:
        activity.accion ||
        'DetÃ©n la conversaciÃ³n y verifica por el canal oficial antes de abrir links, pagar o responder.',
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
      <div className="message-box">{activity.mensaje || 'Detecta las seÃ±ales de riesgo.'}</div>
      <ActivitySummaryBar
        items={[
          { label: 'SeÃ±ales clave', value: signals.filter((signal) => signal.correcta).length || 0, caption: 'No necesitas marcar todo, solo lo importante.' },
          { label: 'Marcadas', value: selected.size, caption: result ? `Resultado ${formatPercent(result.score)}` : 'Puedes tocar una seÃ±al otra vez para quitarla.' },
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
            ? 'Habia senales de urgencia, enlace o identidad dudosa.'
            : 'No aparecian indicios claros de fraude en este ejemplo.'),
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
            : 'Los correos fraudulentos intentan parecer legitimos usando remitentes o asuntos creibles.',
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

  return (
    <>
      {activity.intro ? <Paragraphs text={activity.intro} /> : null}
      <ActivitySummaryBar
        items={[
          {
            label: 'Mensajes',
            value: messages.length,
            caption: kind === 'sms' ? 'clasifica cada SMS' : 'clasifica cada correo',
          },
          {
            label: 'Clasificados',
            value: `${Object.keys(selections).length}/${messages.length}`,
            caption: 'puedes revisar antes de evaluar',
          },
          {
            label: 'Meta',
            value: 'precision',
            caption: 'no te guies solo por la apariencia',
          },
        ]}
      />
      <div className={`email-sim ${kind === 'sms' ? 'is-sms' : ''}`}>
        <div className="email-sidebar">
          {messages.map((message) => {
            const picked = selections[message.id];
            const reviewItem = result?.review?.find((item) => item.id === message.id);
            const resultClass = reviewItem ? reviewItem.status : '';
            return (
              <button
                key={message.id}
                type="button"
                className={`email-list-item ${selectedId === message.id ? 'active' : ''} ${resultClass}`.trim()}
                onClick={() => {
                  setSelectedId(message.id);
                  setShowDetails(false);
                }}
              >
                <div className="email-list-top">
                  <span className="email-list-name">{message.displayName || message.from || 'Mensaje'}</span>
                  <span className="email-list-date">{message.dateLabel || ''}</span>
                </div>
                <p className="email-list-subject">{message.subject || message.text}</p>
                <p className="email-list-preview">{message.preview || message.text}</p>
                <span className={`email-list-status ${picked || 'empty'} ${resultClass}`.trim()}>
                  {resultClass === 'correct'
                    ? 'Acierto'
                    : resultClass === 'wrong'
                      ? 'Error'
                      : picked === 'estafa'
                        ? 'Sospechoso'
                        : picked === 'seguro'
                          ? 'Seguro'
                          : 'Sin clasificar'}
                </span>
              </button>
            );
          })}
        </div>

        {selectedMessage ? (
          <div className="email-reader">
            <div className="email-reader-head">
              <div className="email-open-top">
                <div>
                  <h4 className="email-open-subject">
                    {selectedMessage.subject || selectedMessage.displayName || 'Mensaje'}
                  </h4>
                  <p className="email-open-meta">
                    {`${selectedMessage.displayName || selectedMessage.from || 'Mensaje'} · ${
                      selectedMessage.dateLabel || ''
                    }`.trim()}
                  </p>
                </div>
                <div className="email-open-actions">
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

            <div className="email-reader-body">
              {selectedMessage.warning ? <div className="email-warning">{selectedMessage.warning}</div> : null}
              {showDetails ? (
                <div className="email-details">
                  <p>
                    <strong>From:</strong> {selectedMessage.details?.from || selectedMessage.from || 'Sin dato'}
                  </p>
                  {selectedMessage.details?.replyTo ? (
                    <p>
                      <strong>Reply-To:</strong> {selectedMessage.details.replyTo}
                    </p>
                  ) : null}
                  {selectedMessage.details?.returnPath ? (
                    <p>
                      <strong>Return-Path:</strong> {selectedMessage.details.returnPath}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="email-body-card">
                <p className="email-body-from">
                  {`${selectedMessage.displayName || 'Mensaje'} <${selectedMessage.from || ''}>`}
                </p>
                {(selectedMessage.body?.length ? selectedMessage.body : [selectedMessage.text]).map((line) => (
                  <p className="email-body-line" key={`${selectedMessage.id}-${line}`}>
                    {line}
                  </p>
                ))}
                {selectedMessage.attachments?.length ? (
                  <div className="email-attachments">
                    {selectedMessage.attachments.map((item) => (
                      <span className="email-attachment" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selectedMessage.linkPreview ? (
                  <div className="email-link-preview">{selectedMessage.linkPreview}</div>
                ) : null}
              </div>
            </div>

            <div className="email-reader-footer">
              <p className="email-classify-title">
                {kind === 'correo' ? '¿Como clasificarias este correo?' : '¿Como clasificarias este mensaje?'}
              </p>
              <div className="email-classify-actions">
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
                <div className={`message-review-card ${selectedReview.status}`.trim()}>
                  <div className="message-review-top">
                    <strong>
                      {selectedReview.status === 'correct'
                        ? 'Bien clasificado'
                        : selectedReview.status === 'wrong'
                          ? 'Hay que corregir esta decision'
                          : 'Falto clasificar este mensaje'}
                    </strong>
                    <span>{`Correcto: ${selectedReview.correctChoice === 'estafa' ? 'Sospechoso' : 'Seguro'}`}</span>
                  </div>
                  <p>
                    {selectedReview.picked
                      ? `Tu elegiste: ${selectedReview.picked === 'estafa' ? 'Sospechoso' : 'Seguro'}.`
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
            Evaluar clasificacion
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
              Reintentar clasificacion
            </button>
          </>
        )}
      </div>
    </>
  );
}

function WebLabActivity({ activity, startedAtRef, onComplete }) {
  const page = activity.pagina || {};
  const hotspots = Array.isArray(activity.hotspots) ? activity.hotspots : [];
  const [stage, setStage] = useState('product');
  const [flagged, setFlagged] = useState(() => new Set());
  const [decision, setDecision] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);

  const toggleTarget = (target) => {
    if (result) return;
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  };

  const hotspotMap = useMemo(() => new Map(hotspots.map((hotspot) => [hotspot.target, hotspot])), [hotspots]);

  const calculateScore = () => {
    const correctTargets = hotspots.filter((hotspot) => hotspot.correcta).map((hotspot) => hotspot.target);
    const hotspotScore =
      correctTargets.filter((target) => flagged.has(target)).length / Math.max(correctTargets.length, 1);
    const decisionScore =
      Number.isFinite(Number(activity.correctDecision)) && activity.decisionOptions?.length
        ? decision === activity.correctDecision
          ? 1
          : 0.25
        : 1;
    return Math.max(0, Math.min(1, hotspotScore * 0.7 + decisionScore * 0.3));
  };

  const evaluate = () => {
    const correctTargets = hotspots.filter((hotspot) => hotspot.correcta).map((hotspot) => hotspot.target);
    const matched = correctTargets.filter((target) => flagged.has(target));
    const missed = hotspots
      .filter((hotspot) => hotspot.correcta && !flagged.has(hotspot.target))
      .map((hotspot) => hotspot.label);
    const wrong = Array.from(flagged).filter((target) => !correctTargets.includes(target));
    const score = calculateScore();
    const decisionLabel =
      Number.isFinite(Number(decision)) && activity.decisionOptions?.[decision]
        ? activity.decisionOptions[decision]
        : 'Sin decision final';

    setResult({
      score,
      matched,
      missed,
      wrong,
      decisionLabel,
      expectedCount: correctTargets.length,
    });
    setFeedback(
      buildFeedback({
        title: feedbackRatingLabel(score),
        score,
        signal: `Marcaste ${matched.length} hallazgos relevantes.`,
        risk: 'Una pagina clonada puede pedir pagos inseguros o robar datos personales.',
        action: 'Si la web mete prisa, descuentos absurdos o contactos raros, sal y valida por una fuente oficial.',
        detected: matched.map((target) => hotspotMap.get(target)?.label || target),
        missed: missed.slice(0, 4),
        extra: wrong.length ? `Tambien marcaste: ${wrong.join(', ')}` : `Decision final: ${decisionLabel}.`,
      })
    );
  };

  const renderStage = () => {
    if (stage === 'product') {
      return (
        <>
          <div className="store-hero">
            <p className="store-brand">{page.marca || 'Tienda demo'}</p>
            <button
              className={`store-banner-button ${flagged.has('banner') ? 'flagged' : ''}`.trim()}
              type="button"
              onClick={() => toggleTarget('banner')}
            >
              {page.banner || 'Oferta especial'}
            </button>
            {page.sub ? <p className="store-sub">{page.sub}</p> : null}
          </div>
          <div className="store-product-grid">
            {(Array.isArray(page.productos) ? page.productos : []).map((product) => (
              <article className="store-product-card" key={product.id}>
                <p className="store-product-name">{product.nombre || 'Producto'}</p>
                <p className="store-product-price">
                  {product.antes ? `${product.antes} -> ${product.precio}` : product.precio || ''}
                </p>
                <button className="btn ghost compact" type="button" onClick={() => setStage('cart')}>
                  Agregar al carrito
                </button>
              </article>
            ))}
          </div>
          {page.reviews ? (
            <button
              className={`store-section-button ${flagged.has('reviews') ? 'flagged' : ''}`.trim()}
              type="button"
              onClick={() => toggleTarget('reviews')}
            >
              {page.reviews}
            </button>
          ) : null}
        </>
      );
    }

    if (stage === 'cart') {
      return (
        <>
          {page.cartNote ? (
            <button
              className={`store-section-button ${flagged.has('banner') ? 'flagged' : ''}`.trim()}
              type="button"
              onClick={() => toggleTarget('banner')}
            >
              {page.cartNote}
            </button>
          ) : null}
          {page.shipping ? (
            <button
              className={`store-section-button ${flagged.has('shipping') ? 'flagged' : ''}`.trim()}
              type="button"
              onClick={() => toggleTarget('shipping')}
            >
              {page.shipping}
            </button>
          ) : null}
          <button className="btn primary" type="button" onClick={() => setStage('checkout')}>
            Seguir al checkout
          </button>
        </>
      );
    }

    return (
      <>
        {page.checkoutPrompt ? (
          <button
            className={`store-section-button ${flagged.has('banner') ? 'flagged' : ''}`.trim()}
            type="button"
            onClick={() => toggleTarget('banner')}
          >
            {page.checkoutPrompt}
          </button>
        ) : null}
        {page.contacto ? (
          <button
            className={`store-section-button ${flagged.has('contacto') ? 'flagged' : ''}`.trim()}
            type="button"
            onClick={() => toggleTarget('contacto')}
          >
            {page.contacto}
          </button>
        ) : null}
        {page.policy ? (
          <button
            className={`store-section-button ${flagged.has('policy') ? 'flagged' : ''}`.trim()}
            type="button"
            onClick={() => toggleTarget('policy')}
          >
            {page.policy}
          </button>
        ) : null}
        {(Array.isArray(page.pagos) ? page.pagos.length : 0) ? (
          <button
            className={`store-section-button ${flagged.has('pago') ? 'flagged' : ''}`.trim()}
            type="button"
            onClick={() => toggleTarget('pago')}
          >
            {`Metodos de pago: ${page.pagos.join(' | ')}`}
          </button>
        ) : null}
      </>
    );
  };

  return (
    <>
      {activity.intro ? <Paragraphs text={activity.intro} /> : null}
      <ActivitySummaryBar
        items={[
          { label: 'Etapas', value: 'Producto -> Carrito -> Checkout', caption: 'recorre las tres vistas' },
          {
            label: 'Senales clave',
            value: hotspots.filter((hotspot) => hotspot.correcta).length,
            caption: 'hallazgos importantes',
          },
          { label: 'Marcadas', value: flagged.size, caption: 'puedes ajustar antes de evaluar' },
        ]}
      />
      <div className="web-lab-brief">
        <p className="web-lab-title">Explora la tienda completa antes de decidir.</p>
        <p>
          Revisa dominio, oferta, carrito y checkout. Marca solo las senales que realmente te harian salir del sitio o
          verificar por fuera.
        </p>
      </div>
      <div className="browser-sim">
        <div className="browser-top">
          <div className="browser-dots">
            <span />
            <span />
            <span />
          </div>
          <button
            className={`browser-url ${flagged.has('domain') ? 'flagged' : ''}`.trim()}
            type="button"
            onClick={() => toggleTarget('domain')}
          >
            {page.dominio || 'tienda-demo.com'}
          </button>
        </div>

        <div className="store-nav">
          {['product', 'cart', 'checkout'].map((value) => (
            <button
              key={value}
              className={`store-nav-btn ${stage === value ? 'active' : ''}`.trim()}
              type="button"
              onClick={() => setStage(value)}
            >
              {value === 'product' ? 'Producto' : value === 'cart' ? 'Carrito' : 'Checkout'}
            </button>
          ))}
        </div>

        <div className="store-stage">
          {renderStage()}
          {activity.decisionPrompt && activity.decisionOptions?.length ? (
            <div className="store-decision-box">
              <p className="store-decision-title">{activity.decisionPrompt}</p>
              <div className="store-decision-options">
                {activity.decisionOptions.map((option, index) => (
                  <button
                    key={option}
                    className={`btn ${decision === index ? 'primary' : 'ghost'} compact`}
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
        </div>
      </div>

      <div className="detective-panel">
        <p className="detective-count">{`Hallazgos marcados: ${flagged.size}`}</p>
        <div className="detective-findings">
          {Array.from(flagged).map((target) => (
            <span className="detective-chip" key={target}>
              {hotspotMap.get(target)?.label || target}
            </span>
          ))}
        </div>
      </div>

      <FeedbackPanel feedback={feedback} />
      {result ? (
        <div className="review-grid">
          <article className="review-card correct">
            <div className="review-card-head">
              <strong>Senales acertadas</strong>
              <span>{`${result.matched.length}/${result.expectedCount}`}</span>
            </div>
            <p>
              {result.matched.length
                ? result.matched.map((target) => hotspotMap.get(target)?.label || target).join(' | ')
                : 'Todavia no marcaste las senales clave esperadas.'}
            </p>
          </article>
          <article className={`review-card ${result.missed.length ? 'wrong' : 'correct'}`.trim()}>
            <div className="review-card-head">
              <strong>Te falto revisar</strong>
              <span>{result.missed.length}</span>
            </div>
            <p>{result.missed.length ? result.missed.join(' | ') : 'Cubriste las senales principales.'}</p>
          </article>
          <article className={`review-card ${result.wrong.length ? 'warn' : 'correct'}`.trim()}>
            <div className="review-card-head">
              <strong>Marcas de mas</strong>
              <span>{result.wrong.length}</span>
            </div>
            <p>{result.wrong.length ? result.wrong.join(' | ') : 'Marcaste con buena precision.'}</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Decision final</strong>
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
                  decision,
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
                setDecision(null);
                setStage('product');
              }}
            >
              Reintentar revision
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
        action: option.feedback || 'Cuelga y verifica por un canal oficial antes de compartir informaciÃ³n.',
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
      {activity.intro ? <Paragraphs text={activity.intro} /> : null}
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
      <div className="call-phone">
        <div className="call-screen">
          <p className="call-chip">Llamada entrante</p>
          <h3 className="call-name">{activity.callerName || 'Llamada'}</h3>
          <p className="call-number">{activity.callerNumber || 'NÃºmero no verificado'}</p>
          <div className="call-transcript">
            {transcript.map((entry, index) => (
              <div className={`call-bubble ${entry.speaker}`} key={`${entry.speaker}-${index}`}>
                <strong>{entry.speaker === 'caller' ? 'Llamada' : 'Tu'}</strong>
                <p>{entry.text}</p>
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
            <p>Tu salida mas segura fue cortar la llamada y verificar por un canal oficial controlado por ti.</p>
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
            <p>Cuelga, entra a tu app o llama tu mismo al numero oficial, y nunca compartas codigos ni instales apps.</p>
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
                    action: 'Cuelga y confirma por un nÃºmero oficial que tÃº mismo busques.',
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
  const currentStep = steps[stepIndex] || null;
  const finished = !currentStep && steps.length > 0;
  const finalScore = scores.length
    ? scores.reduce((total, value) => total + value, 0) / scores.length
    : 1;
  const safeChoices = scores.filter((value) => value >= 0.8).length;
  const latestChoice = flowChoices[flowChoices.length - 1] || null;

  const chooseOption = (step, option) => {
    const score = Math.max(0, Math.min(1, Number(option.puntaje) || 0.6));
    setScores((current) => [...current, score]);
    setFlowChoices((current) => [...current, { step: step.texto, choice: option.texto, score }]);
    setFeedback(
      buildFeedback({
        title: feedbackRatingLabel(score),
        signal: step.texto,
        risk: 'La prisa, la confianza o el contexto pueden hacerte bajar la guardia.',
        action: option.feedback || 'Verifica por un canal oficial antes de actuar.',
      })
    );
    const nextIndex =
      Number.isFinite(Number(option.siguiente)) ? Number(option.siguiente) : stepIndex + 1;
    setPendingNext(() => () => {
      setFeedback(null);
      setPendingNext(null);
      setStepIndex(nextIndex);
    });
  };

  return (
    <>
      {activity.intro ? <Paragraphs text={activity.intro} /> : null}
      <ActivitySummaryBar
        items={[
          {
            label: 'Paso',
            value: finished ? 'Finalizado' : `${Math.min(stepIndex + 1, steps.length)}/${steps.length || 1}`,
            caption: 'Cada decision cambia lo que sigue.',
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
        <div className="flow">
          <p className="flow-text">{currentStep.texto}</p>
          <div className="option-grid">
            {currentStep.opciones.map((option) => (
              <button
                key={option.id}
                className="option-btn"
                type="button"
                disabled={Boolean(feedback)}
                onClick={() => chooseOption(currentStep, option)}
              >
                {option.texto}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flow">
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
            <p>Tu mejor defensa fue mantener la rutina aun cuando el escenario parecia cotidiano o creible.</p>
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
              <strong>Ultima respuesta</strong>
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
                    signal: 'Aplicaste tu rutina de verificaciÃ³n en una situaciÃ³n cotidiana.',
                    risk: 'Cuando la rutina se rompe, la urgencia o la confianza pueden tomar el control.',
                    action: 'MantÃ©n la secuencia: pausa, verifica y confirma por canal oficial.',
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
  module,
  activity,
  answers,
  assessment,
  onComplete,
}) {
  const startedAtRef = useRef(Date.now());
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
    <ActivityChrome activity={activity}>
      {activity.tipo === 'concepto' ? (
        <ConceptActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'quiz' || activity.tipo === 'simulacion' ? (
        <QuizActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'checklist' ? (
        <ChecklistActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'abierta' ? (
        <OpenAnswerActivity
          module={module}
          activity={activity}
          answers={answers}
          assessment={assessment}
          startedAtRef={startedAtRef}
          onComplete={onComplete}
        />
      ) : null}
      {activity.tipo === 'sim_chat' ? (
        <WhatsAppSimulation
          activity={activity}
          answers={answers}
          assessment={assessment}
          startedAtRef={startedAtRef}
          onComplete={onComplete}
        />
      ) : null}
      {activity.tipo === 'compare_domains' ? (
        <CompareDomainsActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'signal_hunt' ? (
        <SignalHuntActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'inbox' ? (
        <InboxActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'web_lab' ? (
        <WebLabActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'call_sim' ? (
        <CallSimActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {activity.tipo === 'scenario_flow' ? (
        <ScenarioFlowActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
      {!knownTypes.includes(activity.tipo) ? (
        <ConceptActivity activity={activity} startedAtRef={startedAtRef} onComplete={onComplete} />
      ) : null}
    </ActivityChrome>
  );
}
