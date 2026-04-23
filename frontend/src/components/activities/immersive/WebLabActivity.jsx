import { useEffect, useMemo, useRef, useState } from 'react';
import { feedbackToText } from '../../../lib/course.js';
import { getDecisionRatingLabel } from '../../../lib/activityScoring.js';
import { cn } from '../../../lib/ui.js';
import FeedbackPanel from '../../FeedbackPanel.jsx';
import Button from '../../ui/Button.jsx';
import { ActivitySummaryBar, buildActivityFeedback, completeActivity } from '../sharedActivityUi.jsx';
import { ImmersiveAsidePanel, ImmersivePanel } from './immersivePrimitives.jsx';
import { cleanText, getSimulationCategoryClass, TARGET_LABELS } from './shared.js';
import { buildWebLabHotspots, buildWebLabPage, scoreHotspots } from './webLabActivityUtils.js';

function formatCountdown(seconds) {
  return `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(
    Math.max(0, seconds) % 60
  ).padStart(2, '0')}`;
}

function getSelectionTone(target, flagged, neutralTargets, hotspotMap) {
  if (flagged.has(target)) {
    const hotspot = hotspotMap.get(target);
    return hotspot?.severity === 'critical' ? 'critical' : 'suspicious';
  }
  if (neutralTargets.has(target)) return 'neutral';
  return 'idle';
}

export default function WebLabActivity({ module, activity, startedAtRef, onComplete }) {
  const page = useMemo(() => buildWebLabPage(activity), [activity]);
  const hotspots = useMemo(() => buildWebLabHotspots(activity), [activity]);
  const hotspotMap = useMemo(() => new Map(hotspots.map((hotspot) => [hotspot.target, hotspot])), [hotspots]);
  const decisionOptions = useMemo(
    () =>
      Array.isArray(activity?.decisionOptions)
        ? activity.decisionOptions.map((item) => cleanText(item)).filter(Boolean)
        : [],
    [activity]
  );
  const targetLabels = useMemo(() => {
    const next = { ...TARGET_LABELS };
    page.productos.forEach((product, index) => {
      next[`product_${index}`] = product.nombre;
    });
    return next;
  }, [page.productos]);

  const [stage, setStage] = useState('product');
  const [flagged, setFlagged] = useState(() => new Set());
  const [neutralTargets, setNeutralTargets] = useState(() => new Set());
  const [decision, setDecision] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [countdown, setCountdown] = useState(754);
  const [selectedTarget, setSelectedTarget] = useState('domain');
  const timerRef = useRef(null);

  const correctHotspots = hotspots.filter((hotspot) => hotspot.correcta);
  const goalCount = Math.max(1, correctHotspots.length);
  const foundLabels = Array.from(flagged).map((target) => hotspotMap.get(target)?.label || targetLabels[target] || target);
  const selectedHotspot = hotspotMap.get(selectedTarget) || null;
  const selectedNote =
    selectedHotspot?.explicacion || 'Selecciona una parte del sitio para ver por qué sería o no una señal real.';
  const cartPreview = cartItems.length ? cartItems : page.productos.slice(0, 1);
  const exampleHotspot = correctHotspots[0] || null;

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
    setSelectedTarget('domain');
  }, [activity?.id]);

  const registerTarget = (target, fallbackText = '') => {
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
        severity: 'informational',
      });
    }
  };

  const evaluate = () => {
    const matched = correctHotspots.filter((hotspot) => flagged.has(hotspot.target));
    const missed = correctHotspots.filter((hotspot) => !flagged.has(hotspot.target)).map((hotspot) => hotspot.label);
    const wrong = Array.from(neutralTargets).map((target) => targetLabels[target] || hotspotMap.get(target)?.label || target);
    const score = scoreHotspots({
      hotspots,
      flagged,
      neutralTargets,
      module,
      decision,
      decisionOptions,
      correctDecision: activity?.correctDecision,
    });
    const decisionLabel = decision !== null && decisionOptions[decision] ? decisionOptions[decision] : 'Sin decisión final';

    const nextFeedback = buildActivityFeedback({
      title: getDecisionRatingLabel(score),
      score,
      signal: `Detectaste ${matched.length} de ${correctHotspots.length} señales realmente relevantes dentro del sitio.`,
      risk:
        'Aquí importaba priorizar dominio, pagos, políticas y presión al momento de pagar. Los detalles visuales por sí solos pesan menos.',
      action:
        'En la vida real, antes de pagar, valida dominio, empresa, políticas y método de pago por fuera del propio sitio.',
      detected: matched.map((hotspot) => hotspot.label),
      missed: missed.slice(0, 5),
      extra: wrong.length
        ? `Marcaste algunos elementos dudosos de más: ${wrong.join(' | ')}. Decisión final: ${decisionLabel}.`
        : `Decisión final: ${decisionLabel}.`,
    });

    setResult({
      score,
      matched,
      missed,
      wrong,
      decisionLabel,
    });
    setFeedback(nextFeedback);
  };

  const renderSelectableCard = (target, title, body, className = '') => {
    const tone = getSelectionTone(target, flagged, neutralTargets, hotspotMap);

    return (
      <button
        className={cn(
          'rounded-[22px] border px-4 py-4 text-left transition',
          tone === 'critical'
            ? 'border-rose-300 bg-rose-50/90'
            : tone === 'suspicious'
              ? 'border-amber-300 bg-amber-50/90'
              : tone === 'neutral'
                ? 'border-slate-300 bg-slate-50/90'
                : 'border-sd-border bg-white/78 hover:-translate-y-0.5 hover:bg-white',
          className
        )}
        type="button"
        onClick={() => registerTarget(target, body)}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">{title}</span>
        <strong className="mt-2 block text-base text-sd-text">{targetLabels[target] || title}</strong>
        <p className="mt-2 text-sm leading-6 text-sd-muted">{body}</p>
      </button>
    );
  };

  return (
    <div
      className={cn(getSimulationCategoryClass('web'), 'grid gap-4')}
      data-sd-simulation-category="web"
      data-sd-simulation-channel="weblab"
      data-sd-stage-dominance="primary"
    >
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
            caption: 'Marca solo las señales más peligrosas.',
          },
          {
            label: 'Decisión',
            value: decision !== null && decisionOptions[decision] ? decisionOptions[decision] : 'Pendiente',
            caption: 'Tu decisión final también cuenta.',
          },
        ]}
      />

      <section
        className="sd-simulation-briefing-strip grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"
        data-sd-stage-layout="briefing"
      >
        <ImmersivePanel className="bg-gradient-to-br from-white via-slate-50 to-rose-50/75">
          <p className="eyebrow">Antes de empezar</p>
          <h3 className="font-display text-2xl tracking-[-0.04em] text-sd-text">Marca solo las señales más peligrosas</h3>
          <p className="mt-3 max-w-[64ch] text-sm leading-6 text-sd-muted">
            No hace falta tocar todo. Aquí importa distinguir entre una señal sospechosa y una crítica:
            dominio, pagos, políticas y presión al momento de pagar pesan más que un detalle visual aislado.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700">Señal crítica</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">Señal sospechosa</span>
          </div>
        </ImmersivePanel>

        <ImmersiveAsidePanel
          eyebrow="Ejemplo resuelto"
          title={exampleHotspot?.label || 'Dominio visible'}
          body={exampleHotspot?.explicacion || 'Si el dominio no coincide con la marca o con una ruta oficial, esa sola señal ya merece detenerte.'}
        >
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50/85 px-4 py-3 text-sm text-emerald-900">
            Primero detecta lo que sí cambiaría tu decisión real. Después revisa detalles secundarios.
          </div>
        </ImmersiveAsidePanel>
      </section>

      <section
        className="sd-simulation-main-stage grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,0.9fr)]"
        data-sd-stage-layout="weblab-workbench"
      >
        <ImmersivePanel>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow">Laboratorio web</p>
              <h3 className="font-display text-2xl tracking-[-0.04em] text-sd-text">Explora una tienda antes de confiar</h3>
              <p className="mt-2 max-w-[60ch] text-sm leading-6 text-sd-muted">{page.heroBody}</p>
            </div>
            <div className="grid gap-2 sm:text-right">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">{page.browserTitle}</span>
              <button
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-medium',
                  getSelectionTone('domain', flagged, neutralTargets, hotspotMap) === 'critical'
                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                    : 'border-sd-border bg-white/85 text-sd-text'
                )}
                type="button"
                onClick={() => registerTarget('domain', 'El dominio visible es uno de los primeros puntos que conviene revisar.')}
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
              <Button key={value} variant={stage === value ? 'primary' : 'ghost'} size="compact" type="button" onClick={() => setStage(value)}>
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
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-accent">{page.sealLabel}</p>
                      <h4 className="mt-2 font-display text-2xl tracking-[-0.04em] text-sd-text">{page.heroTitle}</h4>
                    </div>
                    {renderSelectableCard('banner', 'Termina en', formatCountdown(countdown), 'bg-white/80')}
                  </div>
                </div>
                <div className="grid gap-3">
                  {renderSelectableCard('contacto', 'Atención', page.contacto)}
                  {renderSelectableCard('shipping', 'Envío', page.shipping)}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {page.productos.map((product, index) => (
                  <article className="rounded-[24px] border border-sd-border bg-white/80 p-4" key={`${product.nombre}-${index}`}>
                    <button
                      className="flex h-36 w-full items-center justify-center rounded-[20px] border border-sd-border bg-slate-50 text-4xl font-display text-sd-text"
                      type="button"
                      onClick={() => registerTarget(`product_${index}`, 'El producto por sí solo no confirma fraude. Revisa dominio, pagos, urgencia y políticas.')}
                    >
                      {(product.nombre || 'P').slice(0, 1)}
                    </button>
                    <div className="mt-4">
                      <div className="flex items-start justify-between gap-3">
                        <strong className="text-base text-sd-text">{product.nombre}</strong>
                        <span className="rounded-full bg-sd-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sd-accent">{product.badge}</span>
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-sm text-sd-muted">
                        {product.antes ? <span className="line-through">{product.antes}</span> : null}
                        <strong className="text-lg text-sd-text">{product.precio}</strong>
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="ghost" size="compact" type="button" onClick={() => registerTarget(`product_${index}`)}>
                        Revisar producto
                      </Button>
                      <Button
                        variant="primary"
                        size="compact"
                        type="button"
                        onClick={() => {
                          setCartItems((current) => current.some((item) => item.cartId === `product-${index}`) ? current : [...current, { ...product, cartId: `product-${index}` }]);
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
                    <article className="flex items-center gap-4 rounded-[22px] border border-sd-border bg-white/70 px-4 py-4" key={item.cartId || `${item.nombre}-${index}`}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-slate-100 text-lg font-display text-sd-text">{(item.nombre || 'P').slice(0, 1)}</div>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sd-text">{item.nombre}</strong>
                        <span className="text-sm text-sd-muted">{item.precio}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <aside className="grid gap-4">
                {renderSelectableCard('shipping', 'Cargo extra', page.shipping)}
                {renderSelectableCard('order_summary', 'Resumen', cartPreview[0]?.precio || '$0')}
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
                      onClick={() => registerTarget('address_form', 'Pedir datos de envío es normal. La alerta principal suele estar en pagos, urgencia y políticas.')}
                    >
                      {field}
                    </button>
                  ))}
                </div>
                {renderSelectableCard('banner', 'Presión final', page.checkoutPrompt, 'mt-4 w-full')}
              </section>
              <aside className="grid gap-4">
                {renderSelectableCard('pago', 'Pago', page.pagos.join(' · '))}
                {renderSelectableCard('policy', 'Políticas', page.policy)}
              </aside>
            </div>
          ) : null}
        </ImmersivePanel>

        <aside className="grid gap-4">
          <ImmersiveAsidePanel eyebrow="Pista activa" title={targetLabels[selectedTarget] || 'Selecciona una parte del sitio'} body={selectedNote}>
            {selectedHotspot ? (
              <div
                className={cn(
                  'rounded-[18px] px-4 py-3 text-sm font-medium',
                  selectedHotspot.correcta
                    ? selectedHotspot.severity === 'critical'
                      ? 'border border-rose-300 bg-rose-50/90 text-rose-900'
                      : 'border border-amber-300 bg-amber-50/90 text-amber-900'
                    : 'border border-slate-200 bg-slate-50/90 text-slate-700'
                )}
              >
                {selectedHotspot.correcta
                  ? selectedHotspot.severity === 'critical'
                    ? 'La marcaste como señal crítica.'
                    : 'La marcaste como señal sospechosa.'
                  : 'Este punto por sí solo no era una señal fuerte.'}
              </div>
            ) : null}
          </ImmersiveAsidePanel>

          <ImmersiveAsidePanel eyebrow="Hallazgos" title={`${flagged.size}/${goalCount} señales marcadas`} body="Busca precisión: primero lo crítico, luego lo dudoso.">
            {foundLabels.length ? (
              <div className="flex flex-wrap gap-2">
                {foundLabels.map((label) => (
                  <span key={label} className="rounded-full bg-sd-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sd-accent">
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-sd-muted">Aún no has marcado una señal importante.</p>
            )}
          </ImmersiveAsidePanel>

          <ImmersiveAsidePanel eyebrow="Decisión final" title="¿Seguirías con esta compra?" body="Tu decisión debe reflejar lo que harías en la vida real después de revisar el sitio.">
            <div className="grid gap-3">
              {decisionOptions.map((option, index) => (
                <Button key={option} variant={decision === index ? 'primary' : 'ghost'} type="button" onClick={() => setDecision(index)} disabled={Boolean(result)}>
                  {option}
                </Button>
              ))}
            </div>
            {!result ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="primary" type="button" onClick={evaluate} disabled={decisionOptions.length > 0 && decision === null}>
                  Evaluar decisión
                </Button>
                <Button variant="ghost" type="button" onClick={() => setStage(stage === 'product' ? 'cart' : stage === 'cart' ? 'checkout' : 'product')}>
                  {stage === 'product' ? 'Ir al carrito' : stage === 'cart' ? 'Ir al checkout' : 'Volver al producto'}
                </Button>
              </div>
            ) : null}
          </ImmersiveAsidePanel>
        </aside>
      </section>

      <FeedbackPanel feedback={feedback} />

      {result ? (
        <div className="review-grid">
          <article className="review-card correct">
            <div className="review-card-head">
              <strong>Score final</strong>
              <span>{`${Math.round(result.score * 100)}%`}</span>
            </div>
            <p>Se premió más haber detectado las señales críticas que haber marcado todo por duda.</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Señales detectadas</strong>
              <span>{result.matched.length}</span>
            </div>
            <p>{result.matched.length ? result.matched.map((item) => item.label).join(' · ') : 'No registraste señales claras.'}</p>
          </article>
          <article className="review-card">
            <div className="review-card-head">
              <strong>Decisión final</strong>
              <span>{result.decisionLabel}</span>
            </div>
            <p>La decisión final importa, pero no debería borrar un análisis razonable del sitio.</p>
          </article>
        </div>
      ) : null}

      <div className="activity-actions">
        {result ? (
          <>
            <Button
              variant="primary"
              type="button"
              onClick={() =>
                completeActivity(startedAtRef, onComplete, result.score, feedbackToText(feedback), {
                  flagged: Array.from(flagged),
                  neutralTargets: Array.from(neutralTargets),
                  decision,
                })
              }
            >
              Continuar
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setFlagged(new Set());
                setNeutralTargets(new Set());
                setDecision(null);
                setFeedback(null);
                setResult(null);
                setSelectedTarget('domain');
              }}
            >
              Reintentar
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
