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
    ? Math.round((completedEntries.reduce((acc, item) => acc + (Number(item.score) || 0), 0) / completedEntries.length) * 100)
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
  if (priority === 'todo') return 'Ruta amplia para cubrir varios frentes con un orden claro.';
  if (priority && CATEGORY_LABELS[priority]) return `Tu enfoque actual prioriza ${CATEGORY_LABELS[priority].toLowerCase()}.`;
  if (assessment?.nivel) return `La ruta se ajusto a tu evaluacion ${String(assessment.nivel).toLowerCase()} y a tu progreso reciente.`;
  return 'La ruta prioriza avanzar con criterio antes de abrir modulos mas complejos.';
}

function EmptyState({ title, body, error, actionLabel, onAction, generating }) {
  return (
    <section className="sd-page-shell py-8 sm:py-10">
      <SurfaceCard className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Ruta personalizada</p>
        <h1 className="sd-title mt-3">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-sd-muted sm:text-base">{body}</p>
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
            {`Modulo ${entry.index + 1}`}
          </p>
          <strong className="mt-2 block text-base text-sd-text">
            {displayModuleTitle(entry.module)}
          </strong>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {recommended ? <Badge tone="accent">Recomendado</Badge> : null}
          {adminAccess ? <Badge tone="soft">Admin</Badge> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="neutral">{CATEGORY_LABELS[entry.module.categoria] || 'Curso'}</Badge>
        <Badge tone="neutral">{formatPercent(entry.stats.pct)}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-sd-muted">
        {cleanText(entry.module.descripcion, 'Bloque practico para reforzar criterio y habitos.')}
      </p>
    </button>
  );
}

function ModuleDetail({ entry, locked, recommended, adminAccess = false, unlockMessage, onOpenModule }) {
  if (!entry) {
    return (
      <SurfaceCard>
        <p className="eyebrow">Ruta</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">Elige un modulo</h2>
      </SurfaceCard>
    );
  }

  const { module, index, stats } = entry;
  return (
    <SurfaceCard className="lg:sticky lg:top-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{`Modulo ${index + 1}`}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">
            {displayModuleTitle(module)}
          </h2>
          <p className="mt-4 text-sm leading-7 text-sd-muted">
            {cleanText(module.descripcion, 'Bloque practico para detectar senales y repetir una rutina segura.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recommended ? <Badge tone="accent">Recomendado</Badge> : null}
          <Badge tone="neutral">{CATEGORY_LABELS[module.categoria] || 'Curso'}</Badge>
          <Badge tone="neutral">{LEVEL_LABELS[normalizeModuleLevel(module.nivel)] || 'Nivel'}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Avance</span><strong className="mt-3 block text-2xl text-sd-text">{formatPercent(stats.pct)}</strong></div>
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Score</span><strong className="mt-3 block text-2xl text-sd-text">{stats.avgScore ? formatPercent(stats.avgScore) : 'Sin score'}</strong></div>
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Visitas</span><strong className="mt-3 block text-2xl text-sd-text">{stats.visits || 0}</strong></div>
        <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Tiempo</span><strong className="mt-3 block text-2xl text-sd-text">{stats.durationLabel}</strong></div>
      </div>

      <div className="mt-5 rounded-[24px] border border-sd-border bg-white/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Actividades del modulo</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Array.isArray(module.actividades) ? module.actividades : []).map((activity) => (
            <span className="rounded-full border border-sd-border bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-sd-muted" key={activity.id}>
              {displayActivityTitle(activity)}
            </span>
          ))}
        </div>
      </div>

      {locked ? <div className="mt-5 rounded-[20px] border border-amber-300/70 bg-amber-50/90 px-4 py-4 text-sm leading-6 text-amber-900">{unlockMessage}</div> : null}
      {adminAccess ? <div className="mt-5 rounded-[20px] border border-sd-border bg-white/65 px-4 py-4 text-sm leading-6 text-sd-muted">Modo admin activo: puedes abrir o repetir este modulo sin bloqueos.</div> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="primary" type="button" disabled={locked} onClick={() => onOpenModule(index, { restart: adminAccess && stats.pct >= 100 })}>
          {locked ? 'Bloqueado' : adminAccess && stats.pct >= 100 ? 'Repetir modulo' : stats.completedCount ? 'Continuar' : 'Abrir modulo'}
        </Button>
      </div>
    </SurfaceCard>
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
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Fortaleza principal</span><strong className="mt-3 block text-lg text-sd-text">{strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} ${formatPercent(strongestTopic[1])}` : 'Sin datos'}</strong></div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Zona a reforzar</span><strong className="mt-3 block text-lg text-sd-text">{weakestTopic ? `${CATEGORY_LABELS[weakestTopic[0]]} ${formatPercent(weakestTopic[1])}` : 'Sin datos'}</strong></div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Prioridad declarada</span><strong className="mt-3 block text-lg text-sd-text">{getPrioritySummary(answers, assessment)}</strong></div>
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
              <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sd-accent" style={{ width: `${computed.competencias?.[topic] || 0}%` }} /></div>
            </div>
          ))}
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <p className="eyebrow">Evolucion</p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Ultimo acceso</span><strong className="mt-3 block text-lg text-sd-text">{formatDate(progress?.lastAccessAt)}</strong></div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Fortalezas visibles</span><strong className="mt-3 block text-lg text-sd-text">{insights.strengths.length ? insights.strengths.join(' · ') : 'Sin historial suficiente'}</strong></div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Errores recurrentes</span><strong className="mt-3 block text-lg text-sd-text">{insights.mistakes.length ? insights.mistakes.join(' | ') : 'Sin tropiezos claros por ahora'}</strong></div>
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <p className="eyebrow">Ruta activa</p>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Version del plan</span><strong className="mt-3 block text-lg text-sd-text">{`Version ${coursePlan?.planVersion || 0}`}</strong></div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Preferencias</span><strong className="mt-3 block text-lg text-sd-text">{`Estilo ${coursePrefs?.estilo || 'mix'} · dificultad ${coursePrefs?.dificultad || 'auto'}`}</strong></div>
          <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Snapshots recientes</span><strong className="mt-3 block text-lg text-sd-text">{history.length ? history.map((item) => `${formatPercent(item.scoreTotal)} (${item.completedCount})`).join(' · ') : 'Completa mas actividades para ver evolucion'}</strong></div>
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
            <select className="sd-input" value={coursePrefs?.estilo || 'mix'} onChange={(event) => setField('estilo', event.target.value)}><option value="mix">Mix</option><option value="guiado">Guiado</option><option value="practico">Practico</option></select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-sd-text">
            <span>Dificultad</span>
            <select className="sd-input" value={coursePrefs?.dificultad || 'auto'} onChange={(event) => setField('dificultad', event.target.value)}><option value="auto">Auto</option><option value="facil">Facil</option><option value="normal">Normal</option><option value="avanzada">Avanzada</option></select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-sd-text">
            <span>Duracion</span>
            <select className="sd-input" value={coursePrefs?.duracion || '5-10'} onChange={(event) => setField('duracion', event.target.value)}><option value="5-10">5-10 min</option><option value="10-15">10-15 min</option><option value="15-20">15-20 min</option></select>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {TOPIC_ORDER.map((topic) => {
            const active = Array.isArray(coursePrefs?.temas) ? coursePrefs.temas.includes(topic) : false;
            return <button className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition', active ? 'border-sd-accent bg-sd-accent-soft text-sd-accent' : 'border-sd-border bg-white/70 text-sd-text hover:bg-white')} key={topic} type="button" onClick={() => toggleTopic(topic)}>{CATEGORY_LABELS[topic]}</button>;
          })}
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <p className="eyebrow">Aplicar cambios</p>
        <p className="mt-4 text-sm leading-7 text-sd-muted">Regenera la ruta cuando quieras reorganizar modulos, ritmo y prioridad sin perder contexto.</p>
        {error ? <div className="alert mt-5">{error}</div> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" type="button" onClick={onGenerateCourse} disabled={generating}>{generating ? 'Actualizando ruta...' : 'Actualizar ruta'}</Button>
        </div>
      </SurfaceCard>
    </div>
  );
}

export default function CoursesView({
  viewport = 'desktop',
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
  const insights = summarizeProgressInsights(coursePlan, courseProgress);
  const strongestTopic = Object.entries(computed.competencias || {}).sort((a, b) => b[1] - a[1])[0] || null;
  const weakestTopic = Object.entries(computed.competencias || {}).sort((a, b) => a[1] - b[1])[0] || null;
  const [tab, setTab] = useState('ruta');
  const [level, setLevel] = useState(defaultLevel);
  const [selectedModuleId, setSelectedModuleId] = useState(recommendedModule?.id || entries[0]?.module?.id || null);

  useEffect(() => {
    if (!availableLevels.includes(level)) setLevel(defaultLevel);
  }, [availableLevels, defaultLevel, level]);
  useEffect(() => {
    const currentLevelEntries = entries.filter((entry) => normalizeModuleLevel(entry.module.nivel) === level);
    if (!currentLevelEntries.some((entry) => entry.module.id === selectedModuleId)) {
      setSelectedModuleId(currentLevelEntries[0]?.module?.id || entries[0]?.module?.id || null);
    }
  }, [entries, level, selectedModuleId]);

  if (!assessment) return <EmptyState title="Primero completa tu evaluacion" body="Necesitamos la encuesta inicial para organizar una ruta profesional y con continuidad real." error={error} />;
  if (!coursePlan || !courseProgress) return <EmptyState title="Tu ruta todavia no esta lista" body="Genera tu plan y aqui veras una vista clara de blindaje, modulos y progreso." error={error} actionLabel="Generar mi ruta" onAction={onGenerateCourse} generating={generating} />;

  const currentLevelEntries = entries.filter((entry) => normalizeModuleLevel(entry.module.nivel) === level);
  const selectedEntry = currentLevelEntries.find((entry) => entry.module.id === selectedModuleId) || currentLevelEntries[0] || null;
  const prioritySummary = getPrioritySummary(answers, assessment);
  const completedModules = entries.filter((entry) => entry.stats.pct >= 100).length;

  return (
    <section className="sd-page-shell space-y-5 py-6 sm:space-y-6 sm:py-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.95fr)]">
        <SurfaceCard className="overflow-hidden bg-gradient-to-br from-white via-white/92 to-sd-accent-soft">
          <p className="eyebrow">Blindaje actual</p>
          <h1 className="sd-title mt-3">Vista general de tu ruta</h1>
          <p className="mt-4 max-w-[58ch] text-sm leading-7 text-sd-muted sm:text-base">{prioritySummary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-sd-accent/20 bg-sd-accent-soft p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Blindaje</span><strong className="mt-3 block text-3xl text-sd-text">{formatPercent(computed.score_total)}</strong></div>
            <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Ruta activa</span><strong className="mt-3 block text-3xl text-sd-text">{`${completedModules}/${route.length}`}</strong></div>
            <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Fortaleza</span><strong className="mt-3 block text-lg text-sd-text">{strongestTopic ? `${CATEGORY_LABELS[strongestTopic[0]]} ${formatPercent(strongestTopic[1])}` : 'Sin datos'}</strong></div>
            <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Ultimo acceso</span><strong className="mt-3 block text-lg text-sd-text">{formatDate(courseProgress?.lastAccessAt)}</strong></div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Siguiente paso recomendado</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-sd-text">{recommendedModule ? displayModuleTitle(recommendedModule) : 'Tu ruta esta lista'}</h2>
              <p className="mt-4 text-sm leading-7 text-sd-muted sm:text-base">{recommendedModule ? cleanText(recommendedModule.descripcion, 'Bloque practico para reforzar criterio y repetir una rutina segura.') : 'Aqui veras el modulo que conviene abrir primero.'}</p>
            </div>
            {adminAccess ? <Badge tone="accent">Modo admin</Badge> : null}
          </div>
          {recommendedEntry ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Avance</span><strong className="mt-3 block text-2xl text-sd-text">{formatPercent(recommendedEntry.stats.pct)}</strong></div>
                <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Score</span><strong className="mt-3 block text-2xl text-sd-text">{recommendedEntry.stats.avgScore ? formatPercent(recommendedEntry.stats.avgScore) : 'Sin score'}</strong></div>
                <div className="rounded-[22px] border border-sd-border bg-white/75 p-4"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">Siguiente</span><strong className="mt-3 block text-base text-sd-text">{displayActivityTitle(recommendedEntry.stats.nextActivity, 'Modulo listo para repaso')}</strong></div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" type="button" onClick={() => onOpenModule(recommendedModule.__moduleIndex, { restart: adminAccess && recommendedEntry.stats.pct >= 100 })}>
                  {adminAccess && recommendedEntry.stats.pct >= 100 ? 'Repetir modulo' : recommendedEntry.stats.completedCount ? 'Continuar modulo' : 'Abrir modulo'}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setTab('ruta')}>Ver ruta completa</Button>
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Panel de aprendizaje</p>
            <h1 className="sd-title mt-3">Ruta de cursos</h1>
            <p className="mt-4 max-w-[62ch] text-sm leading-7 text-sd-muted sm:text-base">{compact ? 'Modo guiado para movil con tarjetas apiladas y menos carga visual.' : 'Vista amplia para escritorio con lista lateral y detalle persistente del modulo.'}</p>
          </div>
          <Badge tone="soft">{compact ? 'Modo guiado para movil' : 'Vista amplia para escritorio'}</Badge>
        </div>
        {error ? <div className="alert mt-5">{error}</div> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map((value) => (
            <button className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition', tab === value ? 'border-sd-accent bg-sd-accent text-white' : 'border-sd-border bg-white/70 text-sd-text hover:bg-white')} key={value} type="button" onClick={() => setTab(value)}>
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
