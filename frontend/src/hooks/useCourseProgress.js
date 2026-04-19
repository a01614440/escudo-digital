import { useEffect, useState } from 'react';
import {
  COURSE_PLAN_VERSION,
  ensureCourseProgress,
  ensureCourseState,
  getModuleAndActivity,
  normalizeCoursePrefs,
  pickNextActivityIndex,
  withCompletedActivity,
  withSeenScenario,
  withVisitedLesson,
} from '../lib/course.js';
import {
  createSafeCourseState,
  DEFAULT_LESSON_POSITION,
  deriveCurrentView,
  normalizeLessonPosition,
} from '../lib/courseRules.js';
import { generateCoursePlan } from '../services/courseService.js';

export function useCourseProgress({
  initialCoursePlan = null,
  initialCourseProgress = null,
  initialAnswers = {},
  initialAssessment = null,
}) {
  const [coursePlan, setCoursePlan] = useState(initialCoursePlan);
  const [courseProgress, setCourseProgress] = useState(initialCourseProgress);
  const [coursePrefs, setCoursePrefs] = useState(() => normalizeCoursePrefs({}, initialAnswers));
  const [generatingCourse, setGeneratingCourse] = useState(false);
  const [courseError, setCourseError] = useState('');
  const [currentView, setCurrentView] = useState(
    initialCoursePlan && initialCourseProgress ? 'courses' : 'survey'
  );
  const [currentLesson, setCurrentLesson] = useState({ ...DEFAULT_LESSON_POSITION });

  const syncPrefsWithAnswers = (answers) => {
    setCoursePrefs((current) => normalizeCoursePrefs(current, answers || {}));
  };

  const resetCourseExperience = () => {
    setCoursePlan(null);
    setCourseProgress(null);
    setCoursePrefs(normalizeCoursePrefs({}, {}));
    setGeneratingCourse(false);
    setCourseError('');
    setCurrentView('survey');
    setCurrentLesson({ ...DEFAULT_LESSON_POSITION });
  };

  const applyRemoteCourseState = ({ user, state, assessment = null }) => {
    const { safePlan, safeProgress } = createSafeCourseState(state);
    const safeLesson = normalizeLessonPosition(state?.currentLesson);

    setCoursePlan(safePlan);
    setCourseProgress(safeProgress);
    setCurrentLesson(safeLesson);
    setCurrentView(
      deriveCurrentView({
        requestedView: state?.currentView,
        user,
        coursePlan: safePlan,
        courseProgress: safeProgress,
        assessment: state?.assessment || assessment || initialAssessment,
        currentLesson: safeLesson,
      })
    );
    setCoursePrefs((current) => normalizeCoursePrefs(current, state?.answers || {}));
    setCourseError('');

    return { safePlan, safeProgress, safeLesson };
  };

  const generateCourse = async ({
    answers,
    assessment,
    authToken = '',
    adminAccess = false,
    reset = false,
  }) => {
    if (!assessment) {
      setCurrentView('survey');
      return null;
    }

    const normalizedPrefs = normalizeCoursePrefs(coursePrefs, answers);
    const seedProgress = reset ? null : courseProgress;
    const previousPlan = coursePlan;
    const previousProgress = courseProgress;
    setGeneratingCourse(true);
    setCourseError('');

    try {
      const response = await generateCoursePlan(
        {
          answers,
          assessment,
          prefs: normalizedPrefs,
          progress: seedProgress,
          adminAccess,
        },
        { authToken }
      );
      const safePlan = ensureCourseState(response);
      const safeProgress = ensureCourseProgress(safePlan, {
        reset,
        seed: seedProgress,
      });

      setCoursePlan(safePlan);
      setCourseProgress(safeProgress);
      setCoursePrefs(normalizedPrefs);
      setCurrentView('courses');

      return { safePlan, safeProgress };
    } catch (error) {
      setCoursePlan(previousPlan || null);
      setCourseProgress(previousProgress || null);
      if (previousPlan && previousProgress) {
        setCurrentView('courses');
      }
      setCourseError(
        error.message ||
          'No pudimos armar tu ruta en este momento. Puedes reintentar con "Generar mi ruta" sin perder tu avance actual.'
      );
      return null;
    } finally {
      setGeneratingCourse(false);
    }
  };

  const openCourses = async ({ answers, assessment, authToken = '', adminAccess = false }) => {
    const planMatchesCurrentMode =
      Boolean(coursePlan?.planScope === 'admin_full') === Boolean(adminAccess);

    if (
      !coursePlan ||
      !courseProgress ||
      coursePlan.planVersion !== COURSE_PLAN_VERSION ||
      !planMatchesCurrentMode
    ) {
      setCurrentView('courses');
      setCourseError('');
      return generateCourse({
        answers,
        assessment,
        authToken,
        adminAccess,
        reset: true,
      });
    }

    setCurrentView('courses');
    setCourseError('');
    return { safePlan: coursePlan, safeProgress: courseProgress };
  };

  const completeActivity = ({ score, feedback, details }) => {
    if (!coursePlan) return;

    setCourseProgress((current) =>
      withCompletedActivity({
        plan: coursePlan,
        progress: current,
        moduleIndex: currentLesson.moduleIndex,
        activityIndex: currentLesson.activityIndex,
        score,
        feedback,
        details,
      })
    );
    setCurrentLesson((current) => ({
      ...current,
      activityIndex: current.activityIndex + 1,
    }));
  };

  const openModule = (moduleIndex, options = {}) => {
    if (!coursePlan || !courseProgress) return;

    const restart = Boolean(options?.restart);
    setCurrentLesson({
      moduleIndex,
      activityIndex: restart ? 0 : pickNextActivityIndex(coursePlan, courseProgress, moduleIndex),
    });
    setCurrentView('lesson');
  };

  const restartModule = () => {
    setCurrentLesson((current) => ({ ...current, activityIndex: 0 }));
  };

  useEffect(() => {
    if (currentView !== 'lesson' || !coursePlan || !courseProgress) return;

    const info = getModuleAndActivity(
      coursePlan,
      currentLesson.moduleIndex || 0,
      currentLesson.activityIndex || 0
    );

    if (!info?.activity) return;

    setCourseProgress((current) => {
      let next = withVisitedLesson(
        coursePlan,
        current,
        currentLesson.moduleIndex,
        currentLesson.activityIndex
      );
      next = withSeenScenario(next, info.module, info.activity);
      return next;
    });
  }, [coursePlan, currentLesson.activityIndex, currentLesson.moduleIndex, currentView]);

  return {
    coursePlan,
    courseProgress,
    coursePrefs,
    setCoursePrefs,
    generatingCourse,
    courseError,
    currentView,
    setCurrentView,
    currentLesson,
    setCurrentLesson,
    syncPrefsWithAnswers,
    resetCourseExperience,
    applyRemoteCourseState,
    generateCourse,
    openCourses,
    completeActivity,
    openModule,
    restartModule,
  };
}
