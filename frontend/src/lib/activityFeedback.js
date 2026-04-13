import {
  buildCompletionPayload,
  buildFeedbackPayload,
  formatScorePercent,
} from './feedbackRules.js';

export function completeActivityPayload(startedAtRef, score, feedback, details = null) {
  return buildCompletionPayload(startedAtRef, score, feedback, details);
}

export function buildActivityFeedbackPayload({
  title,
  score,
  signal,
  risk,
  action,
  extra,
  detected,
  missed,
}) {
  return buildFeedbackPayload({ title, score, signal, risk, action, extra, detected, missed });
}

export function formatActivityPercent(score) {
  return formatScorePercent(score);
}
