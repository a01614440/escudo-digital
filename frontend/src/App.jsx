import { useEffect, useMemo, useRef, useState } from 'react';
import AdminView from './components/AdminView.jsx';
import AuthView from './components/AuthView.jsx';
import ChatDrawer from './components/ChatDrawer.jsx';
import CoursesView from './components/CoursesView.jsx';
import LessonView from './components/LessonView.jsx';
import SessionBar from './components/SessionBar.jsx';
import SurveyView from './components/SurveyView.jsx';
import { questions } from './data/questions.js';
import { apiRequest, postJson } from './lib/api.js';
import {
  COURSE_PLAN_VERSION,
  defaultTopicsFromAnswers,
  ensureCourseProgress,
  ensureCourseState,
  getModuleAndActivity,
  normalizeCoursePrefs,
  pickNextActivityIndex,
  withCompletedActivity,
  withSeenScenario,
  withVisitedLesson,
} from './lib/course.js';
import {
  clearLocalState,
  readLocalState,
  readSessionToken,
  readThemePreference,
  writeLocalState,
  writeSessionToken,
  writeThemePreference,
} from './lib/storage.js';

function createInitialState() {
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

function isSurveyAnswerValid(question, answers) {
  if (!question) return true;
  const value = answers?.[question.id];
  if (question.type === 'text') return Boolean(String(value || '').trim().length > 3);
  if (question.type === 'multi') return Array.isArray(value) && value.length > 0;
  return Boolean(value);
}

function getVisibleQuestions(answers) {
  return questions.filter((question) => !question.showIf || question.showIf(answers));
}

function deriveCurrentView({ requestedView, user, coursePlan, courseProgress, assessment, currentLesson }) {
  if (requestedView === 'admin' && user?.role === 'admin') return 'admin';
  if (
    requestedView === 'lesson' &&
    coursePlan &&
    courseProgress &&
    getModuleAndActivity(coursePlan, currentLesson?.moduleIndex || 0, currentLesson?.activityIndex || 0)
  ) {
    return 'lesson';
  }
  if ((requestedView === 'courses' || requestedView === 'lesson') && coursePlan && courseProgress) {
    return 'courses';
  }
  if (assessment) return 'survey';
  return 'survey';
}

function getViewportProfile(width) {
  const safeWidth = Number(width) || 0;
  if (safeWidth <= 420) return 'phone-small';
  if (safeWidth <= 640) return 'phone';
  if (safeWidth <= 820) return 'tablet-compact';
  if (safeWidth <= 1024) return 'tablet';
  if (safeWidth <= 1280) return 'laptop';
  return 'desktop';
}

export default function App() {
  const initial = useMemo(() => createInitialState(), []);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(Boolean(readSessionToken()));

  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(readSessionToken());

  const [answers, setAnswers] = useState(initial.answers);
  const [assessment, setAssessment] = useState(initial.assessment);
  const [surveyStage, setSurveyStage] = useState(initial.assessment ? 'results' : 'survey');
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [validationError, setValidationError] = useState('');

  const [coursePlan, setCoursePlan] = useState(initial.coursePlan);
  const [courseProgress, setCourseProgress] = useState(initial.courseProgress);
  const [coursePrefs, setCoursePrefs] = useState(() => normalizeCoursePrefs({}, initial.answers));
  const [generatingCourse, setGeneratingCourse] = useState(false);

  const [currentView, setCurrentView] = useState(
    initial.coursePlan && initial.courseProgress ? 'courses' : 'survey'
  );
  const [currentLesson, setCurrentLesson] = useState({ moduleIndex: 0, activityIndex: 0 });

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [theme, setTheme] = useState(readThemePreference());
  const [adminPreviewAsUser, setAdminPreviewAsUser] = useState(false);
  const wantsAdminCourseAccess = currentUser?.role === 'admin' && !adminPreviewAsUser;

  const visibleQuestions = useMemo(() => getVisibleQuestions(answers), [answers]);

  const suspendSyncRef = useRef(true);
  const syncTimerRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const latestPayloadRef = useRef(null);

  const statePayload = useMemo(
    () => ({
      answers,
      assessment,
      coursePlan,
      courseProgress,
      currentView,
      surveyStage,
      surveyIndex,
      currentLesson,
    }),
    [answers, assessment, coursePlan, courseProgress, currentView, surveyStage, surveyIndex, currentLesson]
  );

  latestPayloadRef.current = statePayload;

  const applyRemoteState = (user, state) => {
    const safePlan =
      state?.coursePlan && Number(state.coursePlan?.planVersion) === COURSE_PLAN_VERSION
        ? ensureCourseState(state.coursePlan)
        : null;
    const safeProgress = safePlan
      ? ensureCourseProgress(safePlan, { seed: state?.courseProgress })
      : null;
    const safeLesson =
      state?.currentLesson && typeof state.currentLesson === 'object'
        ? {
            moduleIndex: Number.isFinite(Number(state.currentLesson.moduleIndex))
              ? Math.max(0, Number(state.currentLesson.moduleIndex))
              : 0,
            activityIndex: Number.isFinite(Number(state.currentLesson.activityIndex))
              ? Math.max(0, Number(state.currentLesson.activityIndex))
              : 0,
          }
        : { moduleIndex: 0, activityIndex: 0 };

    setAnswers(state?.answers && typeof state.answers === 'object' ? state.answers : {});
    setAssessment(state?.assessment || null);
    setCoursePlan(safePlan);
    setCourseProgress(safeProgress);
    setSurveyStage(
      ['survey', 'loading', 'results'].includes(state?.surveyStage)
        ? state.surveyStage
        : state?.assessment
          ? 'results'
          : 'survey'
    );
    setSurveyIndex(
      Number.isFinite(Number(state?.surveyIndex)) ? Math.max(0, Number(state.surveyIndex)) : 0
    );
    setCurrentLesson(safeLesson);
    setCurrentView(
      deriveCurrentView({
        requestedView: state?.currentView,
        user,
        coursePlan: safePlan,
        courseProgress: safeProgress,
        assessment: state?.assessment || null,
        currentLesson: safeLesson,
      })
    );
    setCoursePrefs((current) => normalizeCoursePrefs(current, state?.answers || {}));
  };

  const setSession = (token, user) => {
    setAuthToken(token || '');
    setCurrentUser(user || null);
    writeSessionToken(token || '');
  };

  const resetAppState = () => {
    clearLocalState();
    setAnswers({});
    setAssessment(null);
    setSurveyStage('survey');
    setSurveyIndex(0);
    setCoursePlan(null);
    setCourseProgress(null);
    setCurrentView('survey');
    setCurrentLesson({ moduleIndex: 0, activityIndex: 0 });
    setAnalytics(null);
    setAnalyticsError('');
    setChatMessages([]);
    setChatInput('');
    setChatOpen(false);
    setCoursePrefs(normalizeCoursePrefs({}, {}));
  };

  const runRemoteSync = async () => {
    if (!currentUser || !authToken || suspendSyncRef.current) return;
    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    try {
      const response = await apiRequest('/api/user/state', {
        method: 'POST',
        payload: latestPayloadRef.current,
        authToken,
      });
      if (response?.user) {
        setCurrentUser(response.user);
      }
    } catch (error) {
      console.warn('No se pudo sincronizar el progreso:', error.message);
    } finally {
      syncInFlightRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        runRemoteSync();
      }
    }
  };

  const loadAdminAnalytics = async () => {
    if (currentUser?.role !== 'admin' || !authToken) return;
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const response = await apiRequest('/api/admin/analytics', {
        method: 'GET',
        authToken,
      });
      setAnalytics(response);
    } catch (error) {
      setAnalyticsError(error.message || 'No se pudieron cargar las metricas.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await apiRequest('/api/auth/logout', { method: 'POST', payload: {}, authToken });
      }
    } catch {
      // ignore
    }
    setSession('', null);
    resetAppState();
    setAuthMode('login');
    setAdminPreviewAsUser(false);
  };

  const handleAuthSuccess = (data) => {
    suspendSyncRef.current = true;
    setSession(data.token, data.user);
    applyRemoteState(data.user, data.state || {});
    setAuthPassword('');
    setAuthError('');
    setChatOpen(false);
    window.setTimeout(() => {
      suspendSyncRef.current = false;
    }, 0);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!authEmail.trim() || !authPassword) return;

    setAuthSubmitting(true);
    setAuthError('');
    try {
      const response = await apiRequest(
        authMode === 'login' ? '/api/auth/login' : '/api/auth/register',
        {
          method: 'POST',
          payload: { email: authEmail.trim(), password: authPassword },
          includeAuth: false,
        }
      );
      handleAuthSuccess(response);
    } catch (error) {
      setAuthError(error.message || 'No se pudo iniciar sesion.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const generateCourse = async ({ reset = false } = {}) => {
    if (!assessment) {
      setCurrentView('survey');
      return;
    }

    const normalizedPrefs = normalizeCoursePrefs(coursePrefs, answers);
    const requestAdminAccess = Boolean(wantsAdminCourseAccess);
    const seedProgress = reset ? null : courseProgress;
    setGeneratingCourse(true);
    try {
      const response = await postJson(
        '/api/course',
        {
          answers,
          assessment,
          prefs: normalizedPrefs,
          progress: seedProgress,
          adminAccess: requestAdminAccess,
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
    } catch (error) {
      window.alert(`No se pudo generar el curso: ${error.message}`);
      setCoursePlan(null);
      setCourseProgress(null);
    } finally {
      setGeneratingCourse(false);
    }
  };

  const handleTakeCourses = async () => {
    const planMatchesCurrentMode =
      Boolean(coursePlan?.planScope === 'admin_full') === Boolean(wantsAdminCourseAccess);
    if (!coursePlan || !courseProgress || coursePlan.planVersion !== COURSE_PLAN_VERSION || !planMatchesCurrentMode) {
      await generateCourse({ reset: true });
      return;
    }
    setCurrentView('courses');
  };

  const handleViewChange = (view) => {
    if (view === 'admin') {
      if (currentUser?.role === 'admin') {
        setCurrentView('admin');
      }
      return;
    }
    setCurrentView(view === 'lesson' ? 'courses' : view);
  };

  const handleLessonComplete = ({ score, feedback, details, durationMs }) => {
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
        durationMs,
      })
    );
    setCurrentLesson((current) => ({
      ...current,
      activityIndex: current.activityIndex + 1,
    }));
  };

  const handleOpenModule = (moduleIndex, options = {}) => {
    if (!coursePlan || !courseProgress) return;
    const restart = Boolean(options?.restart);
    setCurrentLesson({
      moduleIndex,
      activityIndex: restart ? 0 : pickNextActivityIndex(coursePlan, courseProgress, moduleIndex),
    });
    setCurrentView('lesson');
  };

  const handleRestartModule = () => {
    setCurrentLesson((current) => ({ ...current, activityIndex: 0 }));
  };

  const handleAnswerChange = (questionId, value) => {
    setValidationError('');
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const handleSurveyNext = async () => {
    const question = visibleQuestions[surveyIndex];
    if (!isSurveyAnswerValid(question, answers)) {
      setValidationError('Completa esta respuesta antes de avanzar.');
      return;
    }

    setValidationError('');
    if (surveyIndex < visibleQuestions.length - 1) {
      setSurveyIndex((current) => current + 1);
      return;
    }

    setSurveyStage('loading');
    try {
      const response = await postJson('/api/assess', { answers });
      setAssessment(response);
      setSurveyStage('results');
      setCoursePrefs((current) => normalizeCoursePrefs(current, answers));
    } catch (error) {
      setSurveyStage('survey');
      window.alert(`No se pudo generar el assessment: ${error.message}`);
    }
  };

  const handleSurveyRestart = () => {
    setAnswers({});
    setAssessment(null);
    setCoursePlan(null);
    setCourseProgress(null);
    setSurveyIndex(0);
    setSurveyStage('survey');
    setCurrentView('survey');
    setValidationError('');
    setCoursePrefs(normalizeCoursePrefs({}, {}));
  };

  const handleChatSubmit = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const nextMessages = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatBusy(true);
    try {
      const response = await postJson('/api/chat', {
        messages: nextMessages.map((message) => ({
          role: message.role === 'bot' ? 'assistant' : 'user',
          content: message.content,
        })),
      });
      setChatMessages((current) => [
        ...current,
        { role: 'bot', content: response?.reply || 'No tengo respuesta en este momento.' },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current,
        { role: 'bot', content: `No pude conectar con la IA. ${error.message || 'Intenta de nuevo.'}` },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  useEffect(() => {
    writeLocalState({ answers, assessment, coursePlan, courseProgress });
  }, [answers, assessment, coursePlan, courseProgress]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const applyViewportProfile = () => {
      const viewport = getViewportProfile(window.innerWidth);
      document.body.dataset.viewport = viewport;
      document.body.dataset.inputMode =
        ['phone-small', 'phone', 'tablet-compact', 'tablet'].includes(viewport) ? 'touch' : 'pointer';
    };

    applyViewportProfile();
    window.addEventListener('resize', applyViewportProfile, { passive: true });

    return () => {
      window.removeEventListener('resize', applyViewportProfile);
      delete document.body.dataset.viewport;
      delete document.body.dataset.inputMode;
    };
  }, []);

  useEffect(() => {
    if (surveyIndex > visibleQuestions.length - 1) {
      setSurveyIndex(Math.max(visibleQuestions.length - 1, 0));
    }
  }, [surveyIndex, visibleQuestions.length]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      if (!authToken) {
        setSessionLoading(false);
        suspendSyncRef.current = false;
        return;
      }

      try {
        const response = await apiRequest('/api/auth/session', {
          method: 'GET',
          authToken,
        });
        if (cancelled) return;
        suspendSyncRef.current = true;
        setCurrentUser(response.user);
        applyRemoteState(response.user, response.state || {});
        window.setTimeout(() => {
          suspendSyncRef.current = false;
        }, 0);
      } catch (error) {
        if (cancelled) return;
        console.warn('Sesion previa no disponible:', error.message);
        setSession('', null);
        resetAppState();
        setAuthMode('login');
        suspendSyncRef.current = false;
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!currentUser || !authToken || suspendSyncRef.current) return undefined;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      runRemoteSync();
    }, 350);
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [authToken, currentUser, statePayload]);

  useEffect(() => {
    if (currentView !== 'lesson' || !coursePlan || !courseProgress) return;
    const info = getModuleAndActivity(
      coursePlan,
      currentLesson.moduleIndex || 0,
      currentLesson.activityIndex || 0
    );
    if (!info || !info.activity) return;
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

  useEffect(() => {
    if (currentView === 'admin' && currentUser?.role === 'admin') {
      loadAdminAnalytics();
    }
  }, [currentUser?.role, currentView]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' && adminPreviewAsUser) {
      setAdminPreviewAsUser(false);
    }
  }, [adminPreviewAsUser, currentUser?.role]);

  useEffect(() => {
    if (adminPreviewAsUser && currentView === 'admin') {
      setCurrentView(coursePlan && courseProgress ? 'courses' : 'survey');
    }
  }, [adminPreviewAsUser, coursePlan, courseProgress, currentView]);

  useEffect(() => {
    if (!assessment || !currentUser || generatingCourse) return;
    const currentScope = coursePlan?.planScope === 'admin_full' ? 'admin_full' : 'standard';
    const expectedScope = wantsAdminCourseAccess ? 'admin_full' : 'standard';
    if (currentScope !== expectedScope) {
      generateCourse({ reset: true });
    }
  }, [assessment, coursePlan?.planScope, currentUser, wantsAdminCourseAccess]);

  if (sessionLoading) {
    return (
      <main className="page">
        <section className="panel">
          <p className="eyebrow">Cargando</p>
          <h1>Restaurando sesion</h1>
          <p className="lead">Estamos recuperando tu informacion guardada.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <AuthView
        mode={authMode}
        email={authEmail}
        password={authPassword}
        error={authError}
        submitting={authSubmitting}
        onModeChange={setAuthMode}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <>
      <main className="page">
        <SessionBar
          user={currentUser}
          currentView={currentView}
          theme={theme}
          adminPreviewAsUser={adminPreviewAsUser}
          onViewChange={handleViewChange}
          onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          onToggleAdminPreview={() => setAdminPreviewAsUser((current) => !current)}
          onLogout={handleLogout}
        />

        {currentView === 'survey' ? (
          <SurveyView
            answers={answers}
            visibleQuestions={visibleQuestions}
            surveyIndex={surveyIndex}
            surveyStage={surveyStage}
            assessment={assessment}
            resultLead={
              assessment?.resumen ||
              'Te mostraremos un resumen claro de tu riesgo y de la ruta que mejor encaja contigo.'
            }
            validationError={validationError}
            onAnswerChange={handleAnswerChange}
            onPrev={() => {
              setValidationError('');
              setSurveyIndex((current) => Math.max(0, current - 1));
            }}
            onNext={handleSurveyNext}
            onRestart={handleSurveyRestart}
            onTakeCourses={handleTakeCourses}
          />
        ) : null}

        {currentView === 'courses' ? (
          <CoursesView
            answers={answers}
            assessment={assessment}
            coursePlan={coursePlan}
            courseProgress={courseProgress}
            coursePrefs={coursePrefs}
            adminAccess={currentUser?.role === 'admin' && !adminPreviewAsUser}
            generating={generatingCourse}
            onCoursePrefsChange={setCoursePrefs}
            onGenerateCourse={() => generateCourse({ reset: Boolean(coursePlan) })}
            onOpenModule={handleOpenModule}
          />
        ) : null}

        {currentView === 'lesson' ? (
          <LessonView
            coursePlan={coursePlan}
            currentLesson={currentLesson}
            answers={answers}
            assessment={assessment}
            onBackToCourses={() => setCurrentView('courses')}
            onRestartModule={handleRestartModule}
            onCompleteActivity={handleLessonComplete}
          />
        ) : null}

        {currentView === 'admin' && currentUser.role === 'admin' ? (
          <AdminView
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onBack={() => setCurrentView(coursePlan && courseProgress ? 'courses' : 'survey')}
            onRefresh={loadAdminAnalytics}
            onExport={() => {
              if (!analytics) return;
              const blob = new Blob([JSON.stringify(analytics, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `escudo-analytics-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
              URL.revokeObjectURL(url);
            }}
          />
        ) : null}
      </main>

      {currentView !== 'admin' ? (
        <>
          <button className={`chat-fab ${chatOpen ? 'hidden' : ''}`} type="button" onClick={() => setChatOpen(true)}>
            Chat
          </button>
          <ChatDrawer
            open={chatOpen}
            messages={chatMessages}
            input={chatInput}
            busy={chatBusy}
            onInputChange={setChatInput}
            onClose={() => setChatOpen(false)}
            onSubmit={handleChatSubmit}
          />
        </>
      ) : null}
    </>
  );
}
