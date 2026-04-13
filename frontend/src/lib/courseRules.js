import { questions } from '../data/questions.js';
import {
  COURSE_PLAN_VERSION,
  ensureCourseProgress,
  ensureCourseState,
  getModuleAndActivity,
} from './course.js';
import { readLocalState } from './storage.js';

export const DEFAULT_LESSON_POSITION = {
  moduleIndex: 0,
  activityIndex: 0,
};

export const SURVEY_STAGES = ['survey', 'loading', 'results'];

export function createInitialLearningState() {
  const local = readLocalState();
  const safePlan =
    local.coursePlan && Number(local.coursePlan?.planVersion) === COURSE_PLAN_VERSION
      ? ensureCourseState(local.coursePlan)
      : null;
  const safeProgress = safePlan
    ? ensureCourseProgress(safePlan, { seed: local.courseProgress })
    : null;

  return {
    answers: local.answers || {},
    assessment: local.assessment || null,
    coursePlan: safePlan,
    courseProgress: safeProgress,
  };
}

export function isSurveyAnswerValid(question, answers) {
  if (!question) return true;
  const value = answers?.[question.id];
  if (question.type === 'text') return Boolean(String(value || '').trim().length > 3);
  if (question.type === 'multi') return Array.isArray(value) && value.length > 0;
  return Boolean(value);
}

export function getVisibleQuestions(answers) {
  return questions.filter((question) => !question.showIf || question.showIf(answers));
}

export function normalizeLessonPosition(value) {
  return value && typeof value === 'object'
    ? {
        moduleIndex: Number.isFinite(Number(value.moduleIndex))
          ? Math.max(0, Number(value.moduleIndex))
          : 0,
        activityIndex: Number.isFinite(Number(value.activityIndex))
          ? Math.max(0, Number(value.activityIndex))
          : 0,
      }
    : { ...DEFAULT_LESSON_POSITION };
}

export function deriveSurveyStage(state) {
  if (SURVEY_STAGES.includes(state?.surveyStage)) return state.surveyStage;
  return state?.assessment ? 'results' : 'survey';
}

export function coerceSurveyIndex(index, answers) {
  const visibleQuestions = getVisibleQuestions(answers);
  const safeIndex = Number.isFinite(Number(index)) ? Math.max(0, Number(index)) : 0;
  return Math.min(safeIndex, Math.max(visibleQuestions.length - 1, 0));
}

export function createSafeCourseState(state) {
  const safePlan =
    state?.coursePlan && Number(state.coursePlan?.planVersion) === COURSE_PLAN_VERSION
      ? ensureCourseState(state.coursePlan)
      : null;
  const safeProgress = safePlan
    ? ensureCourseProgress(safePlan, { seed: state?.courseProgress })
    : null;

  return { safePlan, safeProgress };
}

export function deriveCurrentView({
  requestedView,
  user,
  coursePlan,
  courseProgress,
  assessment,
  currentLesson,
}) {
  if (requestedView === 'admin' && user?.role === 'admin') return 'admin';
  if (
    requestedView === 'lesson' &&
    coursePlan &&
    courseProgress &&
    getModuleAndActivity(
      coursePlan,
      currentLesson?.moduleIndex || 0,
      currentLesson?.activityIndex || 0
    )
  ) {
    return 'lesson';
  }
  if ((requestedView === 'courses' || requestedView === 'lesson') && coursePlan && courseProgress) {
    return 'courses';
  }
  if (assessment) return 'survey';
  return 'survey';
}

export function createRemoteStatePayload({
  answers,
  assessment,
  coursePlan,
  courseProgress,
  currentView,
  surveyStage,
  surveyIndex,
  currentLesson,
}) {
  return {
    answers,
    assessment,
    coursePlan,
    courseProgress,
    currentView,
    surveyStage,
    surveyIndex,
    currentLesson,
  };
}
