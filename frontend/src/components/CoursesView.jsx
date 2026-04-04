import { useEffect, useState } from 'react';
import { formatDate } from '../lib/format.js';
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  computeCompetenciesFromProgress,
  normalizeModuleLevel,
  summarizeProgressInsights,
} from '../lib/course.js';

const DASHBOARD_TABS = [
  { id: 'ruta', label: 'Ruta' },
  { id: 'progreso', label: 'Progreso' },
  { id: 'ajustes', label: 'Ajustes' },
];

const LEVEL_ORDER = ['basico', 'refuerzo', 'avanzado'];

const LEVEL_COPY = {
  basico: {
    eyebrow: 'Base',
    title: 'Nivel básico',
    description: 'Empieza con señales claras y decisiones simples para construir criterio.',
  },
  refuerzo: {
    eyebrow: 'Refuerzo',
    title: 'Nivel intermedio',
    description: 'Practica casos más retadores cuando ya dominaste la base.',
  },
  avanzado: {
    eyebrow: 'Avanzado',
    title: 'Nivel avanzado',
    description: 'Se desbloquea cuando completas los bloques anteriores.',
  },
};

const TOPIC_ORDER = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];

function formatPercent(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${Math.round(safe)}%`;
}

function formatMinutesFromMs(value) {
  const safe = Number(value) || 0;
  if (!safe) return 'Sin tiempo';
  const minutes = safe / 60000;
  if (minutes < 1) return '<1 min';
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

function getRecommendedModuleIndex(route, progress) {
  if (!route.length) return 0;
  const firstIncomplete = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return firstIncomplete === -1 ? 0 : firstIncomplete;
}

function getUnlockedLimit(route, progress) {
  const firstIncomplete = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return firstIncomplete === -1 ? route.length - 1 : firstIncomplete;
}

function getPrioritySummary(answers, assessment) {
  const priority = String(answers?.priority || '').toLowerCase();
  if (priority === 'todo') return 'Ruta amplia para cubrir varios frentes con un orden claro.';
  if (priority && CATEGORY_LABELS[priority]) {
    return `Tu enfoque actual prioriza ${CATEGORY_LABELS[priority].toLowerCase()}.`;
  }

  const level = String(assessment?.nivel || '').trim();
  if (level) {
    return `La ruta se ajustó a tu evaluación ${level.toLowerCase()} y a tu progreso reciente.`;
  }

  return 'La ruta prioriza avanzar con criterio antes de abrir módulos más complejos.';
}

function getStrongestTopic(competencies) {
  const entries = Object.entries(competencies || {}).sort((a, b) => b[1] - a[1]);
  return entries[0] || null;
}

function getWeakestTopic(competencies) {
  const entries = Object.entries(competencies || {}).sort((a, b) => a[1] - b[1]);
  return entries[0] || null;
}

function TabSwitcher({ activeTab, onChange }) {
  return (
    <div className="dashboard-tabs" role="tablist" aria-label="Panel de cursos">
      {DASHBOARD_TABS.map((tab) => (
        <button
          key={tab.id}
          className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ShieldCard({
  scoreTotal,
  completedModules,
  totalModules,
  lastAccessAt,
  strongestTopic,
  weakestTopic,
  prioritySummary,
  adminAccess = false,
}) {
  return (
    <section className="panel dashboard-card shield-card-clean">
      <div className="dashboard-title-stack">
        <div>
          <p className="eyebrow">Blindaje actual</p>
          <h2>Vista general</h2>
          <p className="lead shield-intro">
            Tu blindaje combina tu evaluación inicial con el progreso real que llevas en actividades y módulos.
          </p>
        </div>
      </div>

      <div className="shield-card-body">
        <div className="donut-shell shield-card-donut">
          <div className="shield-donut" style={{ '--p': scoreTotal }}>
            <div className="shield-inner">
              <strong>{formatPercent(scoreTotal)}</strong>
              <span>Blindaje Digital</span>
            </div>
          </div>
          <div className="shield-donut-caption">
            <strong>{completedModules === totalModules ? 'Ruta al día' : 'Sigue sumando progreso'}</strong>
            <p>
              {completedModules === totalModules
                ? 'Ya cubriste todos los módulos activos de esta ruta.'
                : 'Tu puntaje sube conforme completas bloques y mejoras tu toma de decisiones.'}
            </p>
          </div>
        </div>

        <div className="shield-summary-strip">
          <article className="shield-summary-tile">
            <span>Ruta activa</span>
            <strong>{`${completedModules}/${totalModules}`}</strong>
            <p>Módulos completados.</p>
          </article>
          <article className="shield-summary-tile">
            <span>Fortaleza</span>
            <strong>
              {strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} ${formatPercent(strongestTopic[1])}` : 'Sin datos'}
            </strong>
            <p>Tu mejor canal hoy.</p>
          </article>
          <article className="shield-summary-tile">
            <span>Siguiente foco</span>
            <strong>
              {weakestTopic ? `${CATEGORY_LABELS[weakestTopic[0]]} ${formatPercent(weakestTopic[1])}` : 'Sin datos'}
            </strong>
            <p>{prioritySummary === 'Ruta amplia para cubrir varios frentes con un orden claro.' ? 'Prioridad actual de la ruta.' : prioritySummary}</p>
          </article>
          <article className="shield-summary-tile">
            <span>Último acceso</span>
            <strong>{formatDate(lastAccessAt)}</strong>
            <p>Guardado automático.</p>
          </article>
        </div>
      </div>

      <div className="shield-highlight-bar">
        <div className="shield-highlight-chip">
          <span>Mejor desempeño</span>
          <strong>{strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} ${formatPercent(strongestTopic[1])}` : 'Sin datos'}</strong>
        </div>
        <div className="shield-highlight-chip">
          <span>Siguiente foco</span>
          <strong>{weakestTopic ? `${CATEGORY_LABELS[weakestTopic[0]]} ${formatPercent(weakestTopic[1])}` : 'Sin datos'}</strong>
        </div>
        <div className="shield-highlight-chip">
          <span>Contexto</span>
          <strong>{prioritySummary}</strong>
        </div>
        {adminAccess ? (
          <div className="shield-highlight-chip admin-mode-chip">
            <span>Modo admin</span>
            <strong>Acceso libre a todos los módulos</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SpotlightCard({ module, stats, adminAccess = false, onOpenModule, onShowRoute }) {
  if (!module) {
    return (
      <section className="panel dashboard-card spotlight-card-clean empty-state">
        <p className="eyebrow">Empieza por aquí</p>
        <h2>Tu ruta está lista</h2>
        <p className="lead">Cuando generes un curso, aquí verás el módulo que conviene abrir primero.</p>
      </section>
    );
  }

  return (
    <section className="panel dashboard-card spotlight-card-clean">
      <div className="section-title-row dashboard-title-row">
        <div>
          <p className="eyebrow">Empieza por aquí</p>
          <h2>{module.titulo}</h2>
        </div>
        <div className="hero-chip-row compact">
          <span className={`status-pill ${stats.status}`}>{stats.status === 'active' ? 'En curso' : stats.status === 'completed' ? 'Completado' : 'Pendiente'}</span>
          <span className="activity-pill">{CATEGORY_LABELS[module.categoria] || 'Curso'}</span>
          <span className="activity-pill">{LEVEL_LABELS[normalizeModuleLevel(module.nivel)] || 'Módulo'}</span>
          {adminAccess ? <span className="activity-pill soft admin-pill">Admin</span> : null}
        </div>
      </div>

      <p className="lead spotlight-lead">{module.descripcion || 'Práctica guiada para mejorar criterio sin saturar la experiencia.'}</p>

      <div className="focus-progress-row">
        <div className="progress-track">
          <span className="progress-fill" style={{ width: `${stats.pct}%` }} />
        </div>
        <strong>{`${stats.completedCount} de ${stats.total} actividades · ${formatPercent(stats.pct)}`}</strong>
      </div>

      <div className="spotlight-metrics">
        <div className="focus-metric">
          <span>Sigue con</span>
          <strong>{stats.nextActivity?.titulo || 'Lista para repaso'}</strong>
        </div>
        <div className="focus-metric">
          <span>Score promedio</span>
          <strong>{stats.avgScore ? formatPercent(stats.avgScore) : 'Sin score'}</strong>
        </div>
        <div className="focus-metric">
          <span>Visitas</span>
          <strong>{stats.visits || 0}</strong>
        </div>
        <div className="focus-metric">
          <span>Tiempo</span>
          <strong>{stats.durationLabel}</strong>
        </div>
      </div>

      <div className="activity-pill-row compact-row">
        {(Array.isArray(module.actividades) ? module.actividades : []).slice(0, 4).map((activity) => (
          <span key={activity.id} className="activity-pill">
            {ACTIVITY_LABELS[activity.tipo] || activity.titulo}
          </span>
        ))}
        {stats.seenCount ? <span className="activity-pill soft">{`${stats.seenCount} escenarios vistos`}</span> : null}
      </div>

      <div className="row inline spotlight-actions">
        <button
          className="btn primary"
          type="button"
          onClick={() =>
            onOpenModule(module.__moduleIndex, {
              restart: adminAccess && stats.pct >= 100,
            })
          }
        >
          {adminAccess && stats.pct >= 100
            ? 'Repetir módulo'
            : stats.completedCount
              ? 'Continuar módulo'
              : 'Empezar módulo'}
        </button>
        <button className="btn ghost" type="button" onClick={onShowRoute}>
          Ver ruta
        </button>
      </div>
    </section>
  );
}

function LevelPicker({ levels, activeLevel, onChange }) {
  return (
    <div className="level-picker" role="tablist" aria-label="Niveles de la ruta">
      {levels.map((level) => (
        <button
          key={level}
          className={`level-pill ${activeLevel === level ? 'active' : ''}`}
          type="button"
          onClick={() => onChange(level)}
        >
          {LEVEL_LABELS[level]}
        </button>
      ))}
    </div>
  );
}

function ModuleAccordionItem({
  entry,
  isExpanded,
  isLocked,
  isRecommended,
  adminAccess = false,
  unlockMessage,
  onToggle,
  onOpenModule,
}) {
  const { module, index, stats } = entry;

  return (
    <article className={`module-accordion ${isExpanded ? 'expanded' : ''} ${isLocked ? 'locked' : ''}`}>
      <button className="module-accordion-head" type="button" onClick={onToggle}>
        <span className="module-step">{String(index + 1).padStart(2, '0')}</span>
        <div className="module-accordion-copy">
          <div className="module-accordion-title-row">
            <strong>{module.titulo}</strong>
            <div className="hero-chip-row compact">
              {isRecommended ? <span className="activity-pill soft">Recomendado</span> : null}
              <span className={`status-pill ${isLocked ? 'locked' : stats.status}`}>
                {isLocked ? 'Bloqueado' : stats.status === 'active' ? 'En curso' : stats.status === 'completed' ? 'Completado' : 'Pendiente'}
              </span>
            </div>
          </div>
          <div className="module-accordion-meta">
            <span>{CATEGORY_LABELS[module.categoria] || 'Curso'}</span>
            <span>{`${stats.completedCount}/${stats.total} actividades`}</span>
            <span>{formatPercent(stats.pct)}</span>
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="module-accordion-body">
          <p>{module.descripcion || 'Bloque práctico para reforzar criterio y hábitos digitales.'}</p>

          <div className="module-accordion-body-grid">
            <div className="module-fact">
              <span>Siguiente actividad</span>
              <strong>{isLocked ? 'Completa el bloque anterior' : stats.nextActivity?.titulo || 'Módulo listo para repaso'}</strong>
            </div>
            <div className="module-fact">
              <span>Score promedio</span>
              <strong>{stats.avgScore ? formatPercent(stats.avgScore) : 'Sin score'}</strong>
            </div>
            <div className="module-fact">
              <span>Visitas</span>
              <strong>{stats.visits || 0}</strong>
            </div>
            <div className="module-fact">
              <span>Tiempo</span>
              <strong>{stats.durationLabel}</strong>
            </div>
          </div>

          <div className="activity-pill-row compact-row">
            {(Array.isArray(module.actividades) ? module.actividades : []).slice(0, 5).map((activity) => (
              <span key={activity.id} className="activity-pill">
                {ACTIVITY_LABELS[activity.tipo] || activity.titulo}
              </span>
            ))}
          </div>

          {isLocked ? <p className="module-lock-note">{unlockMessage}</p> : null}
          {adminAccess ? (
            <p className="module-admin-note">
              Modo admin: puedes abrir, repetir y revisar este módulo sin bloqueos.
            </p>
          ) : null}

          <div className="row inline">
            <button
              className="btn primary"
              type="button"
              disabled={isLocked}
              onClick={() =>
                onOpenModule(index, {
                  restart: adminAccess && stats.pct >= 100,
                })
              }
            >
              {isLocked
                ? 'Bloqueado'
                : adminAccess && stats.pct >= 100
                  ? 'Repetir módulo'
                  : stats.completedCount
                    ? 'Continuar'
                    : 'Abrir módulo'}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function RouteTab({
  routeEntries,
  availableLevels,
  activeLevel,
  onChangeLevel,
  expandedModuleId,
  onToggleModule,
  recommendedIndex,
  unlockedLimit,
  adminAccess = false,
  onOpenModule,
}) {
  const levelEntries = routeEntries.filter((entry) => normalizeModuleLevel(entry.module.nivel) === activeLevel);
  const copy = LEVEL_COPY[activeLevel] || LEVEL_COPY.basico;

  return (
    <section className="panel dashboard-panel">
      <div className="dashboard-panel-head">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p className="lead">{copy.description}</p>
          {adminAccess ? (
            <p className="hint admin-route-note">
              Modo admin activo: acceso libre para revisar cualquier nivel y repetir módulos.
            </p>
          ) : null}
        </div>
        <LevelPicker levels={availableLevels} activeLevel={activeLevel} onChange={onChangeLevel} />
      </div>

      <div className="module-accordion-list">
        {levelEntries.map((entry) => {
          const isLocked = adminAccess ? false : entry.index > unlockedLimit;
          const unlockMessage =
            routeEntries[unlockedLimit]?.module?.titulo
              ? `Completa "${routeEntries[unlockedLimit].module.titulo}" para desbloquear este bloque.`
              : 'Completa el bloque anterior para avanzar.';

          return (
            <ModuleAccordionItem
              key={entry.module.id}
              entry={entry}
              isExpanded={expandedModuleId === entry.module.id}
              isLocked={isLocked}
              isRecommended={entry.index === recommendedIndex}
              adminAccess={adminAccess}
              unlockMessage={unlockMessage}
              onToggle={() => onToggleModule(entry.module.id)}
              onOpenModule={onOpenModule}
            />
          );
        })}
      </div>
    </section>
  );
}

function ProgressTab({ computed, progress, coursePlan, coursePrefs, answers, assessment }) {
  const insights = summarizeProgressInsights(coursePlan, progress);
  const strongestTopic = getStrongestTopic(computed.competencias);
  const weakestTopic = getWeakestTopic(computed.competencias);
  const history = Array.isArray(progress?.snapshots) ? [...progress.snapshots].slice(-3).reverse() : [];

  return (
    <section className="dashboard-panel-grid">
      <article className="panel dashboard-panel">
        <p className="eyebrow">Fortalezas y foco</p>
        <h2>Qué estamos viendo</h2>
        <div className="summary-list compact">
          <div className="summary-item">
            <strong>Fortaleza principal</strong>
            <p>{strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} ${formatPercent(strongestTopic[1])}` : 'Sin datos suficientes.'}</p>
          </div>
          <div className="summary-item">
            <strong>Zona a reforzar</strong>
            <p>{weakestTopic ? `${CATEGORY_LABELS[weakestTopic[0]]} ${formatPercent(weakestTopic[1])}` : 'Sin datos suficientes.'}</p>
          </div>
          <div className="summary-item">
            <strong>Prioridad declarada</strong>
            <p>{getPrioritySummary(answers, assessment)}</p>
          </div>
        </div>
      </article>

      <article className="panel dashboard-panel">
        <p className="eyebrow">Competencias</p>
        <h2>Por canal</h2>
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

      <article className="panel dashboard-panel">
        <p className="eyebrow">Evolución</p>
        <h2>Señales recientes</h2>
        <div className="summary-list compact">
          <div className="summary-item">
            <strong>Último acceso</strong>
            <p>{formatDate(progress?.lastAccessAt)}</p>
          </div>
          <div className="summary-item">
            <strong>Fortalezas visibles</strong>
            <p>{insights.strengths.length ? insights.strengths.join(' | ') : 'Todavía no hay suficiente historial.'}</p>
          </div>
          <div className="summary-item">
            <strong>Lo que conviene reforzar</strong>
            <p>{insights.focus.length ? insights.focus.join(' | ') : 'Sin señales repetidas por ahora.'}</p>
          </div>
        </div>
      </article>

      <article className="panel dashboard-panel">
        <p className="eyebrow">Ruta activa</p>
        <h2>Resumen del plan</h2>
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
            <strong>Últimos hitos</strong>
            <p>
              {history.length
                ? history.map((item) => `${formatPercent(item.scoreTotal)} (${item.completedCount})`).join(' · ')
                : 'Completa más actividades para ver evolución.'}
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}

function SettingsTab({ coursePrefs, onCoursePrefsChange, onGenerateCourse, generating }) {
  const setField = (field, value) => {
    onCoursePrefsChange((current) => ({ ...current, [field]: value }));
  };

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

  return (
    <section className="panel dashboard-panel settings-panel-clean">
      <div>
        <p className="eyebrow">Ajustes de la ruta</p>
        <h2>Personaliza sin salir del panel</h2>
        <p className="lead">Mantén todo aquí para que la pantalla principal siga limpia y fácil de usar.</p>
      </div>

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
          <select value={coursePrefs?.dificultad || 'auto'} onChange={(event) => setField('dificultad', event.target.value)}>
            <option value="auto">Auto</option>
            <option value="facil">Fácil</option>
            <option value="normal">Normal</option>
            <option value="avanzada">Avanzada</option>
          </select>
        </label>

        <label>
          <span>Duración</span>
          <select value={coursePrefs?.duracion || '5-10'} onChange={(event) => setField('duracion', event.target.value)}>
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
    </section>
  );
}

export default function CoursesView({
  answers,
  assessment,
  coursePlan,
  courseProgress,
  coursePrefs,
  adminAccess = false,
  generating,
  onCoursePrefsChange,
  onGenerateCourse,
  onOpenModule,
}) {
  const [activeTab, setActiveTab] = useState('ruta');
  const route = Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : [];
  const routeEntries = route.map((module, index) => ({
    module,
    index,
    stats: getModuleStats(module, courseProgress),
  }));
  const recommendedIndex = getRecommendedModuleIndex(route, courseProgress);
  const recommendedEntry = routeEntries[recommendedIndex] || null;
  const recommendedModule = recommendedEntry
    ? { ...recommendedEntry.module, __moduleIndex: recommendedEntry.index }
    : null;
  const computed = computeCompetenciesFromProgress(coursePlan, courseProgress);
  const strongestTopic = getStrongestTopic(computed.competencias);
  const weakestTopic = getWeakestTopic(computed.competencias);
  const completedModules = routeEntries.filter((entry) => entry.stats.pct >= 100).length;
  const prioritySummary = getPrioritySummary(answers, assessment);
  const unlockedLimit = adminAccess ? route.length - 1 : getUnlockedLimit(route, courseProgress);
  const availableLevels = LEVEL_ORDER.filter((level) =>
    routeEntries.some((entry) => normalizeModuleLevel(entry.module.nivel) === level)
  );
  const defaultLevel = recommendedModule ? normalizeModuleLevel(recommendedModule.nivel) : availableLevels[0] || 'basico';
  const [activeLevel, setActiveLevel] = useState(defaultLevel);
  const [expandedModuleId, setExpandedModuleId] = useState(recommendedModule?.id || routeEntries[0]?.module?.id || null);

  useEffect(() => {
    if (!availableLevels.includes(activeLevel)) {
      setActiveLevel(defaultLevel);
    }
  }, [activeLevel, availableLevels, defaultLevel]);

  useEffect(() => {
    if (!routeEntries.some((entry) => entry.module.id === expandedModuleId)) {
      setExpandedModuleId(recommendedModule?.id || routeEntries[0]?.module?.id || null);
    }
  }, [expandedModuleId, recommendedModule?.id, routeEntries]);

  if (!assessment) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">Ruta personalizada</p>
        <h1>Primero completa tu evaluación</h1>
        <p className="lead">Necesitamos tu encuesta para organizar una ruta profesional y priorizada.</p>
      </section>
    );
  }

  if (!coursePlan || !courseProgress) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">Ruta personalizada</p>
        <h1>Tu ruta todavía no está lista</h1>
        <p className="lead">Genera tu plan y aquí verás una vista compacta de blindaje, módulos y progreso.</p>
        <button className="btn primary" type="button" onClick={onGenerateCourse} disabled={generating}>
          {generating ? 'Generando ruta...' : 'Generar mi ruta'}
        </button>
      </section>
    );
  }
  const recommendedStats = recommendedEntry?.stats || null;

  return (
    <div className="dashboard-shell course-dashboard">
      <div className="dashboard-grid course-hero-grid">
        <ShieldCard
          scoreTotal={computed.score_total}
          completedModules={completedModules}
          totalModules={route.length}
          lastAccessAt={courseProgress?.lastAccessAt}
          strongestTopic={strongestTopic}
          weakestTopic={weakestTopic}
          prioritySummary={prioritySummary}
          adminAccess={adminAccess}
        />

        <SpotlightCard
          module={recommendedModule}
          stats={recommendedStats}
          adminAccess={adminAccess}
          onOpenModule={onOpenModule}
          onShowRoute={() => setActiveTab('ruta')}
        />
      </div>

      <section className="panel dashboard-shell-panel">
        <div className="section-title-row dashboard-title-row">
          <div>
            <p className="eyebrow">Panel de aprendizaje</p>
            <h1>Ruta de cursos</h1>
          </div>
          <span className="activity-pill soft">Compacto, interactivo y sin scroll innecesario</span>
        </div>

        <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'ruta' ? (
          <RouteTab
            routeEntries={routeEntries}
            availableLevels={availableLevels}
            activeLevel={activeLevel}
            onChangeLevel={setActiveLevel}
            expandedModuleId={expandedModuleId}
            onToggleModule={(moduleId) =>
              setExpandedModuleId((current) => (current === moduleId ? null : moduleId))
            }
            recommendedIndex={recommendedIndex}
            unlockedLimit={unlockedLimit}
            adminAccess={adminAccess}
            onOpenModule={onOpenModule}
          />
        ) : null}

        {activeTab === 'progreso' ? (
          <ProgressTab
            computed={computed}
            progress={courseProgress}
            coursePlan={coursePlan}
            coursePrefs={coursePrefs}
            answers={answers}
            assessment={assessment}
          />
        ) : null}

        {activeTab === 'ajustes' ? (
          <SettingsTab
            coursePrefs={coursePrefs}
            onCoursePrefsChange={onCoursePrefsChange}
            onGenerateCourse={onGenerateCourse}
            generating={generating}
          />
        ) : null}
      </section>
    </div>
  );
}
