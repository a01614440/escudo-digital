import { postJson } from '../lib/api.js';

export function requestAssessment(answers, options = {}) {
  return postJson('/api/assess', { answers }, options);
}

export function generateCoursePlan(
  { answers, assessment, prefs, progress, adminAccess = false },
  options = {}
) {
  return postJson(
    '/api/course',
    {
      answers,
      assessment,
      prefs,
      progress,
      adminAccess,
    },
    options
  );
}

export function gradeOpenAnswer({ prompt, answer, module, activity, user }, options = {}) {
  return postJson(
    '/api/course/grade-open',
    {
      prompt,
      answer,
      module,
      activity,
      user,
    },
    options
  );
}

export function requestSimulationTurn(
  { scenario, history, userMessage, turn, turnos_max, user },
  options = {}
) {
  return postJson(
    '/api/course/sim-turn',
    {
      scenario,
      history,
      userMessage,
      turn,
      turnos_max,
      user,
    },
    options
  );
}
