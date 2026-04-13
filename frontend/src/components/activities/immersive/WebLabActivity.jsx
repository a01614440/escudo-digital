import { useEffect, useMemo, useRef, useState } from 'react';
import { feedbackRatingLabel, feedbackToText } from '../../../lib/course.js';
import { cn } from '../../../lib/ui.js';
import FeedbackPanel from '../../FeedbackPanel.jsx';
import Button from '../../ui/Button.jsx';
import {
  ActivitySummaryBar,
  buildActivityFeedback,
  completeActivity,
  formatPercent,
} from '../sharedActivityUi.jsx';
import {
  ImmersiveAsidePanel,
  ImmersivePanel,
} from './immersivePrimitives.jsx';
import { cleanText, TARGET_LABELS } from './shared.js';
import {
  buildWebLabHotspots,
  buildWebLabPage,
  scoreHotspots,
} from './webLabActivityUtils.js';

function formatCountdown(seconds) {
  return `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(
    Math.max(0, seconds) % 60
  ).padStart(2, '0')}`;
}

export default function WebLabActivity({ activity, startedAtRef, onComplete }) {
  const page = useMemo(() => buildWebLabPage(activity), [activity]);
  const hotspots = useMemo(() => buildWebLabHotspots(activity), [activity]);
  const hotspotMap = useMemo(
    () => new Map(hotspots.map((hotspot) => [hotspot.target, hotspot])),
    [hotspots]
  );
  const targetLabels = useMemo(() => {
    const next = { ...TARGET_LABELS };
    page.productos.forEach((product, index) => {
      next[`product_${index}`] = product.nombre;
    });
    return next;
  }, [page.productos]);
  const decisionOptions = useMemo(
    () =>
      Array.isArray(activity?.decisionOptions)
        ? activity.decisionOptions.map((item) => cleanText(item)).filter(Boolean)
        : [],
    [activity]
  );

  const [stage, setStage] = useState('product');
  const [flagged, setFlagged] = useState(() => new Set());
  const [neutralTargets, setNeutralTargets] = useState(() => new Set());
  const [decision, setDecision] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [countdown, setCountdown] = useState(754);
  const [selectedTarget, setSelectedTarget] = useState('');
  const timerRef = useRef(null);
  const correctHotspots = hotspots.filter((hotspot) => hotspot.correcta);
  const goalCount = Math.max(1, correctHotspots.length);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setStage('product');
    setFlagged(new Set());
    setNeutralTargets(new Set());
    setDecision(null);
    setFeedback(null);
    setResult(null);
    setCartItems([]);
    setSelectedTarget('');
  }, [activity?.id]);

  const registerTarget = (target, fallbackText) => {
    if (result) return;
    const hotspot = hotspotMap.get(target);
    setSelectedTarget(target);

    if (hotspot?.correcta) {
      setFlagged((current) => {
        const next = new Set(current);
        if (next.has(target)) next.delete(target);
        else next.add(target);
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
    if (fallbackText && !hotspotMap.has(target)) {
      hotspotMap.set(target, {
        target,
        label: targetLabels[target] || target,
        explicacion: fallbackText,
        correcta: false,
      });
    }
  };

  const evaluate = () => {
    const matched = correctHotspots.filter((hotspot) => flagged.has(hotspot.target));
    const missed = correctHotspots
      .filter((hotspot) => !flagged.has(hotspot.target))
      .map((hotspot) => hotspot.label);
    const wrong = Array.from(neutralTargets).map(
      (target) => targetLabels[target] || hotspotMap.get(target)?.label || target
    );
    const score = scoreHotspots({
      hotspots,
      flagged,
      neutralTargets,
      decision,
      decisionOptions,
      correctDecision: activity?.correctDecision,
    });
    const decisionLabel =
      decision !== null && decisionOptions[decision]
        ? decisionOptions[decision]
        : 'Sin decisión final';
    const nextFeedback = buildActivityFeedback({
      title: feedbackRatingLabel(score),
      score,
      signal: `Detectaste ${matched.length} de ${correctHotspots.length} señales relevantes dentro del sitio.`,
      risk:
        'El riesgo aparece cuando un sitio mezcla urgencia, pagos inseguros, contacto ambiguo y políticas poco claras.',
      action:
        'Antes de pagar, valida dominio, empresa, políticas y método de pago por fuera del propio sitio.',
      detected: matched.map((hotspot) => hotspot.label),
      missed: missed.slice(0, 5),
      extra: wrong.length
        ? `También marcaste elementos que no eran señal clara: ${wrong.join(' | ')}. Decisión final: ${decisionLabel}.`
        : `Decisión final: ${decisionLabel}.`,
    });

    setResult({
      score,
      matched,
      missed,
      wrong,
      expectedCount: correctHotspots.length,
      decisionLabel,
    });
    setFeedback(nextFeedback);
  };

  const selectedNote =
    hotspotMap.get(selectedTarget)?.explicacion ||
    'Selecciona una parte del sitio para ver la pista.';
  const foundLabels = Array.from(flagged).map(
    (target) => hotspotMap.get(target)?.label || targetLabels[target] || target
  );
  const cartPreview = cartItems.length ? cartItems : page.productos.slice(0, 1);

  return (
    <>
      <ActivitySummaryBar
        items={[
          {
            label: 'Etapa',
            value: stage === 'product' ? 'Producto' : stage === 'cart' ? 'Carrito' : 'Checkout',
            caption: 'Recorre el flujo completo antes de decidir.',
          },
          {
            label: 'Hallazgos',
            value: `${flagged.size}/${goalCount}`,
            caption: 'Busca precisión: no hace falta marcar todo.',
          },
          {
            label: 'Decisión',
            value:
              decision !== null && decisionOptions[decision]
                ? decisionOptions[decision]
                : 'Pendiente',
            caption: 'Tu decisión final también cuenta.',
          },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,0.9fr)]">
        <ImmersivePanel>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow">Laboratorio web</p>
              <h3 className="font-display text-2xl tracking-[-0.04em] text-sd-text">
                Explora una tienda antes de confiar
              </h3>
              <p className="mt-2 max-w-[60ch] text-sm leading-6 text-sd-muted">{page.heroBody}</p>
            </div>
            <div className="grid gap-2 sm:text-right">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                {page.browserTitle}
              </span>
              <button
                className="rounded-full border border-sd-border bg-white/85 px-4 py-2 text-sm font-medium text-sd-text"
                type="button"
                onClick={() =>
                  registerTarget(
                    'domain',
                    'El dominio visible es uno de los primeros puntos que conviene revisar.'
                  )
                }
              >
                {page.dominio}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ['product', 'Producto'],
              ['cart', 'Carrito'],
              ['checkout', 'Checkout'],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant={stage === value ? 'primary' : 'ghost'}
                size="compact"
                type="button"
                onClick={() => setStage(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {stage === 'product' ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.85fr)]">
                <div className="rounded-[26px] border border-sd-border bg-gradient-to-br from-sky-50 via-white to-sd-accent-soft p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-accent">
                        {page.sealLabel}
                      </p>
                      <h4 className="mt-2 font-display text-2xl tracking-[-0.04em] text-sd-text">
                        {page.heroTitle}
                      </h4>
                    </div>
                    <button
                      className="rounded-[22px] border border-sd-border bg-white/80 px-4 py-4 text-left"
                      type="button"
                      onClick={() =>
                        registerTarget(
                          'banner',
                          'La cuenta regresiva por sí sola no basta. Mira si también te presiona a actuar hoy.'
                        )
                      }
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                        Termina en
                      </span>
                      <strong className="mt-2 block text-2xl text-sd-text">
                        {formatCountdown(countdown)}
                      </strong>
                    </button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <button
                    className="rounded-[22px] border border-sd-border bg-white/75 px-4 py-4 text-left"
                    type="button"
                    onClick={() =>
                      registerTarget(
                        'contacto',
                        'Revisa si aparece empresa, soporte verificable y un canal claro.'
                      )
                    }
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                      Atención
                    </span>
                    <strong className="mt-2 block text-base text-sd-text">{page.contacto}</strong>
                  </button>
                  <button
                    className="rounded-[22px] border border-sd-border bg-white/75 px-4 py-4 text-left"
                    type="button"
                    onClick={() =>
                      registerTarget(
                        'shipping',
                        'Un cargo de protección puede ser ambiguo si no explica qué cubre.'
                      )
                    }
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                      Envío
                    </span>
                    <strong className="mt-2 block text-base text-sd-text">{page.shipping}</strong>
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {page.productos.map((product, index) => (
                  <article
                    className="rounded-[24px] border border-sd-border bg-white/80 p-4"
                    key={`${product.nombre}-${index}`}
                  >
                    <button
                      className="flex h-36 w-full items-center justify-center rounded-[20px] border border-sd-border bg-slate-50 text-4xl font-display text-sd-text"
                      type="button"
                      onClick={() =>
                        registerTarget(
                          `product_${index}`,
                          'El producto por sí solo no confirma fraude. Lo importante es revisar pagos, dominio, urgencia y políticas.'
                        )
                      }
                    >
                      {(product.nombre || 'P').slice(0, 1)}
                    </button>
                    <div className="mt-4">
                      <div className="flex items-start justify-between gap-3">
                        <strong className="text-base text-sd-text">{product.nombre}</strong>
                        <span className="rounded-full bg-sd-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sd-accent">
                          {product.badge}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-sm text-sd-muted">
                        {product.antes ? <span className="line-through">{product.antes}</span> : null}
                        <strong className="text-lg text-sd-text">{product.precio}</strong>
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="compact"
                        type="button"
                        onClick={() => registerTarget(`product_${index}`)}
                      >
                        Revisar producto
                      </Button>
                      <Button
                        variant="primary"
                        size="compact"
                        type="button"
                        onClick={() => {
                          setCartItems((current) =>
                            current.some((item) => item.cartId === `product-${index}`)
                              ? current
                              : [...current, { ...product, cartId: `product-${index}` }]
                          );
                          setStage('cart');
                        }}
                      >
                        Agregar al carrito
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {stage === 'cart' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.9fr)]">
              <section className="rounded-[24px] border border-sd-border bg-white/80 p-4">
                <p className="eyebrow">Carrito reservado</p>
                <div className="mt-4 space-y-3">
                  {cartPreview.map((item, index) => (
                    <article
                      className="flex items-center gap-4 rounded-[22px] border border-sd-border bg-white/70 px-4 py-4"
                      key={item.cartId || `${item.nombre}-${index}`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-slate-100 text-lg font-display text-sd-text">
                        {(item.nombre || 'P').slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sd-text">{item.nombre}</strong>
                        <span className="text-sm text-sd-muted">{item.precio}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <aside className="grid gap-4">
                <button
                  className="rounded-[22px] border border-sd-border bg-white/75 px-4 py-4 text-left"
                  type="button"
                  onClick={() =>
                    registerTarget(
                      'shipping',
                      'Aquí el costo extra y el discurso de protección están integrados para presionarte.'
                    )
                  }
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                    Cargo extra
                  </span>
                  <strong className="mt-2 block text-base text-sd-text">{page.shipping}</strong>
                </button>
                <button
                  className="rounded-[22px] border border-sd-border bg-white/75 px-4 py-4 text-left"
                  type="button"
                  onClick={() =>
                    registerTarget(
                      'order_summary',
                      'El resumen por sí solo no es una señal clara; la alerta está en pagos, urgencia y políticas.'
                    )
                  }
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                    Resumen
                  </span>
                  <strong className="mt-2 block text-base text-sd-text">
                    {cartPreview[0]?.precio || '$0'}
                  </strong>
                </button>
              </aside>
            </div>
          ) : null}

          {stage === 'checkout' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.95fr)]">
              <section className="rounded-[24px] border border-sd-border bg-white/80 p-4">
                <p className="eyebrow">Checkout</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {['Nombre completo', 'Dirección', 'Teléfono', 'Referencias'].map((field) => (
                    <button
                      className="rounded-[20px] border border-sd-border bg-white/70 px-4 py-4 text-left text-sm text-sd-text"
                      key={field}
                      type="button"
                      onClick={() =>
                        registerTarget(
                          'address_form',
                          'Pedir datos de envío es normal. La alerta principal suele estar en pagos, urgencia y políticas.'
                        )
                      }
                    >
                      {field}
                    </button>
                  ))}
                </div>
                <button
                  className="mt-4 w-full rounded-[22px] border border-amber-300/70 bg-amber-50/90 px-4 py-4 text-left"
                  type="button"
                  onClick={() =>
                    registerTarget(
                      'banner',
                      'Aquí la urgencia está integrada en el momento final para empujarte a pagar.'
                    )
                  }
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Presión final
                  </span>
                  <strong className="mt-2 block text-base text-sd-text">{page.checkoutPrompt}</strong>
                </button>
              </section>
              <aside className="grid gap-4">
                <button
                  className="rounded-[22px] border border-sd-border bg-white/75 px-4 py-4 text-left"
                  type="button"
                  onClick={() =>
                    registerTarget(
                      'pago',
                      'Revisa si el método de pago te quita protección o te saca a una ruta externa.'
                    )
                  }
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                    Pago
                  </span>
                  <strong className="mt-2 block text-base text-sd-text">
                    {page.pagos.join(' · ')}
                  </strong>
                </button>
                <button
                  className="rounded-[22px] border border-sd-border bg-white/75 px-4 py-4 text-left"
                  type="button"
                  onClick={() =>
                    registerTarget(
                      'policy',
                      'Una política ambigua te deja sin respaldo si algo sale mal.'
                    )
                  }
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                    Políticas
                  </span>
                  <strong className="mt-2 block text-base text-sd-text">{page.policy}</strong>
                </button>
              </aside>
            </div>
          ) : null}

          {decisionOptions.length ? (
            <section className="mt-5 rounded-[24px] border border-sd-border bg-white/70 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">Decisión final</p>
                  <h4 className="text-lg font-semibold text-sd-text">
                    {cleanText(activity?.decisionPrompt || '¿Qué harías con este sitio?')}
                  </h4>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] text-sd-muted">
                  Se evalúa junto con tus hallazgos
                </span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {decisionOptions.map((option, index) => (
                  <button
                    className={cn(
                      'rounded-[20px] border px-4 py-4 text-left text-sm transition',
                      decision === index
                        ? 'border-sd-accent bg-sd-accent-soft text-sd-text'
                        : 'border-sd-border bg-white/75 text-sd-text hover:bg-white'
                    )}
                    disabled={Boolean(result)}
                    key={option}
                    type="button"
                    onClick={() => setDecision(index)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </ImmersivePanel>

        <aside className="grid gap-4">
          <ImmersiveAsidePanel eyebrow="Hallazgos detectados">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-lg text-sd-text">{`${flagged.size}/${goalCount}`}</strong>
              <span className="text-xs uppercase tracking-[0.14em] text-sd-muted">
                Meta sugerida
              </span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sd-accent transition-all"
                style={{ width: `${Math.min(100, Math.round((flagged.size / goalCount) * 100))}%` }}
              />
            </div>
            <div className="mt-4 space-y-2 text-sm text-sd-muted">
              {foundLabels.length ? (
                foundLabels.map((item) => (
                  <p key={item} className="rounded-[16px] bg-white/80 px-3 py-2 text-sd-text">
                    {item}
                  </p>
                ))
              ) : (
                <p>Aún no has marcado ninguna alerta.</p>
              )}
            </div>
          </ImmersiveAsidePanel>

          <ImmersiveAsidePanel
            eyebrow="Foco actual"
            title={
              targetLabels[selectedTarget] ||
              hotspotMap.get(selectedTarget)?.label ||
              'Selecciona una parte del sitio'
            }
            body={selectedNote}
          />
        </aside>
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
                ? result.matched.map((item) => item.label).join(' | ')
                : 'No detectaste las señales clave esperadas en este sitio.'}
            </p>
          </article>
          <article className={`review-card ${result.missed.length ? 'wrong' : 'correct'}`.trim()}>
            <div className="review-card-head">
              <strong>Te faltó revisar</strong>
              <span>{result.missed.length}</span>
            </div>
            <p>
              {result.missed.length
                ? result.missed.join(' | ')
                : 'Cubriste las señales principales.'}
            </p>
          </article>
          <article className={`review-card ${result.wrong.length ? 'warn' : 'correct'}`.trim()}>
            <div className="review-card-head">
              <strong>Marcaste de más</strong>
              <span>{result.wrong.length}</span>
            </div>
            <p>{result.wrong.length ? result.wrong.join(' | ') : 'Tus hallazgos fueron precisos.'}</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Decisión final</strong>
              <span>{formatPercent(result.score)}</span>
            </div>
            <p>{result.decisionLabel}</p>
          </article>
        </div>
      ) : null}

      <div className="activity-actions">
        {!result ? (
          <Button variant="primary" type="button" onClick={evaluate}>
            Evaluar hallazgos
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              type="button"
              onClick={() =>
                completeActivity(startedAtRef, onComplete, result.score, feedbackToText(feedback), {
                  flaggedTargets: Array.from(flagged),
                  neutralTargets: Array.from(neutralTargets),
                  decision,
                  stage,
                })
              }
            >
              Continuar
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setStage('product');
                setFlagged(new Set());
                setNeutralTargets(new Set());
                setDecision(null);
                setFeedback(null);
                setResult(null);
                setCartItems([]);
                setSelectedTarget('');
              }}
            >
              Reintentar simulación
            </Button>
          </>
        )}
      </div>
    </>
  );
}
