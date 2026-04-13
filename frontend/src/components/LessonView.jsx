import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  getModuleAndActivity,
  normalizeModuleTitleForDisplay,
  repairPossibleMojibake,
} from '../lib/course.js';
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

function ModuleEmptyState({ title, body, onBack }) {
  return (
    <section className="sd-page-shell py-8 sm:py-10">
      <SurfaceCard className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Ruta de aprendizaje</p>
        <h1 className="sd-title mt-3">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-sd-muted sm:text-base">
          {body}
        </p>
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
        compact ? '' : 'lg:sticky lg:top-6'
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{`Modulo ${moduleIndex + 1}`}</p>
            <h1 className="sd-title mt-3">
              {cleanText(
                normalizeModuleTitleForDisplay(module?.categoria, module?.titulo || module?.title),
                `Modulo ${moduleIndex + 1}`
              )}
            </h1>
            <p className="mt-4 text-sm leading-7 text-sd-muted sm:text-base">
              {cleanText(
                module?.descripcion,
                'Actividad interactiva para convertir criterio digital en una rutina mas segura.'
              )}
            </p>
          </div>
          <Button variant="ghost" size="compact" type="button" onClick={onBack}>
            Salir del modulo
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{CATEGORY_LABELS[module?.categoria] || 'Curso'}</Badge>
          <Badge tone="neutral">{LEVEL_LABELS[module?.nivel] || module?.nivel || 'Nivel'}</Badge>
          <Badge tone="soft">
            {ACTIVITY_LABELS[activity?.tipo] || activity?.tipo || 'Actividad'}
          </Badge>
        </div>

        <div className="rounded-[24px] border border-sd-border bg-white/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sd-muted">
                Progreso del modulo
              </p>
              <strong className="mt-2 block text-2xl text-sd-text">{`${activityIndex + 1}/${Math.max(totalActivities, 1)}`}</strong>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sd-muted">
                Avance
              </p>
              <strong className="mt-2 block text-2xl text-sd-text">{`${progressPct}%`}</strong>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sd-accent transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-[24px] border border-sd-border bg-white/70 p-4">
          <p className="eyebrow">Actividad actual</p>
          <strong className="mt-2 block text-lg text-sd-text">
            {cleanText(activity?.titulo, 'Actividad en curso')}
          </strong>
          <p className="mt-3 text-sm leading-6 text-sd-muted">
            {cleanText(
              activity?.intro || activity?.escenario || activity?.prompt,
              'Avanza paso a paso, presta atencion a las senales y usa la rutina segura antes de responder.'
            )}
          </p>
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
        const state =
          index < activityIndex ? 'done' : index === activityIndex ? 'current' : 'next';
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
              <strong className="block text-sm text-sd-text">
                {cleanText(activity?.titulo, `Actividad ${index + 1}`)}
              </strong>
              <p className="mt-2 text-xs leading-5 text-sd-muted">
                {ACTIVITY_LABELS[activity?.tipo] || activity?.tipo || 'Actividad'}
              </p>
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
              <p className="eyebrow">Mapa del modulo</p>
              <strong className="mt-2 block text-base text-sd-text">
                {`${activities.length} actividades en esta ruta`}
              </strong>
            </div>
            <Badge tone="neutral">{`Paso ${activityIndex + 1}`}</Badge>
          </div>
        </summary>
        <div className="mt-4">{content}</div>
      </details>
    );
  }

  return (
    <SurfaceCard padding="compact" className="lg:sticky lg:top-[24rem]">
      <p className="eyebrow">Mapa del modulo</p>
      <strong className="mt-2 block text-lg text-sd-text">
        {`${activities.length} actividades en esta ruta`}
      </strong>
      <p className="mt-3 text-sm leading-6 text-sd-muted">
        Usa este mapa para ubicar en que parte del modulo vas y que viene despues.
      </p>
      <div className="mt-5">{content}</div>
    </SurfaceCard>
  );
}

function ModuleComplete({ module, onBack, onRetry }) {
  return (
    <section className="sd-page-shell py-8 sm:py-10">
      <SurfaceCard className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Modulo completado</p>
        <h1 className="sd-title mt-3">
          {cleanText(module?.titulo, 'Buen trabajo')}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-sd-muted sm:text-base">
          Terminaste este modulo. Puedes volver al tablero para seguir con tu ruta o repetirlo para reforzar senales y decisiones.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" type="button" onClick={onBack}>
            Volver a cursos
          </Button>
          <Button variant="ghost" type="button" onClick={onRetry}>
            Repasar modulo
          </Button>
        </div>
      </SurfaceCard>
    </section>
  );
}

export default function LessonView({
  viewport = 'desktop',
  coursePlan,
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
        title="No encontramos este modulo"
        body="Puede que el plan haya cambiado o que la posicion actual ya no exista. Vuelve a cursos para retomar la ruta."
        onBack={onBackToCourses}
      />
    );
  }

  const info = getModuleAndActivity(coursePlan, moduleIndex, activityIndex);
  const activities = Array.isArray(module.actividades) ? module.actividades : [];

  if (!info || !info.activity) {
    return <ModuleComplete module={module} onBack={onBackToCourses} onRetry={onRestartModule} />;
  }

  return (
    <section
      id="lessonView"
      className={cn(
        'sd-page-shell py-6 sm:py-8',
        compact ? 'space-y-4' : 'space-y-5'
      )}
    >
      <div className={cn('grid gap-5', compact ? '' : 'xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]')}>
        <div className={cn('space-y-4', compact ? '' : 'xl:order-1')}>
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

        <div className={cn('space-y-4', compact ? '' : 'xl:order-2')}>
          <SurfaceCard className="overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">Practica actual</p>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-sd-text">
                  {cleanText(info.activity?.titulo, 'Actividad')}
                </h2>
                <p className="mt-3 text-sm leading-6 text-sd-muted">
                  {cleanText(
                    info.activity?.intro || info.activity?.escenario || info.activity?.prompt,
                    'Avanza con calma, revisa las senales y registra la decision mas segura.'
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">
                  {ACTIVITY_LABELS[info.activity?.tipo] || info.activity?.tipo || 'Actividad'}
                </Badge>
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
