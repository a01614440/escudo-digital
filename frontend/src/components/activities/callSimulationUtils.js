import { buildActivityFeedbackPayload, formatActivityPercent } from '../../lib/activityFeedback.js';
import { getDecisionRatingLabel } from '../../lib/activityScoring.js';
import { repairPossibleMojibake } from '../../lib/course.js';

export const DEFAULT_CALL_STARTER_CHOICES = [
  'No voy a dar datos por llamada.',
  '¿De qué institución hablas exactamente?',
  'Voy a colgar y verificar por mi cuenta.',
];

export const VOICE_HINTS = {
  female: /(female|mujer|paulina|helena|sofia|samantha|monica|maria|lucia|carmen|paola|google español)/i,
  male: /(male|man|jorge|diego|carlos|raul|mario|daniel|alejandro|google español de estados unidos)/i,
};

export function clampCallScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

export function formatCallScore(score) {
  return formatActivityPercent(clampCallScore(score));
}

export function formatCallDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const remainder = String(safe % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function cleanCallText(value, fallback = '') {
  return repairPossibleMojibake(String(value || fallback || '')).trim();
}

export function normalizeCallChoices(choices, fallbackChoices = []) {
  const source = Array.isArray(choices) && choices.length ? choices : fallbackChoices;
  return source
    .map((choice) => cleanCallText(choice))
    .filter(Boolean)
    .slice(0, 3);
}

export function buildCallScenarioContext(activity) {
  return [
    `Escenario: ${cleanCallText(activity?.scenarioPrompt || activity?.intro || activity?.titulo || 'Llamada fraudulenta')}`,
    `Tipo de fraude: ${cleanCallText(activity?.fraudType || 'vishing')}`,
    `Nivel: ${cleanCallText(activity?.difficultyTone || 'refuerzo')}`,
    `Apertura del estafador: ${cleanCallText(activity?.opening || '')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function collectDetectedSignals(analyses) {
  return [...new Set(analyses.map((item) => cleanCallText(item?.signal_detected)).filter(Boolean))].slice(0, 3);
}

function buildMissedSignals({ analyses, detectedSignals, finalReason }) {
  const missed = [];
  const unsafeTurns = analyses.filter((item) => clampCallScore(item?.score) < 0.66).length;

  if (!detectedSignals.length) {
    missed.push('La presión por resolver todo dentro de la misma llamada.');
  }

  if (unsafeTurns > 0) {
    missed.push('Cortar antes de seguir contestando cuando aparecen prisa, códigos o amenazas.');
  }

  if (finalReason !== 'hung_up') {
    missed.push('Salir del canal apenas notes autoridad falsa o una petición urgente de datos.');
  }

  return [...new Set(missed)].slice(0, 3);
}

export function buildCallEndSummary({ analyses, finalReason, transcript }) {
  const safeAnalyses = Array.isArray(analyses) ? analyses : [];
  const safeTranscript = Array.isArray(transcript) ? transcript : [];
  const avgScore = safeAnalyses.length
    ? safeAnalyses.reduce((total, item) => total + clampCallScore(item?.score), 0) / safeAnalyses.length
    : finalReason === 'hung_up'
      ? 1
      : 0.72;
  const lastAnalysis = safeAnalyses[safeAnalyses.length - 1] || {};
  const detectedSignals = collectDetectedSignals(safeAnalyses);
  const safeTurns = safeAnalyses.filter((item) => clampCallScore(item?.score) >= 0.75).length;
  const turnCount = safeAnalyses.length;
  const action = cleanCallText(
    lastAnalysis?.safe_action,
    'Cuelga, entra tú mismo a la app o llama al número oficial desde un canal que tú controles.'
  );
  const signal = cleanCallText(
    detectedSignals[0],
    'La llamada buscaba mantenerte en el canal con presión, autoridad falsa y urgencia.'
  );
  const risk = cleanCallText(
    lastAnalysis?.risk,
    'El mayor riesgo es seguir resolviendo dentro de la misma llamada y darle más margen al atacante.'
  );
  const title = getDecisionRatingLabel(avgScore);
  const missed = buildMissedSignals({
    analyses: safeAnalyses,
    detectedSignals,
    finalReason,
  });
  const extra = cleanCallText(
    lastAnalysis?.coach_feedback,
    finalReason === 'hung_up'
      ? 'Cortar la llamada también cuenta como una decisión segura cuando ya viste presión o una petición de datos.'
      : 'La siguiente meta es cortar antes y verificar por tu cuenta, sin intentar resolver nada dentro del mismo canal.'
  );

  return {
    avgScore,
    scoreText: formatCallScore(avgScore),
    safeTurns,
    turnCount,
    transcriptPreview: safeTranscript.slice(-4),
    headline:
      finalReason === 'hung_up'
        ? 'Recuperaste el control del canal'
        : safeTurns >= Math.max(1, Math.ceil(Math.max(turnCount, 1) / 2))
          ? 'Tuviste buen criterio, pero aún puedes cortar antes'
          : 'La llamada te mantuvo demasiado tiempo dentro del canal',
    statusNote:
      finalReason === 'hung_up'
        ? 'Colgaste a tiempo y evitaste seguir el ritmo del atacante.'
        : 'Terminaste la práctica, pero la regla segura sigue siendo salir del canal apenas detectes presión o petición de datos.',
    nextStepLabel: finalReason === 'hung_up' ? 'Verifica por otro canal' : 'Corta antes la próxima vez',
    feedback: buildActivityFeedbackPayload({
      title,
      score: avgScore,
      signal:
        safeTurns > 0
          ? `Detectaste una señal clave: ${signal}`
          : `Ya viste el contexto principal: ${signal}`,
      risk,
      action,
      extra,
      detected: detectedSignals,
      missed,
    }),
  };
}
