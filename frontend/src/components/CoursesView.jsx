import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '../lib/format.js';
import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  computeCompetenciesFromProgress,
  LEVEL_LABELS,
  normalizeModuleLevel,
  normalizeModuleTitleForDisplay,
  repairPossibleMojibake,
  summarizeProgressInsights,
} from '../lib/course.js';
import { getLevelCopy, LEVEL_ORDER, TOPIC_ORDER } from '../lib/difficultyRules.js';
import { buildCourseQuickGuide, buildJourneyProgress } from '../lib/journeyGuidance.js';
import { cn } from '../lib/ui.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

const TABS = ['ruta', 'progreso', 'ajustes'];
const COMPACT_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact']);

const cleanText = (value, fallback = '') =>
  repairPossibleMojibake(String(value || '')).trim() || fallback;
const compactViewport = (viewport) => COMPACT_VIEWPORTS.has(viewport);
const displayModuleTitle = (module) =>
  normalizeModuleTitleForDisplay(module?.categoria, module?.titulo || module?.title || '');
const displayActivityTitle = (activity, fallback = 'Actividad') =>
  cleanText(ACTIVITY_LABELS[activity?.tipo] || activity?.titulo || fallback, fallback);
const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

const formatMinutesFromMs = (value) => {
  const minutes = (Number(value) || 0) / 60000;
  if (!minutes) return 'Sin tiempo';
  if (minutes < 1) return '<1 min';
  if (minutes < 10) return `${minutes.toFixed(1)} min`;
  return `${Math.round(minutes)} min`;
};

function getModuleStats(module, progress) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const completedEntries = activities.map((activity) => progress?.completed?.[activity.id]).filter(Boolean);
  const completedCount = completedEntries.length;
  const total = activities.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const avgScore = completedEntries.length
    ? Math.round(
        (completedEntries.reduce((acc, item) => acc + (Number(item.score) || 0), 0) /
          completedEntries.length) *
          100
      )
    : 0;
  const moduleEntry = progress?.modules?.[module?.id] || {};

  return {
    pct,
    total,
    completedCount,
    avgScore,
    visits: Number(moduleEntry.visits) || 0,
    durationLabel: formatMinutesFromMs(moduleEntry.durationMs),
    completedAt: moduleEntry.completedAt || null,
    nextActivity: activities.find((activity) => !progress?.completed?.[activity.id]) || activities[0] || null,
    status: pct >= 100 ? 'completed' : completedCount > 0 ? 'active' : 'pending',
  };
}

const getRecommendedIndex = (route, progress) => {
  const idx = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return idx === -1 ? 0 : idx;
};

const getUnlockedLimit = (route, progress) => {
  const idx = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return idx === -1 ? route.length - 1 : idx;
};

function getPrioritySummary(answers, assessment) {
  const priority = String(answers?.priority || '').toLowerCase();
  if (priority === 'todo') return 'Tu ruta cubre varios frentes, pero con un orden claro para no saturarte.';
  if (priority && CATEGORY_LABELS[priority]) {
    return `Tu foco actual está en ${CATEGORY_LABELS[priority].toLowerCase()}, así que empezamos por ahí.`;
  }
  if (assessment?.nivel) {
    return `La ruta se ajustó a tu evaluación ${String(assessment.nivel).toLowerCase()} y a tu progreso reciente.`;
  }
  return 'La ruta prioriza avanzar con criterio antes de abrir módulos más complejos.';
}

function buildResumeTarget(entries) {
  const entry = entries.find((item) => item.stats.pct < 100) || entries[0] || null;
  if (!entry) return null;

  return {
    moduleIndex: entry.index,
    module: entry.module,
    nextActivity: entry.stats.nextActivity,
    stats: entry.stats,
  };
}

function JourneyStrip({ steps }) {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {steps.map((step, index) => (
        <div
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                {`Paso ${index + 1}`}
              </p>
              <strong className="mt-2 block text-sm text-sd-text">{step.label}</strong>
            </div>
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold uppercase tracking-[0.14em]',
                step.state === 'current'
                  ? 'bg-sd-accent text-white'
                  : step.state === 'done'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
              )}
            >
              {step.state === 'done' ? 'OK' : String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-sd-muted">{step.description}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, body, error, actionLabel, onAction, generating }) {
  const resolvedTitle = generating ? 'Estamos generando tu ruta' : title;
  const resolvedBody = generating
    ? 'Estamos armando tus módulos y ordenándolos según tu diagnóstico. Esto tarda solo unos segundos.'
    : body;

  return (
    <section className="sd-page-shell py-8 sm:py-10">
      <SurfaceCard className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Ruta personalizada</p>
        <h1 className="sd-title mt-3">{resolvedTitle}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-sd-muted sm:text-base">{resolvedBody}</p>
        {generating ? (
          <div className="mx-auto mt-6 max-w-xl">
            <div className="loader">
              <div className="loader-bar" />
            </div>
            <p className="mt-3 text-sm leading-6 text-sd-muted">
              Qué sigue: en cuanto termine, entrarás a tu ruta sin perder el contexto del diagnóstico.
            </p>
          </div>
        ) : null}
        {error ? <div className="alert mx-auto mt-5 max-w-2xl text-left">{error}</div> : null}
        {actionLabel ? (
          <div className="mt-6 flex justify-center">
            <Button variant="primary" type="button" onClick={onAction} disabled={generating}>
              {generating ? 'Actualizando ruta...' : actionLabel}
            </Button>
          </div>
        ) : null}
      </SurfaceCard>
    </section>
  );
}

function LevelBar({ levels, activeLevel, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {levels.map((value) => (
        <button
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-semibold transition',
            activeLevel === value
              ? 'border-sd-accent bg-sd-accent-soft text-sd-accent'
              : 'border-sd-border bg-white/70 text-sd-text hover:bg-white'
          )}
          key={value}
          type="button"
          onClick={() => onChange(value)}
        >
          {getLevelCopy(value).title}
        </button>
      ))}
    </div>
  );
}

function ModuleListItem({ entry, selected, locked, recommended, adminAccess = false, onSelect }) {
  return (
    <button
      className={cn(
        'w-full rounded-[24px] border px-4 py-4 text-left transition',
        selected
          ? 'border-sd-accent bg-sd-accent-soft'
          : 'border-sd-border bg-white/75 hover:-translate-y-0.5 hover:bg-white',
        locked ? 'opacity-70' : ''
      )}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
            {`Módulo ${entry.index + 1}`}
          </p>
          <strong className="mt-2 block text-base text-sd-text">{displayModuleTitle(entry.module)}</strong>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {recommended ? <Badge tone="accent">Recomendado</Badge> : null}
          {adminAccess ? <Badge tone="soft">Admin</Badge> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="neutral">{CATEGORY_LABELS[entry.module.categoria] || 'Curso'}</Badge>
        <Badge tone="neutral">{formatPercent(entry.stats.pct)}</Badge>
        <Badge tone={entry.stats.status === 'completed' ? 'soft' : 'neutral'}>
          {entry.stats.status === 'completed'
            ? 'Completado'
            : entry.stats.status === 'active'
              ? 'En curso'
              : 'Pendiente'}
        </Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-sd-muted">
        {cleanText(entry.module.descripcion, 'Bloque práctico para reforzar criterio y hábitos.')}
      </p>
    </button>
  );
}

function ModuleDetail({ entry, locked, recommended, adminAccess = false, unlockMessage, onOpenModule }) {
  if (!entry) {
    return (
      <SurfaceCard>
        <p className="eyebrow">Ruta</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">Elige un módulo</h2>
      </SurfaceCard>
    );
  }

  const { module, index, stats } = entry;

  return (
    <SurfaceCard className="lg:sticky lg:top-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{`Módulo ${index + 1}`}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">
            {displayModuleTitle(module)}
          </h2>
          <p className="mt-4 text-sm leading-7 text-sd-muted">
            {cleanText(module.descripcion, 'Bloque práctico para detectar señales y repetir una rutina segura.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recommended ? <Badge tone="accent">Siguiente recomendado</Badge> : null}
          <Badge tone="neutral">{CATEGORY_LABELS[module.categoria] || 'Curso'}</Badge>
          <Badge tone="neutral">{LEVEL_LABELS[normalizeModuleLevel(module.nivel)] || 'Nivel'}</Badge>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-sd-border bg-white/72 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Qué harás aquí</p>
        <p className="mt-3 text-sm leading-6 text-sd-text">
          Abre este módulo para practicar sin prisa, revisar el feedback después de cada actividad y
          mantener la misma rutina segura aunque cambie el canal.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Avance</span>
          <strong className="mt-3 block text-2xl text-sd-text">{formatPercent(stats.pct)}</strong>
        </div>
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Score</span>
          <strong className="mt-3 block text-2xl text-sd-text">
            {stats.avgScore ? formatPercent(stats.avgScore) : 'Sin score'}
          </strong>
        </div>
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Visitas</span>
          <strong className="mt-3 block text-2xl text-sd-text">{stats.visits || 0}</strong>
        </div>
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Tiempo</span>
          <strong className="mt-3 block text-2xl text-sd-text">{stats.durationLabel}</strong>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-sd-border bg-white/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Siguiente actividad</p>
        <strong className="mt-2 block text-base text-sd-text">
          {displayActivityTitle(stats.nextActivity, 'Módulo listo para repaso')}
        </strong>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Array.isArray(module.actividades) ? module.actividades : []).map((activity) => (
            <span
              className="rounded-full border border-sd-border bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sd-muted"
              key={activity.id}
            >
              {displayActivityTitle(activity)}
            </span>
          ))}
        </div>
      </div>

      {locked ? (
        <div className="mt-5 rounded-[20px] border border-amber-300/70 bg-amber-50/90 px-4 py-4 text-sm leading-6 text-amber-900">
          {unlockMessage}
        </div>
      ) : null}

      {adminAccess ? (
        <div className="mt-5 rounded-[20px] border border-sd-border bg-white/65 px-4 py-4 text-sm leading-6 text-sd-muted">
          Modo admin activo: puedes abrir o repetir este módulo sin bloqueos.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="primary"
          type="button"
          disabled={locked}
          onClick={() => onOpenModule(index, { restart: adminAccess && stats.pct >= 100 })}
        >
          {locked
            ? 'Bloqueado'
            : adminAccess && stats.pct >= 100
              ? 'Repetir módulo'
              : stats.completedCount
                ? 'Continuar donde me quedé'
                : 'Abrir módulo'}
        </Button>
      </div>
    </SurfaceCard>
  );
}

function GuideGrid({ items }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <article key={item.title} className="rounded-[22px] border border-sd-border bg-white/74 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Guía rápida</span>
          <strong className="mt-2 block text-base text-sd-text">{item.title}</strong>
          <p className="mt-3 text-sm leading-6 text-sd-muted">{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function ProgressTab({ computed, progress, coursePlan, coursePrefs, answers, assessment }) {
  const strongestTopic = Object.entries(computed.competencias || {}).sort((a, b) => b[1] - a[1])[0] || null;
  const weakestTopic = Object.entries(computed.competencias || {}).sort((a, b) => a[1] - b[1])[0] || null;
  const insights = summarizeProgressInsights(coursePlan, progress);
  const history = Array.isArray(progress?.snapshots) ? [...progress.snapshots].slice(-3).reverse() : [];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SurfaceCard>
        <p className="eyebrow">Fortalezas y foco</p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Fortaleza principal</span>
            <strong className="mt-3 block text-lg text-sd-text">
              {strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} ${formatPercent(strongestTopic[1])}` : 'Sin datos'}
            </strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Área a reforzar</span>
            <strong className="mt-3 block text-lg text-sd-text">
              {weakestTopic ? `${CATEGORY_LABELS[weakestTopic[0]]} ${formatPercent(weakestTopic[1])}` : 'Sin datos'}
            </strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Prioridad declarada</span>
            <strong className="mt-3 block text-lg text-sd-text">{getPrioritySummary(answers, assessment)}</strong>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <p className="eyebrow">Competencias</p>
        <div className="mt-5 space-y-4">
          {TOPIC_ORDER.map((topic) => (
            <div key={topic}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-sd-text">{CATEGORY_LABELS[topic]}</span>
                <strong className="text-sd-text">{formatPercent(computed.competencias?.[topic] || 0)}</strong>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sd-accent" style={{ width: `${computed.competencias?.[topic] || 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <p className="eyebrow">Evolución</p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Último acceso</span>
            <strong className="mt-3 block text-lg text-sd-text">{formatDate(progress?.lastAccessAt)}</strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Señales que detectas bien</span>
            <strong className="mt-3 block text-lg text-sd-text">
              {insights.strengths.length ? insights.strengths.join(' · ') : 'Sin historial suficiente'}
            </strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Errores frecuentes</span>
            <strong className="mt-3 block text-lg text-sd-text">
              {insights.mistakes.length ? insights.mistakes.join(' · ') : 'Sin tropiezos claros por ahora'}
            </strong>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <p className="eyebrow">Ruta activa</p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Versión del plan</span>
            <strong className="mt-3 block text-lg text-sd-text">{`Versión ${coursePlan?.planVersion || 0}`}</strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Preferencias</span>
            <strong className="mt-3 block text-lg text-sd-text">{`Estilo ${coursePrefs?.estilo || 'mix'} · dificultad ${coursePrefs?.dificultad || 'auto'}`}</strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Snapshots recientes</span>
            <strong className="mt-3 block text-lg text-sd-text">
              {history.length ? history.map((item) => `${formatPercent(item.scoreTotal)} (${item.completedCount})`).join(' · ') : 'Completa más actividades para ver evolución'}
            </strong>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

function SettingsTab({ coursePrefs, onCoursePrefsChange, onGenerateCourse, generating, error }) {
  const setField = (field, value) => onCoursePrefsChange((current) => ({ ...current, [field]: value }));

  const toggleTopic = (topic) => {
    onCoursePrefsChange((current) => {
      const currentTopics = Array.isArray(current?.temas) ? current.temas : [];
      const nextTopics = currentTopics.includes(topic)
        ? currentTopics.filter((item) => item !== topic)
        : [...currentTopics, topic];
      return { ...current, temas: nextTopics.length ? nextTopics : currentTopics };
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
      <SurfaceCard>
        <p className="eyebrow">Ajustes de la ruta</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-medium text-sd-text">
            <span>Estilo</span>
            <select className="sd-input" value={coursePrefs?.estilo || 'mix'} onChange={(event) => setField('estilo', event.target.value)}>
              <option value="mix">Mix</option>
              <option value="guiado">Guiado</option>
              <option value="practico">Práctico</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-sd-text">
            <span>Dificultad</span>
            <select className="sd-input" value={coursePrefs?.dificultad || 'auto'} onChange={(event) => setField('dificultad', event.target.value)}>
              <option value="auto">Auto</option>
              <option value="facil">Fácil</option>
              <option value="normal">Normal</option>
              <option value="avanzada">Avanzada</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-sd-text">
            <span>Duración</span>
            <select className="sd-input" value={coursePrefs?.duracion || '5-10'} onChange={(event) => setField('duracion', event.target.value)}>
              <option value="5-10">5-10 min</option>
              <option value="10-15">10-15 min</option>
              <option value="15-20">15-20 min</option>
            </select>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {TOPIC_ORDER.map((topic) => {
            const active = Array.isArray(coursePrefs?.temas) ? coursePrefs.temas.includes(topic) : false;
            return (
              <button
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  active
                    ? 'border-sd-accent bg-sd-accent-soft text-sd-accent'
                    : 'border-sd-border bg-white/70 text-sd-text hover:bg-white'
                )}
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
              >
                {CATEGORY_LABELS[topic]}
              </button>
            );
          })}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <p className="eyebrow">Aplicar cambios</p>
        <p className="mt-4 text-sm leading-7 text-sd-muted">
          Regenera la ruta cuando quieras reorganizar módulos, ritmo y prioridad sin perder el contexto que ya construiste.
        </p>
        {error ? <div className="alert mt-5">{error}</div> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" type="button" onClick={onGenerateCourse} disabled={generating}>
            {generating ? 'Actualizando ruta...' : 'Actualizar ruta'}
          </Button>
        </div>
      </SurfaceCard>
    </div>
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
  const compact = compactViewport(viewport);
  const route = useMemo(
    () =>
      (Array.isArray(coursePlan?.ruta) ? coursePlan.ruta : []).map((module) => ({
        ...module,
        titulo: displayModuleTitle(module),
        descripcion: cleanText(module?.descripcion),
        actividades: (Array.isArray(module?.actividades) ? module.actividades : []).map((activity) => ({
          ...activity,
          titulo: cleanText(activity?.titulo),
        })),
      })),
    [coursePlan]
  );
  const entries = useMemo(
    () => route.map((module, index) => ({ module, index, stats: getModuleStats(module, courseProgress) })),
    [courseProgress, route]
  );
  const recommendedIndex = getRecommendedIndex(route, courseProgress);
  const recommendedEntry = entries[recommendedIndex] || null;
  const recommendedModule = recommendedEntry ? { ...recommendedEntry.module, __moduleIndex: recommendedEntry.index } : null;
  const unlockedLimit = adminAccess ? route.length - 1 : getUnlockedLimit(route, courseProgress);
  const availableLevels = LEVEL_ORDER.filter((level) => entries.some((entry) => normalizeModuleLevel(entry.module.nivel) === level));
  const defaultLevel = recommendedModule ? normalizeModuleLevel(recommendedModule.nivel) : availableLevels[0] || 'basico';
  const computed = computeCompetenciesFromProgress(coursePlan, courseProgress);
  const strongestTopic = Object.entries(computed.competencias || {}).sort((a, b) => b[1] - a[1])[0] || null;
  const [tab, setTab] = useState('ruta');
  const [level, setLevel] = useState(defaultLevel);
  const [selectedModuleId, setSelectedModuleId] = useState(recommendedModule?.id || entries[0]?.module?.id || null);
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
    if (!availableLevels.includes(level)) setLevel(defaultLevel);
  }, [availableLevels, defaultLevel, level]);

  useEffect(() => {
    const currentLevelEntries = entries.filter((entry) => normalizeModuleLevel(entry.module.nivel) === level);
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
      <EmptyState
        title="Primero completa tu evaluación"
        body="Necesitamos la encuesta inicial para organizar una ruta profesional y con continuidad real."
        error={error}
      />
    );
  }

  if (!coursePlan || !courseProgress) {
    return (
      <EmptyState
        title="Tu ruta todavía no está lista"
        body="Genera tu plan y aquí verás una vista clara de blindaje, módulos y progreso."
        error={error}
        actionLabel="Generar mi ruta"
        onAction={onGenerateCourse}
        generating={generating}
      />
    );
  }

  const currentLevelEntries = entries.filter((entry) => normalizeModuleLevel(entry.module.nivel) === level);
  const selectedEntry = currentLevelEntries.find((entry) => entry.module.id === selectedModuleId) || currentLevelEntries[0] || null;
  const prioritySummary = getPrioritySummary(answers, assessment);
  const completedModules = entries.filter((entry) => entry.stats.pct >= 100).length;

  return (
    <section className="sd-page-shell space-y-5 py-6 sm:space-y-6 sm:py-8">
      <SurfaceCard className="overflow-hidden bg-gradient-to-br from-white via-white/92 to-sd-accent-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[62rem]">
            <p className="eyebrow">Blindaje actual</p>
            <h1 className="sd-title mt-3">Tu ruta personalizada</h1>
            <p className="mt-4 max-w-[60ch] text-sm leading-7 text-sd-muted sm:text-base">{prioritySummary}</p>
          </div>
          {strongestTopic ? <Badge tone="accent">{`Fortaleza: ${CATEGORY_LABELS[strongestTopic[0]]}`}</Badge> : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-sd-accent/20 bg-sd-accent-soft p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Blindaje</span>
            <strong className="mt-3 block text-3xl text-sd-text">{formatPercent(computed.score_total)}</strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Módulos listos</span>
            <strong className="mt-3 block text-3xl text-sd-text">{`${completedModules}/${route.length}`}</strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Siguiente actividad</span>
            <strong className="mt-3 block text-lg text-sd-text">
              {displayActivityTitle(resumeTarget?.nextActivity, 'Ruta lista para repaso')}
            </strong>
          </div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Último acceso</span>
            <strong className="mt-3 block text-lg text-sd-text">{formatDate(courseProgress?.lastAccessAt)}</strong>
          </div>
        </div>

        <div className="mt-6">
          <JourneyStrip steps={journeySteps} />
        </div>
      </SurfaceCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <SurfaceCard>
          <p className="eyebrow">Cómo aprovechar tu ruta</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">
            Sigue este orden para no perder el ritmo
          </h2>
          <p className="mt-4 text-sm leading-7 text-sd-muted sm:text-base">
            Aquí siempre verás qué sigue, qué módulo conviene abrir y dónde retomarlo si pausaste.
          </p>
          <div className="mt-5">
            <GuideGrid items={quickGuide} />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Continuidad</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">
                {resumeTarget ? 'Continuar donde me quedé' : 'Tu ruta está lista'}
              </h2>
              <p className="mt-4 text-sm leading-7 text-sd-muted sm:text-base">
                {resumeTarget
                  ? `Retoma ${displayModuleTitle(resumeTarget.module)} y sigue con ${displayActivityTitle(resumeTarget.nextActivity)}.`
                  : 'Aquí verás el módulo que conviene abrir primero.'}
              </p>
            </div>
            {adminAccess ? <Badge tone="accent">Modo admin</Badge> : null}
          </div>

          {resumeTarget ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Módulo</span>
                  <strong className="mt-3 block text-base text-sd-text">{displayModuleTitle(resumeTarget.module)}</strong>
                </div>
                <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Avance</span>
                  <strong className="mt-3 block text-2xl text-sd-text">{formatPercent(resumeTarget.stats.pct)}</strong>
                </div>
                <div className="rounded-[22px] border border-sd-border bg-white/75 p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Siguiente</span>
                  <strong className="mt-3 block text-base text-sd-text">{displayActivityTitle(resumeTarget.nextActivity, 'Módulo listo para repaso')}</strong>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => onOpenModule(resumeTarget.moduleIndex, { restart: adminAccess && resumeTarget.stats.pct >= 100 })}
                >
                  Continuar donde me quedé
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setTab('ruta');
                    setSelectedModuleId(resumeTarget.module.id);
                  }}
                >
                  ¿Qué sigue?
                </Button>
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Panel de aprendizaje</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">Ruta, progreso y ajustes</h2>
            <p className="mt-4 max-w-[62ch] text-sm leading-7 text-sd-muted sm:text-base">
              {compact
                ? 'Modo guiado para móvil: menos carga visual, tarjetas apiladas y detalle inline.'
                : 'Vista amplia para escritorio: lista lateral con detalle persistente del módulo.'}
            </p>
          </div>
          <Badge tone="soft">{compact ? 'Modo guiado para móvil' : 'Vista amplia para escritorio'}</Badge>
        </div>
        {error ? <div className="alert mt-5">{error}</div> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map((value) => (
            <button
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-semibold transition',
                tab === value
                  ? 'border-sd-accent bg-sd-accent text-white'
                  : 'border-sd-border bg-white/70 text-sd-text hover:bg-white'
              )}
              key={value}
              type="button"
              onClick={() => setTab(value)}
            >
              {value === 'ruta' ? 'Ruta' : value === 'progreso' ? 'Progreso' : 'Ajustes'}
            </button>
          ))}
        </div>

        {tab === 'ruta' ? (
          <div className="mt-6 space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="eyebrow">{getLevelCopy(level).eyebrow}</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">{getLevelCopy(level).title}</h2>
                <p className="mt-3 text-sm leading-7 text-sd-muted sm:text-base">{getLevelCopy(level).description}</p>
              </div>
              {availableLevels.length > 1 ? <LevelBar levels={availableLevels} activeLevel={level} onChange={setLevel} /> : null}
            </div>

            {compact ? (
              <div className="space-y-4">
                {currentLevelEntries.map((entry) => {
                  const locked = adminAccess ? false : entry.index > unlockedLimit;
                  const unlockMessage = entries[unlockedLimit]?.module?.titulo
                    ? `Completa "${displayModuleTitle(entries[unlockedLimit].module)}" para desbloquear este bloque.`
                    : 'Completa el bloque anterior para avanzar.';

                  return (
                    <div className="space-y-3" key={entry.module.id}>
                      <ModuleListItem
                        entry={entry}
                        selected={selectedEntry?.module.id === entry.module.id}
                        locked={locked}
                        recommended={entry.index === recommendedIndex}
                        adminAccess={adminAccess}
                        onSelect={() => setSelectedModuleId(entry.module.id)}
                      />
                      {selectedEntry?.module.id === entry.module.id ? (
                        <ModuleDetail
                          entry={entry}
                          locked={locked}
                          recommended={entry.index === recommendedIndex}
                          adminAccess={adminAccess}
                          unlockMessage={unlockMessage}
                          onOpenModule={onOpenModule}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
                <div className="space-y-3">
                  {currentLevelEntries.map((entry) => (
                    <ModuleListItem
                      key={entry.module.id}
                      entry={entry}
                      selected={selectedEntry?.module.id === entry.module.id}
                      locked={adminAccess ? false : entry.index > unlockedLimit}
                      recommended={entry.index === recommendedIndex}
                      adminAccess={adminAccess}
                      onSelect={() => setSelectedModuleId(entry.module.id)}
                    />
                  ))}
                </div>
                <ModuleDetail
                  entry={selectedEntry}
                  locked={selectedEntry ? (adminAccess ? false : selectedEntry.index > unlockedLimit) : false}
                  recommended={selectedEntry?.index === recommendedIndex}
                  adminAccess={adminAccess}
                  unlockMessage={entries[unlockedLimit]?.module?.titulo ? `Completa "${displayModuleTitle(entries[unlockedLimit].module)}" para desbloquear este bloque.` : 'Completa el bloque anterior para avanzar.'}
                  onOpenModule={onOpenModule}
                />
              </div>
            )}
          </div>
        ) : null}

        {tab === 'progreso' ? (
          <div className="mt-6">
            <ProgressTab
              computed={computed}
              progress={courseProgress}
              coursePlan={coursePlan}
              coursePrefs={coursePrefs}
              answers={answers}
              assessment={assessment}
            />
          </div>
        ) : null}

        {tab === 'ajustes' ? (
          <div className="mt-6">
            <SettingsTab
              coursePrefs={coursePrefs}
              onCoursePrefsChange={onCoursePrefsChange}
              onGenerateCourse={onGenerateCourse}
              generating={generating}
              error={error}
            />
          </div>
        ) : null}
      </SurfaceCard>
    </section>
  );
}
