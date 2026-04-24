import { useEffect, useMemo, useRef, useState } from 'react';
import { feedbackToText, repairPossibleMojibake } from '../../lib/course.js';
import { getShellFamily } from '../../hooks/useResponsiveLayout.js';
import {
  getDecisionRatingLabel,
  scoreChoiceDecision,
  scoreSelectionAccuracy,
} from '../../lib/activityScoring.js';
import { cn } from '../../lib/ui.js';
import { requestSimulationTurn } from '../../services/courseService.js';
import { ActionCluster, PanelHeader } from '../../patterns/index.js';
import FeedbackPanel from '../FeedbackPanel.jsx';
import { Badge, Button, InlineMessage, Input, SurfaceCard } from '../ui/index.js';
import { getSimulationCategoryClass } from './immersive/shared.js';
import {
  ActivitySummaryBar,
  buildActivityFeedback,
  completeActivity,
  formatPercent,
  SimulationCloseout,
} from './sharedActivityUi.jsx';

function getChatFeedbackTone(feedback) {
  const score = Number(feedback?.score);
  if (!Number.isFinite(score)) return 'info';
  if (score >= 0.82) return 'success';
  if (score >= 0.56) return 'warning';
  return 'danger';
}

function getChatSignals(activity) {
  const text = repairPossibleMojibake(`${activity?.escenario || ''} ${activity?.inicio || ''}`).toLowerCase();
  const signals = [];

  if (/(transfer|dep[oó]sit|pago|dinero|hotel|cobro)/.test(text)) {
    signals.push({
      title: 'Dinero urgente',
      body: 'La conversación intenta llevarte a una transferencia o pago antes de verificar.',
    });
  }

  if (/(c[oó]digo|sms|clave|token)/.test(text)) {
    signals.push({
      title: 'Código o acceso',
      body: 'El objetivo puede ser sacar un código o un segundo factor bajo presión.',
    });
  }

  if (/(cambi[eé] de n[uú]mero|otro celular|otro n[uú]mero|soporte|cuenta|prima|mam[aá]|daniel)/.test(text)) {
    signals.push({
      title: 'Identidad sin prueba',
      body: 'Quiere usar confianza o autoridad sin una verificación que tú controles.',
    });
  }

  if (/(urgente|hoy|ahora|bloque|recepci[oó]n|de inmediato|ya)/.test(text)) {
    signals.push({
      title: 'Presión de tiempo',
      body: 'Busca que decidas rápido para que no salgas del chat a verificar.',
    });
  }

  if (!signals.length) {
    signals.push({
      title: 'Canal bajo control del atacante',
      body: 'Aunque el mensaje parezca plausible, la regla segura sigue siendo frenar y verificar por fuera.',
    });
  }

  return signals.slice(0, 3);
}

function getThreatNote(userTurns, done) {
  if (done) {
    return 'La conversación ya quedó cerrada. Ahora toca leer el resultado y dejar claro el siguiente paso.';
  }

  if (userTurns > 0) {
    return 'Ya respondiste dentro del canal. La meta ahora es salir con una respuesta corta y verificable.';
  }

  return 'La presión empieza desde el primer mensaje. No necesitas agradar al contacto; necesitas cortar el riesgo.';
}

function ChatFeedbackCard({
  feedback,
  done = false,
  className,
  startedAtRef,
  onComplete,
  bestScore,
  history,
  turns,
}) {
  if (!feedback) return null;

  const tone = getChatFeedbackTone(feedback);
  const scoreLabel = Number.isFinite(Number(feedback?.score)) ? formatPercent(feedback.score) : '';

  return (
    <SurfaceCard
      padding="compact"
      variant={done ? 'spotlight' : tone === 'danger' ? 'editorial' : 'insight'}
      className={cn('sd-chat-feedback-card border-sd-border-strong', className)}
    >
      <PanelHeader
        eyebrow={done ? 'Cierre del intercambio' : 'Lectura del intento'}
        title={repairPossibleMojibake(feedback.title || 'Lectura del resultado')}
        subtitle={
          done
            ? 'Cierre listo.'
            : 'Ajusta antes de responder.'
        }
        meta={scoreLabel ? <Badge tone={tone === 'danger' ? 'warning' : tone === 'success' ? 'accent' : 'neutral'}>{scoreLabel}</Badge> : null}
        divider
      />

      <InlineMessage
        tone={tone}
        title={
          tone === 'success'
            ? 'Ya estás defendiendo bien el canal'
            : tone === 'danger'
              ? 'Todavía estás dándole demasiado control'
              : 'Vas mejor, pero aún conviene ajustar'
        }
      >
        {repairPossibleMojibake(feedback.signal || 'La señal principal ya quedó visible.')}
      </InlineMessage>

      <div className="mt-4 grid gap-3">
        {feedback.risk ? (
          <SurfaceCard padding="compact" variant="subtle">
            <strong className="block text-sm text-sd-text">Qué sigue siendo riesgoso</strong>
            <p className="mt-2 text-sm leading-6 text-sd-text">{repairPossibleMojibake(feedback.risk)}</p>
          </SurfaceCard>
        ) : null}

        {feedback.action ? (
          <SurfaceCard padding="compact" variant="subtle">
            <strong className="block text-sm text-sd-text">Siguiente movimiento seguro</strong>
            <p className="mt-2 text-sm leading-6 text-sd-text">{repairPossibleMojibake(feedback.action)}</p>
          </SurfaceCard>
        ) : null}

        {feedback.extra ? (
          <p className="m-0 text-sm leading-6 text-sd-text">{repairPossibleMojibake(feedback.extra)}</p>
        ) : null}
      </div>

      {done ? (
        <ActionCluster align="start" collapse="wrap" className="mt-4">
          <Button
            variant="hero"
            type="button"
            onClick={() =>
              completeActivity(
                startedAtRef,
                onComplete,
                bestScore || Number(feedback?.score) || 0.68,
                feedbackToText(feedback || 'Simulación completada.'),
                { history, turns }
              )
            }
          >
            Continuar
          </Button>
        </ActionCluster>
      ) : null}
    </SurfaceCard>
  );
}

export function WhatsAppSimulation({
  viewport = 'desktop',
  activity,
  answers,
  assessment,
  startedAtRef,
  onComplete,
}) {
  const threadRef = useRef(null);
  const [history, setHistory] = useState(() =>
    activity.inicio ? [{ role: 'scammer', content: activity.inicio }] : []
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const shellFamily = getShellFamily(viewport);
  const isMobile = shellFamily === 'mobile';
  const isTablet = shellFamily === 'tablet';
  const isDesktop = shellFamily === 'desktop';
  const quickReplies = Array.isArray(activity.quickReplies) ? activity.quickReplies : [];
  const userTurns = history.filter((message) => message.role === 'user').length;
  const contactName = repairPossibleMojibake(activity.contactName || 'Contacto desconocido');
  const contactStatus = repairPossibleMojibake(activity.contactStatus || 'en línea');
  const avatarLabel = repairPossibleMojibake(activity.avatarLabel || contactName.slice(0, 2).toUpperCase() || 'WA');
  const legacyThreatNote =
    userTurns > 0
      ? 'El atacante ya logró mantenerte en el chat. Tu meta ahora es cerrar el canal sin justificarte de más.'
      : 'La presión empieza desde el primer mensaje. Responde como si fuera un chat real, pero sin darle control a la conversación.';

  const threatNote = getThreatNote(userTurns, done);
  const scenarioText = repairPossibleMojibake(
    activity.escenario || 'Corta el canal con una respuesta firme y verifica por un medio que tÃº controles.'
  );
  const signals = useMemo(() => getChatSignals(activity), [activity]);
  const turnsAllowed = Math.max(1, Number(activity.turnos_max) || 6);
  const turnsRemaining = Math.max(0, turnsAllowed - turns);
  const dominantSignal = signals[0]?.title || 'Canal no verificado';
  const threadLabel = done ? 'Hilo de mensajes cerrado' : 'Hilo de mensajes de WhatsApp';
  const composerHint = done
    ? 'La conversación ya quedó cerrada.'
    : 'Responde breve, firme y verifica por fuera si necesitas confirmar algo.';
  const contactPresence = busy && !done ? 'escribiendoâ€¦' : done ? 'chat cerrado' : contactStatus;

  const chatTimestamp = (index) => {
    const baseMinutes = 22;
    const totalMinutes = baseMinutes + index * 2;
    const hour = 11 + Math.floor(totalMinutes / 60);
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hour}:${minutes}`;
  };

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [history, busy, feedback, done]);

  const finishSimulation = () => {
    const score = bestScore || (userTurns ? 0.76 : 0.52);
    if (!feedback) {
      setFeedback(
        buildActivityFeedback({
          title: getDecisionRatingLabel(score),
          score,
          signal: 'Cerraste la conversación sin seguirle el ritmo al estafador.',
          risk: 'El mayor riesgo aquí era quedarte resolviendo dentro del mismo chat y darle más contexto al atacante.',
          action: 'En la vida real, corta la conversación y verifica por una llamada o canal oficial que tú controles.',
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
        turnos_max: turnsAllowed,
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
          title: getDecisionRatingLabel(score),
          score,
          signal:
            response?.signal_detected ||
            'Notaste parte de la presión y no dejaste que el chat definiera toda la decisión.',
          risk:
            response?.risk ||
            'Aquí sigue faltando sacar la conversación del canal donde el atacante controla el ritmo.',
          action:
            response?.safe_action ||
            'Detén la conversación y verifica por un canal oficial que tú controles.',
          extra: response?.coach_feedback || '',
        })
      );
      setDone(Boolean(response?.done) || turns + 1 >= turnsAllowed);
    } catch (error) {
      setFeedback(
        buildActivityFeedback({
          title: 'Riesgosa',
          score: 0.55,
          signal: 'La simulación se interrumpió, pero la regla segura no cambia.',
          risk: 'Si sigues respondiendo dentro del mismo chat, el atacante mantiene el control del contexto.',
          action: 'Reintenta o continúa aplicando la misma regla: pausa y verifica por un canal oficial.',
          extra: error.message || '',
        })
      );
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const supportContent = (
    <>
      <SurfaceCard
        padding="compact"
        variant={isDesktop ? 'insight' : 'subtle'}
        className="sd-chat-support-card border-sd-border-strong"
      >
        <PanelHeader
          eyebrow="QuÃ© estÃ¡ en juego"
          title="No sigas resolviendo dentro del chat"
          subtitle={threatNote}
          meta={<Badge tone="warning">{dominantSignal}</Badge>}
          divider
        />
        <div className="grid gap-3">
          {signals.slice(0, 2).map((signal) => (
            <div className="sd-chat-support-row" key={signal.title}>
              <strong>{signal.title}</strong>
              <p>{signal.body}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <ChatFeedbackCard
        feedback={feedback}
        done={done}
        startedAtRef={startedAtRef}
        onComplete={onComplete}
        bestScore={bestScore}
        history={history}
        turns={turns}
      />
    </>
  );

  return (
    <div
      className={cn(
        'sd-chat-sim',
        `sd-chat-sim-${shellFamily}`,
        getSimulationCategoryClass('chat'),
        done ? 'is-complete' : ''
      )}
      data-sd-container="true"
      data-sd-simulation-category="chat"
      data-sd-simulation-channel="whatsapp"
      data-sd-stage-dominance="primary"
      data-sd-stage-focus="fullscreen"
      data-sd-specific-simulation-pass="chat"
    >
      <section className="sd-chat-surface">
        <header className="sd-chat-header">
          <div className="sd-chat-header-main">
            <div className="sd-chat-avatar" aria-hidden="true">
              {avatarLabel}
            </div>
            <div className="sd-chat-contact">
              <strong>{contactName}</strong>
              <p>{contactPresence}</p>
            </div>
          </div>

          <div className="sd-chat-header-meta">
            <Badge tone={done ? 'neutral' : 'warning'}>{dominantSignal}</Badge>
            <span>{done ? 'Cierre listo' : `${turnsRemaining} turnos restantes`}</span>
          </div>
        </header>

        <div className="sd-chat-scene-note">
          <div>
            <strong>{done ? 'Conversacion cerrada' : 'Decide dentro del hilo'}</strong>
            <p>{scenarioText}</p>
          </div>
          {!isMobile ? <p className="sd-chat-threat-note">{threatNote}</p> : null}
        </div>

        <div className="sd-chat-stage-cues" data-sd-specific-strip="chat" aria-label="Claves del chat">
          <span>{dominantSignal}</span>
          <span>No verificado</span>
          <span>Salir por fuera</span>
        </div>

        <div className="sd-chat-thread-shell">
          {isMobile ? (
            <InlineMessage tone="warning" className="sd-chat-mobile-note" title="Clave del momento">
              {threatNote}
            </InlineMessage>
          ) : null}

          <div
            className="sd-chat-thread"
            ref={threadRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-atomic="false"
            aria-label={threadLabel}
          >
            <div className="sd-chat-thread-divider">Hoy · 11:22</div>
            {history.map((message, index) => (
              <div
                className={cn('sd-chat-row', message.role === 'user' ? 'is-user' : 'is-scammer')}
                key={`${message.role}-${index}`}
              >
                <article
                  className={cn('sd-chat-bubble', message.role === 'user' ? 'is-user' : 'is-scammer')}
                  aria-label={message.role === 'user' ? 'Tu mensaje' : 'Mensaje del contacto'}
                >
                  <p>{repairPossibleMojibake(message.content)}</p>
                  <span>{chatTimestamp(index)}</span>
                </article>
              </div>
            ))}

            {busy ? (
              <div className="sd-chat-row is-scammer">
                <div className="sd-chat-bubble is-scammer is-typing" aria-label="El contacto estÃ¡ escribiendo">
                  <span className="sd-chat-typing-dot" />
                  <span className="sd-chat-typing-dot" />
                  <span className="sd-chat-typing-dot" />
                </div>
              </div>
            ) : null}
          </div>

          {!done && quickReplies.length ? (
            <div className="sd-chat-suggestions" aria-label="Respuestas sugeridas">
              {quickReplies.map((reply) => (
                <Button
                  key={reply}
                  variant="soft"
                  size="compact"
                  type="button"
                  disabled={busy}
                  className="justify-start"
                  aria-label={`Enviar respuesta sugerida: ${repairPossibleMojibake(reply)}`}
                  onClick={() => sendMessage(reply)}
                >
                  {repairPossibleMojibake(reply)}
                </Button>
              ))}
            </div>
          ) : null}

          {!isDesktop && feedback ? (
            <ChatFeedbackCard
              feedback={feedback}
              done={done}
              className="sd-chat-inline-feedback"
              startedAtRef={startedAtRef}
              onComplete={onComplete}
              bestScore={bestScore}
              history={history}
              turns={turns}
            />
          ) : null}

          {!done ? (
            <div
              className="sd-chat-composer"
              role="group"
              aria-label="Área de respuesta"
              aria-describedby="sd-chat-composer-help"
            >
              <p className="sd-chat-composer-help" id="sd-chat-composer-help">
                {composerHint}
              </p>

              <div className="sd-chat-composer-field">
                <Input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Escribe una respuesta breve, firme y segura"
                  disabled={busy}
                  aria-label="Escribe tu respuesta segura"
                  aria-describedby="sd-chat-composer-help"
                />
              </div>

              <ActionCluster
                align="start"
                collapse={isMobile ? 'stack' : 'wrap'}
                className="sd-chat-composer-actions"
              >
                {userTurns > 0 ? (
                  <Button variant="quiet" type="button" onClick={finishSimulation} disabled={busy}>
                    Cerrar y verificar por fuera
                  </Button>
                ) : null}
                <Button variant="primary" type="button" loading={busy} onClick={() => sendMessage()}>
                  Responder
                </Button>
              </ActionCluster>
            </div>
          ) : (
            <InlineMessage tone="success" title="La conversacion ya quedo cerrada" className="sd-chat-complete-note">
              Registra el cierre y sal del chat.
            </InlineMessage>
          )}
        </div>
      </section>

      {isDesktop ? (
        <aside className="sd-chat-insight" data-sd-stage-rail="subordinate">
          {supportContent}
        </aside>
      ) : null}

      {!isDesktop && !feedback ? (
        <SurfaceCard
          padding="compact"
          variant={isTablet ? 'insight' : 'subtle'}
          className="sd-chat-compact-support border-sd-border-strong"
        >
          <PanelHeader
            eyebrow="QuÃ© mirar"
            title="SeÃ±ales que sÃ­ deben mover la decisiÃ³n"
            subtitle="Solo las claves."
            meta={<Badge tone="warning">{dominantSignal}</Badge>}
            divider
          />
          <div className="grid gap-3">
            {signals.slice(0, 2).map((signal) => (
              <div className="sd-chat-support-row" key={signal.title}>
                <strong>{signal.title}</strong>
                <p>{signal.body}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );

  /*
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
              <div className={`wa-row ${message.role === 'user' ? 'user' : 'bot'}`} key={`${message.role}-${index}`}>
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
              completeActivity(
                startedAtRef,
                onComplete,
                bestScore || 0.68,
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
  */
}

export function CompareDomainsActivity({ module, activity, startedAtRef, onComplete }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const domains = Array.isArray(activity.dominios) ? activity.dominios : [];
  const correctIndex = Number.isFinite(Number(activity.correcta)) ? Number(activity.correcta) : 0;

  const handleSelect = (index) => {
    if (selectedIndex !== null) return;
    const score = scoreChoiceDecision({
      isCorrect: index === correctIndex,
      module,
      selectedText: domains[index] || '',
    });

    setSelectedIndex(index);
    setFeedback(
      buildActivityFeedback({
        title: getDecisionRatingLabel(score),
        score,
        signal:
          index === correctIndex
            ? 'Elegiste el dominio más consistente para verificar por tu cuenta.'
            : 'Notaste parte del patrón, pero el dominio seguro suele ser el más simple y coherente con la marca real.',
        risk: 'Un cambio pequeño en letras o extensiones puede llevarte a una web clonada.',
        action: 'En la vida real, no abras el enlace desde el mensaje. Escribe tú mismo el dominio en el navegador.',
        extra: `${activity.explicacion || ''}${activity.tip ? ` Tip: ${activity.tip}` : ''}`.trim(),
      })
    );
  };

  return (
    <>
      <PanelHeader
        eyebrow="Dominio visible"
        title={repairPossibleMojibake(activity.prompt || 'Elige el dominio legítimo.')}
        subtitle={repairPossibleMojibake(
          activity.explicacion || 'Revisa el dominio más simple y coherente con la marca real.'
        )}
        meta={<Badge tone="warning">{`${domains.length || 0} dominios`}</Badge>}
        divider
      />
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

      <div className="analysis-action-strip" data-sd-specific-strip="analysis" aria-label="Regla de dominio">
        <span>Compara</span>
        <span>Elige</span>
        <span>Verifica fuera</span>
      </div>

      <SurfaceCard padding="compact" variant="insight" className="border-sd-border-strong">
        <div className="option-grid">
          {domains.map((domain, index) => {
            const status =
              selectedIndex === null ? '' : index === correctIndex ? 'correct' : selectedIndex === index ? 'wrong' : '';

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
      </SurfaceCard>

      <SimulationCloseout
        feedback={feedback}
        actions={
          feedback ? (
            <>
              <button
                className="btn primary"
                type="button"
                onClick={() =>
                  completeActivity(
                    startedAtRef,
                    onComplete,
                    Number(feedback.score) || 0.6,
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
          ) : null
        }
      />
    </>
  );
}

export function SignalHuntActivity({ module, activity, startedAtRef, onComplete }) {
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
    const correctSignals = signals.filter((signal) => signal.correcta);
    const falsePositives = signals.filter((signal) => selected.has(signal.id) && !signal.correcta).length;
    const falseNegatives = correctSignals.filter((signal) => !selected.has(signal.id)).length;
    const foundCorrect = correctSignals.filter((signal) => selected.has(signal.id)).length;
    const score = scoreSelectionAccuracy({
      correctCount: foundCorrect,
      falsePositives,
      falseNegatives,
      module,
      minimumFloor: 0.3,
    });

    const payload = buildActivityFeedback({
      title: getDecisionRatingLabel(score),
      score,
      signal: `Detectaste ${foundCorrect} de ${correctSignals.length || 1} señales realmente relevantes.`,
      risk: 'Aquí importa más no dejar pasar las señales críticas que marcar todo por duda.',
      action:
        activity.accion ||
        'En la vida real, detén la conversación y verifica por un canal oficial antes de abrir enlaces, pagar o responder.',
      detected: signals.filter((signal) => selected.has(signal.id) && signal.correcta).map((signal) => signal.label),
      missed: signals.filter((signal) => signal.correcta && !selected.has(signal.id)).map((signal) => signal.label),
      extra:
        falsePositives > 0
          ? 'Marcaste alguna señal extra, pero el foco sigue siendo detectar las que sí cambian la decisión.'
          : 'Buena precisión: te concentraste en las señales con más impacto.',
    });

    setResult({
      score,
      selectedSignals: signals.filter((signal) => selected.has(signal.id)).map((signal) => signal.label),
    });
    setFeedback(payload);
  };

  return (
    <>
      <PanelHeader
        eyebrow="Señales del mensaje"
        title="Detecta las señales de riesgo"
        subtitle={repairPossibleMojibake(
          activity.mensaje || 'Marca solo las señales que realmente cambian la decisión.'
        )}
        meta={<Badge tone="warning">{`${signals.filter((signal) => signal.correcta).length || 0} claves`}</Badge>}
        divider
      />
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
            caption: result ? `Resultado ${formatPercent(result.score)}` : 'Puedes tocar una señal otra vez para quitarla.',
          },
        ]}
      />
      <div className="analysis-action-strip" data-sd-specific-strip="analysis" aria-label="Regla de senales">
        <span>Marca claves</span>
        <span>Evita ruido</span>
        <span>Evalua</span>
      </div>
      <SurfaceCard padding="compact" variant="insight" className="border-sd-border-strong">
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
      </SurfaceCard>
      <SimulationCloseout
        feedback={feedback}
        actions={
          !result ? (
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
          )
        }
      />
    </>
  );
}
