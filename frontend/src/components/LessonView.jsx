import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  getModuleAndActivity,
  normalizeModuleTitleForDisplay,
  repairPossibleMojibake,
} from '../lib/course.js';
import { getActivityInstructionMeta, buildJourneyProgress } from '../lib/journeyGuidance.js';
import { cn } from '../lib/ui.js';
import ActivityRenderer from './activities/ActivityRenderer.jsx';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

const COMPACT_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact']);

function cleanText(value, fallback = '') {
  const safe = repairPossibleMojibake(String(value || '')).trim();
  return safe || fallback;
}

function buildModuleSummary(module, courseProgress) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const completed = activities
    .map((activity) => ({
      activity,
      record: courseProgress?.completed?.[activity.id] || null,
    }))
    .filter((entry) => entry.record);

  const strengths = completed
    .filter((entry) => Number(entry.record?.score) >= 0.78)
    .map((entry) => cleanText(entry.activity?.titulo || ACTIVITY_LABELS[entry.activity?.tipo] || 'Actividad'))
    .slice(0, 3);
  const improvementAreas = completed
    .filter((entry) => Number(entry.record?.score) < 0.62)
    .map((entry) => cleanText(entry.activity?.titulo || ACTIVITY_LABELS[entry.activity?.tipo] || 'Actividad'))
    .slice(0, 3);

  return {
    strengths,
    improvementAreas,
    completedCount: completed.length,
    avgScore: completed.length
      ? Math.round(
          (completed.reduce((total, entry) => total + (Number(entry.record?.score) || 0), 0) /
            completed.length) *
            100
        )
      : 0,
  };
}

function JourneyStrip({ steps }) {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {steps.map((step, index) => (
        <article
          key={step.id}
          className={cn(
            'rounded-[22px] border px-4 py-4',
            step.state === 'current'
              ? 'border-sd-accent bg-sd-accent-soft'
              : step.state === 'done'
                ? 'border-emerald-200 bg-emerald-50/80'
                : 'border-sd-border bg-white/68'
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">{`Paso ${index + 1}`}</p>
          <strong className="mt-2 block text-sm text-sd-text">{step.label}</strong>
          <p className="mt-3 text-sm leading-6 text-sd-muted">{step.description}</p>
        </article>
      ))}
    </div>
  );
}

function ModuleEmptyState({ title, body, onBack }) {
  return (
    <section className="sd-page-shell py-8 sm:py-10">
      <SurfaceCard className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Ruta de aprendizaje</p>
        <h1 className="sd-title mt-3">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-sd-muted sm:text-base">{body}</p>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" type="button" onClick={onBack}>
            Volver a cursos
          </Button>
        </div>
      </SurfaceCard>
    </section>
  );
}

function LessonHero({
  module,
  activity,
  moduleIndex,
  activityIndex,
  totalActivities,
  compact = false,
  onBack,
}) {
  const progressPct = Math.round(((activityIndex + 1) / Math.max(totalActivities, 1)) * 100);

  return (
    <SurfaceCard
      className={cn(
        'overflow-hidden bg-gradient-to-br from-white via-white/92 to-sd-accent-soft',
        compact ? '' : 'xl:sticky xl:top-6'
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{`Módulo ${moduleIndex + 1}`}</p>
            <h1 className="sd-title mt-3">
              {cleanText(
                normalizeModuleTitleForDisplay(module?.categoria, module?.titulo || module?.title),
                `Módulo ${moduleIndex + 1}`
              )}
            </h1>
            <p className="mt-4 text-sm leading-7 text-sd-muted sm:text-base">
              {cleanText(
                module?.descripcion,
                'Actividad interactiva para convertir criterio digital en una rutina más segura.'
              )}
            </p>
          </div>
          <Button variant="ghost" size="compact" type="button" onClick={onBack}>
            Salir del módulo
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{CATEGORY_LABELS[module?.categoria] || 'Curso'}</Badge>
          <Badge tone="neutral">{LEVEL_LABELS[module?.nivel] || module?.nivel || 'Nivel'}</Badge>
          <Badge tone="soft">{ACTIVITY_LABELS[activity?.tipo] || activity?.tipo || 'Actividad'}</Badge>
        </div>

        <div className="rounded-[24px] border border-sd-border bg-white/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sd-muted">Progreso del módulo</p>
              <strong className="mt-2 block text-2xl text-sd-text">{`${activityIndex + 1}/${Math.max(totalActivities, 1)}`}</strong>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sd-muted">Avance</p>
              <strong className="mt-2 block text-2xl text-sd-text">{`${progressPct}%`}</strong>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sd-accent transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function LessonInstructionPanel({ module, activity }) {
  const meta = getActivityInstructionMeta(activity?.tipo, module);

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Guía rápida</p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-sd-text">{meta.heading}</h2>
          <p className="mt-3 text-sm leading-6 text-sd-muted">
            {cleanText(activity?.intro || activity?.escenario || activity?.prompt, meta.quickTip)}
          </p>
        </div>
        <Badge tone="accent">¿Qué sigue?</Badge>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[22px] border border-sd-border bg-white/74 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Objetivo</span>
          <p className="mt-3 text-sm leading-6 text-sd-text">{meta.objective}</p>
        </div>
        <div className="rounded-[22px] border border-sd-border bg-white/74 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Qué debes hacer</span>
          <p className="mt-3 text-sm leading-6 text-sd-text">{meta.whatToDo}</p>
        </div>
        <div className="rounded-[22px] border border-sd-border bg-white/74 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Cómo se califica</span>
          <p className="mt-3 text-sm leading-6 text-sd-text">{meta.scoring}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}

function ModuleActivityMap({ module, activityIndex, compact = false }) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];

  const content = (
    <div className="space-y-3">
      {activities.map((activity, index) => {
        const state = index < activityIndex ? 'done' : index === activityIndex ? 'current' : 'next';
        return (
          <article
            className={cn(
              'flex items-start gap-3 rounded-[20px] border px-4 py-4',
              state === 'done'
                ? 'border-emerald-200 bg-emerald-50/70'
                : state === 'current'
                  ? 'border-sd-accent bg-sd-accent-soft'
                  : 'border-sd-border bg-white/75'
            )}
            key={activity?.id || `${index}-${activity?.titulo}`}
          >
            <span
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase tracking-[0.14em]',
                state === 'done'
                  ? 'bg-emerald-100 text-emerald-700'
                  : state === 'current'
                    ? 'bg-sd-accent text-white'
                    : 'bg-slate-100 text-slate-600'
              )}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <strong className="block text-sm text-sd-text">{cleanText(activity?.titulo, `Actividad ${index + 1}`)}</strong>
              <p className="mt-2 text-xs leading-5 text-sd-muted">{ACTIVITY_LABELS[activity?.tipo] || activity?.tipo || 'Actividad'}</p>
            </div>
          </article>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <details className="rounded-[24px] border border-sd-border bg-white/70 p-4">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Mapa del módulo</p>
              <strong className="mt-2 block text-base text-sd-text">{`${activities.length} actividades en esta ruta`}</strong>
            </div>
            <Badge tone="neutral">{`Paso ${activityIndex + 1}`}</Badge>
          </div>
        </summary>
        <div className="mt-4">{content}</div>
      </details>
    );
  }

  return (
    <SurfaceCard padding="compact">
      <p className="eyebrow">Mapa del módulo</p>
      <strong className="mt-2 block text-lg text-sd-text">{`${activities.length} actividades en esta ruta`}</strong>
      <p className="mt-3 text-sm leading-6 text-sd-muted">
        Usa este mapa para ubicarte, ver qué viene después y no tener que adivinar el siguiente paso.
      </p>
      <div className="mt-5">{content}</div>
    </SurfaceCard>
  );
}

function ModuleComplete({ module, courseProgress, onBack, onRetry }) {
  const summary = buildModuleSummary(module, courseProgress);

  return (
    <section className="sd-page-shell py-8 sm:py-10">
      <SurfaceCard className="mx-auto max-w-4xl">
        <p className="eyebrow">Módulo completado</p>
        <h1 className="sd-title mt-3">{cleanText(module?.titulo, 'Buen trabajo')}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-sd-muted sm:text-base">
          Terminaste este módulo. Antes de seguir, aquí tienes un cierre corto para reforzar qué ya haces bien y qué conviene repetir.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border border-sd-border bg-white/74 p-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Promedio</span>
            <strong className="mt-3 block text-3xl text-sd-text">{summary.avgScore ? `${summary.avgScore}%` : 'Sin score'}</strong>
          </div>
          <div className="rounded-[24px] border border-sd-border bg-white/74 p-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Fortalezas</span>
            <p className="mt-3 text-sm leading-6 text-sd-text">
              {summary.strengths.length ? summary.strengths.join(' · ') : 'Ya cerraste el módulo; ahora conviene seguir practicando para consolidar.'}
            </p>
          </div>
          <div className="rounded-[24px] border border-sd-border bg-white/74 p-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Área de mejora</span>
            <p className="mt-3 text-sm leading-6 text-sd-text">
              {summary.improvementAreas.length ? summary.improvementAreas.join(' · ') : 'No se ven tropiezos claros; puedes seguir con el siguiente módulo.'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" type="button" onClick={onBack}>
            Volver a cursos
          </Button>
          <Button variant="ghost" type="button" onClick={onRetry}>
            Repasar módulo
          </Button>
        </div>
      </SurfaceCard>
    </section>
  );
}

export default function LessonView({
  viewport = 'desktop',
  coursePlan,
  courseProgress,
  currentLesson,
  answers,
  assessment,
  onBackToCourses,
  onRestartModule,
  onCompleteActivity,
}) {
  const compact = COMPACT_VIEWPORTS.has(viewport);
  const route = Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : [];
  const moduleIndex = currentLesson?.moduleIndex || 0;
  const activityIndex = currentLesson?.activityIndex || 0;
  const module = route[moduleIndex];

  if (!module) {
    return (
      <ModuleEmptyState
        title="No encontramos este módulo"
        body="Puede que el plan haya cambiado o que la posición actual ya no exista. Vuelve a cursos para retomar la ruta."
        onBack={onBackToCourses}
      />
    );
  }

  const info = getModuleAndActivity(coursePlan, moduleIndex, activityIndex);
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  const journeySteps = buildJourneyProgress({
    currentView: 'lesson',
    surveyStage: 'results',
    hasAssessment: Boolean(assessment),
    hasCoursePlan: Boolean(coursePlan),
    inLesson: true,
  });

  if (!info || !info.activity) {
    return <ModuleComplete module={module} courseProgress={courseProgress} onBack={onBackToCourses} onRetry={onRestartModule} />;
  }

  return (
    <section id="lessonView" className={cn('sd-page-shell py-6 sm:py-8', compact ? 'space-y-4' : 'space-y-5')}>
      <JourneyStrip steps={journeySteps} />

      <div className={cn('grid gap-5', compact ? '' : 'xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]')}>
        <div className="space-y-4">
          <LessonHero
            module={module}
            activity={info.activity}
            moduleIndex={moduleIndex}
            activityIndex={activityIndex}
            totalActivities={activities.length}
            compact={compact}
            onBack={onBackToCourses}
          />
          <ModuleActivityMap module={module} activityIndex={activityIndex} compact={compact} />
        </div>

        <div className="space-y-4">
          <LessonInstructionPanel module={module} activity={info.activity} />

          <SurfaceCard className="overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">Práctica actual</p>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-sd-text">
                  {cleanText(info.activity?.titulo, 'Actividad')}
                </h2>
                <p className="mt-3 text-sm leading-6 text-sd-muted">
                  {cleanText(
                    info.activity?.intro || info.activity?.escenario || info.activity?.prompt,
                    'Avanza con calma, revisa las señales y registra la decisión más segura.'
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{ACTIVITY_LABELS[info.activity?.tipo] || info.activity?.tipo || 'Actividad'}</Badge>
                <Badge tone="neutral">{`Paso ${activityIndex + 1}`}</Badge>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard padding={compact ? 'compact' : 'lg'} className="overflow-hidden">
            <ActivityRenderer
              key={`${module.id}-${info.activity.id}`}
              viewport={viewport}
              module={module}
              activity={info.activity}
              answers={answers}
              assessment={assessment}
              onComplete={onCompleteActivity}
            />
          </SurfaceCard>
        </div>
      </div>
    </section>
  );
}
