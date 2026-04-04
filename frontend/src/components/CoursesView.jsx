import { useState } from 'react';
import { formatDate } from '../lib/format.js';
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  COMP_KEYS,
  LEVEL_LABELS,
  computeCompetenciesFromProgress,
  defaultTopicsFromAnswers,
  normalizeCategory,
  normalizeModuleLevel,
  normalizeRiskLevel,
  pickNextActivityIndex,
  summarizeProgressInsights,
} from '../lib/course.js';

const TOPIC_OPTIONS = COMP_KEYS.map((topic) => ({
  value: topic,
  label: CATEGORY_LABELS[topic] || topic,
}));

const PRIORITY_LABELS = {
  sms: 'detectar SMS falsos',
  web: 'verificar páginas web',
  llamadas: 'evitar llamadas fraudulentas',
  whatsapp: 'mejorar seguridad en WhatsApp',
  todo: 'cubrir todos los frentes',
};

function formatMinutesFromMs(value) {
  const minutes = Math.max(0, Math.round((Number(value) || 0) / 60000));
  if (!minutes) return 'Sin tiempo registrado';
  if (minutes === 1) return '1 min de práctica';
  return `${minutes} min de práctica`;
}

function formatPercent(value) {
  const safe = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return `${safe}%`;
}

function getPrioritySummary(answers) {
  return PRIORITY_LABELS[answers?.priority] || 'blindaje general';
}

function getWeakestTopic(competencias) {
  const entries = Object.entries(competencias || {}).filter(([key]) => COMP_KEYS.includes(key));
  if (!entries.length) return null;
  return entries.sort((a, b) => a[1] - b[1])[0];
}

function getStrongestTopic(competencias) {
  const entries = Object.entries(competencias || {}).filter(([key]) => COMP_KEYS.includes(key));
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0];
}

function getModuleStats(module, progress) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const completedEntries = activities
    .map((activity) => progress?.completed?.[activity.id])
    .filter(Boolean);
  const completedCount = completedEntries.length;
  const total = activities.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const nextActivity =
    activities.find((activity) => !progress?.completed?.[activity.id]) ||
    activities[pickNextActivityIndex({ ruta: [module] }, { completed: progress?.completed || {} }, 0)] ||
    activities[0] ||
    null;
  const avgScore = completedEntries.length
    ? Math.round(
        (completedEntries.reduce((acc, item) => acc + (Number(item.score) || 0), 0) /
          completedEntries.length) *
          100
      )
    : null;
  const moduleEntry = module?.id ? progress?.modules?.[module.id] : null;
  const seenKey = `${normalizeCategory(module?.categoria)}:${normalizeModuleLevel(module?.nivel)}`;
  const seenCount = Array.isArray(progress?.seenScenarioIds?.[seenKey])
    ? progress.seenScenarioIds[seenKey].length
    : 0;

  return {
    activities,
    completedCount,
    total,
    pct,
    nextActivity,
    avgScore,
    visits: Number(moduleEntry?.visits) || 0,
    durationLabel: formatMinutesFromMs(moduleEntry?.durationMs),
    seenCount,
    completedAt: moduleEntry?.completedAt || null,
    status: pct >= 100 ? 'completed' : pct > 0 ? 'active' : 'pending',
  };
}

function getRecommendedModuleIndex(route, progress) {
  const firstIncomplete = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return firstIncomplete === -1 ? 0 : firstIncomplete;
}

function DonutCard({ score, label }) {
  return (
    <article className="panel summary-card donut-card">
      <p className="eyebrow">Blindaje actual</p>
      <div className="donut-shell">
        <div className="shield-donut" style={{ '--p': score }}>
          <div className="shield-inner">
            <strong>{score}%</strong>
            <span>{label}</span>
          </div>
        </div>
      </div>
      <p className="hint">
        Tu puntaje se recalcula con base en tu progreso por actividad, no solo por el assessment
        inicial.
      </p>
    </article>
  );
}

function CompetencyList({ competencias }) {
  const entries = Object.entries(competencias || {}).filter(([key]) => COMP_KEYS.includes(key));

  return (
    <article className="panel summary-card">
      <p className="eyebrow">Competencias por tema</p>
      <h3>Mapa de fortalezas</h3>
      <div className="competency-list">
        {entries.map(([key, value]) => (
          <div className="comp" key={key}>
            <div className="comp-top">
              <span className="comp-name">{CATEGORY_LABELS[key] || key}</span>
              <span className="comp-val">{value}%</span>
            </div>
            <div className="comp-bar">
              <div className="comp-fill" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function CoursePreferences({ answers, value, onChange, onGenerate, generating, canGenerate }) {
  const selectedTopics =
    Array.isArray(value?.temas) && value.temas.length
      ? value.temas
      : defaultTopicsFromAnswers(answers);

  const patch = (changes) => onChange({ ...value, ...changes });

  const toggleTopic = (topic) => {
    const current = new Set(selectedTopics);
    if (current.has(topic)) current.delete(topic);
    else current.add(topic);
    patch({ temas: Array.from(current).map((item) => normalizeCategory(item)) });
  };

  return (
    <article className="panel summary-card course-preferences-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Configuración</p>
          <h3>Ajustes de la ruta</h3>
          <p className="hint">
            Regenera la ruta si quieres priorizar otros temas o cambiar el ritmo de las sesiones.
          </p>
        </div>
        <button
          className="btn primary"
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
        >
          {generating ? 'Generando...' : 'Actualizar ruta'}
        </button>
      </div>

      <div className="prefs-grid">
        <label>
          Estilo
          <select
            value={value?.estilo || 'mix'}
            onChange={(event) => patch({ estilo: event.target.value })}
          >
            <option value="mix">Mixto</option>
            <option value="practico">Más práctico</option>
            <option value="teorico">Más guiado</option>
          </select>
        </label>

        <label>
          Dificultad
          <select
            value={value?.dificultad || 'auto'}
            onChange={(event) => patch({ dificultad: event.target.value })}
          >
            <option value="auto">Automática</option>
            <option value="basico">Básica</option>
            <option value="refuerzo">Refuerzo</option>
            <option value="avanzado">Avanzada</option>
          </select>
        </label>

        <label>
          Duración por sesión
          <select
            value={value?.duracion || '5-10'}
            onChange={(event) => patch({ duracion: event.target.value })}
          >
            <option value="5-10">5-10 min</option>
            <option value="10-15">10-15 min</option>
            <option value="15-20">15-20 min</option>
          </select>
        </label>
      </div>

      <div className="question-body">
        <div className="section-title-row">
          <p className="hint">Temas prioritarios</p>
          <span className="pill soft">{selectedTopics.length} seleccionados</span>
        </div>
        <div className="option-grid">
          {TOPIC_OPTIONS.map((topic) => (
            <label key={topic.value} className="option">
              <input
                type="checkbox"
                checked={selectedTopics.includes(topic.value)}
                onChange={() => toggleTopic(topic.value)}
              />
              <span>{topic.label}</span>
            </label>
          ))}
        </div>
      </div>
    </article>
  );
}

function CourseHero({
  answers,
  assessment,
  coursePlan,
  completedCount,
  totalActivities,
  recommendedModule,
  recommendedStats,
  weakestTopic,
  onContinue,
}) {
  const stateLabel = answers?.state || 'tu contexto';
  const riskLabel = normalizeRiskLevel(assessment?.nivel || 'Medio');
  const priorityLabel = getPrioritySummary(answers);
  const weaknessText = weakestTopic
    ? `${CATEGORY_LABELS[weakestTopic[0]] || weakestTopic[0]} (${weakestTopic[1]}%)`
    : 'se seguirá ajustando con tu progreso';

  return (
    <section className="course-hero-panel panel">
      <div className="course-hero-copy">
        <p className="eyebrow">Ruta activa</p>
        <h1>Tu entrenamiento ya tiene dirección clara</h1>
        <p className="lead">
          Priorizamos {priorityLabel} para ayudarte desde {stateLabel}. Tu perfil actual se
          encuentra en nivel {riskLabel}, y la ruta mezcla práctica guiada con simulaciones para
          reforzar donde más te conviene.
        </p>

        <div className="hero-chip-row">
          <span className="pill">Riesgo actual: {riskLabel}</span>
          <span className="pill">Score base: {coursePlan?.score_name || 'Blindaje Digital'}</span>
          <span className="pill">Actividades completadas: {completedCount}/{totalActivities}</span>
          <span className="pill">Enfoque crítico: {weaknessText}</span>
        </div>

        <div className="hero-actions">
          <button className="btn primary" type="button" onClick={onContinue}>
            Continuar ruta recomendada
          </button>
        </div>
      </div>

      <aside className="course-hero-aside">
        <p className="eyebrow">Siguiente módulo sugerido</p>
        <h3>{recommendedModule?.titulo || 'Tu siguiente paso'}</h3>
        <p>{recommendedModule?.descripcion || 'Abriremos la siguiente actividad disponible.'}</p>
        <div className="hero-next-grid">
          <div className="hero-next-item">
            <span>Categoría</span>
            <strong>{CATEGORY_LABELS[recommendedModule?.categoria] || recommendedModule?.categoria}</strong>
          </div>
          <div className="hero-next-item">
            <span>Nivel</span>
            <strong>{LEVEL_LABELS[recommendedModule?.nivel] || recommendedModule?.nivel}</strong>
          </div>
          <div className="hero-next-item">
            <span>Avance</span>
            <strong>{formatPercent(recommendedStats?.pct)}</strong>
          </div>
          <div className="hero-next-item">
            <span>Siguiente actividad</span>
            <strong>{recommendedStats?.nextActivity?.titulo || 'Repaso recomendado'}</strong>
          </div>
        </div>
      </aside>
    </section>
  );
}

function ProgressStats({ items }) {
  return (
    <section className="course-stat-grid">
      {items.map((item) => (
        <article className="stat-card compact" key={item.label}>
          <p className="stat-label">{item.label}</p>
          <p className="stat-value">{item.value}</p>
          <p className="stat-note">{item.note}</p>
        </article>
      ))}
    </section>
  );
}

function FocusPanel({ insights, snapshots, strongestTopic, weakestTopic, lastAccessAt }) {
  const lastSnapshot = snapshots[0] || null;
  const previousSnapshot = snapshots[1] || null;
  const delta =
    lastSnapshot && previousSnapshot
      ? Number(lastSnapshot.scoreTotal || 0) - Number(previousSnapshot.scoreTotal || 0)
      : null;

  return (
    <section className="course-focus-grid">
      <article className="panel summary-card">
        <p className="eyebrow">Enfoque recomendado</p>
        <h3>Qué conviene reforzar ahora</h3>
        <div className="focus-stack">
          <div className="summary-item">
            <strong>Fortaleza principal</strong>
            <p>
              {strongestTopic
                ? `${CATEGORY_LABELS[strongestTopic[0]] || strongestTopic[0]} (${strongestTopic[1]}%)`
                : 'Aún estamos recogiendo suficientes datos.'}
            </p>
          </div>
          <div className="summary-item">
            <strong>Zona a reforzar</strong>
            <p>
              {weakestTopic
                ? `${CATEGORY_LABELS[weakestTopic[0]] || weakestTopic[0]} (${weakestTopic[1]}%)`
                : 'La ruta se irá afinando conforme avances.'}
            </p>
          </div>
          <div className="summary-item">
            <strong>Temas visibles</strong>
            <p>{insights?.focus?.join(' | ') || 'La app definirá esto con tus siguientes actividades.'}</p>
          </div>
        </div>
      </article>

      <article className="panel summary-card">
        <p className="eyebrow">Evolución</p>
        <h3>Señales recientes</h3>
        <div className="focus-stack">
          <div className="summary-item">
            <strong>Último acceso</strong>
            <p>{lastAccessAt ? formatDate(lastAccessAt) : 'Aún sin registro.'}</p>
          </div>
          <div className="summary-item">
            <strong>Movimiento de blindaje</strong>
            <p>
              {delta === null
                ? 'Todavía no hay suficientes hitos para comparar.'
                : delta >= 0
                  ? `Subiste ${delta} puntos entre tus dos últimos hitos.`
                  : `Bajaste ${Math.abs(delta)} puntos; conviene repasar el bloque de refuerzo.`}
            </p>
          </div>
          <div className="summary-item">
            <strong>Errores más frecuentes</strong>
            <p>
              {insights?.mistakes?.length
                ? insights.mistakes.join(' | ')
                : 'Aún no vemos errores repetidos; eso es buena señal.'}
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}

function RouteMap({ route, progress, onOpenModule }) {
  return (
    <article className="panel summary-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Mapa de ruta</p>
          <h3>Tu progreso módulo por módulo</h3>
          <p className="hint">Cada bloque prioriza un canal y evita repetir escenarios vistos.</p>
        </div>
      </div>

      <div className="route-map">
        {route.map((module, moduleIndex) => {
          const stats = getModuleStats(module, progress);
          return (
            <button
              key={module.id || `${module.categoria}-${moduleIndex}`}
              className={`route-step ${stats.status}`}
              type="button"
              onClick={() => onOpenModule(moduleIndex)}
            >
              <span className="route-step-index">{String(moduleIndex + 1).padStart(2, '0')}</span>
              <div className="route-step-copy">
                <div className="route-step-top">
                  <strong>{module.titulo || `Módulo ${moduleIndex + 1}`}</strong>
                  <span className={`status-pill ${stats.status}`}>
                    {stats.status === 'completed'
                      ? 'Completado'
                      : stats.status === 'active'
                        ? 'En curso'
                        : 'Pendiente'}
                  </span>
                </div>
                <p>{module.descripcion || 'Ruta personalizada para reforzar este tema.'}</p>
                <div className="route-step-meta">
                  <span>{CATEGORY_LABELS[module.categoria] || module.categoria}</span>
                  <span>{LEVEL_LABELS[module.nivel] || module.nivel}</span>
                  <span>{stats.completedCount}/{stats.total} actividades</span>
                </div>
              </div>
              <span className="route-step-progress">{formatPercent(stats.pct)}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function ModuleCard({ module, moduleIndex, progress, onOpen, isRecommended }) {
  const stats = getModuleStats(module, progress);
  const label = stats.pct >= 100 ? 'Repasar' : stats.pct > 0 ? 'Continuar' : 'Empezar';
  const highlights = [
    stats.nextActivity
      ? `Sigue con: ${stats.nextActivity.titulo} (${ACTIVITY_LABELS[stats.nextActivity.tipo] || stats.nextActivity.tipo})`
      : 'Módulo listo para repaso',
    stats.avgScore === null ? 'Aún sin score promedio' : `Score promedio: ${stats.avgScore}%`,
    `${stats.visits} visitas registradas`,
    stats.durationLabel,
  ];

  return (
    <article className={`module-card enhanced ${stats.status} ${isRecommended ? 'recommended' : ''}`.trim()}>
      <div className="module-step">
        {isRecommended ? 'Recomendado ahora' : `Paso ${moduleIndex + 1}`}
      </div>
      <div className="module-head">
        <div>
          <p className="module-title">{module.titulo || `Módulo ${moduleIndex + 1}`}</p>
          <p className="module-desc">{module.descripcion || 'Módulo personalizado por IA.'}</p>
        </div>
        <div className="badges">
          <span className={`status-pill ${stats.status}`}>
            {stats.status === 'completed'
              ? 'Completado'
              : stats.status === 'active'
                ? 'En curso'
                : 'Pendiente'}
          </span>
          <span className="badge">{CATEGORY_LABELS[module.categoria] || module.categoria}</span>
          <span className={`badge level ${module.nivel}`}>
            {LEVEL_LABELS[module.nivel] || module.nivel}
          </span>
        </div>
      </div>

      <div className="progress-mini">
        <div className="fill" style={{ width: `${stats.pct}%` }} />
      </div>

      <div className="module-meta">
        <span>{stats.completedCount} de {stats.total} actividades</span>
        <span>{formatPercent(stats.pct)} completado</span>
      </div>

      <div className="module-highlights">
        {highlights.map((item) => (
          <div className="module-highlight" key={item}>
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="activity-pill-row">
        {stats.activities.slice(0, 4).map((activity) => (
          <span className="activity-pill" key={activity.id}>
            {ACTIVITY_LABELS[activity.tipo] || activity.tipo}
          </span>
        ))}
        {stats.seenCount ? <span className="activity-pill soft">{stats.seenCount} escenarios vistos</span> : null}
      </div>

      <div className="module-actions">
        <button className="btn primary" type="button" onClick={() => onOpen(moduleIndex)}>
          {label}
        </button>
      </div>
    </article>
  );
}

export default function CoursesView({
  answers,
  assessment,
  coursePlan,
  courseProgress,
  coursePrefs,
  generating,
  onCoursePrefsChange,
  onGenerateCourse,
  onOpenModule,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasPlan = Boolean(coursePlan && courseProgress);
  const computed = hasPlan
    ? computeCompetenciesFromProgress(coursePlan, courseProgress)
    : {
        competencias: coursePlan?.competencias || {},
        score_total: coursePlan?.score_total || 0,
      };
  const insights = hasPlan ? summarizeProgressInsights(coursePlan, courseProgress) : null;
  const route = Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : [];
  const rawSnapshots = Array.isArray(courseProgress?.snapshots) ? courseProgress.snapshots : [];
  const snapshots = rawSnapshots.slice(-5).reverse();
  const completedCount = Object.keys(courseProgress?.completed || {}).length;
  const totalActivities = route.reduce(
    (acc, module) => acc + (Array.isArray(module?.actividades) ? module.actividades.length : 0),
    0
  );
  const completedModules = route.filter((module) => getModuleStats(module, courseProgress).pct >= 100).length;
  const recommendedModuleIndex = route.length ? getRecommendedModuleIndex(route, courseProgress) : 0;
  const recommendedModule = route[recommendedModuleIndex] || null;
  const recommendedStats = recommendedModule ? getModuleStats(recommendedModule, courseProgress) : null;
  const weakestTopic = getWeakestTopic(computed.competencias);
  const strongestTopic = getStrongestTopic(computed.competencias);

  const progressItems = [
    {
      label: 'Módulos cerrados',
      value: `${completedModules}/${route.length || 0}`,
      note:
        completedModules === route.length && route.length
          ? 'Ruta completada, lista para repaso.'
          : 'Cada módulo completo consolida tu blindaje.',
    },
    {
      label: 'Actividades resueltas',
      value: `${completedCount}/${totalActivities || 0}`,
      note: totalActivities ? 'El progreso se guarda automáticamente.' : 'Genera primero tu ruta personalizada.',
    },
    {
      label: 'Tema más fuerte',
      value: strongestTopic ? CATEGORY_LABELS[strongestTopic[0]] || strongestTopic[0] : 'Aún sin datos',
      note: strongestTopic ? `${strongestTopic[1]}% de dominio estimado.` : 'Se definirá con tus primeras actividades.',
    },
    {
      label: 'Tema a reforzar',
      value: weakestTopic ? CATEGORY_LABELS[weakestTopic[0]] || weakestTopic[0] : 'Sin prioridad',
      note: weakestTopic ? `${weakestTopic[1]}% actual. Aquí conviene insistir.` : 'El sistema afinará esto conforme avances.',
    },
  ];

  return (
    <section id="coursesView" className="page">
      <header className="hero">
        <p className="eyebrow">Cursos personalizados</p>
        <h1>Tu ruta de aprendizaje</h1>
        <p className="lead">
          {assessment
            ? 'Usamos tu assessment y tu progreso real para ajustar la ruta, priorizar riesgos y evitar repeticiones.'
            : 'Completa primero la encuesta para generar una ruta personalizada.'}
        </p>
      </header>

      {hasPlan ? (
        <>
          <CourseHero
            answers={answers}
            assessment={assessment}
            coursePlan={coursePlan}
            completedCount={completedCount}
            totalActivities={totalActivities}
            recommendedModule={recommendedModule}
            recommendedStats={recommendedStats}
            weakestTopic={weakestTopic}
            onContinue={() => onOpenModule(recommendedModuleIndex)}
          />

          <ProgressStats items={progressItems} />

          <section className="dashboard-grid">
            <DonutCard score={computed.score_total || 0} label={coursePlan?.score_name || 'Blindaje Digital'} />
            <CompetencyList competencias={computed.competencias} />
          </section>

          <section className="panel summary-card course-settings-shell">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Configuración secundaria</p>
                <h3>Ajustes de la ruta</h3>
                <p className="hint">
                  Déjalos ocultos si solo quieres avanzar. Ábrelos cuando quieras cambiar enfoque,
                  dificultad o duración.
                </p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setSettingsOpen((value) => !value)}>
                {settingsOpen ? 'Ocultar ajustes' : 'Ver ajustes de la ruta'}
              </button>
            </div>
            <div className="hero-chip-row compact">
              <span className="pill">Estilo: {coursePrefs?.estilo || 'mix'}</span>
              <span className="pill">Dificultad: {coursePrefs?.dificultad || 'auto'}</span>
              <span className="pill">Sesiones: {coursePrefs?.duracion || '5-10'} min</span>
            </div>
          </section>

          {settingsOpen ? (
            <CoursePreferences
              answers={answers}
              value={coursePrefs}
              onChange={onCoursePrefsChange}
              onGenerate={onGenerateCourse}
              generating={generating}
              canGenerate={Boolean(assessment)}
            />
          ) : null}

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Módulos prioritarios</p>
                <h2>Empieza por aquí</h2>
                <p className="hint">
                  Sigue este orden para reforzar primero los riesgos más importantes de tu ruta.
                </p>
              </div>
            </div>
            <div className="modules-list enhanced">
              {route.map((module, moduleIndex) => (
                <ModuleCard
                  key={module.id || `${module.categoria}-${moduleIndex}`}
                  module={module}
                  moduleIndex={moduleIndex}
                  progress={courseProgress}
                  onOpen={onOpenModule}
                  isRecommended={moduleIndex === recommendedModuleIndex}
                />
              ))}
            </div>
          </section>

          <section className="course-route-layout">
            <RouteMap route={route} progress={courseProgress} onOpenModule={onOpenModule} />

            <article className="panel summary-card">
              <p className="eyebrow">Ruta activa</p>
              <h3>Qué traen tus módulos</h3>
              <div className="focus-stack">
                <div className="summary-item">
                  <strong>Versión del plan</strong>
                  <p>Versión {coursePlan?.planVersion || '1'} con {route.length} módulos activos.</p>
                </div>
                <div className="summary-item">
                  <strong>Simulaciones y práctica</strong>
                  <p>
                    Tu ruta mezcla teoría, ejercicios, comparación de dominios, inbox y
                    simulaciones con `scenarioId` para reducir repetición.
                  </p>
                </div>
                <div className="summary-item">
                  <strong>Preferencias aplicadas</strong>
                  <p>
                    Estilo {coursePrefs?.estilo || 'mix'} | dificultad {coursePrefs?.dificultad || 'auto'} |
                    sesiones de {coursePrefs?.duracion || '5-10'} min.
                  </p>
                </div>
              </div>
            </article>
          </section>

          <FocusPanel
            insights={insights}
            snapshots={snapshots}
            strongestTopic={strongestTopic}
            weakestTopic={weakestTopic}
            lastAccessAt={courseProgress?.lastAccessAt}
          />

          <section className="course-summary-grid">
            <article className="panel summary-card">
              <p className="eyebrow">Resumen</p>
              <h3>Lo que estamos viendo</h3>
              <div className="summary-list">
                <div className="summary-item">
                  <strong>Fortalezas</strong>
                  <p>{insights?.strengths?.join(' | ') || 'Aún estamos recogiendo señales.'}</p>
                </div>
                <div className="summary-item">
                  <strong>Enfoque</strong>
                  <p>{insights?.focus?.join(' | ') || 'La ruta se ajustará con tu progreso.'}</p>
                </div>
                <div className="summary-item">
                  <strong>Prioridad declarada</strong>
                  <p>{getPrioritySummary(answers)}</p>
                </div>
              </div>
            </article>

            <article className="panel summary-card">
              <p className="eyebrow">Historial</p>
              <h3>Últimos hitos</h3>
              <div className="history-list">
                {snapshots.length ? (
                  snapshots.map((snapshot) => (
                    <div className="history-item" key={`${snapshot.at}-${snapshot.completedCount}`}>
                      <div>
                        <p className="history-title">{snapshot.scoreTotal || 0}% de blindaje</p>
                        <p className="history-meta">
                          {formatDate(snapshot.at)} | {snapshot.completedCount || 0} actividades
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="hint">
                    Aún no hay hitos guardados. En cuanto avances, aparecerán aquí.
                  </p>
                )}
              </div>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="panel summary-card course-settings-shell">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Preparación de la ruta</p>
                <h3>Ajustes del curso</h3>
                <p className="hint">
                  Cuando termines la encuesta podrás elegir enfoque, dificultad y temas prioritarios.
                </p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setSettingsOpen((value) => !value)}>
                {settingsOpen ? 'Ocultar ajustes' : 'Ver ajustes de la ruta'}
              </button>
            </div>
          </section>

          {settingsOpen ? (
            <CoursePreferences
              answers={answers}
              value={coursePrefs}
              onChange={onCoursePrefsChange}
              onGenerate={onGenerateCourse}
              generating={generating}
              canGenerate={Boolean(assessment)}
            />
          ) : null}

          <section className="panel empty-state">
            <p className="eyebrow">Aún no hay ruta</p>
            <h2>Genera tu primer curso</h2>
            <p className="lead">
              En cuanto termines la encuesta podremos armar módulos, simulaciones y actividades con
              `scenarioId` para ti.
            </p>
          </section>
        </>
      )}
    </section>
  );
}
