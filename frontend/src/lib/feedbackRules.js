export function clampScore(score) {
  const safe = Number(score);
  if (!Number.isFinite(safe)) return 0;
  return Math.max(0, Math.min(1, safe));
}

export function formatScorePercent(score) {
  return `${Math.round(clampScore(score) * 100)}%`;
}

export function buildFeedbackPayload({
  title,
  score,
  signal,
  risk,
  action,
  extra,
  detected,
  missed,
}) {
  return {
    title,
    score,
    signal,
    risk,
    action,
    extra,
    detected,
    missed,
  };
}

export function buildCompletionPayload(startedAtRef, score, feedback, details = null) {
  return {
    score,
    feedback,
    details,
    durationMs: Math.max(0, Date.now() - startedAtRef.current),
  };
}
