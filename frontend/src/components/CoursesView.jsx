import { formatDate } from '../lib/format.js';
import {
  CATEGORY_LABELS,
  COMP_KEYS,
  LEVEL_LABELS,
  computeCompetenciesFromProgress,
  defaultTopicsFromAnswers,
  normalizeCategory,
  summarizeProgressInsights,
} from '../lib/course.js';

const TOPIC_OPTIONS = COMP_KEYS.map((topic) => ({
  value: topic,
  label: CATEGORY_LABELS[topic] || topic,
}));

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
    <article className="panel summary-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ruta personalizada</p>
          <h3>Ajustes del curso</h3>
          <p className="hint">
            Puedes regenerar la ruta para priorizar otros temas o cambiar el ritmo de las
            sesiones.
          </p>
        </div>
        <button
          className="btn primary"
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
        >
          {generating ? 'Generando...' : 'Generar o actualizar ruta'}
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
            <option value="practico">Mas practico</option>
            <option value="teorico">Mas guiado</option>
          </select>
        </label>

        <label>
          Dificultad
          <select
            value={value?.dificultad || 'auto'}
            onChange={(event) => patch({ dificultad: event.target.value })}
          >
            <option value="auto">Automatica</option>
            <option value="basico">Basica</option>
            <option value="refuerzo">Refuerzo</option>
            <option value="avanzado">Avanzada</option>
          </select>
        </label>

        <label>
          Duracion por sesion
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
        <p className="hint">Temas prioritarios</p>
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

function ModuleCard({ module, moduleIndex, progress, onOpen }) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const completed = activities.filter((activity) => Boolean(progress?.completed?.[activity.id])).length;
  const total = activities.length || 1;
  const pct = Math.round((completed / total) * 100);
  const label = pct >= 100 ? 'Repasar' : pct > 0 ? 'Continuar' : 'Empezar';

  return (
    <article className="module-card">
      <div className="module-head">
        <div>
          <p className="module-title">{module.titulo || `Modulo ${moduleIndex + 1}`}</p>
          <p className="module-desc">{module.descripcion || 'Modulo personalizado por IA.'}</p>
        </div>
        <div className="badges">
          <span className="badge">{CATEGORY_LABELS[module.categoria] || module.categoria}</span>
          <span className={`badge level ${module.nivel}`}>
            {LEVEL_LABELS[module.nivel] || module.nivel}
          </span>
        </div>
      </div>

      <div className="progress-mini">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="module-meta">
        <span>{completed} de {activities.length} actividades</span>
        <span>{pct}% completado</span>
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
  const hasPlan = Boolean(coursePlan && courseProgress);
  const computed = hasPlan
    ? computeCompetenciesFromProgress(coursePlan, courseProgress)
    : {
        competencias: coursePlan?.competencias || {},
        score_total: coursePlan?.score_total || 0,
      };
  const insights = hasPlan ? summarizeProgressInsights(coursePlan, courseProgress) : null;
  const route = Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : [];
  const snapshots = Array.isArray(courseProgress?.snapshots)
    ? courseProgress.snapshots.slice(-5).reverse()
    : [];
  const completedCount = Object.keys(courseProgress?.completed || {}).length;

  return (
    <section id="coursesView" className="page">
      <header className="hero">
        <p className="eyebrow">Cursos personalizados</p>
        <h1>Tu ruta de aprendizaje</h1>
        <p className="lead">
          {assessment
            ? 'Usamos tu assessment y tu progreso real para ajustar la ruta y evitar repeticiones.'
            : 'Completa primero la encuesta para generar una ruta personalizada.'}
        </p>
      </header>

      <CoursePreferences
        answers={answers}
        value={coursePrefs}
        onChange={onCoursePrefsChange}
        onGenerate={onGenerateCourse}
        generating={generating}
        canGenerate={Boolean(assessment)}
      />

      {hasPlan ? (
        <>
          <section className="dashboard-grid">
            <DonutCard score={computed.score_total || 0} label={coursePlan?.score_name || 'Blindaje Digital'} />
            <CompetencyList competencias={computed.competencias} />
          </section>

          <section className="course-summary-grid">
            <article className="panel summary-card">
              <p className="eyebrow">Resumen</p>
              <h3>Lo que estamos viendo</h3>
              <div className="summary-list">
                <div className="summary-item">
                  <strong>Fortalezas</strong>
                  <p>{insights?.strengths?.join(' · ') || 'Aun estamos recogiendo senales.'}</p>
                </div>
                <div className="summary-item">
                  <strong>Enfoque</strong>
                  <p>{insights?.focus?.join(' · ') || 'La ruta se ajustara con tu progreso.'}</p>
                </div>
                <div className="summary-item">
                  <strong>Actividad completada</strong>
                  <p>{completedCount} actividades registradas.</p>
                </div>
              </div>
            </article>

            <article className="panel summary-card">
              <p className="eyebrow">Historial</p>
              <h3>Ultimos hitos</h3>
              <div className="history-list">
                {snapshots.length ? (
                  snapshots.map((snapshot) => (
                    <div className="history-item" key={`${snapshot.at}-${snapshot.completedCount}`}>
                      <div>
                        <p className="history-title">{snapshot.scoreTotal || 0}% de blindaje</p>
                        <p className="history-meta">
                          {formatDate(snapshot.at)} · {snapshot.completedCount || 0} actividades
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="hint">
                    Aun no hay hitos guardados. En cuanto avances, apareceran aqui.
                  </p>
                )}
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Modulos</p>
                <h2>Tu plan activo</h2>
                <p className="hint">
                  Version {coursePlan?.planVersion || '1'} · {route.length} modulos
                </p>
              </div>
            </div>
            <div className="modules-list">
              {route.map((module, moduleIndex) => (
                <ModuleCard
                  key={module.id || `${module.categoria}-${moduleIndex}`}
                  module={module}
                  moduleIndex={moduleIndex}
                  progress={courseProgress}
                  onOpen={onOpenModule}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel empty-state">
          <p className="eyebrow">Aun no hay ruta</p>
          <h2>Genera tu primer curso</h2>
          <p className="lead">
            En cuanto termines la encuesta podremos armar modulos, simulaciones y actividades con
            `scenarioId` para ti.
          </p>
        </section>
      )}
    </section>
  );
}
