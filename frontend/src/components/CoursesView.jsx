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

function DashboardTabs({ activeTab, onChange, tone = 'default' }) {
  return (
    <ActionCluster collapse="wrap">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant={
            activeTab === tab.id
              ? tone === 'inverse'
                ? 'primary'
                : 'hero'
              : tone === 'inverse'
                ? 'ghost'
                : 'quiet'
          }
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
                ? 'Ordenando tu siguiente paso.'
                : body}
            </p>
          </div>

          {generating ? (
            <div className="sd-route-briefing-progress grid gap-3">
              <div className="flex items-center gap-4">
                <Spinner size="lg" />
                <div className="grid gap-1">
                  <strong className="sd-copy-strong m-0">Ordenando la ruta</strong>
                  <p className="m-0 text-sm leading-6 text-sd-text-inverse">
                    Priorizando continuidad.
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
  activeTab,
  prioritySummary,
  completedModules,
  routeLength,
  onContinue,
  onShowInRoute,
  onTabChange,
}) {
  const routePct = routeLength ? Math.round((completedModules / routeLength) * 100) : 0;
  const hasTarget = Boolean(target);
  const primaryLabel = target?.stats.completedCount ? 'Continuar mi ruta' : 'Abrir modulo recomendado';
  const moduleTitle = hasTarget ? displayModuleTitle(target.module) : null;
  const nextActivityTitle = hasTarget
    ? displayActivityTitle(target.nextActivity, 'siguiente bloque')
    : null;
  const activeCopy = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  return (
    <SurfaceCard
      padding="xl"
      variant="command"
      tone="inverse"
      className="sd-route-briefing relative overflow-hidden border-sd-border-strong"
      data-sd-container="true"
      data-sd-route-shelf="integrated"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sd-accent via-sd-accent to-sd-accent-strong" />

      <div
        className={cn(
          'grid gap-6',
          shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1.16fr)_minmax(18rem,0.84fr)] xl:items-start'
            : ''
        )}
      >
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="sd-eyebrow m-0">Ruta personalizada</span>
            <Badge tone="soft">{activeCopy.label}</Badge>
            {adminAccess ? <Badge tone="soft">Modo admin</Badge> : null}
          </div>

          <div className="grid gap-2">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-sd-text-inverse">
              {activeCopy.title}
            </p>
            <h1 className="sd-title-display m-0">
              {hasTarget ? moduleTitle : 'Tu ruta ya esta lista para continuar.'}
            </h1>
            <p className="sd-copy m-0 max-w-[60ch]">
              {hasTarget
                ? `Siguiente actividad: ${nextActivityTitle}.`
                : prioritySummary}
            </p>
          </div>

          {hasTarget ? (
            <div className="grid gap-2 rounded-[22px] border border-white/12 bg-white/[0.08] px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">Siguiente paso</Badge>
                <span className="text-sm font-medium text-sd-text-inverse">
                  {getModuleStatusLabel(target.stats.status)}
                </span>
              </div>
              <strong className="text-base font-semibold leading-6 text-sd-text-inverse">
                {moduleTitle}
              </strong>
              <p className="m-0 text-sm leading-6 text-sd-text-inverse">
                {nextActivityTitle}
              </p>
            </div>
          ) : (
            <InlineMessage tone="info" title="Sin continuidad activa">
              Cuando exista ruta, aqui aparece el siguiente paso.
            </InlineMessage>
          )}

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
          ) : null}
        </div>

        <div className="grid gap-4">
          <DashboardSceneBar
            shellFamily={shellFamily}
            activeTab={activeTab}
            onChange={onTabChange}
          />

          {routeLength > 0 ? (
            <div className="sd-route-briefing-progress grid gap-2 rounded-[22px] border border-white/12 bg-white/[0.06] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-sd-text-inverse">Avance total de tu ruta</span>
              <strong className="sd-copy-strong m-0">
                {`${completedModules}/${routeLength} modulos · ${routePct}%`}
              </strong>
            </div>
            <ProgressBar value={routePct} tone="accent" size="lg" />
          </div>
        ) : null}
        </div>
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
    <div className="sd-route-scene-bar grid gap-4" data-sd-route-console="integrated">
      <div
        className={cn(
          'grid gap-4',
          shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start'
            : ''
        )}
      >
        <div className="grid gap-1">
          <strong className="text-sm font-semibold text-sd-text-inverse">{copy.title}</strong>
          <p className="m-0 text-sm leading-6 text-sd-text-inverse">{copy.subtitle}</p>
        </div>
        <DashboardTabs activeTab={activeTab} onChange={onChange} tone="inverse" />
      </div>

      {hasJourneySteps ? (
        <details
          className="sd-dashboard-stepper-toggle rounded-[18px] border border-white/12 bg-white/[0.06] px-4 py-3"
          data-sd-journey-stepper="courses-route"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text-inverse">
            Ver progreso de la ruta
          </summary>
          <div className="mt-4">
            <JourneyStepper
              steps={journeySteps}
              compact={shellFamily !== 'desktop'}
              label="Progreso de encuesta a modulo"
            />
          </div>
        </details>
      ) : null}
    </div>
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
          'pointer-events-none absolute inset-y-0 left-0 rounded-l-[inherit]',
          selected ? 'w-1.5 bg-sd-accent' : recommended ? 'w-1 bg-sd-accent' : 'w-0 bg-transparent'
        )}
      />
      <div className="grid gap-3 pl-2">
        <div className="flex items-start gap-3">
          <span className="rounded-full border border-sd-border bg-sd-canvas px-2.5 py-1.5 text-xs font-semibold text-sd-text">
            {String(entry.index + 1).padStart(2, '0')}
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex flex-wrap items-start gap-2">
              <strong className="min-w-0 flex-1 break-words text-base leading-6 text-sd-text">
                {displayModuleTitle(entry.module)}
              </strong>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>

            {recommended ? (
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sd-accent">
                Siguiente recomendado
              </span>
            ) : null}
          </div>
        </div>

        <ProgressBar value={entry.stats.pct} tone={locked ? 'warning' : 'accent'} />
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
      className={cn('overflow-hidden', shellFamily === 'desktop' ? '2xl:sticky 2xl:top-6' : '')}
      data-sd-route-rail="secondary"
    >
      <PanelHeader
        eyebrow="Navegador de ruta"
        title="Explora tu ruta"
        subtitle="Cambia de modulo sin perder foco."
        divider
      />

      <div className="grid gap-4">
        {availableLevels.length > 1 ? (
          <div className="grid gap-3 rounded-[18px] border border-sd-border bg-sd-canvas px-4 py-3">
            <PanelHeader
              eyebrow="Nivel visible"
              title={levelCopy.title}
            />
            <div>
              <LevelFilter levels={availableLevels} activeLevel={level} onChange={onLevelChange} />
            </div>
          </div>
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
        const stateTone = completed ? 'success' : isNext ? 'accent' : 'soft';

        return (
          <li
            key={activity.id}
            className={cn(
              'sd-module-activity-row grid gap-2 rounded-[16px] border px-4 py-3 transition',
              completed
                ? 'border-emerald-300 bg-emerald-50/60'
                : isNext
                  ? 'border-sd-accent bg-white shadow-[0_18px_42px_-34px_rgba(47,99,255,0.34)]'
                  : 'border-sd-border bg-white'
            )}
            aria-current={isNext ? 'step' : undefined}
            data-activity-state={completed ? 'completed' : isNext ? 'next' : 'pending'}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sd-border bg-sd-canvas text-xs font-semibold text-sd-text">
                {completed ? 'OK' : String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block break-words text-sm leading-6 text-sd-text">
                  {displayActivityTitle(activity)}
                </strong>
              </div>
              <Badge tone={stateTone}>{stateLabel}</Badge>
            </div>
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
          body="Selecciona un bloque para ver accion y progreso."
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
  const categoryLabel = CATEGORY_LABELS[module.categoria] || 'Ruta';
  const progressHint = `${getModuleStatusLabel(stats.status)} · ${stats.completedCount}/${stats.total} actividades`;
  const supportFacts = [
    { key: 'category', label: 'Categoria', value: categoryLabel },
    { key: 'gap', label: 'Gap visible', value: gapLabel },
    { key: 'unlock', label: 'Siguiente desbloqueo', value: nextUnlockLabel },
  ];
  const statusNote = locked
    ? {
        tone: 'warning',
        title: 'Bloqueado por secuencia.',
        body: unlockMessage,
      }
    : adminAccess
      ? {
          tone: 'info',
          title: 'Modo admin activo.',
          body: 'Puedes abrir o repetir este modulo sin esperar el desbloqueo secuencial.',
        }
      : null;
  const activityCountTone = stats.pct >= 100 ? 'success' : stats.completedCount ? 'accent' : 'soft';

  return (
    <SurfaceCard
      padding="lg"
      variant="panel"
      className="sd-module-mission-board grid gap-5"
      data-route-detail="module"
      data-selected-module-id={module.id}
      data-sd-module-layout={shellFamily === 'desktop' ? 'desktop-flat' : 'stacked-flat'}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="sd-eyebrow m-0">{`Modulo ${index + 1}`}</span>
          {recommended ? <Badge tone="accent">Siguiente recomendado</Badge> : null}
          <Badge tone="soft">{categoryLabel}</Badge>
        </div>
        <h2 className="sd-title m-0">{moduleTitle}</h2>
        <p className="m-0 max-w-[64ch] text-sm leading-6 text-sd-text">
          {cleanText(
            module.descripcion,
            'Modulo practico con salida clara.'
          )}
        </p>
        <details className="rounded-[16px] border border-sd-border bg-sd-canvas px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">Objetivo</summary>
          <p className="mt-2 mb-0 text-sm leading-6 text-sd-text">{getModuleObjective(module)}</p>
        </details>
      </div>

      <div
        className="sd-module-command-deck grid gap-4 rounded-[24px] border border-sd-border-strong bg-sd-canvas px-4 py-4"
        data-sd-module-flow="converged"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-2">
            <p className="sd-eyebrow m-0">Siguiente bloque</p>
            <h3 className="sd-heading-sm m-0">{nextActivityTitle}</h3>
            <p className="m-0 text-sm leading-6 text-sd-text">{progressHint}</p>
          </div>
          <strong className="text-[1.85rem] leading-none font-semibold text-sd-text">
            {formatPercent(stats.pct)}
          </strong>
        </div>

        <ProgressBar value={stats.pct} tone="accent" size="lg" />

        <div className="sd-module-support-facts grid gap-3 sm:grid-cols-2">
          {supportFacts.slice(0, 2).map((item) => (
            <div
              key={item.key}
              className="sd-module-support-fact grid gap-1 rounded-[16px] border border-sd-border bg-sd-surface px-4 py-3"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sd-text">
                {item.label}
              </span>
              <strong className="text-sm leading-6 text-sd-text">{item.value}</strong>
            </div>
          ))}
        </div>

        {statusNote ? (
          <InlineMessage tone={statusNote.tone} title={statusNote.title}>
            {statusNote.body}
          </InlineMessage>
        ) : null}

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
      </div>

      <details className="sd-module-activities-toggle rounded-[18px] border border-sd-border bg-sd-canvas px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-sd-text">
          <span>Mapa de actividades</span>
          <Badge tone={activityCountTone}>{`${stats.completedCount}/${activities.length} hechas`}</Badge>
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
          meta="Avance, fortaleza y gap."
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
          subtitle="Fortalezas y gaps."
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
        subtitle="Lo que conviene repetir."
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
            subtitle="Historial para retomar."
            divider
          />
          <div className="grid gap-3">
            {history.map((item, index) => (
              <div
                key={`${item.timestamp || index}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-sd-border bg-sd-canvas px-4 py-3"
              >
                <strong className="text-sm text-sd-text">{formatDate(item.timestamp)}</strong>
                <div className="flex items-center gap-3 text-sm text-sd-text">
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
        subtitle="Cambia foco sin perder progreso."
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
            : 'Opcional: refuerza un tema concreto.'
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
        body="Completa el diagnostico para ordenar tu ruta."
        error={error}
      />
    );
  }

  if (!coursePlan || !courseProgress) {
    return (
      <DashboardEmptyState
        shellFamily={shellFamily}
        title="Tu ruta todavia no esta lista"
        body="Genera la ruta para ver continuidad y progreso."
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
        body="Regenera la ruta para reconstruir la secuencia."
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
      ? 'tablet-stack'
      : 'desktop-detail-first';

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
          activeTab={tab}
          prioritySummary={prioritySummary}
          completedModules={completedModules}
          routeLength={route.length}
          onContinue={onOpenModule}
          onShowInRoute={handleShowInRoute}
          onTabChange={setTab}
        />

        {tab === 'ruta' ? (
          <div
            className={cn(
              'grid min-w-0 gap-[var(--sd-shell-pane-gap)]',
              shellFamily === 'desktop'
                ? 'xl:grid-cols-[minmax(0,1.18fr)_minmax(16rem,18rem)] xl:items-start'
                  : ''
            )}
            data-sd-route-layout={routeLayoutMode}
            data-sd-route-comfort={shellFamily === 'desktop' ? 'detail-first' : 'stacked'}
          >
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
