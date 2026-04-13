import {
  buildAdminHighlights,
  buildAdminOverviewCards,
  cleanAnalyticsText,
  formatAnalyticsValue,
  getPeakValue,
  normalizeAnalyticsItems,
} from '../lib/adminAnalytics.js';
import { cn } from '../lib/ui.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

const COMPACT_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact']);
const BALANCED_VIEWPORTS = new Set(['tablet', 'laptop', 'desktop']);

function MetricTile({ label, value, note }) {
  return (
    <article className="rounded-[24px] border border-sd-border bg-white/75 p-5 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.45)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">{label}</p>
      <strong className="mt-3 block font-display text-3xl tracking-[-0.05em] text-sd-text">
        {value}
      </strong>
      <p className="mt-3 text-sm leading-6 text-sd-muted">{note}</p>
    </article>
  );
}

function AnalyticsBarPanel({
  title,
  intro,
  items,
  valueKey = 'value',
  labelKey = 'label',
  suffix = '',
}) {
  const normalized = normalizeAnalyticsItems(items, { labelKey, valueKey, limit: 8 });
  const peak = getPeakValue(normalized, 'value');

  return (
    <SurfaceCard padding="compact">
      <p className="eyebrow">Analitica</p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-sd-text">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-sd-muted">{intro}</p>

      <div className="mt-5 grid gap-3">
        {normalized.length ? (
          normalized.map((item) => (
            <article key={item.key} className="rounded-[22px] border border-sd-border bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <strong className="text-sm text-sd-text">{item.label}</strong>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-sd-muted">
                  {formatAnalyticsValue(item.value, { suffix })}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sd-accent"
                  style={{ width: `${(item.value / peak) * 100}%` }}
                />
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-sd-border bg-white/55 px-4 py-5 text-sm text-sd-muted">
            Todavia no hay suficientes datos para mostrar esta vista.
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

function ResponsiveAnalyticsTable({ title, intro, rows, columns, compact = false }) {
  return (
    <SurfaceCard className="overflow-hidden">
      <p className="eyebrow">Analitica</p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-sd-text">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-sd-muted">{intro}</p>

      {!rows.length ? (
        <div className="mt-5 rounded-[22px] border border-dashed border-sd-border bg-white/55 px-4 py-5 text-sm text-sd-muted">
          Todavia no hay datos suficientes para esta tabla.
        </div>
      ) : compact ? (
        <div className="mt-5 grid gap-3">
          {rows.map((row, rowIndex) => (
            <article
              key={`${row.email || row.title || rowIndex}`}
              className="rounded-[24px] border border-sd-border bg-white/72 p-4"
            >
              <div className="grid gap-3">
                {columns.map((column) => {
                  const rawValue = row?.[column.key];
                  const displayValue = column.format
                    ? column.format(rawValue, row)
                    : cleanAnalyticsText(rawValue, 'Sin dato');
                  return (
                    <div
                      key={column.key}
                      className="grid gap-1 rounded-[18px] border border-sd-border/70 bg-white/72 px-3 py-3"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                        {column.label}
                      </span>
                      <strong className="text-sm leading-6 text-sd-text">{displayValue}</strong>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-[24px] border border-sd-border bg-white/65">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-sd-accent-soft/60 text-left">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={`${row.email || row.title || rowIndex}`}
                  className="border-t border-sd-border/70"
                >
                  {columns.map((column) => {
                    const rawValue = row?.[column.key];
                    const displayValue = column.format
                      ? column.format(rawValue, row)
                      : cleanAnalyticsText(rawValue, 'Sin dato');
                    return (
                      <td key={column.key} className="px-4 py-3 align-top text-sd-text">
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SurfaceCard>
  );
}

function LoadingState() {
  return (
    <SurfaceCard className="mx-auto max-w-4xl">
      <p className="eyebrow">Panel interno</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">
        Cargando analitica
      </h2>
      <p className="mt-4 max-w-[60ch] text-sm leading-7 text-sd-muted sm:text-base">
        Estamos consultando la base real para recuperar indicadores, vulnerabilidades y avance.
      </p>
    </SurfaceCard>
  );
}

export default function AdminView({
  viewport = 'desktop',
  analytics,
  loading,
  error,
  onBack,
  onRefresh,
  onExport,
}) {
  const compact = COMPACT_VIEWPORTS.has(viewport);
  const balanced = BALANCED_VIEWPORTS.has(viewport);
  const overviewCards = buildAdminOverviewCards(analytics?.overview || {});
  const highlights = buildAdminHighlights(analytics || {});
  const modulePerformanceRows = Array.isArray(analytics?.modulePerformance)
    ? analytics.modulePerformance.slice(0, 12)
    : [];
  const userRows = Array.isArray(analytics?.users) ? analytics.users.slice(0, 15) : [];

  if (loading && !analytics && !error) {
    return (
      <section id="adminView" className="sd-page-shell py-8 sm:py-10">
        <LoadingState />
      </section>
    );
  }

  return (
    <section id="adminView" className="sd-page-shell py-8 sm:py-10">
      <div className="grid gap-5">
        <SurfaceCard className="overflow-hidden">
          <div
            className={cn(
              'grid gap-5',
              balanced ? 'xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]' : ''
            )}
          >
            <div>
              <p className="eyebrow">Panel interno</p>
              <h1 className="sd-title mt-3">Analitica del proyecto</h1>
              <p className="mt-4 max-w-[62ch] text-sm leading-7 text-sd-muted sm:text-base">
                Esta vista resume impacto, aprendizaje y puntos de friccion usando la base real de
                PostgreSQL. La jerarquia se adapta para revisar rapido en movil y explorar con mas
                contexto en tablet, laptop o desktop.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge tone="accent">{loading ? 'Actualizando datos' : 'Datos en vivo'}</Badge>
                <Badge tone="soft">{compact ? 'Resumen guiado para movil' : 'Vista amplia para analisis'}</Badge>
                {highlights[0] ? <Badge tone="neutral">{highlights[0].value}</Badge> : null}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[24px] border border-sd-border bg-white/72 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                  Vista administrativa
                </p>
                <p className="mt-3 text-sm leading-6 text-sd-text">
                  Puedes refrescar la fotografia actual y exportar el snapshot sin salir del panel.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button variant="ghost" type="button" onClick={onBack}>
                    Volver
                  </Button>
                  <Button variant="ghost" type="button" onClick={onRefresh} disabled={loading}>
                    {loading ? 'Actualizando...' : 'Actualizar'}
                  </Button>
                  <Button variant="primary" type="button" onClick={onExport} disabled={!analytics}>
                    Exportar JSON
                  </Button>
                </div>
              </div>

              {highlights.length > 1 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {highlights.slice(1).map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[22px] border border-sd-border bg-white/66 px-4 py-4"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                        {item.label}
                      </span>
                      <strong className="mt-2 block text-sm leading-6 text-sd-text">
                        {item.value}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {error ? <div className="alert mt-5">{error}</div> : null}
        </SurfaceCard>

        {!analytics && !loading ? (
          <SurfaceCard>
            <p className="eyebrow">Sin datos</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">
              Todavia no hay analitica disponible
            </h2>
            <p className="mt-4 max-w-[60ch] text-sm leading-7 text-sd-muted sm:text-base">
              Cuando haya uso suficiente de la plataforma, aqui veras aprendizaje, progreso y
              vulnerabilidades agrupadas por tema.
            </p>
          </SurfaceCard>
        ) : null}

        {analytics ? (
          <>
            <div
              className={cn(
                'grid gap-4',
                compact
                  ? 'grid-cols-1'
                  : viewport === 'tablet'
                    ? 'grid-cols-2'
                    : 'grid-cols-2 xl:grid-cols-4'
              )}
            >
              {overviewCards.map((card) => (
                <MetricTile key={card.label} {...card} />
              ))}
            </div>

            <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'xl:grid-cols-2')}>
              <AnalyticsBarPanel
                title="Usuarios por edad"
                intro="Te ayuda a ver que segmentos estan usando mas la plataforma."
                items={analytics?.ageBuckets || []}
                valueKey="count"
              />
              <AnalyticsBarPanel
                title="Vulnerabilidad por tema"
                intro="Muestra donde hay mas usuarios en riesgo para priorizar ajustes."
                items={analytics?.vulnerabilityByTopic || []}
                valueKey="vulnerableCount"
              />
              <AnalyticsBarPanel
                title="Desempeno por tema"
                intro="Compara el score promedio entre categorias de aprendizaje."
                items={analytics?.topicPerformance || []}
                valueKey="avgScore"
                suffix="%"
              />
              <AnalyticsBarPanel
                title="Mejora por edad"
                intro="Permite detectar en que grupo etario se nota mas avance."
                items={analytics?.improvementByAge || []}
                labelKey="age"
                valueKey="avgImprovement"
                suffix=" pts"
              />
            </div>

            <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'xl:grid-cols-2')}>
              <AnalyticsBarPanel
                title="Mix de decisiones"
                intro="Resume el tipo de respuesta que mas se esta tomando en las actividades."
                items={analytics?.decisionMix || []}
              />
              <AnalyticsBarPanel
                title="Tiempo por modulo"
                intro="Sirve para detectar modulos demasiado ligeros o demasiado pesados."
                items={analytics?.timeByModule || []}
                labelKey="title"
                valueKey="avgTimeMin"
                suffix=" min"
              />
            </div>

            <ResponsiveAnalyticsTable
              title="Rendimiento por modulo"
              intro="En movil se muestra como tarjetas para reducir saturacion; en pantallas amplias vuelve a tabla."
              rows={modulePerformanceRows}
              compact={compact}
              columns={[
                { key: 'title', label: 'Modulo', format: (value) => cleanAnalyticsText(value) },
                { key: 'category', label: 'Tema', format: (value) => cleanAnalyticsText(value) },
                { key: 'level', label: 'Nivel', format: (value) => cleanAnalyticsText(value) },
                {
                  key: 'avgScore',
                  label: 'Score',
                  format: (value) => formatAnalyticsValue(value, { suffix: '%' }),
                },
                {
                  key: 'completionRate',
                  label: 'Finalizacion',
                  format: (value) => formatAnalyticsValue(value, { suffix: '%' }),
                },
                {
                  key: 'avgTimeMin',
                  label: 'Tiempo',
                  format: (value) => formatAnalyticsValue(value, { suffix: ' min' }),
                },
              ]}
            />

            <ResponsiveAnalyticsTable
              title="Resumen de usuarios"
              intro="Conserva la lectura rapida en telefono y mas densidad informativa en tablet y desktop."
              rows={userRows}
              compact={compact}
              columns={[
                { key: 'email', label: 'Correo', format: (value) => cleanAnalyticsText(value) },
                { key: 'age', label: 'Edad', format: (value) => cleanAnalyticsText(value) },
                {
                  key: 'initialLevel',
                  label: 'Nivel inicial',
                  format: (value) => cleanAnalyticsText(value),
                },
                {
                  key: 'currentShield',
                  label: 'Blindaje',
                  format: (value) => formatAnalyticsValue(value, { suffix: '%' }),
                },
                {
                  key: 'improvement',
                  label: 'Mejora',
                  format: (value) => formatAnalyticsValue(value),
                },
                {
                  key: 'progressPercent',
                  label: 'Avance',
                  format: (value) => formatAnalyticsValue(value, { suffix: '%' }),
                },
              ]}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
