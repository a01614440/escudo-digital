function MetricCard({ label, value, note }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-note">{note}</p>
    </article>
  );
}

function AnalyticsBars({ title, items, valueKey = 'value', labelKey = 'label', suffix = '' }) {
  const peak = Math.max(...items.map((item) => Number(item?.[valueKey]) || 0), 1);

  return (
    <article className="panel admin-card">
      <p className="eyebrow">Analitica</p>
      <h3>{title}</h3>
      <div className="analytics-bar-list">
        {items.length ? (
          items.map((item, index) => (
            <div className="analytics-bar-row" key={`${item?.[labelKey] || index}`}>
              <div className="analytics-bar-top">
                <span className="analytics-bar-label">{item?.[labelKey]}</span>
                <span className="analytics-bar-value">
                  {item?.[valueKey]}
                  {suffix}
                </span>
              </div>
              <div className="analytics-bar-track">
                <div
                  className="analytics-bar-fill"
                  style={{ width: `${((Number(item?.[valueKey]) || 0) / peak) * 100}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="hint">Todavia no hay suficientes datos.</p>
        )}
      </div>
    </article>
  );
}

function AnalyticsTable({ title, rows, columns }) {
  return (
    <article className="panel admin-card">
      <p className="eyebrow">Analitica</p>
      <h3>{title}</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={`${row.title || row.email || rowIndex}`}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.format ? column.format(row?.[column.key], row) : row?.[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>Todavia no hay datos suficientes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function AdminView({
  analytics,
  loading,
  error,
  onBack,
  onRefresh,
  onExport,
}) {
  const overview = analytics?.overview || {};

  return (
    <section id="adminView" className="page">
      <header className="hero">
        <p className="eyebrow">Panel interno</p>
        <h1>Analitica del proyecto</h1>
        <p className="lead">
          Este panel usa la base real de PostgreSQL para resumir impacto, aprendizaje y
          vulnerabilidades.
        </p>
      </header>

      <section className="panel session-bar">
        <div>
          <p className="eyebrow">Vista administrativa</p>
          <h2>Metrica y seguimiento</h2>
          <p className="hint">
            Puedes refrescar la informacion o exportar el snapshot actual para analisis externo.
          </p>
        </div>
        <div className="row inline nav-responsive">
          <button className="btn ghost" type="button" onClick={onBack}>
            Volver
          </button>
          <button className="btn ghost" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn primary" type="button" onClick={onExport} disabled={!analytics}>
            Exportar JSON
          </button>
        </div>
      </section>

      {error ? (
        <section className="panel">
          <div className="alert">{error}</div>
        </section>
      ) : null}

      <section className="admin-grid">
        <MetricCard
          label="Usuarios totales"
          value={overview.totalUsers ?? 0}
          note={`${overview.activeUsers7d ?? 0} activos en los ultimos 7 dias`}
        />
        <MetricCard
          label="Blindaje promedio"
          value={`${overview.averageShield ?? 0}%`}
          note={`Mejora media: ${overview.averageImprovement ?? 0} puntos`}
        />
        <MetricCard
          label="Finalizacion de modulos"
          value={`${overview.moduleCompletionRate ?? 0}%`}
          note={`Actividades completadas: ${overview.activityCompletionRate ?? 0}%`}
        />
        <MetricCard
          label="Dias para mejorar"
          value={
            overview.avgDaysToImprove === null || overview.avgDaysToImprove === undefined
              ? '—'
              : overview.avgDaysToImprove
          }
          note="Promedio para superar el nivel base"
        />
      </section>

      <section className="analytics-grid">
        <AnalyticsBars title="Usuarios por edad" items={analytics?.ageBuckets || []} valueKey="count" />
        <AnalyticsBars
          title="Vulnerabilidad por tema"
          items={(analytics?.vulnerabilityByTopic || []).slice(0, 6)}
          valueKey="vulnerableCount"
        />
        <AnalyticsBars
          title="Desempeno por tema"
          items={analytics?.topicPerformance || []}
          valueKey="avgScore"
          suffix="%"
        />
        <AnalyticsBars
          title="Mejora por edad"
          items={analytics?.improvementByAge || []}
          valueKey="avgImprovement"
          labelKey="age"
          suffix=" pts"
        />
      </section>

      <section className="analytics-grid">
        <AnalyticsBars title="Mix de decisiones" items={analytics?.decisionMix || []} />
        <AnalyticsBars
          title="Tiempo por modulo"
          items={(analytics?.timeByModule || []).slice(0, 8)}
          valueKey="avgTimeMin"
          labelKey="title"
          suffix=" min"
        />
      </section>

      <AnalyticsTable
        title="Rendimiento por modulo"
        rows={Array.isArray(analytics?.modulePerformance) ? analytics.modulePerformance.slice(0, 12) : []}
        columns={[
          { key: 'title', label: 'Modulo' },
          { key: 'category', label: 'Tema' },
          { key: 'level', label: 'Nivel' },
          { key: 'avgScore', label: 'Score', format: (value) => `${value}%` },
          { key: 'completionRate', label: 'Finalizacion', format: (value) => `${value}%` },
          { key: 'avgTimeMin', label: 'Tiempo', format: (value) => `${value} min` },
        ]}
      />

      <AnalyticsTable
        title="Resumen de usuarios"
        rows={Array.isArray(analytics?.users) ? analytics.users.slice(0, 15) : []}
        columns={[
          { key: 'email', label: 'Correo' },
          { key: 'age', label: 'Edad' },
          { key: 'initialLevel', label: 'Nivel inicial' },
          { key: 'currentShield', label: 'Blindaje', format: (value) => `${value}%` },
          { key: 'improvement', label: 'Mejora' },
          { key: 'progressPercent', label: 'Avance', format: (value) => `${value}%` },
        ]}
      />
    </section>
  );
}
