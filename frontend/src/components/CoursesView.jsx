import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '../lib/format.js';
import {
  CATEGORY_LABELS,
  computeCompetenciesFromProgress,
  LEVEL_LABELS,
  normalizeModuleLevel,
  summarizeProgressInsights,
} from '../lib/course.js';
import { getLevelCopy, LEVEL_ORDER, TOPIC_ORDER } from '../lib/difficultyRules.js';
import { getModuleObjective } from '../lib/journeyGuidance.js';
import { cn } from '../lib/ui.js';
import { getShellFamily } from '../hooks/useResponsiveLayout.js';
import {
  ActionCluster,
  EmptyState,
  JourneyStepper,
  KeyValueBlock,
  PanelHeader,
  ProgressSummary,
  StageHero,
  StatStrip,
  SupportRail,
} from '../patterns/index.js';
import {
  Badge,
  Button,
  Field,
  InlineMessage,
  ProgressBar,
  Select,
  Spinner,
  SurfaceCard,
} from './ui/index.js';
import {
  buildResumeTarget,
  cleanText,
  displayActivityTitle,
  displayModuleTitle,
  formatPercent,
  getModuleStats,
  getModuleStatusLabel,
  getModuleStatusTone,
  getPrioritySummary,
  getRecommendedIndex,
  getUnlockedLimit,
} from './course-dashboard/viewModel.js';

const TABS = [
  {
    id: 'ruta',
    label: 'Ruta',
    eyebrow: 'Direccion',
    title: 'Ruta activa y siguiente paso',
    subtitle: 'Modulos y continuidad en un solo frente.',
  },
  {
    id: 'progreso',
    label: 'Progreso',
    eyebrow: 'Lectura',
    title: 'Blindaje, gaps y evolucion',
    subtitle: 'Lo importante del avance, sin ruido.',
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    eyebrow: 'Control',
    title: 'Ritmo, foco y regeneracion',
    subtitle: 'Ritmo y foco sin perder continuidad.',
  },
];

function getModuleCtaLabel({ locked, adminAccess, stats }) {
  if (locked) return 'Bloqueado por secuencia';
  if (adminAccess && stats.pct >= 100) return 'Repetir modulo';
  if (stats.completedCount) return 'Continuar modulo';
  return 'Abrir modulo';
}

function DashboardTabs({ activeTab, onChange }) {
  return (
    <ActionCluster collapse="wrap">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant={activeTab === tab.id ? 'hero' : 'quiet'}
          size="compact"
          active={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </ActionCluster>
  );
}

function LevelFilter({ levels, activeLevel, onChange }) {
  return (
    <ActionCluster align="start" collapse="wrap">
      {levels.map((level) => (
        <Button
          key={level}
          type="button"
          size="compact"
          variant={activeLevel === level ? 'primary' : 'quiet'}
          active={activeLevel === level}
          onClick={() => onChange(level)}
        >
          {getLevelCopy(level).title}
        </Button>
      ))}
    </ActionCluster>
  );
}

function DashboardEmptyState({
  shellFamily,
  title,
  body,
  error,
  actionLabel,
  onAction,
  generating = false,
}) {
  return (
    <section className="sd-page-shell py-[var(--sd-shell-padding-block)]" data-sd-container="true">
      <SurfaceCard
        padding="xl"
        variant="command"
        tone="inverse"
        className="sd-route-briefing relative overflow-hidden border-sd-border-strong"
        data-sd-container="true"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sd-accent via-sd-accent to-sd-accent-strong" />

        <div className="grid gap-6">
          <span className="sd-eyebrow m-0">Ruta personalizada</span>

          <div className="grid gap-3">
            <h1 className="sd-title-display m-0">
              {generating ? 'Estamos armando tu ruta' : title}
            </h1>
            <p className="sd-copy m-0 max-w-[60ch]">
              {generating
                ? 'Estamos ordenando modulos y prioridad para dejarte un siguiente paso claro.'
                : body}
            </p>
          </div>

          {generating ? (
            <div className="sd-route-briefing-progress grid gap-3">
              <div className="flex items-center gap-4">
                <Spinner size="lg" />
                <div className="grid gap-1">
                  <strong className="sd-copy-strong m-0">Ordenando la ruta</strong>
                  <p className="m-0 text-sm leading-6 text-sd-text-inverse-soft">
                    Estamos priorizando que sigue sin perder contexto.
                  </p>
                </div>
              </div>
              <ProgressBar value={72} tone="accent" size="lg" />
            </div>
          ) : null}

          {error ? (
            <InlineMessage tone="danger" title="No pudimos completar esta parte.">
              {error}
            </InlineMessage>
          ) : null}

          {actionLabel && onAction ? (
            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={onAction}
                loading={generating}
              >
                {generating ? 'Actualizando ruta...' : actionLabel}
              </Button>
            </ActionCluster>
          ) : null}
        </div>
      </SurfaceCard>
    </section>
  );
}

function RouteBriefing({
  shellFamily,
  target,
  adminAccess,
  prioritySummary,
  completedModules,
  routeLength,
  onContinue,
  onShowInRoute,
}) {
  const routePct = routeLength ? Math.round((completedModules / routeLength) * 100) : 0;
  const hasTarget = Boolean(target);
  const primaryLabel = target?.stats.completedCount ? 'Continuar mi ruta' : 'Abrir modulo recomendado';
  const moduleTitle = hasTarget ? displayModuleTitle(target.module) : null;
  const nextActivityTitle = hasTarget
    ? displayActivityTitle(target.nextActivity, 'siguiente bloque')
    : null;

  return (
    <SurfaceCard
      padding="xl"
      variant="command"
      tone="inverse"
      className="sd-route-briefing relative overflow-hidden border-sd-border-strong"
      data-sd-container="true"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sd-accent via-sd-accent to-sd-accent-strong" />

      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="sd-eyebrow m-0">Ruta personalizada</span>
          {adminAccess ? <Badge tone="soft">Modo admin</Badge> : null}
        </div>

        <div className="grid gap-3">
          <h1 className="sd-title-display m-0">
            {hasTarget ? moduleTitle : 'Tu ruta ya esta lista para continuar.'}
          </h1>
          <p className="sd-copy m-0 max-w-[60ch]">
            {hasTarget ? `Siguiente actividad: ${nextActivityTitle}.` : prioritySummary}
          </p>
        </div>

        {hasTarget ? (
          <ActionCluster
            align="start"
            collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}
          >
            <Button
              type="button"
              variant="primary"
              size="lg"
              data-sd-primary-cta="courses-continuity"
              aria-label={`${primaryLabel}: ${moduleTitle}`}
              onClick={() =>
                onContinue(target.moduleIndex, { restart: adminAccess && target.stats.pct >= 100 })
              }
            >
              {primaryLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onShowInRoute(target.module.id)}
            >
              Ver en la ruta
            </Button>
          </ActionCluster>
        ) : (
          <InlineMessage tone="info" title="Sin continuidad activa">
            En cuanto tengas una ruta disponible, esta region te muestra el siguiente paso con CTA directo.
          </InlineMessage>
        )}

        {routeLength > 0 ? (
          <div className="sd-route-briefing-progress grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-sd-text-inverse-soft">Avance total de tu ruta</span>
              <strong className="sd-copy-strong m-0">
                {`${completedModules}/${routeLength} modulos · ${routePct}%`}
              </strong>
            </div>
            <ProgressBar value={routePct} tone="accent" size="lg" />
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

function DashboardSceneBar({
  shellFamily,
  activeTab,
  onChange,
  journeySteps = [],
}) {
  const copy = TABS.find((tab) => tab.id === activeTab) || TABS[0];
  const hasJourneySteps = Array.isArray(journeySteps) && journeySteps.length > 0;

  return (
    <SurfaceCard
      padding="md"
      variant="editorial"
      className="border-sd-border-strong"
    >
      <div
        className={cn(
          'grid gap-5',
          shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1fr)_auto]'
            : shellFamily === 'tablet'
              ? 'lg:grid-cols-[minmax(0,1fr)_auto]'
              : ''
        )}
      >
        <PanelHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />
        <DashboardTabs activeTab={activeTab} onChange={onChange} />
      </div>

      {hasJourneySteps ? (
        <div
          className="mt-5 border-t border-sd-border pt-4"
          data-sd-journey-stepper="courses-route"
        >
          <JourneyStepper
            steps={journeySteps}
            compact={shellFamily !== 'desktop'}
            label="Progreso de encuesta a modulo"
          />
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function RouteModulePill({
  entry,
  selected,
  locked,
  recommended,
  onSelect,
}) {
  const categoryLabel = CATEGORY_LABELS[entry.module.categoria] || 'Ruta';
  const levelLabel = LEVEL_LABELS[normalizeModuleLevel(entry.module.nivel)] || 'Nivel';
  const statusLabel = locked ? 'Bloqueado' : getModuleStatusLabel(entry.stats.status);
  const statusTone = locked ? 'warning' : getModuleStatusTone(entry.stats.status);

  return (
    <SurfaceCard
      as="button"
      type="button"
      padding="compact"
      variant={selected ? 'raised' : 'subtle'}
      interactive
      selected={selected}
      className={cn(
        'sd-route-pill relative w-full overflow-hidden text-left transition',
        selected ? 'border-2 border-sd-accent' : '',
        locked ? 'opacity-90' : ''
      )}
      aria-current={selected ? 'true' : undefined}
      aria-label={`${displayModuleTitle(entry.module)}: ${statusLabel}, ${categoryLabel}, ${levelLabel}`}
      data-route-module-state={locked ? 'locked' : recommended ? 'recommended' : entry.stats.status}
      onClick={onSelect}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0',
          selected ? 'w-1.5 bg-sd-accent' : recommended ? 'w-1 bg-sd-accent' : 'w-0 bg-transparent'
        )}
      />
      <div className="grid gap-3 pl-2">
        <div className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3">
          <span className="rounded-full border border-sd-border bg-sd-canvas px-2.5 py-1.5 text-xs font-semibold text-sd-text">
            {String(entry.index + 1).padStart(2, '0')}
          </span>
          <strong className="break-words text-base leading-6 text-sd-text">
            {displayModuleTitle(entry.module)}
          </strong>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>

        <ProgressBar value={entry.stats.pct} tone={locked ? 'warning' : 'accent'} />

        {recommended ? (
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sd-accent">
            Siguiente recomendado
          </span>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

function RouteNavigatorRail({
  shellFamily,
  level,
  availableLevels,
  onLevelChange,
  currentLevelEntries,
  selectedEntry,
  adminAccess,
  unlockedLimit,
  recommendedIndex,
  onSelectModule,
}) {
  const levelCopy = getLevelCopy(level);

  return (
    <SurfaceCard
      padding="md"
      variant="support"
      className={cn('overflow-hidden', shellFamily === 'desktop' ? 'xl:sticky xl:top-6' : '')}
    >
      <PanelHeader
        eyebrow="Navegador de ruta"
        title="Ruta por modulos"
        subtitle="Escanea estado, prioridad y detalle seleccionado."
        divider
      />

      <div className="grid gap-4">
        {availableLevels.length > 1 ? (
          <SurfaceCard padding="compact" variant="subtle">
            <PanelHeader
              eyebrow="Nivel visible"
              title={levelCopy.title}
              subtitle="Filtra sin romper el orden."
            />
            <div className="mt-4">
              <LevelFilter levels={availableLevels} activeLevel={level} onChange={onLevelChange} />
            </div>
          </SurfaceCard>
        ) : null}

        <div className="grid gap-3">
          {currentLevelEntries.map((entry) => {
            const locked = adminAccess ? false : entry.index > unlockedLimit;

            return (
              <RouteModulePill
                key={entry.module.id}
                entry={entry}
                selected={selectedEntry?.module.id === entry.module.id}
                locked={locked}
                recommended={entry.index === recommendedIndex}
                onSelect={() => onSelectModule(entry.module.id)}
              />
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
}

function ModuleActivityList({ module, nextActivity, completedMap }) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];

  return (
    <ol className="sd-module-activity-list grid gap-2 p-0">
      {activities.map((activity, index) => {
        const completed = Boolean(completedMap?.[activity.id]);
        const isNext = nextActivity?.id === activity.id;
        const stateLabel = completed ? 'Hecha' : isNext ? 'Siguiente' : activity?.tipo || 'Actividad';

        return (
          <li
            key={activity.id}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[14px] border px-3 py-2.5 transition',
              completed
                ? 'border-emerald-300 bg-emerald-50/60'
                : isNext
                  ? 'border-sd-accent border-l-4 bg-white'
                  : 'border-sd-border bg-white'
            )}
            aria-current={isNext ? 'step' : undefined}
            data-activity-state={completed ? 'completed' : isNext ? 'next' : 'pending'}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sd-border bg-sd-canvas text-xs font-semibold text-sd-text">
              {completed ? 'OK' : String(index + 1).padStart(2, '0')}
            </span>
            <strong className="min-w-0 truncate text-sm leading-6 text-sd-text">
              {displayActivityTitle(activity)}
            </strong>
            <span
              className={cn(
                'text-xs font-semibold uppercase tracking-[0.06em]',
                isNext ? 'text-sd-accent' : 'text-sd-text-soft'
              )}
            >
              {stateLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ModuleMissionBoard({
  shellFamily,
  entry,
  locked,
  recommended,
  adminAccess = false,
  unlockMessage,
  onOpenModule,
  progressMap,
  weakestTopic,
  nextUnlockEntry,
}) {
  if (!entry) {
    return (
      <SurfaceCard padding="lg" variant="panel">
        <EmptyState
          eyebrow="Ruta"
          title="Elige un modulo para abrir su detalle"
          body="Cuando selecciones un bloque, esta region se convierte en tu mission board con progreso, metadata y CTA."
        />
      </SurfaceCard>
    );
  }

  const { module, index, stats } = entry;
  const moduleTitle = displayModuleTitle(module);
  const nextActivityTitle = displayActivityTitle(stats.nextActivity, 'Actividad pendiente');
  const gapLabel = weakestTopic ? CATEGORY_LABELS[weakestTopic[0]] : 'Sin gap dominante';
  const nextUnlockLabel = nextUnlockEntry
    ? displayModuleTitle(nextUnlockEntry.module)
    : 'Ruta abierta completa';
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];

  return (
    <SurfaceCard
      padding="lg"
      variant="panel"
      className="sd-module-mission-board grid gap-6"
      data-route-detail="module"
      data-selected-module-id={module.id}
      data-sd-module-layout={shellFamily === 'desktop' ? 'desktop-flat' : 'stacked-flat'}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="sd-eyebrow m-0">{`Modulo ${index + 1}`}</span>
          {recommended ? <Badge tone="accent">Siguiente recomendado</Badge> : null}
        </div>
        <h2 className="sd-title m-0">{moduleTitle}</h2>
        <p className="m-0 text-sm leading-6 text-sd-text">
          {cleanText(
            module.descripcion,
            'Modulo practico con siguiente actividad y salida clara.'
          )}
        </p>
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-sd-text-soft">
          {`${CATEGORY_LABELS[module.categoria] || 'Ruta'} · ${getModuleObjective(module)}`}
        </p>
      </div>

      <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={locked}
          data-sd-module-cta="courses-detail"
          aria-label={`${getModuleCtaLabel({ locked, adminAccess, stats })}: ${moduleTitle}`}
          onClick={() => onOpenModule(index, { restart: adminAccess && stats.pct >= 100 })}
        >
          {getModuleCtaLabel({ locked, adminAccess, stats })}
        </Button>
      </ActionCluster>

      <ProgressSummary
        eyebrow="Avance del modulo"
        title={nextActivityTitle}
        value={formatPercent(stats.pct)}
        hint={getModuleStatusLabel(stats.status)}
        progressValue={stats.pct}
        tone="accent"
        variant="support"
      />

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 rounded-[14px] border border-sd-border bg-sd-canvas px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-sd-text-soft">
            Gap visible
          </dt>
          <dd className="m-0 text-sm font-semibold leading-6 text-sd-text">{gapLabel}</dd>
        </div>
        <div className="grid gap-1 rounded-[14px] border border-sd-border bg-sd-canvas px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-sd-text-soft">
            Siguiente desbloqueo
          </dt>
          <dd className="m-0 text-sm font-semibold leading-6 text-sd-text">{nextUnlockLabel}</dd>
        </div>
      </dl>

      {locked ? (
        <InlineMessage tone="warning" title="Este modulo aun esta bloqueado.">
          {unlockMessage}
        </InlineMessage>
      ) : null}

      {adminAccess ? (
        <InlineMessage tone="info" title="Modo admin activo.">
          Puedes abrir o repetir este modulo sin esperar el desbloqueo secuencial.
        </InlineMessage>
      ) : null}

      <details className="sd-module-activities-toggle rounded-[18px] border border-sd-border bg-sd-canvas px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-sd-text">
          <span>{`Ver actividades del modulo (${activities.length})`}</span>
          <span aria-hidden="true" className="text-xs uppercase tracking-[0.08em] text-sd-text-soft">
            Colapsable
          </span>
        </summary>
        <div className="mt-4">
          <ModuleActivityList
            module={module}
            nextActivity={stats.nextActivity}
            completedMap={progressMap?.completed || {}}
          />
        </div>
      </details>
    </SurfaceCard>
  );
}

function ProgressScene({
  shellFamily,
  computed,
  progress,
  coursePlan,
  coursePrefs,
  answers,
  assessment,
  completedModules,
  routeLength,
}) {
  const strongestTopic =
    Object.entries(computed.competencias || {}).sort((a, b) => b[1] - a[1])[0] || null;
  const weakestTopic =
    Object.entries(computed.competencias || {}).sort((a, b) => a[1] - b[1])[0] || null;
  const insights = summarizeProgressInsights(coursePlan, progress);
  const history = Array.isArray(progress?.snapshots)
    ? [...progress.snapshots].slice(-4).reverse()
    : [];
  const routeCompletion = routeLength ? Math.round((completedModules / routeLength) * 100) : 0;
  const progressStrip = [
    {
      key: 'route',
      eyebrow: 'Ruta',
      value: formatPercent(routeCompletion),
      label: `${completedModules}/${routeLength} modulos`,
      hint: 'Avance total del recorrido.',
      tone: 'accent',
    },
    {
      key: 'focus',
      eyebrow: 'Fortaleza',
      value: strongestTopic ? CATEGORY_LABELS[strongestTopic[0]] : 'Sin dato',
      label: strongestTopic ? formatPercent(strongestTopic[1]) : '0%',
      hint: 'Competencia mejor consolidada.',
      tone: 'neutral',
    },
    {
      key: 'gap',
      eyebrow: 'Gap',
      value: weakestTopic ? CATEGORY_LABELS[weakestTopic[0]] : 'Sin gap',
      label: weakestTopic ? formatPercent(weakestTopic[1]) : '0%',
      hint: 'Tema que conviene reforzar.',
      tone: 'warning',
    },
  ];

  return (
    <div className="grid gap-5">
      <StageHero
        tone="editorial"
        eyebrow="Progreso visible"
        title="Progreso util de tu ruta"
        subtitle={getPrioritySummary(answers, assessment)}
        meta="Avance, fortaleza y gap sin datos decorativos."
        footer={
          <StatStrip
            compact={shellFamily === 'mobile'}
            items={progressStrip}
          />
        }
      />

      <SurfaceCard padding="lg" variant="panel">
        <PanelHeader
          eyebrow="Competencias"
          title="Tu blindaje por tema"
          subtitle="Lee rapido que esta fuerte y que conviene reforzar."
          divider
        />
        <div className="grid gap-4">
          {TOPIC_ORDER.map((topic) => (
            <div key={topic} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-sd-text">{CATEGORY_LABELS[topic]}</span>
                <strong className="text-sd-text">
                  {formatPercent(computed.competencias?.[topic] || 0)}
                </strong>
              </div>
              <ProgressBar value={computed.competencias?.[topic] || 0} />
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SupportRail
        tone="support"
        eyebrow="Lo importante"
        title="Senales de aprendizaje"
        subtitle="Errores y fortalezas que ayudan a decidir como seguir."
      >
        <KeyValueBlock
          items={[
            {
              key: 'mistakes',
              label: 'Errores frecuentes',
              value: insights.mistakes.length ? insights.mistakes.join(' / ') : 'Sin tropiezos claros',
            },
            {
              key: 'strengths',
              label: 'Senales fuertes',
              value: insights.strengths.length ? insights.strengths.join(' / ') : 'Sin fortalezas destacadas aun',
            },
            {
              key: 'plan',
              label: 'Plan actual',
              value: `v${coursePlan?.planVersion || 0} · ${coursePrefs?.estilo || 'mix'} · ${coursePrefs?.dificultad || 'auto'}`,
            },
          ]}
        />
      </SupportRail>

      {history.length ? (
        <SurfaceCard padding="lg" variant="editorial">
          <PanelHeader
            eyebrow="Historial reciente"
            title="Evolucion de la ruta"
            subtitle="Snapshots recientes para retomar con contexto real."
            divider
          />
          <div className="grid gap-3">
            {history.map((item, index) => (
              <div
                key={`${item.timestamp || index}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-sd-border bg-sd-canvas px-4 py-3"
              >
                <strong className="text-sm text-sd-text">{formatDate(item.timestamp)}</strong>
                <div className="flex items-center gap-3 text-sm text-sd-text-soft">
                  <span>{`${item.completedCount} actividad(es)`}</span>
                  <Badge tone="accent">{formatPercent(item.scoreTotal)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}

function SettingsScene({
  shellFamily,
  coursePrefs,
  onCoursePrefsChange,
  onGenerateCourse,
  generating,
  error,
}) {
  const setField = (field, value) =>
    onCoursePrefsChange((current) => ({ ...current, [field]: value }));

  const toggleTopic = (topic) => {
    onCoursePrefsChange((current) => {
      const currentTopics = Array.isArray(current?.temas) ? current.temas : [];
      const nextTopics = currentTopics.includes(topic)
        ? currentTopics.filter((item) => item !== topic)
        : [...currentTopics, topic];
      return { ...current, temas: nextTopics.length ? nextTopics : currentTopics };
    });
  };
  const selectedTopicCount = Array.isArray(coursePrefs?.temas) ? coursePrefs.temas.length : 0;

  return (
    <SurfaceCard padding="lg" variant="panel" className="sd-settings-scene grid gap-6">
      <PanelHeader
        eyebrow="Ajustes de ruta"
        title="Ajustes de ruta sin perder progreso"
        subtitle="Cambia ritmo, dificultad o temas antes de regenerar. No toca diagnostico ni progreso."
        divider
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Estilo">
          <Select
            value={coursePrefs?.estilo || 'mix'}
            onChange={(event) => setField('estilo', event.target.value)}
          >
            <option value="mix">Mix</option>
            <option value="guiado">Guiado</option>
            <option value="practico">Practico</option>
          </Select>
        </Field>

        <Field label="Dificultad">
          <Select
            value={coursePrefs?.dificultad || 'auto'}
            onChange={(event) => setField('dificultad', event.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="facil">Facil</option>
            <option value="normal">Normal</option>
            <option value="avanzada">Avanzada</option>
          </Select>
        </Field>

        <Field label="Duracion">
          <Select
            value={coursePrefs?.duracion || '5-10'}
            onChange={(event) => setField('duracion', event.target.value)}
          >
            <option value="5-10">5-10 min</option>
            <option value="10-15">10-15 min</option>
            <option value="15-20">15-20 min</option>
          </Select>
        </Field>
      </div>

      <Field
        label="Temas prioritarios"
        hint={
          selectedTopicCount
            ? `${selectedTopicCount} tema(s) priorizados manualmente.`
            : 'Elige temas solo si quieres reforzar una prioridad concreta.'
        }
      >
        <ActionCluster align="start" collapse="wrap">
          {TOPIC_ORDER.map((topic) => {
            const active = Array.isArray(coursePrefs?.temas)
              ? coursePrefs.temas.includes(topic)
              : false;

            return (
              <Button
                key={topic}
                type="button"
                size="compact"
                variant={active ? 'primary' : 'quiet'}
                active={active}
                onClick={() => toggleTopic(topic)}
              >
                {CATEGORY_LABELS[topic]}
              </Button>
            );
          })}
        </ActionCluster>
      </Field>

      {error ? (
        <InlineMessage tone="danger" title="No pudimos actualizar la ruta.">
          {error}
        </InlineMessage>
      ) : null}

      <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
        <Button
          type="button"
          variant="primary"
          size="lg"
          data-sd-settings-cta="courses-regenerate"
          aria-label="Actualizar ruta con estas preferencias"
          onClick={onGenerateCourse}
          loading={generating}
        >
          {generating ? 'Actualizando ruta...' : 'Actualizar ruta'}
        </Button>
      </ActionCluster>
    </SurfaceCard>
  );
}

export default function CoursesView({
  viewport = 'desktop',
  currentView = 'courses',
  answers,
  assessment,
  coursePlan,
  courseProgress,
  coursePrefs,
  adminAccess = false,
  generating,
  error,
  onCoursePrefsChange,
  onGenerateCourse,
  onOpenModule,
}) {
  const shellFamily = getShellFamily(viewport);
  const isMobile = shellFamily === 'mobile';

  const route = useMemo(
    () =>
      (Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : []).map((module) => ({
        ...module,
        titulo: displayModuleTitle(module),
        descripcion: cleanText(module?.descripcion),
        actividades: (Array.isArray(module?.actividades) ? module.actividades : []).map(
          (activity) => ({
            ...activity,
            titulo: cleanText(activity?.titulo),
          })
        ),
      })),
    [coursePlan]
  );

  const entries = useMemo(
    () => route.map((module, index) => ({ module, index, stats: getModuleStats(module, courseProgress) })),
    [courseProgress, route]
  );

  const recommendedIndex = getRecommendedIndex(route, courseProgress);
  const recommendedEntry = entries[recommendedIndex] || null;
  const recommendedTarget = recommendedEntry
    ? {
        moduleIndex: recommendedEntry.index,
        module: recommendedEntry.module,
        nextActivity: recommendedEntry.stats.nextActivity,
        stats: recommendedEntry.stats,
      }
    : null;
  const unlockedLimit = adminAccess ? route.length - 1 : getUnlockedLimit(route, courseProgress);
  const availableLevels = LEVEL_ORDER.filter((level) =>
    entries.some((entry) => normalizeModuleLevel(entry.module.nivel) === level)
  );
  const defaultLevel =
    recommendedEntry ? normalizeModuleLevel(recommendedEntry.module.nivel) : availableLevels[0] || 'basico';
  const computed = computeCompetenciesFromProgress(coursePlan, courseProgress);
  const weakestTopic =
    Object.entries(computed.competencias || {}).sort((a, b) => a[1] - b[1])[0] || null;

  const [tab, setTab] = useState('ruta');
  const [level, setLevel] = useState(defaultLevel);
  const [selectedModuleId, setSelectedModuleId] = useState(
    recommendedEntry?.module?.id || entries[0]?.module?.id || null
  );

  const resumeTarget = useMemo(() => buildResumeTarget(entries), [entries]);

  useEffect(() => {
    if (!availableLevels.includes(level)) {
      setLevel(defaultLevel);
    }
  }, [availableLevels, defaultLevel, level]);

  useEffect(() => {
    const currentLevelEntries = entries.filter(
      (entry) => normalizeModuleLevel(entry.module.nivel) === level
    );
    if (!currentLevelEntries.some((entry) => entry.module.id === selectedModuleId)) {
      setSelectedModuleId(currentLevelEntries[0]?.module?.id || entries[0]?.module?.id || null);
    }
  }, [entries, level, selectedModuleId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [tab]);

  if (!assessment) {
    return (
      <DashboardEmptyState
        shellFamily={shellFamily}
        title="Primero completa tu evaluacion"
        body="Necesitamos tu diagnostico antes de ordenar una ruta con continuidad real."
        error={error}
      />
    );
  }

  if (!coursePlan || !courseProgress) {
    return (
      <DashboardEmptyState
        shellFamily={shellFamily}
        title="Tu ruta todavia no esta lista"
        body="Desde aqui deberias poder leer continuidad, progreso y siguiente paso como una sola cabina de producto."
        error={error}
        actionLabel="Generar mi ruta"
        onAction={onGenerateCourse}
        generating={generating}
      />
    );
  }

  if (!route.length) {
    return (
      <DashboardEmptyState
        shellFamily={shellFamily}
        title="Tu ruta no tiene modulos visibles"
        body="Vuelve a generar la ruta para reconstruir la secuencia recomendada sin perder tu progreso."
        error={error}
        actionLabel="Actualizar ruta"
        onAction={onGenerateCourse}
      />
    );
  }

  const currentLevelEntries = entries.filter(
    (entry) => normalizeModuleLevel(entry.module.nivel) === level
  );
  const selectedEntry =
    currentLevelEntries.find((entry) => entry.module.id === selectedModuleId) ||
    currentLevelEntries[0] ||
    null;
  const prioritySummary = getPrioritySummary(answers, assessment);
  const completedModules = entries.filter((entry) => entry.stats.pct >= 100).length;
  const nextRouteTarget = resumeTarget || recommendedTarget;
  const nextUnlockEntry =
    unlockedLimit >= 0 && unlockedLimit + 1 < entries.length ? entries[unlockedLimit + 1] : null;

  const handleShowInRoute = (moduleId) => {
    setTab('ruta');
    setSelectedModuleId(moduleId);
  };

  const selectedLocked =
    selectedEntry ? (adminAccess ? false : selectedEntry.index > unlockedLimit) : false;
  const selectedUnlockMessage =
    entries[unlockedLimit]?.module?.titulo
      ? `Completa "${displayModuleTitle(entries[unlockedLimit].module)}" para desbloquear este bloque.`
      : 'Completa el bloque anterior para avanzar.';
  const routeLayoutMode = isMobile
    ? 'mobile-stack'
    : shellFamily === 'tablet'
      ? 'tablet-two-pane'
      : 'desktop-two-pane';

  return (
    <section
      id="coursesView"
      className="sd-page-shell py-[var(--sd-shell-padding-block)]"
      data-sd-container="true"
    >
      <div className="grid gap-[var(--sd-shell-section-gap)]">
        <RouteBriefing
          shellFamily={shellFamily}
          target={nextRouteTarget}
          adminAccess={adminAccess}
          prioritySummary={prioritySummary}
          completedModules={completedModules}
          routeLength={route.length}
          onContinue={onOpenModule}
          onShowInRoute={handleShowInRoute}
        />

        <DashboardSceneBar
          shellFamily={shellFamily}
          activeTab={tab}
          onChange={setTab}
        />

        {tab === 'ruta' ? (
          <div
            className={cn(
              'grid min-w-0 gap-[var(--sd-shell-pane-gap)]',
              shellFamily === 'tablet'
                ? 'lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1.18fr)]'
                : shellFamily === 'desktop'
                  ? 'xl:grid-cols-[minmax(19rem,21rem)_minmax(0,1.5fr)] 2xl:grid-cols-[minmax(20rem,22rem)_minmax(0,1.6fr)]'
                  : ''
            )}
            data-sd-route-layout={routeLayoutMode}
          >
            <RouteNavigatorRail
              shellFamily={shellFamily}
              level={level}
              availableLevels={availableLevels}
              onLevelChange={setLevel}
              currentLevelEntries={currentLevelEntries}
              selectedEntry={selectedEntry}
              adminAccess={adminAccess}
              unlockedLimit={unlockedLimit}
              recommendedIndex={recommendedIndex}
              onSelectModule={setSelectedModuleId}
            />

            <ModuleMissionBoard
              shellFamily={shellFamily}
              entry={selectedEntry}
              locked={selectedLocked}
              recommended={selectedEntry?.index === recommendedIndex}
              adminAccess={adminAccess}
              unlockMessage={selectedUnlockMessage}
              onOpenModule={onOpenModule}
              progressMap={courseProgress}
              weakestTopic={weakestTopic}
              nextUnlockEntry={nextUnlockEntry}
            />
          </div>
        ) : null}

        {tab === 'progreso' ? (
          <ProgressScene
            shellFamily={shellFamily}
            computed={computed}
            progress={courseProgress}
            coursePlan={coursePlan}
            coursePrefs={coursePrefs}
            answers={answers}
            assessment={assessment}
            completedModules={completedModules}
            routeLength={route.length}
          />
        ) : null}

        {tab === 'ajustes' ? (
          <SettingsScene
            shellFamily={shellFamily}
            coursePrefs={coursePrefs}
            onCoursePrefsChange={onCoursePrefsChange}
            onGenerateCourse={onGenerateCourse}
            generating={generating}
            error={error}
          />
        ) : null}
      </div>
    </section>
  );
}
