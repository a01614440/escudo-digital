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
  const isSms = kind === 'sms';
  const simulationCategory = isSms ? 'sms' : 'email';
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
  const selectedStatus = selectedMessage ? getInboxStatus(selections[selectedMessage.id], selectedReview) : null;
  const reviewedCount = Object.keys(selections).length;

  const rootClassName = cn(
    getSimulationCategoryClass(simulationCategory),
    'grid gap-4',
    isSms ? 'email-sim inbox-sim-sms sms-summary-shell' : 'email-sim inbox-sim-mail'
  );

  const summaryItems = isSms
    ? [
        {
          label: 'Canal',
          value: 'SMS',
          caption: 'Lectura rápida, tono directo y señales mínimas.',
        },
        {
          label: 'Revisados',
          value: `${reviewedCount}/${messages.length || 0}`,
          caption: 'Clasifica solo lo que realmente te haría frenar.',
        },
        {
          label: 'Meta',
          value: 'Criterio',
          caption: 'Mira remitente, urgencia y enlace antes de actuar.',
        },
      ]
    : [
        {
          label: 'Bandeja',
          value: 'Correo',
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
      ];

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
    <div className={rootClassName} data-sd-simulation-category={simulationCategory} data-sd-simulation-channel={isSms ? 'sms' : 'email'} data-sd-stage-dominance="primary">
      {isSms ? (
        <>
          <div className="sms-app-topbar col-span-full">
            <span className="sms-app-signal">SMS directo</span>
            <span>Lectura rápida y verificación de enlace</span>
          </div>
          <div className="sms-app-header col-span-full">
            <div>
              <strong>SMS sospechosos</strong>
              <span>Mensajes breves, urgentes y directos. Prioriza remitente, tono y enlace antes de actuar.</span>
            </div>
            <div className="sms-app-header-pills">
              <span className="sms-app-pill active">SMS</span>
              <span className="sms-app-pill">Urgencia</span>
              <span className="sms-app-pill">Enlace corto</span>
            </div>
          </div>
        </>
      ) : null}

      <div className="col-span-full">
        <ActivitySummaryBar items={summaryItems} />
      </div>

      <div className="sd-simulation-main-stage col-span-full grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]" data-sd-stage-layout="list-detail">
        <ImmersivePanel className="email-sidebar">
          {isSms ? (
            <>
              <div className="sms-sidebar-head">
                <div>
                  <p className="eyebrow">Bandeja móvil</p>
                  <strong className="mt-1 block text-base text-sd-text">Mensajes sospechosos</strong>
                  <p className="mt-2 text-sm leading-6 text-sd-text-soft">Marca solo lo que de verdad te haría frenar.</p>
                </div>
                <span className="sms-app-pill active">SMS</span>
              </div>

              <p className="mt-4 text-sm leading-6 text-sd-muted">
                {cleanText(activity?.intro || 'Revisa remitente, tono y enlace antes de abrir o responder.')}
              </p>

              <div className="mt-4 space-y-3">
                {messages.map((message) => {
                  const reviewItem = result?.review?.find((item) => item.id === message.id);
                  const status = getInboxStatus(selections[message.id], reviewItem);

                  return (
                    <button
                      key={message.id}
                      type="button"
                      className={cn(
                        'email-list-item sms-thread-layout w-full rounded-[22px] border px-4 py-4 text-left transition',
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
                      <span
                        className={cn(
                          'sms-thread-avatar mt-1',
                          status.tone === 'idle' ? 'safe' : status.tone,
                          selectedId === message.id ? 'large' : ''
                        )}
                      >
                        {getAvatarLabel(message)}
                      </span>
                      <div className="sms-thread-main">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="email-list-name truncate text-sm text-sd-text">{message.displayName}</strong>
                          <span className="email-list-date text-xs text-sd-muted">{message.dateLabel}</span>
                        </div>
                        <p className="email-list-subject mt-1 truncate text-sm font-medium text-sd-text">{message.subject}</p>
                        <p className="email-list-preview mt-1 line-clamp-2 text-xs leading-5 text-sd-muted">
                          {message.preview || message.body[0] || 'Sin vista previa'}
                        </p>
                        <div className="sms-thread-footer mt-3">
                          <span className={cn('sms-thread-chip', message.linkPreview ? 'has-link' : 'neutral')}>
                            {message.linkPreview ? 'Incluye enlace' : 'Texto directo'}
                          </span>
                          <span
                            className={cn(
                              'email-list-status rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                              status.tone === 'correct'
                                ? 'correct bg-emerald-100 text-emerald-700'
                                : status.tone === 'wrong'
                                  ? 'wrong bg-amber-100 text-amber-700'
                                  : status.tone === 'flagged'
                                    ? 'flagged bg-rose-100 text-rose-700'
                                    : status.tone === 'safe'
                                      ? 'safe bg-sky-100 text-sky-700'
                                      : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Bandeja principal</p>
                  <h3 className="font-display text-xl tracking-[-0.03em] text-sd-text">Correos por revisar</h3>
                  <p className="mt-2 text-sm leading-6 text-sd-muted">
                    {cleanText(activity?.intro || 'Busca remitente, cuerpo, enlaces y contexto antes de clasificar.')}
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
                        'email-list-item w-full rounded-[22px] border px-4 py-4 text-left transition',
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
                        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                          {getAvatarLabel(message)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="email-list-name truncate text-sm text-sd-text">{message.displayName}</strong>
                            <span className="email-list-date text-xs text-sd-muted">{message.dateLabel}</span>
                          </div>
                          <p className="email-list-subject mt-1 truncate text-sm font-medium text-sd-text">{message.subject}</p>
                          <p className="email-list-preview mt-1 line-clamp-2 text-xs leading-5 text-sd-muted">
                            {message.preview || message.body[0] || 'Sin vista previa'}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-sd-muted">
                              {message.linkPreview ? 'Incluye enlace' : 'Texto directo'}
                            </span>
                            <span
                              className={cn(
                                'email-list-status rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                                status.tone === 'correct'
                                  ? 'correct bg-emerald-100 text-emerald-700'
                                  : status.tone === 'wrong'
                                    ? 'wrong bg-amber-100 text-amber-700'
                                    : status.tone === 'flagged'
                                      ? 'flagged bg-rose-100 text-rose-700'
                                      : status.tone === 'safe'
                                        ? 'safe bg-sky-100 text-sky-700'
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
            </>
          )}
        </ImmersivePanel>

        {selectedMessage ? (
          <ImmersivePanel className={cn('email-reader', isSms ? 'sms-reader-body' : '')}>
            {isSms ? (
              <>
                <div className="sms-reader-topbar sms-reader-head border-b border-sd-border pb-4">
                  <div className="sms-reader-contact">
                    <span
                      className={cn(
                        'sms-thread-avatar large',
                        selectedStatus?.tone === 'idle' ? 'safe' : selectedStatus?.tone || 'safe'
                      )}
                    >
                      {getAvatarLabel(selectedMessage)}
                    </span>
                    <div>
                      <strong>{selectedMessage.displayName}</strong>
                      <span>{selectedMessage.from || 'SMS sin remitente claro'}</span>
                    </div>
                  </div>
                  <div className="sms-reader-status">
                    <span className="sms-reader-dot" />
                    {selectedStatus?.label || 'Canal SMS'}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">Lectura del mensaje</p>
                    <h3 className="font-display text-xl tracking-[-0.03em] text-sd-text">{selectedMessage.subject}</h3>
                    <p className="mt-2 text-sm text-sd-muted">
                      {selectedMessage.dateLabel} · {selectedMessage.details?.replyTo || selectedMessage.from || 'Sin dato'}
                    </p>
                  </div>
                  <div className="sms-open-actions flex flex-wrap gap-2">
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
                  <div className="sms-warning-card mt-4 rounded-[20px] border border-amber-300/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
                    {selectedMessage.warning}
                  </div>
                ) : null}

                {showDetails ? (
                  <div className="sms-details-card mt-4 grid gap-3 rounded-[22px] border border-sd-border p-4 text-sm text-sd-muted sm:grid-cols-2">
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

                <div className="sms-body-card mt-4 rounded-[24px] border border-sd-border">
                  <div className="sms-message-stack">
                    {selectedMessage.body.map((line) => (
                      <p className="sms-message-bubble text-sm leading-6 text-sd-text" key={`${selectedMessage.id}-${line}`}>
                        {line}
                      </p>
                    ))}
                  </div>

                  {selectedMessage.attachments.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedMessage.attachments.map((item) => (
                        <span className="sms-thread-chip neutral rounded-full border border-sd-border bg-white px-3 py-1 text-xs font-medium text-sd-muted" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {selectedMessage.linkPreview ? (
                    <div className="sms-link-preview mt-4 rounded-[18px] border px-4 py-3">
                      <p className="sms-link-label">Enlace detectado</p>
                      <strong className="block text-sm text-sd-text">{selectedMessage.linkPreview}</strong>
                    </div>
                  ) : null}
                </div>

                <div className="sms-reader-footer mt-4 rounded-[22px] border border-sd-border p-4">
                  <p className="text-sm font-semibold text-sd-text">¿Cómo clasificarías este SMS?</p>
                  <div className="sms-classify-actions mt-3">
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
                        'sms-review-card mt-4 rounded-[20px] border px-4 py-4 text-sm',
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
              </>
            ) : (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="eyebrow">Lectura del correo</p>
                    <h3 className="font-display text-xl tracking-[-0.03em] text-sd-text">{selectedMessage.subject}</h3>
                    <p className="mt-2 text-sm text-sd-muted">
                      {`${selectedMessage.displayName}${selectedMessage.from ? ` <${selectedMessage.from}>` : ''}`}
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
                      <p className="rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-sd-text" key={`${selectedMessage.id}-${line}`}>
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
                  <p className="text-sm font-semibold text-sd-text">¿Cómo clasificarías este correo?</p>
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
              </>
            )}
          </ImmersivePanel>
        ) : null}
      </div>

      <div className="col-span-full">
        <FeedbackPanel feedback={feedback} />
      </div>

      {result ? (
        <div className="review-grid col-span-full">
          {result.review.map((item) => (
            <article className={`review-card ${item.status} ${isSms ? 'sms-review-card' : ''}`.trim()} key={item.id}>
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

      <div className="activity-actions col-span-full">
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
