import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  getModuleAndActivity,
  normalizeModuleTitleForDisplay,
  repairPossibleMojibake,
} from '../lib/course.js';
import { getActivityInstructionMeta } from '../lib/journeyGuidance.js';
import { cn } from '../lib/ui.js';
import { getShellFamily } from '../hooks/useResponsiveLayout.js';
import {
  ActionCluster,
  PanelHeader,
} from '../patterns/index.js';
import ActivityRenderer from './activities/ActivityRenderer.jsx';
import {
  Badge,
  Button,
  InlineMessage,
  ProgressBar,
  SurfaceCard,
} from './ui/index.js';

function cleanText(value, fallback = '') {
  const safe = repairPossibleMojibake(String(value || '')).trim();
  return safe || fallback;
}

function getModuleTitle(module, moduleIndex = 0) {
  return cleanText(
    normalizeModuleTitleForDisplay(module?.categoria, module?.titulo || module?.title),
    `Módulo ${moduleIndex + 1}`
  );
}

function getActivityTitle(activity, activityIndex = 0) {
  return cleanText(activity?.titulo, `Actividad ${activityIndex + 1}`);
}

function formatPercentLabel(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function formatLastAccessLabel(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

const IMMERSIVE_ACTIVITY_TYPES = new Set(['sim_chat', 'inbox', 'web_lab', 'call_sim', 'scenario_flow']);

function isImmersiveActivityType(type) {
  return IMMERSIVE_ACTIVITY_TYPES.has(String(type || '').toLowerCase());
}

function getLessonStageMode(activity) {
  return isImmersiveActivityType(activity?.tipo) ? 'immersive' : 'guided';
}

function getCompletedModules(route, courseProgress) {
  return route.filter((module) => {
    const activities = Array.isArray(module?.actividades) ? module.actividades : [];
    return activities.length && activities.every((activity) => Boolean(courseProgress?.completed?.[activity.id]));
  }).length;
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
    .map((entry) => getActivityTitle(entry.activity))
    .slice(0, 2);

  const improvementAreas = completed
    .filter((entry) => Number(entry.record?.score) < 0.62)
    .map((entry) => getActivityTitle(entry.activity))
    .slice(0, 2);

  return {
    completedCount: completed.length,
    avgScore: completed.length
      ? Math.round(
          (completed.reduce((total, entry) => total + (Number(entry.record?.score) || 0), 0) /
            completed.length) *
            100
        )
      : 0,
    strengths,
    improvementAreas,
  };
}

function ModuleEmptyState({ shellFamily, title, body, onBack }) {
  return (
    <section className="sd-page-shell py-[var(--sd-shell-padding-block)]" data-sd-container="true">
      <div className="grid gap-[var(--sd-shell-section-gap)]">
        <SurfaceCard
          padding="xl"
          variant="command"
          tone="inverse"
          className="sd-lesson-briefing sd-lesson-shell-command"
          data-sd-container="true"
          data-sd-lesson-shell="empty"
        >
          <div className="grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="sd-eyebrow m-0">Cabina de practica</span>
              <Badge tone="soft">Reubicar</Badge>
            </div>

            <div className="grid gap-3">
              <h1 className="sd-title-display m-0">{title}</h1>
              <p className="sd-copy m-0 max-w-[52ch]">{body}</p>
              <p className="m-0 text-sm leading-6 text-sd-text-inverse">
                La continuidad sigue intacta; solo necesitamos devolverte a la ruta correcta.
              </p>
            </div>

            <div className="sd-lesson-shell-status grid gap-2 rounded-[22px] border border-white/12 bg-white/[0.06] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-sd-text-inverse">Estado actual</span>
                <strong className="sd-copy-strong m-0">Sin modulo activo</strong>
              </div>
              <ProgressBar value={0} tone="accent" size="lg" />
            </div>

            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
              <Button variant="primary" size="lg" type="button" onClick={onBack}>
                Volver a mi ruta
              </Button>
            </ActionCluster>
          </div>
        </SurfaceCard>

        <InlineMessage tone="info" title="Ruta y progreso preservados">
          El lesson no encontro la actividad visible, pero tu ruta y tu avance siguen intactos.
        </InlineMessage>
      </div>
    </section>
  );
}
function LessonMissionHero({
  shellFamily,
  module,
  activity,
  moduleIndex,
  routeLength,
  activityIndex,
  totalActivities,
  moduleSummary,
  completedModules,
  onBack,
}) {
  const moduleTitle = getModuleTitle(module, moduleIndex);
  const activityTitle = getActivityTitle(activity, activityIndex);
  const categoryLabel = CATEGORY_LABELS[module?.categoria] || 'Ruta';
  const levelLabel = LEVEL_LABELS[module?.nivel] || cleanText(module?.nivel, 'Nivel');
  const activityLabel = ACTIVITY_LABELS[activity?.tipo] || 'Práctica';
  const modulePositionPct = Math.round(((activityIndex + 1) / Math.max(totalActivities, 1)) * 100);
  const routeProgressPct = Math.round((completedModules / Math.max(routeLength, 1)) * 100);

  const progressHint = moduleSummary.completedCount
    ? `${moduleSummary.completedCount} completada(s) en este módulo`
    : `${routeProgressPct}% de ruta cerrada`;

  return (
    <SurfaceCard
      padding="xl"
      variant="command"
      tone="inverse"
      className="sd-lesson-briefing relative overflow-hidden border-sd-border-strong"
      data-sd-container="true"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sd-accent via-sd-accent to-sd-accent-strong" />

      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="sd-eyebrow m-0">{`Módulo ${moduleIndex + 1} · ${moduleTitle}`}</span>
          <Badge tone="soft">{activityLabel}</Badge>
        </div>

        <div className="grid gap-3">
          <h1 className="sd-title-display m-0">{activityTitle}</h1>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-sd-text-inverse">
            {`${categoryLabel} · ${levelLabel}`}
          </p>
        </div>

        <ActionCluster
          align="start"
          collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}
        >
          <Button
            type="button"
            variant="ghost"
            data-sd-lesson-back="courses"
            onClick={onBack}
          >
            Volver a la ruta
          </Button>
        </ActionCluster>

        <div className="sd-lesson-briefing-progress grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-sd-text-inverse">
              {`Actividad ${activityIndex + 1}/${Math.max(totalActivities, 1)} · Módulo ${moduleIndex + 1}/${Math.max(routeLength, 1)}`}
            </span>
            <strong className="sd-copy-strong m-0">{progressHint}</strong>
          </div>
          <ProgressBar value={modulePositionPct} tone="accent" size="lg" />
        </div>
      </div>
    </SurfaceCard>
  );
}

function ActivityMapList({ module, activityIndex, courseProgress }) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];

  return (
    <div className="grid gap-3">
      {activities.map((activity, index) => {
        const record = courseProgress?.completed?.[activity.id] || null;
        const isCurrent = index === activityIndex;
        const isDone = !isCurrent && Boolean(record);
        const stateNote = isCurrent
          ? 'Ahora mismo'
          : isDone
            ? `Completada · ${formatPercentLabel((Number(record?.score) || 0) * 100)}`
            : `Después · ${ACTIVITY_LABELS[activity?.tipo] || 'Actividad'}`;

        return (
          <SurfaceCard
            key={activity?.id || `${index}-${activity?.titulo}`}
            padding="compact"
            variant={isCurrent ? 'raised' : isDone ? 'subtle' : 'panel'}
            className={cn(
              'border-sd-border-strong',
              isCurrent ? 'bg-sd-accent-soft shadow-[0_24px_48px_-32px_rgba(47,99,255,0.38)]' : ''
            )}
          >
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
              <span
                className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  isCurrent
                    ? 'border-sd-accent bg-sd-accent text-sd-accent-contrast'
                    : isDone
                      ? 'border-sd-border-strong bg-sd-surface-subtle text-sd-text'
                      : 'border-sd-border-strong bg-sd-surface text-sd-text'
                )}
              >
                {isDone ? 'OK' : String(index + 1).padStart(2, '0')}
              </span>

              <div className="grid min-w-0 gap-1">
                <strong className="text-sm leading-5 text-sd-text">{getActivityTitle(activity, index)}</strong>
                <p className="m-0 text-sm leading-6 text-sd-text">{stateNote}</p>
              </div>
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
}

function LessonCommandRail({
  shellFamily,
  module,
  activityIndex,
  courseProgress,
  onBack,
  onRestart,
  compact = false,
}) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const moduleSummary = buildModuleSummary(module, courseProgress);
  const moduleProgressPct = Math.round((moduleSummary.completedCount / Math.max(activities.length, 1)) * 100);
  const mapContent = <ActivityMapList module={module} activityIndex={activityIndex} courseProgress={courseProgress} />;
  const progressLabel = moduleSummary.completedCount
    ? `${moduleSummary.completedCount}/${Math.max(activities.length, 1)} actividades cerradas`
    : 'Todavia no cierras actividades en este modulo.';

  return (
    <SurfaceCard
      padding={compact ? 'md' : 'lg'}
      variant="support"
      className="sd-lesson-support-card border-sd-border-strong"
      data-sd-lesson-context={compact ? 'compact-map' : 'mission'}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <p className="sd-eyebrow m-0">Mapa del modulo</p>
            <h2 className="sd-heading-sm m-0">{getModuleTitle(module)}</h2>
            <p className="m-0 text-sm leading-6 text-sd-text">{progressLabel}</p>
          </div>
          <Badge tone="accent">{formatPercentLabel(moduleProgressPct)}</Badge>
        </div>

        <ProgressBar value={moduleProgressPct} tone="accent" size="lg" />

        <details
          className="sd-lesson-map-toggle rounded-[20px] border border-sd-border-strong bg-white px-4 py-4"
          data-sd-lesson-map="secondary"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
            {compact ? 'Ver recorrido del modulo' : 'Abrir mapa del modulo'}
          </summary>
          <div className="mt-4">{mapContent}</div>
        </details>

        <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
          <Button variant="secondary" type="button" onClick={onBack}>
            Volver a la ruta
          </Button>
          <Button variant="quiet" type="button" onClick={onRestart}>
            Reiniciar modulo
          </Button>
        </ActionCluster>
      </div>
    </SurfaceCard>
  );
}
function LessonActivityStage({
  shellFamily,
  stageMode = 'guided',
  viewport,
  module,
  activity,
  activityIndex,
  answers,
  assessment,
  onCompleteActivity,
}) {
  const instructionMeta = getActivityInstructionMeta(activity?.tipo, module);
  const isImmersive = stageMode === 'immersive';
  const renderer = (
    <ActivityRenderer
      key={`${module.id}-${activity.id}`}
      viewport={viewport}
      module={module}
      activity={activity}
      answers={answers}
      assessment={assessment}
      onComplete={onCompleteActivity}
    />
  );

  if (isImmersive) {
    return (
      <section
        className="sd-lesson-stage sd-lesson-stage-immersive"
        data-sd-lesson-stage="immersive"
        data-sd-activity-type={String(activity?.tipo || '')}
        data-sd-stage-comfort="fullscreen"
      >
        <div className="sr-only">
          <h2>{getActivityTitle(activity, activityIndex)}</h2>
          <p>{instructionMeta.quickTip}</p>
        </div>
        {renderer}
      </section>
    );
  }

  return (
    <section
      className="sd-lesson-stage sd-lesson-stage-guided overflow-hidden rounded-[26px] border border-sd-border-strong bg-sd-surface-raised px-4 py-4 shadow-[0_30px_76px_-56px_rgba(15,27,51,0.42)]"
      data-sd-lesson-stage="guided"
      data-sd-briefing-source="activity-chrome"
      data-sd-stage-comfort="dominant"
    >
      <div className="sd-lesson-stage-head flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="sd-eyebrow m-0">Actividad actual</p>
          <h2 className="m-0 text-[1.2rem] leading-tight font-semibold text-sd-text">
            {getActivityTitle(activity, activityIndex)}
          </h2>

        </div>
        <Badge tone="accent">{ACTIVITY_LABELS[activity?.tipo] || 'Practica'}</Badge>
      </div>

      <div className="sd-lesson-renderer-frame mt-4 overflow-hidden rounded-[24px] border border-sd-border-strong bg-white p-2 md:p-3">
        {renderer}
      </div>
    </section>
  );
}
function LessonInsightRail({ shellFamily, module, activity, courseProgress, moduleSummary }) {
  if (!moduleSummary.completedCount && !courseProgress?.lastAccessAt) return null;
  const instructionMeta = getActivityInstructionMeta(activity?.tipo, module);
  const categoryLabel = CATEGORY_LABELS[module?.categoria] || 'Ruta';
  const levelLabel = LEVEL_LABELS[module?.nivel] || cleanText(module?.nivel, 'Nivel');
  const activityType = ACTIVITY_LABELS[activity?.tipo] || 'Practica';
  const lastAccessLabel = formatLastAccessLabel(courseProgress?.lastAccessAt);

  return (
    <SurfaceCard
      padding="md"
      variant="support"
      className="sd-lesson-support-card border-sd-border-strong"
      data-sd-lesson-context="insight"
    >
      <div className="grid gap-4">
        <PanelHeader
          eyebrow="Briefing breve"
          title="Lo justo para entrar bien"

          divider
        />

        <ActionCluster collapse="wrap">
          <Badge tone="soft">{categoryLabel}</Badge>
          <Badge tone="neutral">{levelLabel}</Badge>
          <Badge tone="neutral">{activityType}</Badge>
        </ActionCluster>

        <details className="rounded-[18px] border border-sd-border bg-sd-canvas px-4 py-3" data-sd-lesson-objective="collapsed">
          <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">Objetivo</summary>
          <p className="mt-2 mb-0 text-sm leading-6 text-sd-text">{instructionMeta.objective}</p>
        </details>

        <details
          className="sd-lesson-insight-toggle rounded-[20px] border border-sd-border-strong bg-sd-canvas px-4 py-4"
          data-sd-lesson-insight="secondary"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
            Ver lectura del modulo
          </summary>

          <div className="mt-4 grid gap-3">
            {moduleSummary.completedCount ? (
              <>
                <div className="grid gap-1 rounded-[16px] border border-sd-border bg-white px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sd-text">
                    Lo que ya sostienes
                  </span>
                  <p className="m-0 text-sm leading-6 text-sd-text">
                    {moduleSummary.strengths.length
                      ? moduleSummary.strengths.join(' � ')
                      : 'Aun no hay fortalezas suficientemente claras para resumirlas.'}
                  </p>
                </div>

                <div className="grid gap-1 rounded-[16px] border border-sd-border bg-white px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sd-text">
                    Que conviene repetir
                  </span>
                  <p className="m-0 text-sm leading-6 text-sd-text">
                    {moduleSummary.improvementAreas.length
                      ? moduleSummary.improvementAreas.join(' � ')
                      : 'No se ven tropiezos relevantes: puedes seguir con la practica actual.'}
                  </p>
                </div>
              </>
            ) : (
              <InlineMessage tone="info" title="Aun no hay suficiente historial">
                Completa una o dos actividades y este resumen te devolvera una lectura mas util del modulo.
              </InlineMessage>
            )}

            {lastAccessLabel ? (
              <p className="m-0 text-sm leading-6 text-sd-text">
                <strong className="text-sd-text">Ultima reentrada:</strong> {lastAccessLabel}
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </SurfaceCard>
  );
}
function ModuleComplete({ shellFamily, module, courseProgress, onBack, onRetry }) {
  const moduleSummary = buildModuleSummary(module, courseProgress);
  const moduleTitle = getModuleTitle(module);
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const completionLabel = moduleSummary.completedCount
    ? `${moduleSummary.completedCount}/${Math.max(activities.length, 1)} actividades registradas`
    : 'Aun no hay suficiente historial para leer el modulo';
  const nextActionLabel = moduleSummary.improvementAreas.length
    ? `Conviene repetir: ${moduleSummary.improvementAreas.join(' � ')}.`
    : 'Puedes volver a la ruta y abrir el siguiente modulo recomendado.';

  return (
    <section className="sd-page-shell py-[var(--sd-shell-padding-block)]" data-sd-container="true">
      <div className="grid gap-[var(--sd-shell-section-gap)]">
        <SurfaceCard
          padding="xl"
          variant="command"
          tone="inverse"
          className="sd-lesson-briefing sd-lesson-shell-command"
          data-sd-container="true"
          data-sd-lesson-shell="complete"
        >
          <div className="grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="sd-eyebrow m-0">Modulo completado</span>
              <Badge tone="soft">{`${activities.length} actividades`}</Badge>
            </div>

            <div className="grid gap-3">
              <h1 className="sd-title-display m-0">{`Cerraste ${moduleTitle}`}</h1>
              <p className="sd-copy m-0 max-w-[54ch]">
                La practica ya termino; sales con una lectura breve y el siguiente paso claro.
              </p>
            </div>

            <div className="sd-lesson-shell-status grid gap-3 rounded-[22px] border border-white/12 bg-white/[0.06] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid gap-1">
                  <span className="text-sm text-sd-text-inverse">Lectura acumulada</span>
                  <strong className="text-[1.85rem] leading-none font-semibold text-sd-text-inverse">
                    {moduleSummary.completedCount ? formatPercentLabel(moduleSummary.avgScore) : '0%'}
                  </strong>
                </div>
                <div className="grid gap-1 text-sm text-sd-text-inverse">
                  <span>{completionLabel}</span>
                  <span>
                    {moduleSummary.improvementAreas.length ? 'Hay puntos para repetir' : 'Listo para volver a la ruta'}
                  </span>
                </div>
              </div>
              <ProgressBar value={moduleSummary.avgScore} tone="accent" size="lg" />
            </div>

            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
              <Button variant="primary" size="lg" type="button" onClick={onBack}>
                Volver a mi ruta
              </Button>
              <Button variant="secondary" type="button" onClick={onRetry}>
                Repasar modulo
              </Button>
            </ActionCluster>
          </div>
        </SurfaceCard>

        <div
          className={cn(
            'sd-lesson-secondary-grid grid gap-[var(--sd-shell-pane-gap)]',
            shellFamily === 'mobile' ? '' : 'md:grid-cols-2'
          )}
          data-sd-lesson-secondary="complete"
        >
          <SurfaceCard padding="md" variant="support" className="border-sd-border-strong">
            <div className="grid gap-2">
              <p className="sd-eyebrow m-0">Fortalezas visibles</p>
              <p className="m-0 text-sm leading-6 text-sd-text">
                {moduleSummary.strengths.length
                  ? moduleSummary.strengths.join(' � ')
                  : 'Todavia no hay se�ales fuertes para resumir fortalezas especificas.'}
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard padding="md" variant="support" className="border-sd-border-strong">
            <div className="grid gap-2">
              <p className="sd-eyebrow m-0">Siguiente decision</p>
              <p className="m-0 text-sm leading-6 text-sd-text">{nextActionLabel}</p>
            </div>
          </SurfaceCard>
        </div>
      </div>
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
  const shellFamily = getShellFamily(viewport);
  const route = Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : [];
  const moduleIndex = currentLesson?.moduleIndex || 0;
  const activityIndex = currentLesson?.activityIndex || 0;
  const module = route[moduleIndex];

  if (!module) {
    return (
      <ModuleEmptyState
        shellFamily={shellFamily}
        title="No encontramos este modulo"
        body="Vuelve a la ruta para retomar el bloque correcto."
        onBack={onBackToCourses}
      />
    );
  }

  const info = getModuleAndActivity(coursePlan, moduleIndex, activityIndex);
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const moduleSummary = buildModuleSummary(module, courseProgress);
  const completedModules = getCompletedModules(route, courseProgress);

  if (!info || !info.activity) {
    return (
      <ModuleComplete
        shellFamily={shellFamily}
        module={module}
        courseProgress={courseProgress}
        onBack={onBackToCourses}
        onRetry={onRestartModule}
      />
    );
  }

  const stageMode = getLessonStageMode(info.activity);
  const isImmersive = stageMode === 'immersive';

  const hero = (
    <LessonMissionHero
      shellFamily={shellFamily}
      module={module}
      activity={info.activity}
      moduleIndex={moduleIndex}
      routeLength={route.length}
      activityIndex={activityIndex}
      totalActivities={activities.length}
      moduleSummary={moduleSummary}
      completedModules={completedModules}
      onBack={onBackToCourses}
    />
  );

  const commandRail = (
    <LessonCommandRail
      shellFamily={shellFamily}
      module={module}
      activityIndex={activityIndex}
      courseProgress={courseProgress}
      onBack={onBackToCourses}
      onRestart={onRestartModule}
      compact={isImmersive}
    />
  );

  const activityStage = (
    <LessonActivityStage
      shellFamily={shellFamily}
      stageMode={stageMode}
      viewport={viewport}
      module={module}
      activity={info.activity}
      activityIndex={activityIndex}
      answers={answers}
      assessment={assessment}
      onCompleteActivity={onCompleteActivity}
    />
  );

  const insightRail = (
    <LessonInsightRail
      shellFamily={shellFamily}
      module={module}
      activity={info.activity}
      courseProgress={courseProgress}
      moduleSummary={moduleSummary}
    />
  );

  return (
    <section
      id="lessonView"
      className="sd-page-shell sd-lesson-enter py-[var(--sd-shell-padding-block)]"
      data-sd-container="true"
      data-sd-lesson-source="courses-continuity"
      data-sd-activity-mode={stageMode}
    >
      <div className="grid gap-[var(--sd-shell-section-gap)]">
        {hero}

        <div
          className="sd-lesson-flow grid gap-[var(--sd-shell-pane-gap)]"
          data-sd-lesson-layout={isImmersive ? 'immersive-stack' : 'guided-stack'}
          data-sd-lesson-comfort="stage-first"
        >
          <div className="sd-lesson-primary min-w-0">{activityStage}</div>

          <div
            className={cn(
              'sd-lesson-secondary-grid grid gap-[var(--sd-shell-pane-gap)]',
              shellFamily === 'mobile'
                ? ''
                : 'md:grid-cols-2 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] xl:items-start'
            )}
            data-sd-lesson-secondary="subordinate"
          >
            {commandRail}
            {insightRail}
          </div>
        </div>
      </div>
    </section>
  );
}
