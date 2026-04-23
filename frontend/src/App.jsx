import { useEffect, useMemo, useState } from 'react';
import { useAssessmentFlow } from './hooks/useAssessmentFlow.js';
import { useAuthSession } from './hooks/useAuthSession.js';
import { useChatSession } from './hooks/useChatSession.js';
import { useCourseProgress } from './hooks/useCourseProgress.js';
import { useRemoteProgressSync } from './hooks/useRemoteProgressSync.js';
import { createInitialLearningState, createRemoteStatePayload } from './lib/courseRules.js';
import { clearLocalState, writeLocalState } from './lib/storage.js';
import { useDeviceProfile } from './providers/DeviceProfileProvider.jsx';
import resolveActiveRoute from './route-containers/resolveActiveRoute.jsx';
import DeviceShell from './shells/DeviceShell.jsx';
import buildShellSlots from './shells/buildShellSlots.jsx';
import { buildNavigationModel, normalizeRequestedView } from './shells/navigationPolicy.js';
import {
  downloadAnalyticsSnapshot,
  fetchAdminAnalytics,
} from './services/progressService.js';

export default function App() {
  const initial = useMemo(() => createInitialLearningState(), []);
  const device = useDeviceProfile();
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

  const isAdmin = auth.currentUser?.role === 'admin';
  const wantsAdminCourseAccess = isAdmin && !adminPreviewAsUser;

  const loadAdminAnalytics = async () => {
    if (!isAdmin || !auth.authToken) return;

    setAnalyticsLoading(true);
    setAnalyticsError('');

    try {
      const response = await fetchAdminAnalytics(auth.authToken);
      setAnalytics(response);
    } catch (error) {
      setAnalyticsError(error.message || 'No se pudieron cargar las metricas.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleViewChange = (view) => {
    const nextView = normalizeRequestedView(view, { isAdmin });
    if (!nextView) return;
    course.setCurrentView(nextView);
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
    if (!isAdmin && adminPreviewAsUser) {
      setAdminPreviewAsUser(false);
    }
  }, [adminPreviewAsUser, isAdmin]);

  useEffect(() => {
    if (adminPreviewAsUser && course.currentView === 'admin') {
      course.setCurrentView(course.coursePlan && course.courseProgress ? 'courses' : 'survey');
    }
  }, [adminPreviewAsUser, course.coursePlan, course.courseProgress, course.currentView]);

  useEffect(() => {
    if (course.currentView === 'admin' && isAdmin) {
      loadAdminAnalytics();
    }
  }, [isAdmin, course.currentView]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [course.currentView, assessment.surveyStage, course.currentLesson.moduleIndex]);

  useEffect(() => {
    if (
      !assessment.assessment ||
      !auth.currentUser ||
      course.generatingCourse ||
      course.currentView === 'survey'
    ) {
      return;
    }

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
    course.currentView,
    course.coursePlan?.planScope,
    course.generatingCourse,
    wantsAdminCourseAccess,
  ]);

  const routeDefinition = useMemo(
    () =>
      resolveActiveRoute({
        shellFamily: device.shellFamily,
        viewport: device.viewport,
        auth,
        assessment,
        course,
        isAdmin,
        wantsAdminCourseAccess,
        analytics,
        analyticsLoading,
        analyticsError,
        onLoadAdminAnalytics: loadAdminAnalytics,
        onExportAnalytics: () => downloadAnalyticsSnapshot(analytics),
      }),
    [
      analytics,
      analyticsError,
      analyticsLoading,
      assessment,
      auth,
      course,
      device.shellFamily,
      device.viewport,
      isAdmin,
      wantsAdminCourseAccess,
    ]
  );

  const navigation = useMemo(
    () =>
      buildNavigationModel({
        currentView: routeDefinition.routeKey,
        isAdmin,
        currentUser: auth.currentUser,
      }),
    [auth.currentUser, isAdmin, routeDefinition.routeKey]
  );

  const shellSlots = useMemo(
    () =>
      buildShellSlots({
        device,
        auth,
        chat,
        navigation,
        routeDefinition,
        adminPreviewAsUser,
        onNavigate: handleViewChange,
        onThemeToggle: device.toggleTheme,
        onToggleAdminPreview: () => setAdminPreviewAsUser((current) => !current),
        onLogout: auth.handleLogout,
      }),
    [adminPreviewAsUser, auth, chat, device, navigation, routeDefinition]
  );

  return (
    <DeviceShell
      shellFamily={device.shellFamily}
      routeKey={routeDefinition.routeKey}
      routeIntent={routeDefinition.routeMeta.shellIntent}
      header={shellSlots.header}
      primary={shellSlots.primary}
      secondary={shellSlots.secondary}
      floating={shellSlots.floating}
      overlay={shellSlots.overlay}
    />
  );
}
