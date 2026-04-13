import { useState } from 'react';
import { feedbackRatingLabel, feedbackToText, repairPossibleMojibake } from '../../lib/course.js';
import { requestSimulationTurn } from '../../services/courseService.js';
import FeedbackPanel from '../FeedbackPanel.jsx';
import {
  ActivitySummaryBar,
  buildActivityFeedback,
  completeActivity,
  formatPercent,
  Paragraphs,
} from './sharedActivityUi.jsx';

export function WhatsAppSimulation({
  activity,
  answers,
  assessment,
  startedAtRef,
  onComplete,
}) {
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
        buildActivityFeedback({
          title: feedbackRatingLabel(score),
          score,
          signal: 'Cerraste la conversación sin seguir el ritmo del estafador.',
          risk:
            'El mayor riesgo en este tipo de chat es quedarte resolviendo dentro del mismo canal.',
          action:
            'Corta la conversación y verifica por una llamada o canal oficial que tú controles.',
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
      const response = await requestSimulationTurn({
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
        buildActivityFeedback({
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
        buildActivityFeedback({
          title: 'Sin respuesta',
          signal: 'No pudimos continuar la simulación en este momento.',
          action:
            'Reintenta o continua aplicando la regla: pausa y verifica por un canal oficial.',
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
            <button
              className="btn primary"
              type="button"
              disabled={busy || done}
              onClick={() => sendMessage()}
            >
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
              completeActivity(
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

export function CompareDomainsActivity({ activity, startedAtRef, onComplete }) {
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
      buildActivityFeedback({
        title: feedbackRatingLabel(score),
        score,
        signal: isCorrect
          ? 'Elegiste el dominio más consistente para verificar por tu cuenta.'
          : 'El dominio seguro suele ser el más simple y coherente con la marca real.',
        risk: 'Un cambio pequeño en letras o extensiones puede llevarte a una web clonada.',
        action:
          'Si dudas, no abras el enlace desde el mensaje. Escribe tú el dominio en el navegador.',
        extra: `${activity.explicacion || ''}${activity.tip ? ` Tip: ${activity.tip}` : ''}`.trim(),
      })
    );
  };

  return (
    <>
      <Paragraphs text={activity.prompt || 'Elige el dominio legítimo.'} />
      <ActivitySummaryBar
        items={[
          {
            label: 'Dominios',
            value: domains.length || 0,
            caption: 'Busca el más simple y coherente.',
          },
          {
            label: 'Regla',
            value: 'Escribirlo tú mismo',
            caption: 'Si dudas, no abras el enlace desde el mensaje.',
          },
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
                completeActivity(
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

export function SignalHuntActivity({ activity, startedAtRef, onComplete }) {
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
    const correctIds = new Set(
      signals.filter((signal) => signal.correcta).map((signal) => signal.id)
    );
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
    const score =
      precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const payload = buildActivityFeedback({
      title: feedbackRatingLabel(score),
      score,
      signal: `Encontraste ${tp} de ${correctIds.size || 1} señales relevantes.`,
      risk:
        'Cuando una señal pasa desapercibida, es más fácil que el mensaje te arrastre al siguiente paso.',
      action:
        activity.accion ||
        'Detén la conversación y verifica por el canal oficial antes de abrir links, pagar o responder.',
      detected: signals
        .filter((signal) => selected.has(signal.id) && signal.correcta)
        .map((signal) => signal.label),
      missed: signals
        .filter((signal) => signal.correcta && !selected.has(signal.id))
        .map((signal) => signal.label),
    });
    setResult({
      score,
      selectedSignals: signals
        .filter((signal) => selected.has(signal.id))
        .map((signal) => signal.label),
    });
    setFeedback(payload);
  };

  return (
    <>
      <div className="message-box">{activity.mensaje || 'Detecta las señales de riesgo.'}</div>
      <ActivitySummaryBar
        items={[
          {
            label: 'Señales clave',
            value: signals.filter((signal) => signal.correcta).length || 0,
            caption: 'No necesitas marcar todo, solo lo importante.',
          },
          {
            label: 'Marcadas',
            value: selected.size,
            caption: result
              ? `Resultado ${formatPercent(result.score)}`
              : 'Puedes tocar una señal otra vez para quitarla.',
          },
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
                completeActivity(
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
