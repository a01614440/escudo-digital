import { ACTIVITY_LABELS, CATEGORY_LABELS, LEVEL_LABELS, getModuleAndActivity } from '../lib/course.js';
import ActivityRenderer from './activities/ActivityRenderer.jsx';

function LessonMeta({ module, activity, moduleIndex, activityIndex, totalActivities }) {
  const pct = Math.round(((activityIndex + 1) / Math.max(totalActivities, 1)) * 100);

  return (
    <header className="panel lesson-header">
      <div className="lesson-copy">
        <p className="eyebrow">{`Módulo ${moduleIndex + 1}`}</p>
        <h1 className="lesson-title">{module.titulo || `Módulo ${moduleIndex + 1}`}</h1>
        <p className="lead">{module.descripcion || 'Actividad interactiva de seguridad digital.'}</p>
      </div>

      <div className="lesson-meta">
        <span className="badge">{CATEGORY_LABELS[module.categoria] || module.categoria}</span>
        <span className={`badge level ${module.nivel}`}>
          {LEVEL_LABELS[module.nivel] || module.nivel}
        </span>
        <span className="badge subtle">
          {ACTIVITY_LABELS[activity.tipo] || activity.tipo || 'Actividad'}
        </span>
      </div>

      <div className="progress">
        <span>{`Actividad ${activityIndex + 1} de ${totalActivities}`}</span>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </header>
  );
}

function ModuleComplete({ module, onBack, onRetry }) {
  return (
    <section className="panel lesson-card">
      <p className="eyebrow">Módulo completado</p>
      <h2>{module?.titulo || 'Buen trabajo'}</h2>
      <p className="lead">
        Terminaste este módulo. Si quieres reforzarlo, puedes repasarlo completo o volver al
        tablero para seguir con tu ruta.
      </p>
      <div className="actions">
        <button className="btn primary" type="button" onClick={onBack}>
          Volver a cursos
        </button>
        <button className="btn ghost" type="button" onClick={onRetry}>
          Repasar módulo
        </button>
      </div>
    </section>
  );
}

export default function LessonView({
  coursePlan,
  currentLesson,
  answers,
  assessment,
  onBackToCourses,
  onRestartModule,
  onCompleteActivity,
}) {
  const route = Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : [];
  const module = route[currentLesson?.moduleIndex || 0];

  if (!module) {
    return (
      <section className="page">
        <section className="panel lesson-card">
          <p className="eyebrow">Sin lección</p>
          <h2>No encontramos este módulo</h2>
          <button className="btn primary" type="button" onClick={onBackToCourses}>
            Volver a cursos
          </button>
        </section>
      </section>
    );
  }

  const info = getModuleAndActivity(
    coursePlan,
    currentLesson?.moduleIndex || 0,
    currentLesson?.activityIndex || 0
  );
  const activities = Array.isArray(module.actividades) ? module.actividades : [];

  if (!info || !info.activity) {
    return (
      <section className="page">
        <ModuleComplete module={module} onBack={onBackToCourses} onRetry={onRestartModule} />
      </section>
    );
  }

  return (
    <section id="lessonView" className="page">
      <LessonMeta
        module={module}
        activity={info.activity}
        moduleIndex={currentLesson.moduleIndex}
        activityIndex={currentLesson.activityIndex}
        totalActivities={activities.length}
      />

      <section className="panel lesson-card">
        <div className="lesson-actions">
          <button className="btn ghost" type="button" onClick={onBackToCourses}>
            Salir del módulo
          </button>
        </div>

        <ActivityRenderer
          key={`${module.id}-${info.activity.id}`}
          module={module}
          activity={info.activity}
          answers={answers}
          assessment={assessment}
          onComplete={onCompleteActivity}
        />
      </section>
    </section>
  );
}
