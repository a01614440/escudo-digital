import { useEffect, useMemo, useState } from 'react';
import AdminView from './components/AdminView.jsx';
import AuthView from './components/AuthView.jsx';
import ChatDrawer from './components/ChatDrawer.jsx';
import CoursesView from './components/CoursesView.jsx';
import LessonView from './components/LessonView.jsx';
import SessionBar from './components/SessionBar.jsx';
import SurveyView from './components/SurveyView.jsx';
import SurfaceCard from './components/ui/SurfaceCard.jsx';
import { createInitialLearningState, createRemoteStatePayload } from './lib/courseRules.js';
import { clearLocalState, writeLocalState } from './lib/storage.js';
import { useAssessmentFlow } from './hooks/useAssessmentFlow.js';
import { useAuthSession } from './hooks/useAuthSession.js';
import { useChatSession } from './hooks/useChatSession.js';
import { useCourseProgress } from './hooks/useCourseProgress.js';
import { useRemoteProgressSync } from './hooks/useRemoteProgressSync.js';
import { useResponsiveLayout } from './hooks/useResponsiveLayout.js';
import {
  downloadAnalyticsSnapshot,
  fetchAdminAnalytics,
} from './services/progressService.js';

function SessionLoadingView() {
  return (
    <main className="page sd-page-shell">
      <SurfaceCard padding="lg" className="mx-auto max-w-3xl">
        <p className="eyebrow">Cargando</p>
        <h1 className="sd-title max-w-[12ch]">Restaurando sesión</h1>
        <p className="lead sd-subtitle">Estamos recuperando tu información guardada.</p>
      </SurfaceCard>
    </main>
  );
}

export default function App() {
  const initial = useMemo(() => createInitialLearningState(), []);
  const responsive = useResponsiveLayout();
  const chat = useChatSession();
  const course = useCourseProgress({
    initialCoursePlan: initial.coursePlan,
    initialCourseProgress: initial.courseProgress,
    initialAnswers: initial.answers,
    initialAssessment: initial.assessment,
  });

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [adminPreviewAsUser, setAdminPreviewAsUser] = useState(false);

  const assessment = useAssessmentFlow({
    initialAnswers: initial.answers,
    initialAssessment: initial.assessment,
    onAssessmentReady: (_response, answers) => {
      course.syncPrefsWithAnswers(answers);
    },
    onResetJourney: () => {
      course.resetCourseExperience();
      setAnalytics(null);
      setAnalyticsError('');
      chat.resetChat();
      setAdminPreviewAsUser(false);
    },
  });

  const resetExperience = () => {
    clearLocalState();
    assessment.resetSurveyState();
    course.resetCourseExperience();
    setAnalytics(null);
    setAnalyticsError('');
    chat.resetChat();
    setAdminPreviewAsUser(false);
  };

  const auth = useAuthSession({
    onAuthenticated: (user, state) => {
      remoteSync.pauseSync();
      assessment.applyRemoteSurveyState(state);
      course.applyRemoteCourseState({
        user,
        state,
        assessment: state?.assessment || null,
      });
      chat.closeChat();
      remoteSync.resumeSync();
    },
    onResetAfterLogout: () => {
      remoteSync.pauseSync();
      resetExperience();
    },
  });

  const statePayload = useMemo(
    () =>
      createRemoteStatePayload({
        answers: assessment.answers,
        assessment: assessment.assessment,
        coursePlan: course.coursePlan,
        courseProgress: course.courseProgress,
        currentView: course.currentView,
        surveyStage: assessment.surveyStage,
        surveyIndex: assessment.surveyIndex,
        currentLesson: course.currentLesson,
      }),
    [
      assessment.answers,
      assessment.assessment,
      assessment.surveyIndex,
      assessment.surveyStage,
      course.coursePlan,
      course.courseProgress,
      course.currentLesson,
      course.currentView,
    ]
  );

  const remoteSync = useRemoteProgressSync({
    currentUser: auth.currentUser,
    authToken: auth.authToken,
    statePayload,
    onUserRefresh: auth.setCurrentUser,
  });

  const wantsAdminCourseAccess = auth.currentUser?.role === 'admin' && !adminPreviewAsUser;

  const loadAdminAnalytics = async () => {
    if (auth.currentUser?.role !== 'admin' || !auth.authToken) return;

    setAnalyticsLoading(true);
    setAnalyticsError('');

    try {
      const response = await fetchAdminAnalytics(auth.authToken);
      setAnalytics(response);
    } catch (error) {
      setAnalyticsError(error.message || 'No se pudieron cargar las métricas.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleViewChange = (view) => {
    if (view === 'admin') {
      if (auth.currentUser?.role === 'admin') {
        course.setCurrentView('admin');
      }
      return;
    }

    course.setCurrentView(view === 'lesson' ? 'courses' : view);
  };

  useEffect(() => {
    writeLocalState({
      answers: assessment.answers,
      assessment: assessment.assessment,
      coursePlan: course.coursePlan,
      courseProgress: course.courseProgress,
    });
  }, [assessment.answers, assessment.assessment, course.coursePlan, course.courseProgress]);

  useEffect(() => {
    if (auth.currentUser?.role !== 'admin' && adminPreviewAsUser) {
      setAdminPreviewAsUser(false);
    }
  }, [adminPreviewAsUser, auth.currentUser?.role]);

  useEffect(() => {
    if (adminPreviewAsUser && course.currentView === 'admin') {
      course.setCurrentView(course.coursePlan && course.courseProgress ? 'courses' : 'survey');
    }
  }, [adminPreviewAsUser, course.coursePlan, course.courseProgress, course.currentView]);

  useEffect(() => {
    if (course.currentView === 'admin' && auth.currentUser?.role === 'admin') {
      loadAdminAnalytics();
    }
  }, [auth.currentUser?.role, course.currentView]);

  useEffect(() => {
    if (!assessment.assessment || !auth.currentUser || course.generatingCourse) return;

    const currentScope = course.coursePlan?.planScope === 'admin_full' ? 'admin_full' : 'standard';
    const expectedScope = wantsAdminCourseAccess ? 'admin_full' : 'standard';

    if (currentScope !== expectedScope) {
      course.generateCourse({
        answers: assessment.answers,
        assessment: assessment.assessment,
        authToken: auth.authToken,
        adminAccess: wantsAdminCourseAccess,
        reset: true,
      });
    }
  }, [
    assessment.answers,
    assessment.assessment,
    auth.authToken,
    auth.currentUser,
    course.coursePlan?.planScope,
    course.generatingCourse,
    wantsAdminCourseAccess,
  ]);

  if (auth.sessionLoading) {
    return <SessionLoadingView />;
  }

  if (!auth.currentUser) {
    return (
      <AuthView
        viewport={responsive.viewport}
        mode={auth.authMode}
        email={auth.authEmail}
        password={auth.authPassword}
        error={auth.authError}
        submitting={auth.authSubmitting}
        onModeChange={auth.setAuthMode}
        onEmailChange={auth.setAuthEmail}
        onPasswordChange={auth.setAuthPassword}
        onSubmit={auth.handleAuthSubmit}
      />
    );
  }

  return (
    <>
      <main
        className={`page app-shell app-shell-${responsive.viewport} app-view-${course.currentView}`}
      >
        <SessionBar
          viewport={responsive.viewport}
          user={auth.currentUser}
          currentView={course.currentView}
          theme={responsive.theme}
          adminPreviewAsUser={adminPreviewAsUser}
          onViewChange={handleViewChange}
          onThemeToggle={responsive.toggleTheme}
          onToggleAdminPreview={() => setAdminPreviewAsUser((current) => !current)}
          onLogout={auth.handleLogout}
        />

        {course.currentView === 'survey' ? (
          <SurveyView
            viewport={responsive.viewport}
            answers={assessment.answers}
            visibleQuestions={assessment.visibleQuestions}
            surveyIndex={assessment.surveyIndex}
            surveyStage={assessment.surveyStage}
            assessment={assessment.assessment}
            resultLead={
              assessment.assessment?.resumen ||
              'Te mostraremos un resumen claro de tu riesgo y de la ruta que mejor encaja contigo.'
            }
            validationError={assessment.validationError}
            flowError={assessment.flowError}
            onAnswerChange={assessment.handleAnswerChange}
            onPrev={assessment.handleSurveyPrevious}
            onNext={assessment.handleSurveyNext}
            onRestart={assessment.handleSurveyRestart}
            onTakeCourses={() =>
              course.openCourses({
                answers: assessment.answers,
                assessment: assessment.assessment,
                authToken: auth.authToken,
                adminAccess: wantsAdminCourseAccess,
              })
            }
          />
        ) : null}

        {course.currentView === 'courses' ? (
          <CoursesView
            viewport={responsive.viewport}
            answers={assessment.answers}
            assessment={assessment.assessment}
            coursePlan={course.coursePlan}
            courseProgress={course.courseProgress}
            coursePrefs={course.coursePrefs}
            adminAccess={wantsAdminCourseAccess}
            generating={course.generatingCourse}
            error={course.courseError}
            onCoursePrefsChange={course.setCoursePrefs}
            onGenerateCourse={() =>
              course.generateCourse({
                answers: assessment.answers,
                assessment: assessment.assessment,
                authToken: auth.authToken,
                adminAccess: wantsAdminCourseAccess,
                reset: Boolean(course.coursePlan),
              })
            }
            onOpenModule={course.openModule}
          />
        ) : null}

        {course.currentView === 'lesson' ? (
          <LessonView
            viewport={responsive.viewport}
            coursePlan={course.coursePlan}
            currentLesson={course.currentLesson}
            answers={assessment.answers}
            assessment={assessment.assessment}
            onBackToCourses={() => course.setCurrentView('courses')}
            onRestartModule={course.restartModule}
            onCompleteActivity={course.completeActivity}
          />
        ) : null}

        {course.currentView === 'admin' && auth.currentUser.role === 'admin' ? (
          <AdminView
            viewport={responsive.viewport}
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onBack={() =>
              course.setCurrentView(course.coursePlan && course.courseProgress ? 'courses' : 'survey')
            }
            onRefresh={loadAdminAnalytics}
            onExport={() => downloadAnalyticsSnapshot(analytics)}
          />
        ) : null}
      </main>

      {course.currentView !== 'admin' ? (
        <>
          <button
            className={`chat-fab ${chat.chatOpen ? 'hidden' : ''}`}
            type="button"
            onClick={() => chat.setChatOpen(true)}
          >
            Chat
          </button>
          <ChatDrawer
            viewport={responsive.viewport}
            open={chat.chatOpen}
            messages={chat.chatMessages}
            input={chat.chatInput}
            busy={chat.chatBusy}
            onInputChange={chat.setChatInput}
            onClose={chat.closeChat}
            onSubmit={chat.handleChatSubmit}
          />
        </>
      ) : null}
    </>
  );
}

