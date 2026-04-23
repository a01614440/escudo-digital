import { useEffect, useMemo, useState } from 'react';
import { feedbackToText } from '../../../lib/course.js';
import { cn } from '../../../lib/ui.js';
import FeedbackPanel from '../../FeedbackPanel.jsx';
import Button from '../../ui/Button.jsx';
import { ActivitySummaryBar, completeActivity } from '../sharedActivityUi.jsx';
import { ImmersivePanel } from './immersivePrimitives.jsx';
import { classifyInbox, getAvatarLabel, getInboxStatus, normalizeInboxMessages } from './inboxActivityUtils.js';
import { cleanText, getSimulationCategoryClass } from './shared.js';

export default function InboxActivity({ module, activity, startedAtRef, onComplete }) {
  const kind = activity?.kind === 'sms' ? 'sms' : 'correo';
  const simulationCategory = kind === 'sms' ? 'sms' : 'email';
  const messages = useMemo(() => normalizeInboxMessages(activity), [activity]);
  const [selectedId, setSelectedId] = useState(messages[0]?.id || '');
  const [selections, setSelections] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setSelectedId(messages[0]?.id || '');
    setSelections({});
    setShowDetails(false);
    setFeedback(null);
    setResult(null);
  }, [activity?.id, messages]);

  const selectedMessage = messages.find((message) => message.id === selectedId) || messages[0] || null;
  const selectedReview = result?.review?.find((item) => item.id === selectedMessage?.id) || null;
  const reviewedCount = Object.keys(selections).length;

  const classify = (messageId, value) => {
    if (result) return;
    setSelections((current) => ({ ...current, [messageId]: value }));
  };

  const evaluate = () => {
    const next = classifyInbox(messages, selections, kind, module);
    setResult(next);
    setFeedback(next.feedback);
    const focus = next.review.find((item) => item.status !== 'correct');
    if (focus) setSelectedId(focus.id);
  };

  return (
    <div
      className={cn(getSimulationCategoryClass(simulationCategory), 'grid gap-4')}
      data-sd-simulation-category={simulationCategory}
      data-sd-simulation-channel={kind === 'sms' ? 'sms' : 'email'}
      data-sd-stage-dominance="primary"
    >
      <ActivitySummaryBar
        items={[
          {
            label: 'Bandeja',
            value: kind === 'sms' ? 'SMS' : 'Correo',
            caption: 'Revisa el contexto completo antes de decidir.',
          },
          {
            label: 'Revisados',
            value: `${reviewedCount}/${messages.length || 0}`,
            caption: 'Puedes clasificar primero y evaluar después.',
          },
          {
            label: 'Meta',
            value: 'Precisión',
            caption: 'No te guíes solo por apariencia o tono.',
          },
        ]}
      />

      <div
        className="sd-simulation-main-stage grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]"
        data-sd-stage-layout="list-detail"
      >
        <ImmersivePanel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{kind === 'sms' ? 'Bandeja móvil' : 'Bandeja principal'}</p>
              <h3 className="font-display text-xl tracking-[-0.03em] text-sd-text">
                {kind === 'sms' ? 'Mensajes sospechosos' : 'Correos por revisar'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-sd-muted">
                {cleanText(
                  activity?.intro ||
                    (kind === 'sms'
                      ? 'Marca solo lo que de verdad te haría frenar.'
                      : 'Busca remitente, cuerpo, enlaces y contexto antes de clasificar.')
                )}
              </p>
            </div>
            <span className="sd-badge sd-badge-accent">{`${messages.length} mensajes`}</span>
          </div>

          <div className="mt-4 space-y-3">
            {messages.map((message) => {
              const reviewItem = result?.review?.find((item) => item.id === message.id);
              const status = getInboxStatus(selections[message.id], reviewItem);

              return (
                <button
                  key={message.id}
                  type="button"
                  className={cn(
                    'w-full rounded-[22px] border px-4 py-4 text-left transition',
                    selectedId === message.id
                      ? 'border-sd-accent bg-sd-accent-soft'
                      : 'border-sd-border bg-white/65 hover:-translate-y-0.5 hover:bg-white/80',
                    reviewItem?.status === 'wrong'
                      ? 'border-amber-300/70'
                      : reviewItem?.status === 'correct'
                        ? 'border-emerald-300/80'
                        : ''
                  )}
                  onClick={() => {
                    setSelectedId(message.id);
                    setShowDetails(false);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-[0.12em]',
                        kind === 'sms' ? 'bg-sd-accent-soft text-sd-accent' : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {getAvatarLabel(message)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-sm text-sd-text">{message.displayName}</strong>
                        <span className="text-xs text-sd-muted">{message.dateLabel}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-sd-text">{message.subject}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-sd-muted">
                        {message.preview || message.body[0] || 'Sin vista previa'}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-sd-muted">
                          {message.linkPreview ? 'Incluye enlace' : 'Texto directo'}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                            status.tone === 'correct'
                              ? 'bg-emerald-100 text-emerald-700'
                              : status.tone === 'wrong'
                                ? 'bg-amber-100 text-amber-700'
                                : status.tone === 'flagged'
                                  ? 'bg-rose-100 text-rose-700'
                                  : status.tone === 'safe'
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ImmersivePanel>

        {selectedMessage ? (
          <ImmersivePanel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="eyebrow">{kind === 'sms' ? 'Lectura del mensaje' : 'Lectura del correo'}</p>
                <h3 className="font-display text-xl tracking-[-0.03em] text-sd-text">{selectedMessage.subject}</h3>
                <p className="mt-2 text-sm text-sd-muted">
                  {kind === 'sms'
                    ? `SMS de ${selectedMessage.displayName}`
                    : `${selectedMessage.displayName}${selectedMessage.from ? ` <${selectedMessage.from}>` : ''}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="compact" type="button" onClick={() => setShowDetails((value) => !value)}>
                  {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
                </Button>
                <Button
                  variant="ghost"
                  size="compact"
                  type="button"
                  disabled={Boolean(result)}
                  onClick={() => classify(selectedMessage.id, 'estafa')}
                >
                  Reportar phishing
                </Button>
              </div>
            </div>

            {selectedMessage.warning ? (
              <div className="mt-4 rounded-[20px] border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
                {selectedMessage.warning}
              </div>
            ) : null}

            {showDetails ? (
              <div className="mt-4 grid gap-3 rounded-[22px] border border-sd-border bg-white/55 p-4 text-sm text-sd-muted sm:grid-cols-2">
                <div>
                  <strong className="block text-sd-text">From</strong>
                  <p>{cleanText(selectedMessage?.details?.from || selectedMessage.from || 'Sin dato')}</p>
                </div>
                {selectedMessage?.details?.replyTo ? (
                  <div>
                    <strong className="block text-sd-text">Reply-To</strong>
                    <p>{cleanText(selectedMessage.details.replyTo)}</p>
                  </div>
                ) : null}
                {selectedMessage?.details?.returnPath ? (
                  <div>
                    <strong className="block text-sd-text">Return-Path</strong>
                    <p>{cleanText(selectedMessage.details.returnPath)}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-[24px] border border-sd-border bg-white/80 p-4">
              <div className="space-y-3">
                {selectedMessage.body.map((line) => (
                  <p
                    className={cn(
                      'rounded-[18px] px-4 py-3 text-sm leading-6',
                      kind === 'sms' ? 'ml-auto max-w-[92%] bg-sd-accent-soft text-sd-text' : 'bg-slate-50 text-sd-text'
                    )}
                    key={`${selectedMessage.id}-${line}`}
                  >
                    {line}
                  </p>
                ))}
              </div>

              {selectedMessage.attachments.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedMessage.attachments.map((item) => (
                    <span className="rounded-full border border-sd-border bg-white px-3 py-1 text-xs font-medium text-sd-muted" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}

              {selectedMessage.linkPreview ? (
                <div className="mt-4 rounded-[18px] border border-sky-200 bg-sky-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Enlace detectado</p>
                  <strong className="mt-1 block text-sm text-sd-text">{selectedMessage.linkPreview}</strong>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-[22px] border border-sd-border bg-white/60 p-4">
              <p className="text-sm font-semibold text-sd-text">
                {kind === 'sms' ? '¿Cómo clasificarías este mensaje?' : '¿Cómo clasificarías este correo?'}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {['seguro', 'estafa'].map((choice) => (
                  <Button
                    key={choice}
                    variant={selections[selectedMessage.id] === choice ? 'primary' : 'ghost'}
                    size="compact"
                    type="button"
                    disabled={Boolean(result)}
                    onClick={() => classify(selectedMessage.id, choice)}
                  >
                    {choice === 'seguro' ? 'Seguro' : 'Sospechoso'}
                  </Button>
                ))}
              </div>

              {selectedReview ? (
                <div
                  className={cn(
                    'mt-4 rounded-[20px] border px-4 py-4 text-sm',
                    selectedReview.status === 'correct'
                      ? 'border-emerald-300/80 bg-emerald-50/90 text-emerald-900'
                      : selectedReview.status === 'wrong'
                        ? 'border-amber-300/80 bg-amber-50/90 text-amber-900'
                        : 'border-slate-200 bg-slate-50/90 text-slate-700'
                  )}
                >
                  <strong className="block">
                    {selectedReview.status === 'correct'
                      ? 'Bien clasificado'
                      : selectedReview.status === 'wrong'
                        ? 'Aquí conviene corregir la decisión'
                        : 'Faltó clasificar este mensaje'}
                  </strong>
                  <p className="mt-2">
                    {selectedReview.picked
                      ? `Tú elegiste ${selectedReview.picked === 'estafa' ? 'Sospechoso' : 'Seguro'}.`
                      : 'No lo clasificaste antes de evaluar.'}
                  </p>
                  <p className="mt-2">{selectedReview.reason}</p>
                </div>
              ) : null}
            </div>
          </ImmersivePanel>
        ) : null}
      </div>

      <FeedbackPanel feedback={feedback} />

      {result ? (
        <div className="review-grid">
          {result.review.map((item) => (
            <article className={`review-card ${item.status}`.trim()} key={item.id}>
              <div className="review-card-head">
                <strong>{item.label}</strong>
                <span>{item.status === 'correct' ? 'Correcto' : item.status === 'wrong' ? 'Revisar' : 'Pendiente'}</span>
              </div>
              <p>{item.reason}</p>
              <p className="review-card-meta">
                {item.picked ? `Marcaste ${item.picked === 'estafa' ? 'Sospechoso' : 'Seguro'}` : 'Sin clasificar'} ·{' '}
                {`Respuesta esperada: ${item.correctChoice === 'estafa' ? 'Sospechoso' : 'Seguro'}`}
              </p>
            </article>
          ))}
        </div>
      ) : null}

      <div className="activity-actions">
        {!result ? (
          <Button variant="primary" type="button" onClick={evaluate}>
            Evaluar clasificación
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              type="button"
              onClick={() =>
                completeActivity(startedAtRef, onComplete, result.score, feedbackToText(result.feedback), {
                  selections,
                  review: result.review,
                })
              }
            >
              Continuar
            </Button>
            <Button
              variant="ghost"
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
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
