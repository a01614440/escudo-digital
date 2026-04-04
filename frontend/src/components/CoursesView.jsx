import { useMemo, useState } from 'react';
import { formatDate } from '../lib/format.js';
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  computeCompetenciesFromProgress,
  normalizeModuleLevel,
  summarizeProgressInsights,
} from '../lib/course.js';

const LEVEL_ORDER = ['basico', 'refuerzo', 'avanzado'];

const LEVEL_COPY = {
  basico: {
    eyebrow: 'Nivel 1',
    title: 'Base esencial',
    description: 'Empieza por señales claras y decisiones simples antes de pasar a retos más complejos.',
  },
  refuerzo: {
    eyebrow: 'Nivel 2',
    title: 'Refuerzo guiado',
    description: 'Aquí practicas casos más retadores cuando ya consolidaste el bloque básico.',
  },
  avanzado: {
    eyebrow: 'Nivel 3',
    title: 'Nivel avanzado',
    description: 'Se abre al completar lo anterior para que no te adelantes sin contexto.',
  },
};

const TOPIC_ORDER = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];

function formatPercent(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${Math.round(safe)}%`;
}

function formatMinutesFromMs(value) {
  const safe = Number(value) || 0;
  if (!safe) return 'Sin tiempo registrado';
  const minutes = safe / 60000;
  if (minutes < 1) return 'Menos de 1 min';
  if (minutes < 10) return `${minutes.toFixed(1)} min`;
  return `${Math.round(minutes)} min`;
}

function getModuleStats(module, progress) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const completedEntries = activities
    .map((activity) => progress?.completed?.[activity.id])
    .filter(Boolean);
  const completedCount = completedEntries.length;
  const total = activities.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const avgScore = completedEntries.length
    ? Math.round(
        (completedEntries.reduce((acc, entry) => acc + (Number(entry.score) || 0), 0) /
          completedEntries.length) *
          100
      )
    : 0;
  const nextActivity = activities.find((activity) => !progress?.completed?.[activity.id]) || activities[0] || null;
  const moduleEntry = progress?.modules?.[module?.id] || {};
  const seenKey = `${module?.categoria}:${module?.nivel}`;
  const seenCount = Array.isArray(progress?.seenScenarioIds?.[seenKey])
    ? progress.seenScenarioIds[seenKey].length
    : 0;

  return {
    total,
    completedCount,
    pct,
    avgScore,
    nextActivity,
    visits: Number(moduleEntry.visits) || 0,
    durationLabel: formatMinutesFromMs(moduleEntry.durationMs),
    completedAt: moduleEntry.completedAt || null,
    seenCount,
    status: pct >= 100 ? 'completed' : completedCount > 0 ? 'active' : 'pending',
  };
}

function getFirstIncompleteIndex(route, progress) {
  const index = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return index === -1 ? route.length - 1 : index;
}

function getRecommendedModuleIndex(route, progress) {
  if (!route.length) return 0;
  const firstIncomplete = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return firstIncomplete === -1 ? 0 : firstIncomplete;
}

function isModuleUnlocked(route, progress, moduleIndex) {
  if (!route.length) return false;
  const firstIncomplete = getFirstIncompleteIndex(route, progress);
  if (firstIncomplete < 0) return true;
  return moduleIndex <= firstIncomplete;
}

function getPrioritySummary(answers, assessment) {
  const priority = String(answers?.priority || '').toLowerCase();
  if (priority === 'todo') return 'Ruta amplia para cubrir varios frentes sin perder orden.';
  if (priority && CATEGORY_LABELS[priority]) {
    return `Ruta enfocada en ${CATEGORY_LABELS[priority].toLowerCase()} con avance progresivo.`;
  }

  const level = String(assessment?.nivel || '').trim();
  if (level) {
    return `Tu ruta se organizó según tu evaluación ${level.toLowerCase()} y tu avance reciente.`;
  }

  return 'Tu ruta está organizada para avanzar paso a paso y evitar saltos innecesarios.';
}

function getStrongestTopic(competencies) {
  const entries = Object.entries(competencies || {}).sort((a, b) => b[1] - a[1]);
  return entries[0] || null;
}

function getWeakestTopic(competencies) {
  const entries = Object.entries(competencies || {}).sort((a, b) => a[1] - b[1]);
  return entries[0] || null;
}

function getLevelModules(route, progress, level) {
  return route
    .map((module, index) => ({
      module,
      index,
      stats: getModuleStats(module, progress),
    }))
    .filter(({ module }) => normalizeModuleLevel(module?.nivel) === level);
}

function DonutCard({
  scoreTotal,
  completedModules,
  totalModules,
  lastAccessAt,
  strongestTopic,
  weakestTopic,
  prioritySummary,
  insightsOpen,
  onToggleInsights,
}) {
  return (
    <section className="panel donut-card-enhanced">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Blindaje actual</p>
          <h2>Tu avance general</h2>
        </div>
        <button className="btn ghost" type="button" onClick={onToggleInsights}>
          {insightsOpen ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
      </div>

      <div className="blindaje-card-layout">
        <button className="donut-shell donut-shell-button" type="button" onClick={onToggleInsights}>
          <div className="shield-donut" style={{ '--p': scoreTotal }}>
            <div className="shield-inner">
              <strong>{formatPercent(scoreTotal)}</strong>
              <span>Blindaje Digital</span>
            </div>
          </div>
          <span className="hint">Toca el blindaje para abrir tu información y estadísticas.</span>
        </button>

        <div className="blindaje-support-grid">
          <article className="stat-card compact blindaje-support-card">
            <span className="eyebrow">Módulos completados</span>
            <strong>{`${completedModules}/${totalModules}`}</strong>
            <p>{completedModules === totalModules ? 'Ruta terminada' : 'Aún tienes módulos por desbloquear.'}</p>
          </article>

          <article className="stat-card compact blindaje-support-card">
            <span className="eyebrow">Último acceso</span>
            <strong>{formatDate(lastAccessAt)}</strong>
            <p>Tu progreso se sincroniza automáticamente.</p>
          </article>

          <article className="stat-card compact blindaje-support-card">
            <span className="eyebrow">Fortaleza actual</span>
            <strong>
              {strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} ${formatPercent(strongestTopic[1])}` : 'Sin datos'}
            </strong>
            <p>Lo que hoy estás resolviendo con mayor confianza.</p>
          </article>

          <article className="stat-card compact blindaje-support-card">
            <span className="eyebrow">Lo siguiente a reforzar</span>
            <strong>
              {weakestTopic ? `${CATEGORY_LABELS[weakestTopic[0]]} ${formatPercent(weakestTopic[1])}` : 'Sin datos'}
            </strong>
            <p>{prioritySummary}</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function FocusCard({ module, stats, onOpenModule }) {
  if (!module) {
    return (
      <section className="panel course-focus-panel empty-state">
        <p className="eyebrow">Ruta activa</p>
        <h2>Tu ruta está lista</h2>
        <p className="lead">Cuando generes un curso nuevo, aquí verás tu siguiente módulo recomendado.</p>
      </section>
    );
  }

  return (
    <section className="panel course-focus-panel">
      <p className="eyebrow">Empieza por aquí</p>
      <div className="focus-card-head">
        <div className="focus-card-copy">
          <h2>{module.titulo}</h2>
          <p>{module.descripcion || 'Este bloque te ayudará a tomar decisiones más seguras sin avanzar demasiado rápido.'}</p>
        </div>
        <div className="hero-chip-row compact">
          <span className={`status-pill ${stats.status}`}>{stats.status === 'active' ? 'En curso' : stats.status === 'completed' ? 'Completado' : 'Pendiente'}</span>
          <span className="activity-pill">{CATEGORY_LABELS[module.categoria] || 'Curso'}</span>
          <span className="activity-pill">{LEVEL_LABELS[normalizeModuleLevel(module.nivel)] || 'Módulo'}</span>
        </div>
      </div>

      <div className="focus-progress-row">
        <div className="progress-track">
          <span className="progress-fill" style={{ width: `${stats.pct}%` }} />
        </div>
        <strong>{`${stats.completedCount} de ${stats.total} actividades · ${formatPercent(stats.pct)}`}</strong>
      </div>

      <div className="focus-card-metrics">
        <div className="focus-metric">
          <span>Sigue con</span>
          <strong>{stats.nextActivity?.titulo || 'Módulo listo para revisar'}</strong>
        </div>
        <div className="focus-metric">
          <span>Score promedio</span>
          <strong>{stats.avgScore ? formatPercent(stats.avgScore) : 'Aún sin score'}</strong>
        </div>
        <div className="focus-metric">
          <span>Visitas registradas</span>
          <strong>{stats.visits || 0}</strong>
        </div>
        <div className="focus-metric">
          <span>Tiempo de práctica</span>
          <strong>{stats.durationLabel}</strong>
        </div>
      </div>

      <div className="activity-pill-row">
        {(Array.isArray(module.actividades) ? module.actividades : []).slice(0, 5).map((activity) => (
          <span key={activity.id} className="activity-pill">
            {ACTIVITY_LABELS[activity.tipo] || activity.titulo}
          </span>
        ))}
        {stats.seenCount ? <span className="activity-pill soft">{`${stats.seenCount} escenarios vistos`}</span> : null}
      </div>

      <div className="row inline">
        <button className="btn primary" type="button" onClick={() => onOpenModule(module.__moduleIndex)}>
          {stats.completedCount ? 'Continuar módulo' : 'Empezar módulo'}
        </button>
      </div>
    </section>
  );
}

function ModuleCard({ module, moduleIndex, stats, isRecommended, isLocked, unlockMessage, onOpenModule }) {
  const statusLabel =
    stats.status === 'completed' ? 'Completado' : stats.status === 'active' ? 'En curso' : isLocked ? 'Bloqueado' : 'Pendiente';

  return (
    <article
      className={[
        'panel',
        'module-card',
        'enhanced',
        stats.status,
        isRecommended ? 'recommended' : '',
        isLocked ? 'locked' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="module-card-top">
        <span className="module-step">{String(moduleIndex + 1).padStart(2, '0')}</span>
        <div className="module-card-copy">
          <div className="route-step-top">
            <h3>{module.titulo}</h3>
            <div className="hero-chip-row compact">
              {isRecommended ? <span className="activity-pill soft">Recomendado ahora</span> : null}
              <span className={`status-pill ${isLocked ? 'locked' : stats.status}`}>{statusLabel}</span>
            </div>
          </div>
          <p>{module.descripcion || 'Bloque práctico para reforzar decisiones cotidianas sin repetir escenarios.'}</p>
        </div>
      </div>

      <div className="route-step-meta compact">
        <span>{CATEGORY_LABELS[module.categoria] || 'Curso'}</span>
        <span>{LEVEL_LABELS[normalizeModuleLevel(module.nivel)] || 'Módulo'}</span>
        <span>{`${stats.total} actividades`}</span>
      </div>

      <div className="focus-progress-row compact">
        <div className="progress-track">
          <span className="progress-fill" style={{ width: `${stats.pct}%` }} />
        </div>
        <strong>{`${stats.completedCount}/${stats.total} · ${formatPercent(stats.pct)}`}</strong>
      </div>

      <div className="module-compact-grid">
        <div className="module-compact-item">
          <span>Siguiente paso</span>
          <strong>{isLocked ? 'Desbloquea este módulo primero' : stats.nextActivity?.titulo || 'Módulo listo para repaso'}</strong>
        </div>
        <div className="module-compact-item">
          <span>Progreso</span>
          <strong>
            {stats.avgScore ? `Score ${formatPercent(stats.avgScore)}` : stats.completedAt ? 'Ruta completada' : 'Aún sin score'}
          </strong>
        </div>
      </div>

      {isLocked ? <p className="module-lock-note">{unlockMessage}</p> : null}

      <div className="row inline module-actions">
        <button className="btn primary" type="button" disabled={isLocked} onClick={() => onOpenModule(moduleIndex)}>
          {isLocked ? 'Bloqueado' : stats.completedCount ? 'Continuar' : 'Empezar'}
        </button>
      </div>
    </article>
  );
}

function LevelSection({ level, items, route, progress, recommendedIndex, onOpenModule }) {
  if (!items.length) return null;
  const copy = LEVEL_COPY[level];

  return (
    <section className="panel level-section">
      <div className="level-section-head">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
        <p className="lead">{copy.description}</p>
      </div>

      <div className="modules-list enhanced">
        {items.map(({ module, index, stats }) => {
          const locked = !isModuleUnlocked(route, progress, index);
          const firstIncomplete = getFirstIncompleteIndex(route, progress);
          const blocker = route[firstIncomplete];
          const unlockMessage =
            locked && blocker
              ? `Completa "${blocker.titulo}" para desbloquear este módulo.`
              : 'Completa el bloque anterior para avanzar.';

          return (
            <ModuleCard
              key={module.id}
              module={module}
              moduleIndex={index}
              stats={stats}
              isRecommended={index === recommendedIndex}
              isLocked={locked}
              unlockMessage={unlockMessage}
              onOpenModule={onOpenModule}
            />
          );
        })}
      </div>
    </section>
  );
}

function InsightsSection({
  open,
  onToggle,
  computed,
  progress,
  coursePlan,
  coursePrefs,
  answers,
  assessment,
}) {
  const insights = summarizeProgressInsights(coursePlan, progress);
  const strongestTopic = getStrongestTopic(computed.competencias);
  const weakestTopic = getWeakestTopic(computed.competencias);
  const history = Array.isArray(progress?.snapshots) ? [...progress.snapshots].slice(-4).reverse() : [];

  return (
    <section className="panel insights-shell">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Información adicional</p>
          <h2>Tu progreso y contexto de la ruta</h2>
        </div>
        <button className="btn ghost" type="button" onClick={onToggle}>
          {open ? 'Ocultar información' : 'Ver información'}
        </button>
      </div>

      {!open ? (
        <p className="lead">
          Aquí guardamos estadísticas, fortalezas, evolución y detalles del plan para no cargar demasiado la pantalla principal.
        </p>
      ) : (
        <div className="insights-grid">
          <article className="panel info-mini-panel">
            <p className="eyebrow">Ruta activa</p>
            <h3>Resumen rápido</h3>
            <div className="summary-list compact">
              <div className="summary-item">
                <strong>Versión del plan</strong>
                <p>{`Versión ${coursePlan?.planVersion || 0} con ${Array.isArray(coursePlan?.ruta) ? coursePlan.ruta.length : 0} módulos activos.`}</p>
              </div>
              <div className="summary-item">
                <strong>Preferencias aplicadas</strong>
                <p>{`Estilo ${coursePrefs?.estilo || 'mix'} · dificultad ${coursePrefs?.dificultad || 'auto'} · sesiones ${coursePrefs?.duracion || '5-10'} min.`}</p>
              </div>
              <div className="summary-item">
                <strong>Prioridad declarada</strong>
                <p>{getPrioritySummary(answers, assessment)}</p>
              </div>
            </div>
          </article>

          <article className="panel info-mini-panel">
            <p className="eyebrow">Qué conviene reforzar</p>
            <h3>Señales clave</h3>
            <div className="summary-list compact">
              <div className="summary-item">
                <strong>Fortaleza principal</strong>
                <p>{strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} (${formatPercent(strongestTopic[1])})` : 'Aún sin suficientes datos.'}</p>
              </div>
              <div className="summary-item">
                <strong>Zona a reforzar</strong>
                <p>{weakestTopic ? `${CATEGORY_LABELS[weakestTopic[0]]} (${formatPercent(weakestTopic[1])})` : 'Aún sin suficientes datos.'}</p>
              </div>
              <div className="summary-item">
                <strong>Temas visibles</strong>
                <p>{insights.focus.length ? insights.focus.join(' | ') : 'Todavía no hay temas críticos repetidos.'}</p>
              </div>
            </div>
          </article>

          <article className="panel info-mini-panel">
            <p className="eyebrow">Competencias</p>
            <h3>Cómo va cada canal</h3>
            <div className="analytics-bar-list">
              {TOPIC_ORDER.map((topic) => (
                <div key={topic} className="analytics-bar-row">
                  <div className="analytics-bar-top">
                    <span>{CATEGORY_LABELS[topic]}</span>
                    <strong>{formatPercent(computed.competencias?.[topic] || 0)}</strong>
                  </div>
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill" style={{ width: `${computed.competencias?.[topic] || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel info-mini-panel">
            <p className="eyebrow">Historial reciente</p>
            <h3>Últimos hitos</h3>
            <div className="history-list compact">
              {history.length ? (
                history.map((snapshot) => (
                  <div key={snapshot.at} className="history-item">
                    <strong>{`${formatPercent(snapshot.scoreTotal)} de blindaje`}</strong>
                    <p>{`${formatDate(snapshot.at)} · ${snapshot.completedCount} actividades completadas`}</p>
                  </div>
                ))
              ) : (
                <div className="history-item">
                  <strong>Sin hitos suficientes</strong>
                  <p>Cuando completes más actividades verás aquí tu evolución reciente.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function RouteSettings({ open, onToggle, coursePrefs, onCoursePrefsChange, onGenerateCourse, generating }) {
  const toggleTopic = (topic) => {
    onCoursePrefsChange((current) => {
      const currentTopics = Array.isArray(current?.temas) ? current.temas : [];
      const exists = currentTopics.includes(topic);
      const nextTopics = exists
        ? currentTopics.filter((item) => item !== topic)
        : [...currentTopics, topic];
      return {
        ...current,
        temas: nextTopics.length ? nextTopics : currentTopics,
      };
    });
  };

  const setField = (field, value) => {
    onCoursePrefsChange((current) => ({ ...current, [field]: value }));
  };

  return (
    <section className="panel course-preferences-panel route-settings-bottom">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Configuración secundaria</p>
          <h2>Ajustes de la ruta</h2>
        </div>
        <button className="btn ghost" type="button" onClick={onToggle}>
          {open ? 'Ocultar ajustes' : 'Ver ajustes de la ruta'}
        </button>
      </div>

      <p className="lead">
        Déjalos abajo para no distraer del aprendizaje. Ábrelos solo si quieres cambiar enfoque, dificultad o duración.
      </p>

      {!open ? (
        <div className="hero-chip-row compact">
          <span className="activity-pill">{`Estilo: ${coursePrefs?.estilo || 'mix'}`}</span>
          <span className="activity-pill">{`Dificultad: ${coursePrefs?.dificultad || 'auto'}`}</span>
          <span className="activity-pill">{`Sesiones: ${coursePrefs?.duracion || '5-10'} min`}</span>
        </div>
      ) : (
        <>
          <div className="prefs-grid">
            <label>
              <span>Estilo</span>
              <select value={coursePrefs?.estilo || 'mix'} onChange={(event) => setField('estilo', event.target.value)}>
                <option value="mix">Mix</option>
                <option value="guiado">Guiado</option>
                <option value="practico">Práctico</option>
              </select>
            </label>

            <label>
              <span>Dificultad</span>
              <select
                value={coursePrefs?.dificultad || 'auto'}
                onChange={(event) => setField('dificultad', event.target.value)}
              >
                <option value="auto">Auto</option>
                <option value="facil">Fácil</option>
                <option value="normal">Normal</option>
                <option value="avanzada">Avanzada</option>
              </select>
            </label>

            <label>
              <span>Duración</span>
              <select
                value={coursePrefs?.duracion || '5-10'}
                onChange={(event) => setField('duracion', event.target.value)}
              >
                <option value="5-10">5-10 min</option>
                <option value="10-15">10-15 min</option>
                <option value="15-20">15-20 min</option>
              </select>
            </label>
          </div>

          <div className="topic-toggle-grid">
            {TOPIC_ORDER.map((topic) => {
              const active = Array.isArray(coursePrefs?.temas) ? coursePrefs.temas.includes(topic) : false;
              return (
                <button
                  key={topic}
                  className={`activity-pill topic-pill ${active ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                >
                  {CATEGORY_LABELS[topic]}
                </button>
              );
            })}
          </div>

          <div className="row inline">
            <button className="btn primary" type="button" onClick={onGenerateCourse} disabled={generating}>
              {generating ? 'Actualizando ruta...' : 'Actualizar ruta'}
            </button>
          </div>
        </>
      )}
    </section>
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
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!assessment) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">Ruta personalizada</p>
        <h1>Primero completa tu evaluación</h1>
        <p className="lead">Necesitamos tu encuesta para armar una ruta de cursos con prioridad y dificultad adecuadas.</p>
      </section>
    );
  }

  if (!coursePlan || !courseProgress) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">Ruta personalizada</p>
        <h1>Tu ruta todavía no está lista</h1>
        <p className="lead">Genera tu plan personalizado y aquí verás el blindaje, los módulos y el avance paso a paso.</p>
        <button className="btn primary" type="button" onClick={onGenerateCourse} disabled={generating}>
          {generating ? 'Generando ruta...' : 'Generar mi ruta'}
        </button>
      </section>
    );
  }

  const route = Array.isArray(coursePlan.ruta) ? coursePlan.ruta : [];
  const recommendedIndex = getRecommendedModuleIndex(route, courseProgress);
  const recommendedModule = route[recommendedIndex]
    ? { ...route[recommendedIndex], __moduleIndex: recommendedIndex }
    : null;
  const recommendedStats = recommendedModule ? getModuleStats(recommendedModule, courseProgress) : null;
  const computed = computeCompetenciesFromProgress(coursePlan, courseProgress);
  const strongestTopic = getStrongestTopic(computed.competencias);
  const weakestTopic = getWeakestTopic(computed.competencias);
  const completedModules = route.filter((module) => getModuleStats(module, courseProgress).pct >= 100).length;
  const prioritySummary = getPrioritySummary(answers, assessment);
  const levelGroups = useMemo(
    () =>
      LEVEL_ORDER.map((level) => ({
        level,
        items: getLevelModules(route, courseProgress, level),
      })).filter((group) => group.items.length),
    [courseProgress, route]
  );

  return (
    <div className="dashboard-shell course-dashboard">
      <div className="dashboard-grid course-primary-grid">
        <DonutCard
          scoreTotal={computed.score_total}
          completedModules={completedModules}
          totalModules={route.length}
          lastAccessAt={courseProgress?.lastAccessAt}
          strongestTopic={strongestTopic}
          weakestTopic={weakestTopic}
          prioritySummary={prioritySummary}
          insightsOpen={insightsOpen}
          onToggleInsights={() => setInsightsOpen((value) => !value)}
        />

        <FocusCard module={recommendedModule} stats={recommendedStats} onOpenModule={onOpenModule} />
      </div>

      <section className="panel course-modules-panel">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Módulos de aprendizaje</p>
            <h1>Ruta guiada por progreso</h1>
          </div>
          <span className="activity-pill soft">No puedes adelantar bloques sin completar el anterior</span>
        </div>

        <p className="lead">
          La ruta avanza por niveles. Primero completas la base, después se abre el refuerzo y al final el bloque avanzado.
        </p>
      </section>

      {levelGroups.map((group) => (
        <LevelSection
          key={group.level}
          level={group.level}
          items={group.items}
          route={route}
          progress={courseProgress}
          recommendedIndex={recommendedIndex}
          onOpenModule={onOpenModule}
        />
      ))}

      <InsightsSection
        open={insightsOpen}
        onToggle={() => setInsightsOpen((value) => !value)}
        computed={computed}
        progress={courseProgress}
        coursePlan={coursePlan}
        coursePrefs={coursePrefs}
        answers={answers}
        assessment={assessment}
      />

      <RouteSettings
        open={settingsOpen}
        onToggle={() => setSettingsOpen((value) => !value)}
        coursePrefs={coursePrefs}
        onCoursePrefsChange={onCoursePrefsChange}
        onGenerateCourse={onGenerateCourse}
        generating={generating}
      />
    </div>
  );
}
