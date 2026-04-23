import AuthenticatedRouteContainer from './AuthenticatedRouteContainer.jsx';
import PublicRouteContainer from './PublicRouteContainer.jsx';
import SessionLoadingRouteContainer from './SessionLoadingRouteContainer.jsx';
import { getRouteMeta } from '../shells/navigationPolicy.js';

export default function resolveActiveRoute({
  shellFamily,
  viewport,
  auth,
  assessment,
  course,
  isAdmin,
  wantsAdminCourseAccess,
  analytics,
  analyticsLoading,
  analyticsError,
  onLoadAdminAnalytics,
  onExportAnalytics,
}) {
  if (auth.sessionLoading) {
    const routeMeta = getRouteMeta('loading', { isAdmin });

    return {
      routeKey: routeMeta.id,
      routeMeta,
      slots: {
        primary: <SessionLoadingRouteContainer shellFamily={shellFamily} routeMeta={routeMeta} />,
        secondary: null,
      },
    };
  }

  if (!auth.currentUser) {
    const routeMeta = getRouteMeta('auth', { isAdmin });

    return {
      routeKey: routeMeta.id,
      routeMeta,
      slots: {
        primary: (
          <PublicRouteContainer
            shellFamily={shellFamily}
            viewport={viewport}
            routeMeta={routeMeta}
            authProps={{
              mode: auth.authMode,
              email: auth.authEmail,
              password: auth.authPassword,
              error: auth.authError,
              submitting: auth.authSubmitting,
              onModeChange: auth.setAuthMode,
              onEmailChange: auth.setAuthEmail,
              onPasswordChange: auth.setAuthPassword,
              onSubmit: auth.handleAuthSubmit,
            }}
          />
        ),
        secondary: null,
      },
    };
  }

  const routeMeta = getRouteMeta(course.currentView, { isAdmin });

  return {
    routeKey: routeMeta.id,
    routeMeta,
    slots: {
      primary: (
        <AuthenticatedRouteContainer
          shellFamily={shellFamily}
          viewport={viewport}
          currentView={routeMeta.id}
          isAdmin={isAdmin}
          routeMeta={routeMeta}
          surveyProps={{
            answers: assessment.answers,
            visibleQuestions: assessment.visibleQuestions,
            surveyIndex: assessment.surveyIndex,
            surveyStage: assessment.surveyStage,
            assessment: assessment.assessment,
            courseError: course.courseError,
            resultLead:
              assessment.assessment?.resumen ||
              'Te mostraremos un resumen claro de tu riesgo y de la ruta que mejor encaja contigo.',
            validationError: assessment.validationError,
            flowError: assessment.flowError,
            onAnswerChange: assessment.handleAnswerChange,
            onPrev: assessment.handleSurveyPrevious,
            onNext: assessment.handleSurveyNext,
            onRestart: assessment.handleSurveyRestart,
            onTakeCourses: () =>
              course.openCourses({
                answers: assessment.answers,
                assessment: assessment.assessment,
                authToken: auth.authToken,
                adminAccess: wantsAdminCourseAccess,
              }),
          }}
          coursesProps={{
            answers: assessment.answers,
            assessment: assessment.assessment,
            coursePlan: course.coursePlan,
            courseProgress: course.courseProgress,
            coursePrefs: course.coursePrefs,
            adminAccess: wantsAdminCourseAccess,
            generating: course.generatingCourse,
            error: course.courseError,
            onCoursePrefsChange: course.setCoursePrefs,
            onGenerateCourse: () =>
              course.generateCourse({
                answers: assessment.answers,
                assessment: assessment.assessment,
                authToken: auth.authToken,
                adminAccess: wantsAdminCourseAccess,
                reset: Boolean(course.coursePlan),
              }),
            onOpenModule: course.openModule,
          }}
          lessonProps={{
            coursePlan: course.coursePlan,
            courseProgress: course.courseProgress,
            currentLesson: course.currentLesson,
            answers: assessment.answers,
            assessment: assessment.assessment,
            onBackToCourses: () => course.setCurrentView('courses'),
            onRestartModule: course.restartModule,
            onCompleteActivity: course.completeActivity,
          }}
          adminProps={{
            analytics,
            loading: analyticsLoading,
            error: analyticsError,
            onBack: () =>
              course.setCurrentView(course.coursePlan && course.courseProgress ? 'courses' : 'survey'),
            onRefresh: onLoadAdminAnalytics,
            onExport: onExportAnalytics,
          }}
        />
      ),
      secondary: null,
    },
  };
}
