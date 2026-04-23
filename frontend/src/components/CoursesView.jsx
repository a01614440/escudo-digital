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
import {
  buildCourseQuickGuide,
  buildJourneyProgress,
  getModuleObjective,
} from '../lib/journeyGuidance.js';
import { cn } from '../lib/ui.js';
import { getShellFamily } from '../hooks/useResponsiveLayout.js';
import { SplitHeroLayout, WorkspaceLayout } from '../layouts/index.js';
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
    subtitle: 'Modulos, continuidad y handoff leidos como una sola cabina.',
  },
  {
    id: 'progreso',
    label: 'Progreso',
    eyebrow: 'Lectura',
    title: 'Blindaje, gaps y evolucion',
    subtitle: 'Lo que ya dominas, lo que falta y como va cambiando tu recorrido.',
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    eyebrow: 'Control',
    title: 'Ritmo, foco y regeneracion',
    subtitle: 'Ajustes visuales de la ruta sin perder continuidad.',
  },
];

const EMPTY_STRIP = [
  {
    key: 'diagnostico',
    eyebrow: 'Diagnostico',
    value: '1 base',
    label: 'Primero leer, luego ordenar',
    hint: 'La ruta nace del diagnostico; no se improvisa a mano.',
    tone: 'accent',
  },
  {
    key: 'accion',
    eyebrow: 'Salida',
    value: '1 paso',
    label: 'Siempre hay un siguiente movimiento claro',
    hint: 'Cuando la ruta esta lista, te muestra que hacer y por que.',
    tone: 'accent',
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
      <SplitHeroLayout
        shellFamily={shellFamily}
        className={
          shellFamily === 'tablet'
            ? 'md:grid-cols-[minmax(0,1.1fr)_minmax(21rem,0.9fr)]'
            : shellFamily === 'desktop'
              ? 'xl:grid-cols-[minmax(0,1.18fr)_minmax(24rem,0.82fr)] 2xl:grid-cols-[minmax(0,1.28fr)_minmax(25rem,0.78fr)]'
              : ''
        }
        hero={
          <StageHero
            tone={generating ? 'editorial' : 'hero'}
            eyebrow="Ruta personalizada"
            title={generating ? 'Estamos armando tu ruta' : title}
            subtitle={
              generating
                ? 'Estamos ordenando modulos, continuidad y prioridad para que la cabina nazca ya con siguiente paso claro.'
                : body
            }
            meta="La ruta no es una lista suelta: conecta diagnostico, continuidad y lesson."
            footer={<StatStrip items={EMPTY_STRIP} compact={shellFamily === 'mobile'} variant="support" />}
          >
            <p className="m-0 text-sm leading-7 text-white/78">
              Aqui la experiencia ya debe sentirse como producto completo: direccion,
              continuidad y salida accionable, no solo un boton para “generar”.
            </p>
          </StageHero>
        }
        primary={
          <SurfaceCard padding="lg" variant="spotlight">
            <PanelHeader
              eyebrow={generating ? 'Generando' : 'Siguiente accion'}
              title={generating ? 'Preparando la cabina' : 'Dejemos lista la ruta'}
              subtitle={
                generating
                  ? 'Estamos recalculando modulos y continuidad con el mismo diagnostico.'
                  : 'Desde aqui puedes crear o reconstruir la ruta sin tocar tu dominio ni tu cuenta.'
              }
              divider
            />

            <div className="grid gap-4">
              {generating ? (
                <SurfaceCard padding="compact" variant="command">
                  <div className="flex items-start gap-4">
                    <Spinner size="lg" />
                    <div className="grid gap-2">
                      <strong className="text-base text-white">Ordenando modulos y continuidad</strong>
                      <p className="m-0 text-sm leading-6 text-white/76">
                        Estamos priorizando que sigue y como retomarlo sin perder contexto.
                      </p>
                    </div>
                  </div>
                  <ProgressBar className="mt-4" value={72} tone="accent" />
                </SurfaceCard>
              ) : null}

              {error ? (
                <InlineMessage tone="danger" title="No pudimos completar esta parte.">
                  {error}
                </InlineMessage>
              ) : (
                <InlineMessage tone={generating ? 'success' : 'info'} title="Que se va a conservar">
                  Tu diagnostico, tu estado y la continuidad general se mantienen intactos.
                </InlineMessage>
              )}

              {actionLabel && onAction ? (
                <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
                  <Button type="button" variant="hero" size="lg" onClick={onAction} loading={generating}>
                    {generating ? 'Actualizando cabina...' : actionLabel}
                  </Button>
                </ActionCluster>
              ) : null}
            </div>
          </SurfaceCard>
        }
        secondary={
          <SupportRail
            tone={shellFamily === 'desktop' ? 'editorial' : 'support'}
            sticky={shellFamily === 'desktop'}
            eyebrow="Que esperar"
            title="Como se lee esta pantalla"
            subtitle="Primero se ordena el diagnostico, luego aparece la ruta y despues el handoff al modulo."
          >
            <div className="grid gap-2">
              <SurfaceCard padding="compact" variant="subtle">
                <strong className="text-sm text-sd-text">1. Diagnostico primero</strong>
                <p className="mt-2 text-sm leading-6 text-sd-muted">
                  Sin esa base, la ruta no deberia inventarse visualmente.
                </p>
              </SurfaceCard>
              <SurfaceCard padding="compact" variant="subtle">
                <strong className="text-sm text-sd-text">2. Continuidad visible</strong>
                <p className="mt-2 text-sm leading-6 text-sd-muted">
                  En cuanto exista un modulo activo, veras con claridad que sigue y como entrar.
                </p>
              </SurfaceCard>
            </div>
          </SupportRail>
        }
      />
    </section>
  );
}

function RouteHero({
  shellFamily,
  assessment,
  prioritySummary,
  strongestTopic,
  weakestTopic,
  completedModules,
  routeLength,
  computed,
  courseProgress,
  adminAccess,
}) {
  const stripItems = [
    {
      key: 'shield',
      eyebrow: 'Shield',
      value: formatPercent(computed.score_total),
      label: 'Score total',
      hint: 'Lectura global de tu estado actual.',
      tone: 'accent',
      variant: 'command',
    },
    {
      key: 'modules',
      eyebrow: 'Ruta',
      value: `${completedModules}/${routeLength}`,
      label: 'Modulos completos',
      hint: 'Cuanto ya recorriste.',
      tone: 'neutral',
      variant: 'command',
    },
    {
      key: 'focus',
      eyebrow: 'Foco',
      value: strongestTopic ? CATEGORY_LABELS[strongestTopic[0]] : 'Sin dato',
      label: strongestTopic ? formatPercent(strongestTopic[1]) : '0%',
      hint: weakestTopic
        ? `Gap: ${CATEGORY_LABELS[weakestTopic[0]]}`
        : 'Sin gap dominante todavia.',
      tone: 'accent',
      variant: 'command',
    },
  ];

  return (
    <StageHero
      tone="spotlight"
      eyebrow="Ruta personalizada"
      title="Tu ruta ya te dice que sigue."
      subtitle={assessment?.resumen || prioritySummary}
      actions={
        <ActionCluster collapse="wrap">
          {assessment?.nivel ? <Badge tone="soft">{`Nivel ${assessment.nivel}`}</Badge> : null}
          {adminAccess ? <Badge tone="soft">Modo admin</Badge> : null}
        </ActionCluster>
      }
      meta={`Ultimo acceso: ${formatDate(courseProgress?.lastAccessAt)}`}
      footer={<StatStrip items={stripItems} compact={shellFamily === 'mobile'} variant="command" />}
    >
      <p className="m-0 text-sm leading-7 text-white/78">
        La consola de continuidad concentra la accion principal y el detalle del modulo deja la explicacion larga para despues.
      </p>
    </StageHero>
  );
}

function ContinuityConsole({
  shellFamily,
  target,
  adminAccess,
  onContinue,
  onShowInRoute,
}) {
  return (
    <SurfaceCard
      padding="lg"
      variant="raised"
      className="relative overflow-hidden border-sd-border-strong"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sd-accent via-sd-accent to-sd-accent-strong" />

      <div className="grid gap-6">
        <PanelHeader
          eyebrow="Que sigue ahora"
          title={
            target
              ? displayModuleTitle(target.module)
              : 'Tu siguiente paso aparecera aqui en cuanto la ruta tenga un modulo activo.'
          }
          subtitle={
            target
              ? `Siguiente accion: ${displayActivityTitle(target.nextActivity, 'el siguiente bloque')}.`
              : 'Cuando la ruta este lista, esta region concentra la accion principal.'
          }
          meta={
            <div className="flex flex-wrap gap-2">
              {target ? <Badge tone="accent">{`Modulo ${target.moduleIndex + 1}`}</Badge> : <Badge tone="neutral">Ruta lista</Badge>}
            </div>
          }
          divider
        />

        {target ? (
          <>
            <ProgressSummary
              eyebrow="Avance"
              title={displayActivityTitle(target.nextActivity, 'Siguiente actividad')}
              value={formatPercent(target.stats.pct)}
              hint={
                target.stats.completedCount
                  ? `${target.stats.completedCount} de ${target.stats.total} actividades ya completadas.`
                  : 'Todavia no registras actividades en este bloque.'
              }
              progressValue={target.stats.pct}
              variant="support"
              tone="accent"
              className={shellFamily === 'tablet' ? '!grid-cols-1' : ''}
            />

            <KeyValueBlock
              items={[
                {
                  key: 'category',
                  label: 'Categoria',
                  value: CATEGORY_LABELS[target.module.categoria] || 'Ruta',
                },
                {
                  key: 'time',
                  label: 'Tiempo',
                  value: target.stats.durationLabel,
                },
              ]}
            />

            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() =>
                  onContinue(target.moduleIndex, { restart: adminAccess && target.stats.pct >= 100 })
                }
              >
                {target.stats.completedCount ? 'Continuar donde me quede' : 'Abrir modulo recomendado'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => onShowInRoute(target.module.id)}>
                Verlo dentro de la ruta
              </Button>
            </ActionCluster>
          </>
        ) : (
          <InlineMessage tone="info" title="Sin continuidad activa">
            En cuanto tengas una ruta disponible, esta cabina te mostrara el siguiente paso con CTA directo.
          </InlineMessage>
        )}
      </div>
    </SurfaceCard>
  );
}

function TopSupportBand({
  shellFamily,
  quickGuide,
  strongestTopic,
  weakestTopic,
  prioritySummary,
}) {
  return (
    <div
      className={cn(
        'grid gap-[var(--sd-shell-pane-gap)]',
        shellFamily === 'desktop'
          ? 'xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)]'
          : shellFamily === 'tablet'
            ? 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.88fr)]'
            : ''
      )}
    >
      <SurfaceCard padding="lg" variant="editorial">
        <PanelHeader
          eyebrow="Como leerla"
          title="Ruta por prioridad"
          subtitle="Solo dejamos las referencias que ayudan a decidir que abrir."
          divider
        />
        <div className="grid gap-3 md:grid-cols-2">
          {quickGuide.slice(0, 2).map((item) => (
            <SurfaceCard key={item.title} padding="compact" variant="subtle" className="h-full">
              <strong className="block text-sm text-sd-text">{item.title}</strong>
              <p className="mt-2 text-sm leading-6 text-sd-muted">{item.body}</p>
            </SurfaceCard>
          ))}
        </div>
      </SurfaceCard>

      <SupportRail
        tone={shellFamily === 'desktop' ? 'support' : 'insight'}
        eyebrow="Lectura rapida"
        title="Lo que mas pesa hoy"
        subtitle="Foco principal y gap visible en un solo bloque."
      >
        <ProgressSummary
          eyebrow="Foco actual"
          title={prioritySummary}
          value={strongestTopic ? CATEGORY_LABELS[strongestTopic[0]] : 'Ruta activa'}
          hint={
            weakestTopic
              ? `Gap visible: ${CATEGORY_LABELS[weakestTopic[0]]}`
              : 'Todavia no hay suficiente progresion para detectar el gap principal.'
          }
          progressValue={strongestTopic?.[1] || 0}
          variant="support"
        />
      </SupportRail>
    </div>
  );
}

function DashboardSceneBar({
  shellFamily,
  activeTab,
  onChange,
  completedModules,
  routeLength,
  nextRouteTarget,
}) {
  const copy = TABS.find((tab) => tab.id === activeTab) || TABS[0];

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
          meta={
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">{`${completedModules}/${routeLength} modulos cerrados`}</Badge>
            </div>
          }
        />
        <DashboardTabs activeTab={activeTab} onChange={onChange} />
      </div>
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
  return (
    <SurfaceCard
      as="button"
      type="button"
      padding="compact"
      variant={selected ? 'raised' : 'subtle'}
      interactive
      selected={selected}
      className={cn(
        'relative w-full overflow-hidden text-left transition',
        selected ? 'border-sd-accent bg-sd-accent-soft shadow-[0_24px_50px_-28px_rgba(47,107,255,0.35)]' : '',
        locked ? 'opacity-90' : ''
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-1',
          selected ? 'bg-sd-accent' : recommended ? 'bg-sd-accent/60' : 'bg-transparent'
        )}
      />
      <div className="grid gap-3 pl-1">
        <div className="grid gap-2">
          <div className="grid min-w-0 grid-cols-[auto_1fr] items-start gap-3">
            <span className="rounded-full border border-sd-border bg-sd-canvas px-3 py-2 text-xs font-semibold text-sd-text-soft">
              {String(entry.index + 1).padStart(2, '0')}
            </span>
            <div className="grid min-w-0 gap-2">
              <strong className="text-base leading-5 text-sd-text">
                {displayModuleTitle(entry.module)}
              </strong>
              <p className="m-0 text-sm leading-6 text-sd-text-soft">
                {(LEVEL_LABELS[normalizeModuleLevel(entry.module.nivel)] || 'Nivel') +
                  ' · ' +
                  (CATEGORY_LABELS[entry.module.categoria] || 'Ruta')}
              </p>
            </div>
          </div>
        </div>

        <ProgressBar value={entry.stats.pct} tone={locked ? 'warning' : 'accent'} />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-sd-text-soft">
          <span>{`${entry.stats.completedCount}/${entry.stats.total} actividades`}</span>
          <span>{entry.stats.durationLabel}</span>
          <span>{locked ? 'Bloqueado por secuencia' : getModuleStatusLabel(entry.stats.status)}</span>
          {recommended ? <Badge tone="accent">Siguiente</Badge> : null}
        </div>
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
  entries,
  onSelectModule,
}) {
  const levelCopy = getLevelCopy(level);

  return (
    <SurfaceCard
      padding="md"
      variant="command"
      className={cn(
        'overflow-hidden bg-[linear-gradient(180deg,#0a1d35,#123052)] shadow-[0_36px_90px_-40px_rgba(10,29,53,0.94)] [&_.text-sd-text]:text-white [&_.text-sd-muted]:text-white/74',
        shellFamily === 'desktop' ? 'xl:sticky xl:top-6' : ''
      )}
    >
      <PanelHeader
        eyebrow="Navegador de ruta"
        title="Modulos por prioridad"
        subtitle="Elige un bloque y lee su detalle sin perder continuidad."
        meta={<Badge tone="ink">{`${currentLevelEntries.length} visibles`}</Badge>}
        divider
        className="[&_.sd-heading-sm]:text-white [&_.sd-copy-sm]:text-white/76 [&_.sd-eyebrow]:text-white/70"
      />

      <div className="grid gap-4">
        {availableLevels.length > 1 ? (
          <SurfaceCard padding="compact" variant="support" className="bg-white/6 shadow-none">
            <PanelHeader
              eyebrow="Nivel visible"
              title={levelCopy.title}
              subtitle="Filtra la ruta sin perder el orden."
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
    <div className="grid gap-3">
      {activities.map((activity, index) => {
        const completed = Boolean(completedMap?.[activity.id]);
        const isNext = nextActivity?.id === activity.id;

        return (
          <div
            key={activity.id}
            className={cn(
              'rounded-[24px] border px-4 py-4 transition',
              completed
                ? 'border-emerald-200 bg-emerald-50/80'
                : isNext
                  ? 'border-sd-accent bg-sd-accent-soft'
                  : 'border-sd-border bg-white/72'
            )}
          >
            <div className="grid gap-3">
              <div className="grid min-w-0 grid-cols-[auto_1fr] items-start gap-3">
                <span className="rounded-[18px] bg-sd-canvas px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-sd-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="grid min-w-0 gap-2">
                  <strong className="text-sm leading-6 text-sd-text">{displayActivityTitle(activity)}</strong>
                  <p className="m-0 text-sm leading-6 text-sd-muted">
                    {cleanText(
                      activity?.descripcion,
                      completed
                        ? 'Actividad completada dentro de este modulo.'
                        : isNext
                          ? 'Este es el siguiente bloque que retomaras al abrir el modulo.'
                          : 'Bloque posterior dentro del recorrido del modulo.'
                    )}
                  </p>
                </div>
              </div>
              <div className="text-sm text-sd-text-soft">
                {completed ? 'Hecha' : isNext ? 'Siguiente' : activity?.tipo || 'Actividad'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
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

  return (
    <div className="grid gap-5">
      <StageHero
        tone={recommended ? 'spotlight' : 'editorial'}
        eyebrow={`Modulo ${index + 1}`}
        title={displayModuleTitle(module)}
        subtitle={cleanText(
          module.descripcion,
          'Bloque practico para detectar senales, fijar una rutina segura y saber exactamente como retomar.'
        )}
        actions={
          <ActionCluster collapse="wrap">
            <Badge tone={recommended ? 'accent' : 'neutral'}>
              {recommended ? 'Siguiente recomendado' : getModuleStatusLabel(stats.status)}
            </Badge>
          </ActionCluster>
        }
        meta={`${CATEGORY_LABELS[module.categoria] || 'Ruta'} · ${getModuleObjective(module)}`}
        footer={
          <StatStrip
            compact={shellFamily === 'mobile'}
            variant="support"
            items={[
              {
                key: 'progress',
                eyebrow: 'Avance',
                value: formatPercent(stats.pct),
                label: getModuleStatusLabel(stats.status),
                hint: 'Porcentaje visible dentro del modulo.',
                tone: getModuleStatusTone(stats.status),
              },
              {
                key: 'time',
                eyebrow: 'Tiempo',
                value: stats.durationLabel,
                label: 'Dedicacion',
                hint: 'Tiempo registrado en este bloque.',
                tone: 'neutral',
              },
            ]}
          />
        }
      >
        <p className="m-0 text-sm leading-7 text-sd-text-soft">Objetivo claro, siguiente actividad visible y CTA directo.</p>
      </StageHero>

      <div
        className={cn(
          'grid gap-4',
          shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)]'
            : shellFamily === 'tablet'
              ? 'lg:grid-cols-[minmax(0,1.04fr)_minmax(17rem,0.96fr)]'
              : ''
        )}
      >
        <SurfaceCard padding="lg" variant="panel">
          <PanelHeader
            eyebrow="Ruta interna del modulo"
            title={displayActivityTitle(stats.nextActivity, 'Modulo listo para repaso')}
            subtitle="La secuencia deja visible que sigue y que ya quedo hecho."
            divider
          />
          <ModuleActivityList
            module={module}
            nextActivity={stats.nextActivity}
            completedMap={progressMap?.completed || {}}
          />
        </SurfaceCard>

        <SupportRail
          tone={recommended ? 'insight' : 'support'}
          sticky={shellFamily === 'desktop'}
          eyebrow="Apertura"
          title="Entrar con contexto"
          subtitle="Metadata esencial y CTA claro para abrir el modulo."
        >
          <div className="grid gap-4">
            <ProgressSummary
              eyebrow="Estado del modulo"
              title={getModuleStatusLabel(stats.status)}
              value={formatPercent(stats.pct)}
              hint={`Siguiente actividad: ${displayActivityTitle(stats.nextActivity, 'Actividad pendiente')}`}
              progressValue={stats.pct}
              tone="accent"
              variant="support"
              className={shellFamily === 'tablet' ? '!grid-cols-1' : ''}
            />

            <KeyValueBlock
              items={[
                {
                  key: 'visits',
                  label: 'Visitas',
                  value: stats.visits || 0,
                },
                {
                  key: 'last',
                  label: 'Ultimo cierre',
                  value: stats.completedAt ? formatDate(stats.completedAt) : 'Aun sin cierre',
                },
                {
                  key: 'activities',
                  label: 'Actividades',
                  value: `${stats.completedCount}/${stats.total}`,
                },
              ]}
            />

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

            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={locked}
                onClick={() => onOpenModule(index, { restart: adminAccess && stats.pct >= 100 })}
              >
                {getModuleCtaLabel({ locked, adminAccess, stats })}
              </Button>
            </ActionCluster>
          </div>
        </SupportRail>
      </div>
    </div>
  );
}

function RouteInsightRail({
  shellFamily,
  routeLength,
  completedModules,
  selectedEntry,
  quickGuide,
  strongestTopic,
  weakestTopic,
  nextUnlockEntry,
  adminAccess,
}) {
  const selectedStats = selectedEntry?.stats || null;
  const selectedModule = selectedEntry?.module || null;
  const routeCompletion = routeLength ? Math.round((completedModules / routeLength) * 100) : 0;

  return (
    <div className={cn('grid gap-4', shellFamily === 'desktop' ? 'xl:sticky xl:top-6' : '')}>
      <SupportRail
        tone={shellFamily === 'desktop' ? 'support' : 'insight'}
        eyebrow="Lectura del recorrido"
        title="La ruta se entiende de un vistazo"
        subtitle="Progreso, foco y siguiente desbloqueo en un solo costado."
      >
        <div className="grid gap-4">
          <ProgressSummary
            eyebrow="Ruta total"
            title={selectedModule ? displayModuleTitle(selectedModule) : 'Ruta activa'}
            value={formatPercent(routeCompletion)}
            hint={`${completedModules} de ${routeLength} modulos completos`}
            progressValue={routeCompletion}
            tone="accent"
            variant="support"
            className={shellFamily === 'tablet' ? '!grid-cols-1' : ''}
          />

          <KeyValueBlock
            items={[
              {
                key: 'fortaleza',
                label: 'Fortaleza',
                value: strongestTopic ? CATEGORY_LABELS[strongestTopic[0]] : 'Sin dato suficiente',
              },
              {
                key: 'gap',
                label: 'Gap visible',
                value: weakestTopic ? CATEGORY_LABELS[weakestTopic[0]] : 'Sin gap dominante',
              },
              {
                key: 'next',
                label: 'Siguiente desbloqueo',
                value: nextUnlockEntry ? displayModuleTitle(nextUnlockEntry.module) : 'Ruta abierta completa',
              },
            ]}
          />

          {selectedStats ? (
            <InlineMessage tone="info" title="Lectura del modulo seleccionado">
              {selectedStats.completedCount
                ? `Ya registras ${selectedStats.completedCount} actividad(es) en este bloque.`
                : 'Todavia no registras avance en este bloque.'}
            </InlineMessage>
          ) : null}

          {adminAccess ? (
            <InlineMessage tone="info" title="Modo admin activo">
              Esta ruta permite abrir y repetir modulos sin esperar el desbloqueo secuencial.
            </InlineMessage>
          ) : null}
        </div>
      </SupportRail>

      <SurfaceCard padding="md" variant="editorial">
        <PanelHeader
          eyebrow="Guia"
          title={quickGuide[0]?.title || 'Recorre por prioridad'}
          subtitle={quickGuide[0]?.body || 'Usa la ruta por prioridad y continuidad.'}
        />
      </SurfaceCard>
    </div>
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

  return (
    <div className="grid gap-5">
      <StageHero
        tone="editorial"
        eyebrow="Progreso visible"
        title="Tu blindaje ya se puede leer como avance real, no como datos sueltos."
        subtitle={getPrioritySummary(answers, assessment)}
        actions={
          <ActionCluster collapse="wrap">
            {strongestTopic ? (
              <Badge tone="accent">{`Fortaleza: ${CATEGORY_LABELS[strongestTopic[0]]}`}</Badge>
            ) : null}
            {weakestTopic ? (
              <Badge tone="warning">{`Gap: ${CATEGORY_LABELS[weakestTopic[0]]}`}</Badge>
            ) : null}
          </ActionCluster>
        }
        meta="Aqui interpretas que tan blindada esta la ruta y donde conviene insistir en los siguientes modulos."
        footer={
          <StatStrip
            compact={shellFamily === 'mobile'}
            items={[
              {
                key: 'shield',
                eyebrow: 'Shield',
                value: formatPercent(computed.score_total),
                label: 'Lectura global',
                hint: 'Se mueve conforme completas actividades.',
                tone: 'accent',
              },
              {
                key: 'route',
                eyebrow: 'Ruta completada',
                value: formatPercent(routeCompletion),
                label: `${completedModules}/${routeLength} modulos`,
                hint: 'Sirve para retomar con una expectativa real.',
                tone: 'neutral',
              },
              {
                key: 'last',
                eyebrow: 'Ultimo acceso',
                value: formatDate(progress?.lastAccessAt),
                label: 'Registro',
                hint: 'Ayuda a leer continuidad y ritmo.',
                tone: 'neutral',
              },
            ]}
          />
        }
      >
        <p className="m-0 text-sm leading-7 text-sd-text-soft">
          El progreso deja de ser accesorio: ahora explica fortalezas, errores frecuentes y como
          eso reordena la siguiente parte de tu ruta.
        </p>
      </StageHero>

      <div
        className={cn(
          'grid gap-4',
          shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1.12fr)_minmax(19rem,0.88fr)]'
            : shellFamily === 'tablet'
              ? 'lg:grid-cols-[minmax(0,1.04fr)_minmax(17rem,0.96fr)]'
              : ''
        )}
      >
        <div className="grid gap-4">
          <SurfaceCard padding="lg" variant="panel">
            <PanelHeader
              eyebrow="Competencias"
              title="Tu blindaje por tema"
              subtitle="Estas barras muestran donde ya detectas mejor las senales y donde conviene insistir."
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

          <SurfaceCard padding="lg" variant="editorial">
            <PanelHeader
              eyebrow="Snapshots"
              title="Como se esta moviendo la ruta"
              subtitle="Este historial sirve para retomar con contexto y no solo recordar “mas o menos como iba”."
              divider
            />
            <div className="grid gap-3">
              {history.length ? (
                history.map((item, index) => (
                  <div
                    key={`${item.timestamp || index}`}
                    className="rounded-[22px] border border-sd-border bg-white/76 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-sm text-sd-text">{formatDate(item.timestamp)}</strong>
                      <Badge tone="accent">{formatPercent(item.scoreTotal)}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-sd-muted">
                      {`${item.completedCount} actividad(es) registradas en este snapshot.`}
                    </p>
                  </div>
                ))
              ) : (
                <InlineMessage tone="info" title="Sin snapshots todavia">
                  Completa mas actividades para empezar a ver evolucion a lo largo del tiempo.
                </InlineMessage>
              )}
            </div>
          </SurfaceCard>
        </div>

        <div className="grid gap-4">
          <ProgressSummary
            eyebrow="Lectura rapida"
            title={strongestTopic ? CATEGORY_LABELS[strongestTopic[0]] : 'Sin lectura dominante'}
            value={strongestTopic ? formatPercent(strongestTopic[1]) : '0%'}
            hint={
              strongestTopic
                ? 'Esta es la competencia que mejor esta respondiendo dentro de tu progreso reciente.'
                : 'Aun no hay suficiente recorrido para detectar la fortaleza principal.'
            }
            progressValue={strongestTopic?.[1] || 0}
            variant="support"
            tone="accent"
          />

          <SupportRail
            tone="support"
            eyebrow="Lo importante"
            title="Fortalezas, gaps y configuracion"
            subtitle="Este costado concentra lo que mas importa para decidir como seguir."
          >
            <div className="grid gap-4">
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
                    key: 'prefs',
                    label: 'Ruta / preferencias',
                    value: `v${coursePlan?.planVersion || 0} · ${coursePrefs?.estilo || 'mix'} · ${coursePrefs?.dificultad || 'auto'}`,
                  },
                ]}
              />
            </div>
          </SupportRail>
        </div>
      </div>
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

  const settingsStrip = [
    {
      key: 'style',
      eyebrow: 'Estilo',
      value: coursePrefs?.estilo || 'mix',
      label: 'Cabina actual',
      hint: 'Solo cambia el ritmo de la ruta, no el dominio.',
      tone: 'accent',
    },
    {
      key: 'difficulty',
      eyebrow: 'Dificultad',
      value: coursePrefs?.dificultad || 'auto',
      label: 'Escala visible',
      hint: 'Sigue usando la misma logica de plan.',
      tone: 'neutral',
    },
    {
      key: 'duration',
      eyebrow: 'Duracion',
      value: coursePrefs?.duracion || '5-10',
      label: 'Ritmo esperado',
      hint: 'Ajusta cuanto deberia sentirse cada bloque.',
      tone: 'neutral',
    },
  ];

  return (
    <SplitHeroLayout
      shellFamily={shellFamily}
      className={
        shellFamily === 'tablet'
          ? 'md:grid-cols-[minmax(0,1.02fr)_minmax(21rem,0.98fr)]'
          : shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)] 2xl:grid-cols-[minmax(0,1.18fr)_minmax(25rem,0.88fr)]'
            : ''
      }
      hero={
        <StageHero
          tone="editorial"
          eyebrow="Ajustes de cabina"
          title="Ritmo, foco y regeneracion ya viven dentro del mismo sistema visual de la ruta."
          subtitle="Aqui no se reescribe la logica del plan: solo se ajusta como quieres recorrerlo y cuando vale la pena regenerarlo."
          meta="Los cambios preservan diagnostico, continuidad y estructura general del recorrido."
          footer={<StatStrip items={settingsStrip} compact={shellFamily === 'mobile'} variant="support" />}
        >
          <p className="m-0 text-sm leading-7 text-sd-text-soft">
            Esta region ya no se siente como un formulario suelto. Es la cabina donde decides
            ritmo, dificultad visible y temas prioritarios antes de volver a ordenar la ruta.
          </p>
        </StageHero>
      }
      primary={
        <SurfaceCard padding="lg" variant="spotlight">
          <PanelHeader
            eyebrow="Preferencias"
            title="Ajusta ritmo y enfoque"
            subtitle="Estos controles no tocan dominio ni scoring; solo reordenan la presentacion de la ruta cuando vuelves a generarla."
            divider
          />

          <div className="grid gap-4 md:grid-cols-3">
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
            className="mt-6"
            label="Temas prioritarios"
            hint="Activa o quita temas segun el foco que quieras reforzar."
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
        </SurfaceCard>
      }
      secondary={
        <SupportRail
          tone={shellFamily === 'desktop' ? 'editorial' : 'support'}
          sticky={shellFamily === 'desktop'}
          eyebrow="Aplicar cambios"
          title="Regenerar sin perder continuidad"
          subtitle="Usa esta accion cuando quieras reordenar modulos, ritmo y prioridad con la misma base logica."
        >
          <div className="grid gap-4">
            {error ? (
              <InlineMessage tone="danger" title="No pudimos actualizar la ruta.">
                {error}
              </InlineMessage>
            ) : (
              <InlineMessage tone="info" title="Que se conserva">
                Tu diagnostico, progreso y continuidad siguen intactos mientras se recalcula la ruta.
              </InlineMessage>
            )}

            <ActionCluster align="start" collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
              <Button type="button" variant="hero" onClick={onGenerateCourse} loading={generating}>
                {generating ? 'Actualizando ruta...' : 'Actualizar ruta'}
              </Button>
            </ActionCluster>
          </div>
        </SupportRail>
      }
    />
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
  const isDesktop = shellFamily === 'desktop';
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
  const strongestTopic =
    Object.entries(computed.competencias || {}).sort((a, b) => b[1] - a[1])[0] || null;
  const weakestTopic =
    Object.entries(computed.competencias || {}).sort((a, b) => a[1] - b[1])[0] || null;

  const [tab, setTab] = useState('ruta');
  const [level, setLevel] = useState(defaultLevel);
  const [selectedModuleId, setSelectedModuleId] = useState(
    recommendedEntry?.module?.id || entries[0]?.module?.id || null
  );

  const journeySteps = useMemo(
    () =>
      buildJourneyProgress({
        currentView,
        surveyStage: 'results',
        hasAssessment: Boolean(assessment),
        hasCoursePlan: Boolean(coursePlan),
      }),
    [assessment, coursePlan, currentView]
  );

  const resumeTarget = useMemo(() => buildResumeTarget(entries), [entries]);
  const quickGuide = useMemo(
    () =>
      buildCourseQuickGuide({
        hasProgress: Boolean(Object.keys(courseProgress?.completed || {}).length),
      }),
    [courseProgress]
  );

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

  return (
    <section
      id="coursesView"
      className="sd-page-shell py-[var(--sd-shell-padding-block)]"
      data-sd-container="true"
    >
      <div className="grid gap-[var(--sd-shell-section-gap)]">
        <SplitHeroLayout
          shellFamily={shellFamily}
          className={
            shellFamily === 'tablet'
              ? 'md:grid-cols-[minmax(0,1.08fr)_minmax(21rem,0.92fr)]'
              : shellFamily === 'desktop'
                ? 'xl:grid-cols-[minmax(0,1.18fr)_minmax(24rem,0.82fr)] 2xl:grid-cols-[minmax(0,1.28fr)_minmax(25rem,0.78fr)]'
                : ''
          }
          hero={
            <RouteHero
              shellFamily={shellFamily}
              assessment={assessment}
              prioritySummary={prioritySummary}
              strongestTopic={strongestTopic}
              weakestTopic={weakestTopic}
              completedModules={completedModules}
              routeLength={route.length}
              computed={computed}
              courseProgress={courseProgress}
              adminAccess={adminAccess}
            />
          }
          primary={
            <ContinuityConsole
              shellFamily={shellFamily}
              target={nextRouteTarget}
              adminAccess={adminAccess}
              onContinue={onOpenModule}
              onShowInRoute={handleShowInRoute}
            />
          }
          secondary={
            <TopSupportBand
              shellFamily={shellFamily}
              quickGuide={quickGuide}
              strongestTopic={strongestTopic}
              weakestTopic={weakestTopic}
              prioritySummary={prioritySummary}
            />
          }
        />

        <DashboardSceneBar
          shellFamily={shellFamily}
          activeTab={tab}
          onChange={setTab}
          completedModules={completedModules}
          routeLength={route.length}
          nextRouteTarget={nextRouteTarget}
        />

        {tab === 'ruta' ? (
          isMobile ? (
            <div className="grid gap-[var(--sd-shell-pane-gap)]">
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
                entries={entries}
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
              />

              <RouteInsightRail
                shellFamily={shellFamily}
                routeLength={route.length}
                completedModules={completedModules}
                selectedEntry={selectedEntry}
                quickGuide={quickGuide}
                strongestTopic={strongestTopic}
                weakestTopic={weakestTopic}
                nextUnlockEntry={nextUnlockEntry}
                adminAccess={adminAccess}
              />
            </div>
          ) : shellFamily === 'tablet' ? (
            <div className="grid gap-[var(--sd-shell-pane-gap)] lg:grid-cols-[minmax(20rem,21.5rem)_minmax(0,1fr)]">
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
                entries={entries}
                onSelectModule={setSelectedModuleId}
              />

              <div className="grid gap-[var(--sd-shell-pane-gap)]">
                <ModuleMissionBoard
                  shellFamily={shellFamily}
                  entry={selectedEntry}
                  locked={selectedLocked}
                  recommended={selectedEntry?.index === recommendedIndex}
                  adminAccess={adminAccess}
                  unlockMessage={selectedUnlockMessage}
                  onOpenModule={onOpenModule}
                  progressMap={courseProgress}
                />

                <RouteInsightRail
                  shellFamily={shellFamily}
                  routeLength={route.length}
                  completedModules={completedModules}
                  selectedEntry={selectedEntry}
                  quickGuide={quickGuide}
                  strongestTopic={strongestTopic}
                  weakestTopic={weakestTopic}
                  nextUnlockEntry={nextUnlockEntry}
                  adminAccess={adminAccess}
                />
              </div>
            </div>
          ) : (
            <WorkspaceLayout
              shellFamily={shellFamily}
              className="xl:grid-cols-[minmax(20.5rem,22rem)_minmax(0,1.32fr)_minmax(18.75rem,20.5rem)] 2xl:grid-cols-[minmax(21rem,22.5rem)_minmax(0,1.4fr)_minmax(19.5rem,21rem)]"
              command={
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
                  entries={entries}
                  onSelectModule={setSelectedModuleId}
                />
              }
              main={
                <ModuleMissionBoard
                  shellFamily={shellFamily}
                  entry={selectedEntry}
                  locked={selectedLocked}
                  recommended={selectedEntry?.index === recommendedIndex}
                  adminAccess={adminAccess}
                  unlockMessage={selectedUnlockMessage}
                  onOpenModule={onOpenModule}
                  progressMap={courseProgress}
                />
              }
              insight={
                <RouteInsightRail
                  shellFamily={shellFamily}
                  routeLength={route.length}
                  completedModules={completedModules}
                  selectedEntry={selectedEntry}
                  quickGuide={quickGuide}
                  strongestTopic={strongestTopic}
                  weakestTopic={weakestTopic}
                  nextUnlockEntry={nextUnlockEntry}
                  adminAccess={adminAccess}
                />
              }
            />
          )
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
