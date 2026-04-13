import { repairPossibleMojibake } from './course.js';

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function cleanAnalyticsText(value, fallback = 'Sin dato') {
  const text = repairPossibleMojibake(String(value || '')).trim();
  return text || fallback;
}

export function formatAnalyticsValue(value, { suffix = '', fallback = '0' } = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return cleanAnalyticsText(value, fallback);

  const rounded = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
  return `${rounded}${suffix}`;
}

export function getPeakValue(items, valueKey = 'value') {
  return Math.max(...(Array.isArray(items) ? items : []).map((item) => safeNumber(item?.[valueKey])), 1);
}

export function normalizeAnalyticsItems(
  items,
  { labelKey = 'label', valueKey = 'value', limit = null } = {}
) {
  const normalized = (Array.isArray(items) ? items : []).map((item, index) => ({
    key: `${cleanAnalyticsText(item?.[labelKey], 'Sin dato')}-${index}`,
    label: cleanAnalyticsText(item?.[labelKey], 'Sin dato'),
    value: safeNumber(item?.[valueKey]),
    raw: item || {},
  }));

  return Number.isFinite(limit) ? normalized.slice(0, limit) : normalized;
}

export function buildAdminOverviewCards(overview = {}) {
  return [
    {
      label: 'Usuarios totales',
      value: formatAnalyticsValue(overview.totalUsers),
      note: `${formatAnalyticsValue(overview.activeUsers7d)} activos en los ultimos 7 dias`,
    },
    {
      label: 'Blindaje promedio',
      value: formatAnalyticsValue(overview.averageShield, { suffix: '%' }),
      note: `Mejora media: ${formatAnalyticsValue(overview.averageImprovement)} puntos`,
    },
    {
      label: 'Finalizacion de modulos',
      value: formatAnalyticsValue(overview.moduleCompletionRate, { suffix: '%' }),
      note: `Actividades completadas: ${formatAnalyticsValue(overview.activityCompletionRate, { suffix: '%' })}`,
    },
    {
      label: 'Dias para mejorar',
      value:
        overview.avgDaysToImprove === null || overview.avgDaysToImprove === undefined
          ? 'Sin dato'
          : formatAnalyticsValue(overview.avgDaysToImprove),
      note: 'Promedio para superar el nivel base',
    },
  ];
}

export function buildAdminHighlights(analytics = {}) {
  const topRisk = normalizeAnalyticsItems(analytics?.vulnerabilityByTopic, {
    labelKey: 'label',
    valueKey: 'vulnerableCount',
    limit: 1,
  })[0];
  const topPerformance = normalizeAnalyticsItems(analytics?.topicPerformance, {
    labelKey: 'label',
    valueKey: 'avgScore',
    limit: 1,
  })[0];
  const topAgeBucket = normalizeAnalyticsItems(analytics?.ageBuckets, {
    labelKey: 'label',
    valueKey: 'count',
    limit: 1,
  })[0];

  return [
    topRisk
      ? {
          label: 'Mayor vulnerabilidad',
          value: `${topRisk.label} ${formatAnalyticsValue(topRisk.value)}`,
        }
      : null,
    topPerformance
      ? {
          label: 'Mejor desempeno',
          value: `${topPerformance.label} ${formatAnalyticsValue(topPerformance.value, { suffix: '%' })}`,
        }
      : null,
    topAgeBucket
      ? {
          label: 'Segmento mas activo',
          value: `${topAgeBucket.label} ${formatAnalyticsValue(topAgeBucket.value)} usuarios`,
        }
      : null,
  ].filter(Boolean);
}
