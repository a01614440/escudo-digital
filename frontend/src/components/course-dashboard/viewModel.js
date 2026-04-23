import {
  ACTIVITY_LABELS,
  CATEGORY_LABELS,
  normalizeModuleTitleForDisplay,
  repairPossibleMojibake,
} from '../../lib/course.js';

export const cleanText = (value, fallback = '') =>
  repairPossibleMojibake(String(value || '')).trim() || fallback;

export const displayModuleTitle = (module) =>
  normalizeModuleTitleForDisplay(module?.categoria, module?.titulo || module?.title || '');

export const displayActivityTitle = (activity, fallback = 'Actividad') =>
  cleanText(ACTIVITY_LABELS[activity?.tipo] || activity?.titulo || fallback, fallback);

export const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

export const formatMinutesFromMs = (value) => {
  const minutes = (Number(value) || 0) / 60000;
  if (!minutes) return 'Sin tiempo';
  if (minutes < 1) return '<1 min';
  if (minutes < 10) return `${minutes.toFixed(1)} min`;
  return `${Math.round(minutes)} min`;
};

export function getModuleStats(module, progress) {
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  const completedEntries = activities
    .map((activity) => progress?.completed?.[activity.id])
    .filter(Boolean);
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
    nextActivity:
      activities.find((activity) => !progress?.completed?.[activity.id]) || activities[0] || null,
    status: pct >= 100 ? 'completed' : completedCount > 0 ? 'active' : 'pending',
  };
}

export function getRecommendedIndex(route, progress) {
  const idx = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return idx === -1 ? 0 : idx;
}

export function getUnlockedLimit(route, progress) {
  const idx = route.findIndex((module) => getModuleStats(module, progress).pct < 100);
  return idx === -1 ? route.length - 1 : idx;
}

export function getPrioritySummary(answers, assessment) {
  const priority = String(answers?.priority || '').toLowerCase();

  if (priority === 'todo') {
    return 'Tu ruta cubre varios frentes, pero con un orden claro para no saturarte.';
  }

  if (priority && CATEGORY_LABELS[priority]) {
    return `Tu foco actual esta en ${CATEGORY_LABELS[priority].toLowerCase()}, asi que empezamos por ahi.`;
  }

  if (assessment?.nivel) {
    return `La ruta se ajusto a tu evaluacion ${String(assessment.nivel).toLowerCase()} y a tu progreso reciente.`;
  }

  return 'La ruta prioriza avanzar con criterio antes de abrir modulos mas complejos.';
}

export function buildResumeTarget(entries) {
  const entry = entries.find((item) => item.stats.pct < 100) || entries[0] || null;
  if (!entry) return null;

  return {
    moduleIndex: entry.index,
    module: entry.module,
    nextActivity: entry.stats.nextActivity,
    stats: entry.stats,
  };
}

export function getModuleStatusLabel(status) {
  if (status === 'completed') return 'Completado';
  if (status === 'active') return 'En curso';
  return 'Pendiente';
}

export function getModuleStatusTone(status) {
  if (status === 'completed') return 'success';
  if (status === 'active') return 'accent';
  return 'neutral';
}
