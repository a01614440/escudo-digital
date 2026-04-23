import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  getModuleAndActivity,
  normalizeModuleTitleForDisplay,
  repairPossibleMojibake,
} from '../lib/course.js';
import { getActivityInstructionMeta, getModuleObjective } from '../lib/journeyGuidance.js';
import { cn } from '../lib/ui.js';
import { getShellFamily } from '../hooks/useResponsiveLayout.js';
import { SplitHeroLayout } from '../layouts/index.js';
import {
  ActionCluster,
  KeyValueBlock,
  PanelHeader,
  ProgressSummary,
  StageHero,
  StatStrip,
  SupportRail,
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
      <SplitHeroLayout
        shellFamily={shellFamily}
        className={
          shellFamily === 'tablet'
            ? 'md:grid-cols-[minmax(0,1.08fr)_minmax(21rem,0.92fr)]'
            : shellFamily === 'desktop'
              ? 'xl:grid-cols-[minmax(0,1.16fr)_minmax(23rem,0.84fr)] 2xl:grid-cols-[minmax(0,1.24fr)_minmax(24rem,0.8fr)]'
              : ''
        }
        hero={
          <StageHero
            tone="editorial"
            eyebrow="Cabina de práctica"
            title={title}
            subtitle={body}
            meta="La práctica vive dentro de un shell inmersivo y vuelve a la ruta cuando no encuentra el módulo."
            footer={
              <StatStrip
                compact={shellFamily === 'mobile'}
                items={[
                  {
                    key: 'context',
                    eyebrow: 'Estado',
                    value: 'Sin módulo',
                    label: 'No encontramos la práctica actual',
                    hint: 'Vuelve a la ruta para reubicarte.',
                    tone: 'accent',
                  },
                  {
                    key: 'action',
                    eyebrow: 'Salida',
                    value: 'Ruta',
                    label: 'Regresa a la cabina principal',
                    hint: 'El handoff permanece intacto.',
                    tone: 'neutral',
                  },
                ]}
                variant="support"
              />
            }
          >
            <p className="m-0 text-sm leading-7 text-sd-text-soft">
              Esta vista ya no debe improvisar estructura ni depender del dashboard para seguir siendo clara.
            </p>
          </StageHero>
        }
        primary={
          <SurfaceCard padding="lg" variant="spotlight">
            <PanelHeader
              eyebrow="Siguiente acción"
              title="Volver a la ruta"
              subtitle="Regresa al tablero principal para retomar el módulo correcto sin perder continuidad."
              divider
            />
            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
              <Button variant="hero" size="lg" type="button" onClick={onBack}>
                Ir a mi ruta
              </Button>
            </ActionCluster>
          </SurfaceCard>
        }
        secondary={
          <SupportRail
            tone={shellFamily === 'desktop' ? 'editorial' : 'support'}
            sticky={shellFamily === 'desktop'}
            eyebrow="Qué pasó"
            title="El shell sigue vivo, solo cambió la posición"
            subtitle="No tocamos dominio ni progreso; solo te falta volver a ubicar el módulo actual."
          >
            <InlineMessage tone="info" title="Estado preservado">
              El lesson no encontró la actividad visible, pero tu ruta y tu progreso no se han perdido.
            </InlineMessage>
          </SupportRail>
        }
      />
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
  const subtitle = cleanText(
    activity?.intro || activity?.escenario || activity?.prompt,
    'Esta práctica vive en una cabina dedicada: tarea principal, contexto breve y renderer al centro.'
  );
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
          <p className="sd-copy m-0 max-w-[60ch]">{subtitle}</p>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-sd-text-inverse-soft">
            {`${categoryLabel} · ${levelLabel} · ${getModuleObjective(module)}`}
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
            <span className="text-sd-text-inverse-soft">
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
                      : 'border-sd-border bg-white text-sd-text-soft'
                )}
              >
                {isDone ? 'OK' : String(index + 1).padStart(2, '0')}
              </span>

              <div className="grid min-w-0 gap-1">
                <strong className="text-sm leading-5 text-sd-text">{getActivityTitle(activity, index)}</strong>
                <p className="m-0 text-sm leading-6 text-sd-text-soft">{stateNote}</p>
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

  if (compact) {
    return (
      <SurfaceCard
        padding="md"
        variant="support"
        className="sd-lesson-context-card border-sd-border-strong"
        data-sd-lesson-context="compact-map"
      >
        <div className="grid gap-4">
          <PanelHeader
            eyebrow="Mapa del modulo"
            title={`${activities.length} actividades`}
            subtitle="El recorrido queda disponible sin robarle ancho a la practica."
            meta={<Badge tone="accent">{formatPercentLabel(moduleProgressPct)}</Badge>}
            divider
          />

          <details className="sd-lesson-map-toggle rounded-[20px] border border-sd-border-strong bg-white p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
              Ver recorrido del modulo
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

  return (
    <SupportRail
      tone={shellFamily === 'desktop' ? 'support' : 'editorial'}
      sticky={false}
      eyebrow="Mapa del módulo"
      title={`${activities.length} actividades en esta práctica`}
      subtitle="El orden ya está resuelto: solo necesitas ver dónde estás y qué sigue."
      footer={
        <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
          <Button variant="secondary" type="button" onClick={onBack}>
            Volver a la ruta
          </Button>
          <Button variant="quiet" type="button" onClick={onRestart}>
            Reiniciar módulo
          </Button>
        </ActionCluster>
      }
    >
      <div className="grid gap-4">
        <ProgressSummary
          eyebrow="Avance real"
          title={getModuleTitle(module)}
          value={formatPercentLabel(moduleProgressPct)}
          hint={
            moduleSummary.completedCount
              ? `${moduleSummary.completedCount} de ${Math.max(activities.length, 1)} actividades ya quedaron cerradas.`
              : 'Todavía no completas actividades dentro de este módulo.'
          }
          progressValue={moduleProgressPct}
          variant="support"
        />

        {shellFamily === 'mobile' ? (
          <details className="rounded-[24px] border border-sd-border-strong bg-white/78 p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
              Ver mapa completo
            </summary>
            <div className="mt-4">{mapContent}</div>
          </details>
        ) : (
          mapContent
        )}
      </div>
    </SupportRail>
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
    <SurfaceCard
      padding={shellFamily === 'mobile' ? 'md' : 'lg'}
      variant="spotlight"
      className="sd-lesson-stage sd-lesson-stage-guided overflow-hidden border-sd-border-strong"
      data-sd-lesson-stage="guided"
    >
      <PanelHeader
        eyebrow="Actividad actual"
        title={getActivityTitle(activity, activityIndex)}
        subtitle={cleanText(
          activity?.intro || activity?.escenario || activity?.prompt,
          instructionMeta.quickTip
        )}
        meta={<Badge tone="accent">{ACTIVITY_LABELS[activity?.tipo] || 'Práctica'}</Badge>}
        divider
      />

      <div
        className={cn(
          'grid gap-3',
          shellFamily === 'desktop' ? 'xl:grid-cols-2' : shellFamily === 'tablet' ? 'md:grid-cols-2' : ''
        )}
      >
        <SurfaceCard padding="compact" variant="subtle">
          <strong className="block text-sm text-sd-text">Qué debes hacer</strong>
          <p className="mt-2 text-sm leading-6 text-sd-text-soft">{instructionMeta.whatToDo}</p>
        </SurfaceCard>

        <SurfaceCard padding="compact" variant="subtle">
          <strong className="block text-sm text-sd-text">Cómo se evalúa</strong>
          <p className="mt-2 text-sm leading-6 text-sd-text-soft">{instructionMeta.scoring}</p>
        </SurfaceCard>
      </div>

      <div className="sd-lesson-renderer-frame mt-4 overflow-hidden rounded-[24px] border border-sd-border-strong bg-white p-3 md:p-4">
        {renderer}
      </div>
    </SurfaceCard>
  );
}

function LessonInsightRail({ shellFamily, module, activity, courseProgress, moduleSummary }) {
  if (!moduleSummary.completedCount && !courseProgress?.lastAccessAt) return null;
  const instructionMeta = getActivityInstructionMeta(activity?.tipo, module);
  const categoryLabel = CATEGORY_LABELS[module?.categoria] || 'Ruta';
  const levelLabel = LEVEL_LABELS[module?.nivel] || cleanText(module?.nivel, 'Nivel');
  const activityType = ACTIVITY_LABELS[activity?.tipo] || 'Práctica';

  return (
    <SupportRail
      tone={shellFamily === 'desktop' ? 'editorial' : 'insight'}
      sticky={shellFamily === 'desktop'}
      eyebrow="Briefing"
      title="Lo mínimo para practicar bien"
      subtitle="Contexto corto, criterio claro y lectura del módulo sin llenar la pantalla."
    >
      <div className="grid gap-4">
        <KeyValueBlock
          items={[
            { key: 'category', label: 'Categoría', value: categoryLabel },
            { key: 'level', label: 'Nivel', value: levelLabel },
            { key: 'type', label: 'Formato', value: activityType },
          ]}
        />

        <SurfaceCard padding="compact" variant="subtle">
          <strong className="block text-sm text-sd-text">Objetivo del módulo</strong>
          <p className="mt-2 text-sm leading-6 text-sd-text-soft">{instructionMeta.objective}</p>
        </SurfaceCard>

        <ProgressSummary
          eyebrow="Lectura del módulo"
          title={
            moduleSummary.completedCount
              ? 'Ya hay una señal clara de cómo vas'
              : 'Todavía estás abriendo este bloque'
          }
          value={moduleSummary.completedCount ? formatPercentLabel(moduleSummary.avgScore) : '0%'}
          hint={
            moduleSummary.completedCount
              ? `Promedio actual sobre ${moduleSummary.completedCount} actividades registradas.`
              : 'El resumen aparecerá en cuanto cierres las primeras actividades.'
          }
          progressValue={moduleSummary.completedCount ? moduleSummary.avgScore : 0}
          variant="support"
        />

        {moduleSummary.completedCount ? (
          <div className="grid gap-3">
            <SurfaceCard padding="compact" variant="subtle">
              <strong className="block text-sm text-sd-text">Lo que ya sostienes</strong>
              <p className="mt-2 text-sm leading-6 text-sd-text-soft">
                {moduleSummary.strengths.length
                  ? moduleSummary.strengths.join(' · ')
                  : 'Todavía no hay fortalezas suficientemente claras para resumirlas.'}
              </p>
            </SurfaceCard>

            <SurfaceCard padding="compact" variant="subtle">
              <strong className="block text-sm text-sd-text">Qué conviene repetir</strong>
              <p className="mt-2 text-sm leading-6 text-sd-text-soft">
                {moduleSummary.improvementAreas.length
                  ? moduleSummary.improvementAreas.join(' · ')
                  : 'No se ven tropiezos relevantes: puedes seguir con la práctica actual.'}
              </p>
            </SurfaceCard>
          </div>
        ) : (
          <InlineMessage tone="info" title="Aún no hay suficiente historial">
            Completa una o dos actividades y este rail te devolverá una lectura mucho más útil del módulo.
          </InlineMessage>
        )}

        {courseProgress?.lastAccessAt ? (
          <SurfaceCard padding="compact" variant="subtle">
            <strong className="block text-sm text-sd-text">Última reentrada</strong>
            <p className="mt-2 text-sm leading-6 text-sd-text-soft">
              {cleanText(
                new Date(courseProgress.lastAccessAt).toLocaleString('es-MX', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
                'Registro no disponible'
              )}
            </p>
          </SurfaceCard>
        ) : null}
      </div>
    </SupportRail>
  );
}

function ModuleComplete({ shellFamily, module, courseProgress, onBack, onRetry }) {
  const moduleSummary = buildModuleSummary(module, courseProgress);
  const moduleTitle = getModuleTitle(module);
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];

  return (
    <section className="sd-page-shell py-[var(--sd-shell-padding-block)]" data-sd-container="true">
      <SplitHeroLayout
        shellFamily={shellFamily}
        className={
          shellFamily === 'tablet'
            ? 'md:grid-cols-[minmax(0,1.08fr)_minmax(21rem,0.92fr)]'
            : shellFamily === 'desktop'
              ? 'xl:grid-cols-[minmax(0,1.18fr)_minmax(24rem,0.82fr)] 2xl:grid-cols-[minmax(0,1.26fr)_minmax(25rem,0.78fr)]'
              : ''
        }
        hero={
          <StageHero
            tone="spotlight"
            eyebrow="Módulo completado"
            title={`Cerraste ${moduleTitle}`}
            subtitle="La práctica ya terminó; ahora te devolvemos una lectura corta de lo que sostuviste y qué conviene repetir."
            meta={`${activities.length} actividades recorridas`}
            aside={
              <ProgressSummary
                eyebrow="Resultado del módulo"
                title="Lectura acumulada"
                value={moduleSummary.completedCount ? formatPercentLabel(moduleSummary.avgScore) : '0%'}
                hint={
                  moduleSummary.completedCount
                    ? `Promedio sobre ${moduleSummary.completedCount} actividades completadas.`
                    : 'Aún no hay suficientes registros para calcular promedio.'
                }
                progressValue={moduleSummary.avgScore}
                variant="support"
              />
            }
            footer={
              <StatStrip
                compact={shellFamily === 'mobile'}
                items={[
                  {
                    key: 'completed',
                    eyebrow: 'Completadas',
                    value: `${moduleSummary.completedCount}`,
                    label: 'Actividades registradas',
                    hint: 'Cada cierre alimenta tu historial real.',
                    tone: 'accent',
                  },
                  {
                    key: 'focus',
                    eyebrow: 'Refuerzo',
                    value: moduleSummary.improvementAreas.length ? 'Sí' : 'Bajo',
                    label: moduleSummary.improvementAreas.length ? 'Hay puntos para repetir' : 'Sin tropiezos fuertes',
                    hint: 'Puedes volver al módulo o regresar a la ruta.',
                    tone: 'neutral',
                  },
                ]}
                variant="support"
              />
            }
          >
            <p className="m-0 text-sm leading-7 text-sd-text-soft">{getModuleObjective(module)}</p>
          </StageHero>
        }
        primary={
          <SurfaceCard padding="lg" variant="spotlight">
            <PanelHeader
              eyebrow="Lectura breve"
              title="Qué deja este módulo"
              subtitle="Resumen corto para salir de la práctica con una idea clara de continuidad."
              divider
            />

            <div className="grid gap-3">
              <SurfaceCard padding="compact" variant="subtle">
                <strong className="block text-sm text-sd-text">Fortalezas visibles</strong>
                <p className="mt-2 text-sm leading-6 text-sd-text-soft">
                  {moduleSummary.strengths.length
                    ? moduleSummary.strengths.join(' · ')
                    : 'El módulo quedó completado, pero todavía no hay señales fuertes para resumir fortalezas específicas.'}
                </p>
              </SurfaceCard>

              <SurfaceCard padding="compact" variant="subtle">
                <strong className="block text-sm text-sd-text">Siguiente decisión</strong>
                <p className="mt-2 text-sm leading-6 text-sd-text-soft">
                  {moduleSummary.improvementAreas.length
                    ? `Conviene repetir: ${moduleSummary.improvementAreas.join(' · ')}.`
                    : 'Puedes volver a la ruta y abrir el siguiente módulo recomendado.'}
                </p>
              </SurfaceCard>
            </div>

            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'} className="mt-6">
              <Button variant="hero" size="lg" type="button" onClick={onBack}>
                Volver a mi ruta
              </Button>
              <Button variant="secondary" type="button" onClick={onRetry}>
                Repasar módulo
              </Button>
            </ActionCluster>
          </SurfaceCard>
        }
        secondary={
          <SupportRail
            tone={shellFamily === 'desktop' ? 'editorial' : 'support'}
            sticky={shellFamily === 'desktop'}
            eyebrow="Continuidad"
            title="El siguiente paso ya no depende del renderer"
            subtitle="Sales de la práctica con cierre breve y vuelves a la ruta sin perder contexto."
          >
            <InlineMessage tone="success" title="Handoff intacto">
              La lógica de curso, progreso y reentrada permanece arriba; esta pantalla solo reorganiza el chrome visual.
            </InlineMessage>
          </SupportRail>
        }
      />
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
  const isMobile = shellFamily === 'mobile';
  const route = Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : [];
  const moduleIndex = currentLesson?.moduleIndex || 0;
  const activityIndex = currentLesson?.activityIndex || 0;
  const module = route[moduleIndex];

  if (!module) {
    return (
      <ModuleEmptyState
        shellFamily={shellFamily}
        title="No encontramos este módulo"
        body="Puede que la ruta haya cambiado o que esta práctica ya no exista. Vuelve a la ruta para retomar el bloque correcto."
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

  const contextRail = (
    <div className="sd-lesson-context grid gap-[var(--sd-shell-pane-gap)]">
      {commandRail}
      {isImmersive ? insightRail : null}
    </div>
  );

  const mobileContextRail = (
    <div className="sd-lesson-context grid gap-[var(--sd-shell-pane-gap)]">
      {commandRail}
      {insightRail}
    </div>
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

        {isMobile ? (
          <div className="grid gap-[var(--sd-shell-pane-gap)]">
            {activityStage}
            {mobileContextRail}
          </div>
        ) : (
          <div
            className={cn(
              'sd-lesson-layout grid gap-[var(--sd-shell-pane-gap)]',
              isImmersive
                ? 'sd-lesson-layout-immersive'
                : 'sd-lesson-layout-guided md:grid-cols-[minmax(17.5rem,20rem)_minmax(0,1fr)]'
            )}
            data-sd-lesson-layout={isImmersive ? 'immersive-fullscreen' : 'guided-two-pane'}
          >
            {isImmersive ? (
              <>
                <div className="sd-lesson-primary min-w-0">{activityStage}</div>
                {contextRail}
              </>
            ) : (
              <>
                {contextRail}
                <div className="sd-lesson-primary grid min-w-0 gap-[var(--sd-shell-pane-gap)]">
                  {activityStage}
                  {insightRail}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
