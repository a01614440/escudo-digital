import { normalizeModuleLevel } from './course.js';

const LEVEL_PROFILES = {
  basico: {
    lightPenalty: 0.08,
    mediumPenalty: 0.18,
    heavyPenalty: 0.34,
    falsePositivePenalty: 0.08,
    falseNegativePenalty: 0.22,
  },
  refuerzo: {
    lightPenalty: 0.12,
    mediumPenalty: 0.24,
    heavyPenalty: 0.42,
    falsePositivePenalty: 0.12,
    falseNegativePenalty: 0.28,
  },
  avanzado: {
    lightPenalty: 0.16,
    mediumPenalty: 0.3,
    heavyPenalty: 0.48,
    falsePositivePenalty: 0.16,
    falseNegativePenalty: 0.34,
  },
};

const HIGH_RISK_PATTERNS = [
  'transfer',
  'deposit',
  'pagar',
  'pago',
  'tarjeta',
  'contraseña',
  'password',
  'codigo',
  'código',
  'token',
  'otp',
  'enlace',
  'link',
  'abrir',
  'descargar',
];

const LOW_RISK_PATTERNS = [
  'esperar',
  'verificar',
  'llamar',
  'confirmar',
  'pausar',
  'revisar',
  'ignorar',
  'cerrar',
];

const CRITICAL_TARGET_PATTERNS = ['domain', 'pago', 'payment', 'checkout', 'policy', 'address_form'];
const SUSPICIOUS_TARGET_PATTERNS = ['banner', 'shipping', 'reviews', 'contacto', 'order_summary'];

function getLevelProfile(module) {
  return LEVEL_PROFILES[normalizeModuleLevel(module?.nivel || module?.level)] || LEVEL_PROFILES.basico;
}

export function classifyDecisionBand(score) {
  const safe = Math.max(0, Math.min(1, Number(score) || 0));
  if (safe >= 0.85) return 'clear_success';
  if (safe >= 0.66) return 'partial_success';
  if (safe >= 0.42) return 'minor_error';
  return 'major_error';
}

export function getDecisionRatingLabel(score) {
  const band = classifyDecisionBand(score);
  if (band === 'clear_success' || band === 'partial_success') return 'Buena';
  if (band === 'minor_error') return 'Riesgosa';
  return 'Incorrecta';
}

export function inferActionRiskSeverity(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized.trim()) return 'moderate';
  if (LOW_RISK_PATTERNS.some((pattern) => normalized.includes(pattern))) return 'low';
  if (HIGH_RISK_PATTERNS.some((pattern) => normalized.includes(pattern))) return 'high';
  return 'moderate';
}

export function scoreChoiceDecision({ isCorrect, module, selectedText }) {
  if (isCorrect) return 1;

  const profile = getLevelProfile(module);
  const severity = inferActionRiskSeverity(selectedText);
  const penalty =
    severity === 'low'
      ? profile.lightPenalty
      : severity === 'high'
        ? profile.heavyPenalty
        : profile.mediumPenalty;
  return Math.max(0.22, 1 - penalty - 0.12);
}

export function scoreSelectionAccuracy({
  correctCount,
  falsePositives,
  falseNegatives,
  module,
  minimumFloor = 0.28,
}) {
  const profile = getLevelProfile(module);
  const normalizedCorrect = Math.max(0, Number(correctCount) || 0);
  const normalizedFalsePositives = Math.max(0, Number(falsePositives) || 0);
  const normalizedFalseNegatives = Math.max(0, Number(falseNegatives) || 0);
  const totalRelevant = normalizedCorrect + normalizedFalseNegatives;

  if (!totalRelevant) return 1;

  const base = normalizedCorrect / totalRelevant;
  const penalty =
    normalizedFalsePositives * profile.falsePositivePenalty +
    normalizedFalseNegatives * profile.falseNegativePenalty;

  return Math.max(minimumFloor, Math.min(1, base - penalty + normalizedCorrect * 0.05));
}

export function inferHotspotSeverity(hotspot = {}) {
  const target = String(hotspot?.target || '').toLowerCase();
  const label = String(hotspot?.label || '').toLowerCase();
  const source = `${target} ${label}`;

  if (hotspot?.severity === 'critical' || CRITICAL_TARGET_PATTERNS.some((pattern) => source.includes(pattern))) {
    return 'critical';
  }

  if (hotspot?.severity === 'suspicious' || SUSPICIOUS_TARGET_PATTERNS.some((pattern) => source.includes(pattern))) {
    return 'suspicious';
  }

  return 'informational';
}

export function scoreHotspotDecision({
  hotspots,
  flagged,
  neutralTargets,
  module,
  decision,
  decisionOptions,
  correctDecision,
}) {
  const correctHotspots = hotspots.filter((item) => item.correcta);
  const matched = correctHotspots.filter((item) => flagged.has(item.target));
  const falsePositives = Array.from(neutralTargets).length;
  const falseNegatives = correctHotspots.length - matched.length;
  const criticalTotal = correctHotspots.filter((item) => inferHotspotSeverity(item) === 'critical').length;
  const criticalMatched = matched.filter((item) => inferHotspotSeverity(item) === 'critical').length;
  const accuracyScore = scoreSelectionAccuracy({
    correctCount: matched.length,
    falsePositives,
    falseNegatives,
    module,
    minimumFloor: 0.22,
  });

  const criticalCoverage = criticalTotal ? criticalMatched / criticalTotal : 1;
  const decisionScore =
    Number.isFinite(Number(correctDecision)) && decisionOptions.length
      ? decision === Number(correctDecision)
        ? 1
        : decision === null
          ? 0.35
          : 0.5
      : 1;

  return Math.max(
    0.2,
    Math.min(1, accuracyScore * 0.6 + criticalCoverage * 0.25 + decisionScore * 0.15)
  );
}
