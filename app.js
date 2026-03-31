// Escudo Digital (frontend)
// - Encuesta dinamica -> evaluacion IA
// - Cursos personalizados + simulaciones
// - Chat flotante (drawer)

const $ = (id) => document.getElementById(id);

const els = {
  // Auth / shell
  authView: $('authView'),
  appShell: $('appShell'),
  showLoginBtn: $('showLoginBtn'),
  showRegisterBtn: $('showRegisterBtn'),
  authForm: $('authForm'),
  authTitle: $('authTitle'),
  authSubtitle: $('authSubtitle'),
  authEmail: $('authEmail'),
  authPassword: $('authPassword'),
  authSubmitBtn: $('authSubmitBtn'),
  authError: $('authError'),
  userEmail: $('userEmail'),
  userLastAccess: $('userLastAccess'),
  logoutBtn: $('logoutBtn'),
  goSurveyBtn: $('goSurveyBtn'),
  goCoursesBtn: $('goCoursesBtn'),
  openAdminBtn: $('openAdminBtn'),

  // Survey
  questionTitle: $('questionTitle'),
  questionHelper: $('questionHelper'),
  questionBody: $('questionBody'),
  questionEyebrow: $('questionEyebrow'),
  progressText: $('progressText'),
  progressBar: $('progressBar'),
  nextBtn: $('nextBtn'),
  prevBtn: $('prevBtn'),
  alertBox: $('questionAlert'),
  surveySection: $('surveySection'),
  loadingSection: $('loadingSection'),
  resultSection: $('resultSection'),
  resultLead: $('resultLead'),
  riskLevel: $('riskLevel'),
  riskSummary: $('riskSummary'),
  riskRecs: $('riskRecs'),
  nextStepsGrid: $('nextStepsGrid') || $('nextStepsList'),
  restartBtn: $('restartBtn'),
  goToCoursesBtn: $('goToCoursesBtn'),

  // Views
  surveyView: $('surveyView'),
  coursesView: $('coursesView'),
  lessonView: $('lessonView'),

  // Courses dashboard
  backToResultsBtn: $('backToResultsBtn'),
  openCourseSettingsBtn: $('openCourseSettingsBtn'),
  closeCourseSettingsBtn: $('closeCourseSettingsBtn'),
  applyCoursePrefsBtn: $('applyCoursePrefsBtn'),
  courseSettings: $('courseSettings'),
  shieldDonut: $('shieldDonut'),
  shieldScoreLabel: $('shieldScoreLabel'),
  shieldScoreName: $('shieldScoreName'),
  competencyList: $('competencyList'),
  courseLoading: $('courseLoading'),
  courseReadyHint: $('courseReadyHint'),
  modulesList: $('modulesList'),
  prefStyle: $('prefStyle'),
  prefDifficulty: $('prefDifficulty'),
  prefSession: $('prefSession'),
  prefTopics: $('prefTopics'),
  profileSummaryList: $('profileSummaryList'),
  historyList: $('historyList'),
  mistakeList: $('mistakeList'),

  // Lesson view
  lessonBackBtn: $('lessonBackBtn'),
  lessonEyebrow: $('lessonEyebrow'),
  lessonTitle: $('lessonTitle'),
  lessonDesc: $('lessonDesc'),
  lessonBadge: $('lessonBadge'),
  lessonLevelBadge: $('lessonLevelBadge'),
  lessonProgressText: $('lessonProgressText'),
  lessonActivity: $('lessonActivity'),

  // Chat drawer
  chatFab: $('chatFab'),
  chatDrawer: $('chatDrawer'),
  chatBackdrop: $('chatBackdrop'),
  chatClose: $('chatClose'),
  chatMessages: $('chatMessages'),
  chatForm: $('chatForm'),
  chatInput: $('chatInput'),

  // Admin
  adminView: $('adminView'),
  adminBackBtn: $('adminBackBtn'),
  adminRefreshBtn: $('adminRefreshBtn'),
  adminExportBtn: $('adminExportBtn'),
  adminOverview: $('adminOverview'),
  ageChart: $('ageChart'),
  vulnerabilityChart: $('vulnerabilityChart'),
  topicPerformanceChart: $('topicPerformanceChart'),
  decisionChart: $('decisionChart'),
  trendList: $('trendList'),
  improvementAgeChart: $('improvementAgeChart'),
  moduleTableBody: $('moduleTableBody'),
  userTableBody: $('userTableBody'),
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STORAGE_KEYS = {
  session: 'escudo_session_v1',
  assessment: 'escudo_assessment_v1',
  answers: 'escudo_answers_v1',
  coursePlan: 'escudo_course_plan_v3',
  courseProgress: 'escudo_course_progress_v3',
};

const CATEGORY_LABELS = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  web: 'Web',
  llamadas: 'Llamadas',
  correo_redes: 'Correo/Redes',
  habitos: 'Hábitos',
};

const LEVEL_LABELS = {
  basico: 'Básico',
  refuerzo: 'Refuerzo',
  avanzado: 'Avanzado',
};

const ACTIVITY_LABELS = {
  concepto: 'Concepto',
  quiz: 'Quiz',
  simulacion: 'Simulación',
  abierta: 'Respuesta abierta',
  sim_chat: 'Simulación (chat)',
  checklist: 'Checklist',
  compare_domains: 'Comparación',
  signal_hunt: 'Modo detective',
  inbox: 'Inbox',
  web_lab: 'Laboratorio web',
  scenario_flow: 'Escenario',
};

const COMP_KEYS = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];

const mexicoStates = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacan',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
  'Ciudad de México',
];

const questions = [
  {
    id: 'age',
    title: '¿Cuál es tu rango de edad?',
    helper: 'Esto nos ayuda a ajustar el lenguaje y los ejemplos.',
    type: 'single',
    options: [
      { label: '13-17', value: '13-17', score: 2 },
      { label: '18-24', value: '18-24', score: 2 },
      { label: '25-34', value: '25-34', score: 1 },
      { label: '35-44', value: '35-44', score: 1 },
      { label: '45-54', value: '45-54', score: 1 },
      { label: '55+', value: '55+', score: 2 },
    ],
  },
  {
    id: 'knowledge',
    title: '¿Qué tanto sabes sobre estafas digitales?',
    helper: 'Sé honesto, no es un examen.',
    type: 'single',
    options: [
      { label: 'Nada', value: 'nada', score: 3 },
      { label: 'Lo básico', value: 'basico', score: 2 },
      { label: 'Intermedio', value: 'intermedio', score: 1 },
      { label: 'Avanzado', value: 'avanzado', score: 0 },
    ],
  },
  {
    id: 'state',
    title: '¿En qué estado de México te encuentras?',
    helper: 'Queremos adaptar alertas locales.',
    type: 'select',
    options: mexicoStates.map((state) => ({ label: state, value: state, score: 0 })),
  },
  {
    id: 'channels',
    title: '¿En qué canales recibes más mensajes desconocidos?',
    helper: 'Selecciona todas las opciones que apliquen.',
    type: 'multi',
    options: [
      { label: 'SMS', value: 'sms', score: 1 },
      { label: 'WhatsApp', value: 'whatsapp', score: 1 },
      { label: 'Llamadas', value: 'llamadas', score: 1 },
      { label: 'Redes sociales', value: 'redes', score: 1 },
      { label: 'Correo electrónico', value: 'correo', score: 1 },
    ],
  },
  {
    id: 'frequency',
    title: '¿Con qué frecuencia recibes enlaces o llamadas sospechosas?',
    helper: 'Esto mide tu exposición diaria.',
    type: 'single',
    options: [
      { label: 'Casi nunca', value: 'nunca', score: 0 },
      { label: 'Una vez por semana', value: 'semanal', score: 1 },
      { label: 'Varias veces por semana', value: 'varias', score: 2 },
      { label: 'Casi todos los días', value: 'diario', score: 3 },
    ],
  },
  {
    id: 'habits',
    title: '¿Qué tan seguido verificas enlaces antes de abrirlos?',
    helper: 'Ejemplo: revisar el dominio o buscar la empresa.',
    type: 'single',
    options: [
      { label: 'Siempre verifico', value: 'siempre', score: 0 },
      { label: 'A veces', value: 'aveces', score: 2 },
      { label: 'Casi nunca', value: 'nunca', score: 3 },
    ],
  },
  {
    id: 'scammed',
    title: '¿Alguna vez has sido víctima de una estafa digital?',
    helper: 'Tu experiencia nos ayudará a orientar el contenido.',
    type: 'single',
    options: [
      { label: 'Sí', value: 'si', score: 3 },
      { label: 'No', value: 'no', score: 0 },
      { label: 'No estoy seguro', value: 'duda', score: 1 },
    ],
  },
  {
    id: 'scam_type',
    title: '¿Cómo ocurrió la estafa?',
    helper: 'Selecciona los tipos que recuerdes.',
    type: 'multi',
    options: [
      { label: 'SMS con enlace falso', value: 'sms', score: 1 },
      { label: 'WhatsApp con suplantación', value: 'whatsapp', score: 1 },
      { label: 'Llamada pidiendo datos', value: 'llamada', score: 1 },
      { label: 'Página web clonada', value: 'web', score: 1 },
      { label: 'Otra', value: 'otra', score: 1 },
    ],
    showIf: (answers) => answers.scammed === 'si',
  },
  {
    id: 'scam_story',
    title: 'Cuéntanos brevemente qué pasó',
    helper: 'Un par de líneas es suficiente.',
    type: 'text',
    placeholder: 'Ejemplo: recibí un SMS del “banco” y me pedían un código...',
    showIf: (answers) => answers.scammed === 'si',
  },
  {
    id: 'priority',
    title: '¿Qué te gustaría aprender primero?',
    helper: 'Con esto definimos el orden de los cursos.',
    type: 'single',
    options: [
      { label: 'Detectar SMS falsos', value: 'sms', score: 1 },
      { label: 'Verificar paginas web', value: 'web', score: 1 },
      { label: 'Evitar llamadas fraudulentas', value: 'llamadas', score: 1 },
      { label: 'Seguridad en WhatsApp', value: 'whatsapp', score: 1 },
      { label: 'Todo lo anterior', value: 'todo', score: 2 },
    ],
  },
];

const answers = {};
let currentIndex = 0;
let latestAssessment = null;
let latestCoursePlan = null;
let courseProgress = null;
let currentLesson = { moduleIndex: 0, activityIndex: 0 };
let currentUser = null;
let authMode = 'login';
let latestAnalytics = null;
let surveyStage = 'survey';
let activeView = 'survey';
let authToken = localStorage.getItem(STORAGE_KEYS.session) || '';
let remoteSyncTimer = null;
let remoteSyncInFlight = false;
let remoteSyncQueued = false;
let suspendRemoteSync = false;
let lessonActivityStartedAt = 0;

const chatHistory = [];
const simSessions = new Map(); // activityId -> { history, done, bestScore }

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const clearLocalState = () => {
  try {
    [
      STORAGE_KEYS.answers,
      STORAGE_KEYS.assessment,
      STORAGE_KEYS.coursePlan,
      STORAGE_KEYS.courseProgress,
    ].forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
};

const buildClientStatePayload = () => ({
  answers,
  assessment: latestAssessment,
  coursePlan: latestCoursePlan,
  courseProgress,
  currentView: activeView,
  surveyStage,
  surveyIndex: currentIndex,
  currentLesson,
});

const persistState = ({ remote = true } = {}) => {
  try {
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(answers));
    if (latestAssessment) {
      localStorage.setItem(STORAGE_KEYS.assessment, JSON.stringify(latestAssessment));
    } else {
      localStorage.removeItem(STORAGE_KEYS.assessment);
    }
    if (latestCoursePlan) {
      localStorage.setItem(STORAGE_KEYS.coursePlan, JSON.stringify(latestCoursePlan));
    } else {
      localStorage.removeItem(STORAGE_KEYS.coursePlan);
    }
    if (courseProgress) {
      localStorage.setItem(STORAGE_KEYS.courseProgress, JSON.stringify(courseProgress));
    } else {
      localStorage.removeItem(STORAGE_KEYS.courseProgress);
    }
  } catch {
    // ignore
  }

  if (remote) scheduleRemoteSync();
};

const hydrateState = () => {
  const storedAnswers = safeJsonParse(localStorage.getItem(STORAGE_KEYS.answers));
  if (storedAnswers && typeof storedAnswers === 'object') {
    Object.assign(answers, storedAnswers);
  }
  latestAssessment = safeJsonParse(localStorage.getItem(STORAGE_KEYS.assessment));
  latestCoursePlan = safeJsonParse(localStorage.getItem(STORAGE_KEYS.coursePlan));
  courseProgress = safeJsonParse(localStorage.getItem(STORAGE_KEYS.courseProgress));
};

const applyStateSnapshot = (state) => {
  suspendRemoteSync = true;

  Object.keys(answers).forEach((key) => delete answers[key]);
  const safe = state && typeof state === 'object' ? state : {};
  if (safe.answers && typeof safe.answers === 'object') {
    Object.assign(answers, safe.answers);
  }

  latestAssessment = safe.assessment || null;
  latestCoursePlan = safe.coursePlan ? ensureCourseState(safe.coursePlan) : null;
  courseProgress = safe.courseProgress || null;
  if (latestCoursePlan) {
    courseProgress = ensureCourseProgress(latestCoursePlan, { reset: false, seed: courseProgress });
  }

  surveyStage = ['survey', 'loading', 'results'].includes(safe.surveyStage)
    ? safe.surveyStage
    : latestAssessment
      ? 'results'
      : 'survey';
  currentIndex = Number.isFinite(Number(safe.surveyIndex)) ? Math.max(0, Number(safe.surveyIndex)) : 0;
  currentLesson =
    safe.currentLesson && typeof safe.currentLesson === 'object'
      ? {
          moduleIndex: Number.isFinite(Number(safe.currentLesson.moduleIndex))
            ? Math.max(0, Number(safe.currentLesson.moduleIndex))
            : 0,
          activityIndex: Number.isFinite(Number(safe.currentLesson.activityIndex))
            ? Math.max(0, Number(safe.currentLesson.activityIndex))
            : 0,
        }
      : { moduleIndex: 0, activityIndex: 0 };

  persistState({ remote: false });
  suspendRemoteSync = false;
};

const normalizeRiskLevel = (value) => {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith('alto')) return 'Alto';
  if (lower.startsWith('medio')) return 'Medio';
  if (lower.startsWith('bajo')) return 'Bajo';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
};

const normalizeCategory = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'habitos';
  if (raw.startsWith('web')) return 'web';
  if (raw.startsWith('whats') || raw === 'wa') return 'whatsapp';
  if (raw.startsWith('sms')) return 'sms';
  if (raw.startsWith('llam') || raw.startsWith('call')) return 'llamadas';
  if (raw.includes('correo') || raw.includes('redes')) return 'correo_redes';
  if (raw.includes('hab')) return 'habitos';
  return COMP_KEYS.includes(raw) ? raw : 'habitos';
};

const normalizeModuleLevel = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.startsWith('ava')) return 'avanzado';
  if (raw.startsWith('ref')) return 'refuerzo';
  if (raw.startsWith('bas')) return 'basico';
  if (raw.startsWith('int') || raw.startsWith('med')) return 'refuerzo';
  return LEVEL_LABELS[raw] ? raw : 'basico';
};

const computeTotalScore = (competencias) => {
  const values = Object.values(competencias || {}).filter((v) => Number.isFinite(v));
  if (!values.length) return 0;
  return Math.round(values.reduce((acc, v) => acc + v, 0) / values.length);
};

const categoryNote = (value) => {
  if (value >= 85) return 'Muy fuerte';
  if (value >= 70) return 'Fuerte';
  if (value >= 50) return 'Bien';
  if (value >= 30) return 'Por reforzar';
  return 'Prioridad alta';
};

const setSurveyStage = (stage, { sync = true } = {}) => {
  surveyStage = stage;
  if (els.surveySection) els.surveySection.classList.toggle('hidden', stage !== 'survey');
  if (els.loadingSection) els.loadingSection.classList.toggle('hidden', stage !== 'loading');
  if (els.resultSection) els.resultSection.classList.toggle('hidden', stage !== 'results');
  if (sync) persistState();
};

const showView = (view, { sync = true } = {}) => {
  const views = {
    survey: els.surveyView,
    courses: els.coursesView,
    lesson: els.lessonView,
    admin: els.adminView,
  };

  activeView = view;
  Object.values(views).forEach((node) => node?.classList.add('hidden'));
  views[view]?.classList.remove('hidden');

  if (view === 'survey') document.title = 'Escudo Digital | Encuesta';
  if (view === 'courses') document.title = 'Escudo Digital | Cursos';
  if (view === 'lesson') document.title = 'Escudo Digital | Lección';
  if (view === 'admin') document.title = 'Escudo Digital | Panel interno';

  const showChat = Boolean(currentUser) && view !== 'admin';
  if (!showChat) closeChat();
  else els.chatFab?.classList.toggle('hidden', isChatOpen());
  if (sync) persistState();
};

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const applyInlineFormatting = (value) =>
  String(value || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const formatMessage = (text) => {
  const raw = text || '';
  const safe = applyInlineFormatting(escapeHtml(raw));
  const lines = safe
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines.filter((line) => line.startsWith('- ') || line.startsWith('• '));
  if (bulletLines.length >= 2) {
    const hasIntro = lines[0] && !lines[0].startsWith('- ') && !lines[0].startsWith('• ');
    const intro = hasIntro
      ? `<p class="chat-intro">${lines[0]}</p>`
      : `<p class="chat-intro">Vamos paso a paso.</p>`;
    const items = bulletLines
      .map((line) => `<li>${line.replace(/^(-|•)\\s*/, '')}</li>`)
      .join('');
    const outro =
      '<p class="chat-outro">Si algo se ve raro o te mete urgencia, mejor pausa y verifica.</p>';
    return `${intro}<ul>${items}</ul>${outro}`;
  }

  const numbered = lines.filter((line) => /^\\d+\\.\\s/.test(line));
  if (numbered.length >= 2) {
    const items = numbered
      .map((line) => `<li>${line.replace(/^\\d+\\.\\s*/, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  }

  return lines.join('<br />');
};

const appendChat = (text, role) => {
  if (!els.chatMessages) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = formatMessage(text);
  els.chatMessages.appendChild(bubble);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
};

const apiRequest = async (path, { method = 'POST', payload, includeAuth = true } = {}) => {
  const headers = {};
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (includeAuth && authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(path, {
    method,
    headers,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error || 'Error al conectar con el servidor.';
    const status = error.status ? ` (status ${error.status})` : '';
    throw new Error(`${message}${status}`);
  }
  return response.json().catch(() => ({}));
};

const callBackend = async (path, payload) => apiRequest(path, { method: 'POST', payload });

const formatDate = (value) => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const updateUserBar = () => {
  if (!currentUser) return;
  if (els.userEmail) els.userEmail.textContent = currentUser.email;
  if (els.userLastAccess) {
    els.userLastAccess.textContent = `Último acceso: ${formatDate(currentUser.lastAccessAt)} · Tu avance se guarda automáticamente.`;
  }
  els.openAdminBtn?.classList.toggle('hidden', currentUser.role !== 'admin');
};

const showAuth = () => {
  els.authView?.classList.remove('hidden');
  els.appShell?.classList.add('hidden');
  closeChat();
  els.chatFab?.classList.add('hidden');
};

const showAppShell = () => {
  els.authView?.classList.add('hidden');
  els.appShell?.classList.remove('hidden');
  updateUserBar();
  if (activeView !== 'admin') {
    els.chatFab?.classList.remove('hidden');
  }
};

const setAuthMode = (mode) => {
  authMode = mode === 'register' ? 'register' : 'login';
  els.showLoginBtn?.classList.toggle('active', authMode === 'login');
  els.showRegisterBtn?.classList.toggle('active', authMode === 'register');
  if (els.authTitle) {
    els.authTitle.textContent =
      authMode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta';
  }
  if (els.authSubtitle) {
    els.authSubtitle.textContent =
      authMode === 'login'
        ? 'Entra con tu correo para continuar exactamente donde te quedaste.'
        : 'Solo te pediremos correo y contraseña para guardar tu progreso.';
  }
  if (els.authSubmitBtn) {
    els.authSubmitBtn.textContent =
      authMode === 'login' ? 'Entrar' : 'Crear cuenta';
  }
  els.authPassword?.setAttribute(
    'autocomplete',
    authMode === 'login' ? 'current-password' : 'new-password'
  );
  els.authError?.classList.add('hidden');
  if (els.authError) els.authError.textContent = '';
};

const setSession = (token, user) => {
  authToken = token || '';
  currentUser = user || null;
  if (authToken) {
    localStorage.setItem(STORAGE_KEYS.session, authToken);
  } else {
    localStorage.removeItem(STORAGE_KEYS.session);
  }
  updateUserBar();
};

const resetAppState = () => {
  if (remoteSyncTimer) {
    window.clearTimeout(remoteSyncTimer);
    remoteSyncTimer = null;
  }
  remoteSyncInFlight = false;
  remoteSyncQueued = false;
  Object.keys(answers).forEach((key) => delete answers[key]);
  currentIndex = 0;
  latestAssessment = null;
  latestCoursePlan = null;
  courseProgress = null;
  currentLesson = { moduleIndex: 0, activityIndex: 0 };
  surveyStage = 'survey';
  activeView = 'survey';
  latestAnalytics = null;
  chatHistory.length = 0;
  simSessions.clear();
  if (els.chatMessages) els.chatMessages.innerHTML = '';
  clearLocalState();
};

const scheduleRemoteSync = () => {
  if (!currentUser || !authToken || suspendRemoteSync) return;
  if (remoteSyncTimer) window.clearTimeout(remoteSyncTimer);
  remoteSyncTimer = window.setTimeout(() => {
    syncRemoteState();
  }, 350);
};

const syncRemoteState = async () => {
  if (!currentUser || !authToken || suspendRemoteSync) return;
  if (remoteSyncInFlight) {
    remoteSyncQueued = true;
    return;
  }

  remoteSyncInFlight = true;
  try {
    const data = await apiRequest('/api/user/state', {
      method: 'POST',
      payload: buildClientStatePayload(),
    });
    if (data?.user) {
      currentUser = data.user;
      updateUserBar();
    }
  } catch (error) {
    console.warn('No se pudo sincronizar el progreso:', error.message);
  } finally {
    remoteSyncInFlight = false;
    if (remoteSyncQueued) {
      remoteSyncQueued = false;
      scheduleRemoteSync();
    }
  }
};

const restoreAppAfterLogin = () => {
  showAppShell();

  if (
    latestCoursePlan &&
    courseProgress &&
    activeView === 'lesson' &&
    getModuleAndActivity(currentLesson.moduleIndex || 0, currentLesson.activityIndex || 0)
  ) {
    showView('lesson', { sync: false });
    renderLessonActivity(currentLesson.moduleIndex || 0, currentLesson.activityIndex || 0);
    return;
  }

  if (activeView === 'admin' && currentUser?.role === 'admin') {
    showView('admin', { sync: false });
    loadAdminAnalytics();
    return;
  }

  if (latestCoursePlan && courseProgress) {
    showView('courses', { sync: false });
    renderCoursesDashboard();
    return;
  }

  showView('survey', { sync: false });
  setSurveyStage(latestAssessment ? 'results' : 'survey', { sync: false });
  if (latestAssessment) {
    renderAssessment(latestAssessment);
  } else {
    const visible = getVisibleQuestions();
    currentIndex = clamp(currentIndex, 0, Math.max(visible.length - 1, 0));
    renderQuestion();
  }
};

const handleAuthSuccess = (data) => {
  setSession(data.token, data.user);
  applyStateSnapshot(data.state || {});
  activeView = (data.state && typeof data.state.currentView === 'string') ? data.state.currentView : 'survey';
  restoreAppAfterLogin();
};

const loadSession = async () => {
  if (!authToken) {
    showAuth();
    setAuthMode('login');
    return;
  }

  try {
    const data = await apiRequest('/api/auth/session', { method: 'GET' });
    setSession(authToken, data.user);
    applyStateSnapshot(data.state || {});
    activeView = (data.state && typeof data.state.currentView === 'string') ? data.state.currentView : 'survey';
    restoreAppAfterLogin();
  } catch (error) {
    console.warn('Sesión previa no disponible:', error.message);
    setSession('', null);
    resetAppState();
    showAuth();
    setAuthMode('login');
  }
};

const logout = async () => {
  try {
    if (authToken) {
      await apiRequest('/api/auth/logout', { method: 'POST', payload: {} });
    }
  } catch {
    // ignore logout errors
  }

  setSession('', null);
  resetAppState();
  showAuth();
  setAuthMode('login');
};

const isChatOpen = () => !els.chatDrawer?.classList.contains('hidden');

const openChat = () => {
  if (!currentUser) return;
  els.chatDrawer?.classList.remove('hidden');
  els.chatBackdrop?.classList.remove('hidden');
  els.chatFab?.classList.add('hidden');
};

const closeChat = () => {
  els.chatDrawer?.classList.add('hidden');
  els.chatBackdrop?.classList.add('hidden');
  els.chatFab?.classList.toggle('hidden', !currentUser || activeView === 'admin');
};

const toggleChat = () => {
  if (isChatOpen()) closeChat();
  else openChat();
};

const getVisibleQuestions = () =>
  questions.filter((q) => !q.showIf || q.showIf(answers));

const updateProgress = () => {
  const visible = getVisibleQuestions();
  const total = visible.length;
  const current = currentIndex + 1;
  if (els.progressText) els.progressText.textContent = `Paso ${current} de ${total}`;
  if (els.progressBar) els.progressBar.style.width = `${(current / total) * 100}%`;
};

const updateButtons = () => {
  if (els.prevBtn) els.prevBtn.disabled = currentIndex === 0;
  if (!els.nextBtn) return;
  els.nextBtn.textContent =
    currentIndex === getVisibleQuestions().length - 1 ? 'Finalizar' : 'Siguiente';
};

const validateCurrent = () => {
  const visible = getVisibleQuestions();
  const question = visible[currentIndex];
  if (!question) return true;
  const value = answers[question.id];

  if (question.type === 'text') return value && value.length > 3;
  if (question.type === 'multi') return Array.isArray(value) && value.length > 0;
  return Boolean(value);
};

const renderQuestion = () => {
  const visible = getVisibleQuestions();
  const question = visible[currentIndex];

  if (!question) {
    showResults();
    return;
  }

  if (els.questionTitle) els.questionTitle.textContent = question.title;
  if (els.questionHelper) els.questionHelper.textContent = question.helper || '';
  if (els.questionEyebrow) els.questionEyebrow.textContent = `Pregunta ${currentIndex + 1}`;

  if (els.questionBody) els.questionBody.innerHTML = '';
  els.alertBox?.classList.add('hidden');

  const stored = answers[question.id];

  if ((question.type === 'single' || question.type === 'multi') && els.questionBody) {
    const isMulti = question.type === 'multi';
    question.options.forEach((option) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'option';
      const input = document.createElement('input');
      input.type = isMulti ? 'checkbox' : 'radio';
      input.name = question.id;
      input.value = option.value;

      const isSelected = isMulti
        ? Array.isArray(stored) && stored.includes(option.value)
        : stored === option.value;
      input.checked = isSelected;
      if (isSelected) wrapper.classList.add('active');

      const text = document.createElement('span');
      text.textContent = option.label;

      wrapper.appendChild(input);
      wrapper.appendChild(text);
      els.questionBody.appendChild(wrapper);

      input.addEventListener('change', () => {
        if (isMulti) {
          const set = new Set(Array.isArray(answers[question.id]) ? answers[question.id] : []);
          if (input.checked) {
            set.add(option.value);
            wrapper.classList.add('active');
          } else {
            set.delete(option.value);
            wrapper.classList.remove('active');
          }
          answers[question.id] = Array.from(set);
          persistState();
          return;
        }

        answers[question.id] = option.value;
        els.questionBody.querySelectorAll('.option').forEach((optEl) => optEl.classList.remove('active'));
        wrapper.classList.add('active');
        persistState();
      });
    });
  }

  if (question.type === 'select' && els.questionBody) {
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecciona tu estado';
    placeholder.disabled = true;
    placeholder.selected = !stored;
    select.appendChild(placeholder);

    question.options.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      if (stored === option.value) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      answers[question.id] = select.value;
      persistState();
    });

    els.questionBody.appendChild(select);
  }

  if (question.type === 'text' && els.questionBody) {
    const textarea = document.createElement('textarea');
    textarea.placeholder = question.placeholder || '';
    textarea.value = stored || '';
    textarea.addEventListener('input', () => {
      answers[question.id] = textarea.value.trim();
      persistState();
    });
    els.questionBody.appendChild(textarea);
  }

  updateProgress();
  updateButtons();
  persistState();
};

const scoreAnswers = () => {
  let score = 0;
  questions.forEach((question) => {
    if (question.showIf && !question.showIf(answers)) return;
    const value = answers[question.id];
    if (!value) return;

    if (question.type === 'single' || question.type === 'select') {
      const option = question.options.find((opt) => opt.value === value);
      if (option && option.score) score += option.score;
    }

    if (question.type === 'multi') {
      const selected = Array.isArray(value) ? value : [];
      selected.forEach((val) => {
        const option = question.options.find((opt) => opt.value === val);
        if (option && option.score) score += option.score;
      });
    }
  });
  return score;
};

const renderAssessment = (data) => {
  if (!data) return;
  if (els.riskLevel) els.riskLevel.textContent = normalizeRiskLevel(data.nivel);
  if (els.riskSummary) els.riskSummary.textContent = data.resumen || '';

  if (els.riskRecs) {
    els.riskRecs.innerHTML = '';
    (Array.isArray(data.recomendaciones) ? data.recomendaciones : []).forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      els.riskRecs.appendChild(li);
    });
  }

  if (els.nextStepsGrid) {
    els.nextStepsGrid.innerHTML = '';
    const steps = Array.isArray(data.proximos_pasos) ? data.proximos_pasos : [];
    steps.forEach((step) => {
      const titleText =
        typeof step === 'string'
          ? step
          : step?.titulo || step?.title || step?.tema || 'Siguiente paso';
      const descText =
        typeof step === 'string'
          ? ''
          : step?.descripcion || step?.aprenderas || step?.desc || '';

      if (els.nextStepsGrid.tagName === 'UL') {
        const li = document.createElement('li');
        li.textContent = descText ? `${titleText}: ${descText}` : titleText;
        els.nextStepsGrid.appendChild(li);
        return;
      }

      const card = document.createElement('div');
      card.className = 'step-card';

      const title = document.createElement('p');
      title.className = 'step-title';
      title.textContent = titleText;
      card.appendChild(title);

      if (descText) {
        const desc = document.createElement('p');
        desc.className = 'step-desc';
        desc.textContent = descText;
        card.appendChild(desc);
      }

      els.nextStepsGrid.appendChild(card);
    });
  }
};

const showResults = async () => {
  // Local fallback to avoid a blank UI if the network fails
  const score = scoreAnswers();
  let fallback = {
    nivel: score >= 10 ? 'Alto' : score >= 6 ? 'Medio' : 'Bajo',
    resumen:
      score >= 10
        ? 'Estás más expuesto a estafas digitales. La buena noticia: se puede mejorar con hábitos.'
        : score >= 6
          ? 'Hay oportunidades para reforzar hábitos y reconocer señales de riesgo.'
          : 'Tienes buenas prácticas. Aun así, vale la pena reforzar con casos reales.',
    recomendaciones: [
      'Pausa cuando haya urgencia: verifica por un canal oficial antes de actuar.',
      'No compartas códigos, contraseñas ni datos bancarios por mensaje o llamada.',
      'Antes de comprar, revisa dominio, reseñas externas y métodos de pago con protección.',
    ],
    proximos_pasos: [
      { titulo: 'Hábitos de verificación', descripcion: 'Un checklist rápido antes de abrir enlaces o pagar.' },
      { titulo: 'Mensajes y suplantación', descripcion: 'Cómo detectar urgencia, links falsos y perfiles clonados.' },
      { titulo: 'Web y compras seguras', descripcion: 'Señales para identificar tiendas falsas y pagos riesgosos.' },
      { titulo: 'Llamadas fraudulentas', descripcion: 'Qué nunca decir y cómo colgar y verificar correctamente.' },
    ],
  };

  setSurveyStage('loading');
  const started = Date.now();

  try {
    const data = await callBackend('/api/assess', { answers });
    latestAssessment = data;
    persistState();
    renderAssessment(data);
    if (els.resultLead) {
      els.resultLead.textContent = 'La IA ajustó tu perfil con base en tus respuestas.';
    }
  } catch (error) {
    latestAssessment = fallback;
    renderAssessment(fallback);
    if (els.resultLead) {
      els.resultLead.textContent = `No se pudo conectar con la IA. ${error.message || ''}`.trim();
    }
  } finally {
    const elapsed = Date.now() - started;
    if (elapsed < 900) await sleep(900 - elapsed);
    setSurveyStage('results');
  }
};

const resetSurvey = () => {
  Object.keys(answers).forEach((key) => delete answers[key]);
  currentIndex = 0;
  latestAssessment = null;
  latestCoursePlan = null;
  courseProgress = null;
  currentLesson = { moduleIndex: 0, activityIndex: 0 };
  surveyStage = 'survey';

  clearLocalState();

  if (els.chatMessages) els.chatMessages.innerHTML = '';
  chatHistory.length = 0;
  simSessions.clear();

  closeChat();
  showView('survey', { sync: false });
  setSurveyStage('survey', { sync: false });
  renderQuestion();
  persistState();
};

const setDonut = (score, label) => {
  if (!els.shieldDonut) return;
  const safe = clamp(Number(score) || 0, 0, 100);
  els.shieldDonut.style.setProperty('--p', String(safe));
  if (els.shieldScoreLabel) els.shieldScoreLabel.textContent = `${safe}%`;
  if (els.shieldScoreName && label) els.shieldScoreName.textContent = label;
};

const renderCompetencies = (competencias) => {
  if (!els.competencyList) return;
  els.competencyList.innerHTML = '';

  const entries = Object.entries(competencias || {}).filter(([k]) => COMP_KEYS.includes(k));
  if (!entries.length) {
    els.competencyList.innerHTML = '<p class="hint">Generando tu mapa…</p>';
    return;
  }

  entries.forEach(([key, value]) => {
    const val = clamp(Number(value) || 0, 0, 100);
    const card = document.createElement('div');
    card.className = 'comp';

    const top = document.createElement('div');
    top.className = 'comp-top';

    const name = document.createElement('span');
    name.className = 'comp-name';
    name.textContent = CATEGORY_LABELS[key] || key;

    const pct = document.createElement('span');
    pct.className = 'comp-val';
    pct.textContent = `${val}%`;

    top.appendChild(name);
    top.appendChild(pct);

    const bar = document.createElement('div');
    bar.className = 'comp-bar';
    const fill = document.createElement('div');
    fill.className = 'comp-fill';
    fill.style.width = `${val}%`;
    bar.appendChild(fill);

    const note = document.createElement('p');
    note.className = 'comp-note';
    note.textContent = categoryNote(val);

    card.appendChild(top);
    card.appendChild(bar);
    card.appendChild(note);
    els.competencyList.appendChild(card);
  });
};

const computePlanSignature = (plan) => {
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  const ids = route.map((m) => String(m?.id || '')).join('|');
  const actCount = route.reduce((acc, m) => acc + (Array.isArray(m?.actividades) ? m.actividades.length : 0), 0);
  return `${String(plan?.score_name || '')}::${ids}::${actCount}`;
};

const ensureCourseState = (plan) => {
  const safe = plan && typeof plan === 'object' ? plan : {};
  safe.score_name = String(safe.score_name || 'Blindaje Digital').trim() || 'Blindaje Digital';
  safe.competencias = safe.competencias && typeof safe.competencias === 'object' ? safe.competencias : {};

  COMP_KEYS.forEach((k) => {
    const raw = Number(safe.competencias[k]);
    safe.competencias[k] = Number.isFinite(raw) ? clamp(raw, 0, 100) : 50;
  });

  const route = Array.isArray(safe.ruta) ? safe.ruta : [];
  safe.ruta = route
    .map((mod, mIdx) => {
      if (!mod || typeof mod !== 'object') return null;
      const id = String(mod.id || `m${mIdx + 1}`).trim() || `m${mIdx + 1}`;
      const categoria = normalizeCategory(mod.categoria || mod.category || 'habitos');
      const nivel = normalizeModuleLevel(mod.nivel || mod.level || mod.dificultad || '');
      const titulo = String(mod.titulo || `Módulo ${mIdx + 1}`).trim();
      const descripcion = String(mod.descripcion || '').trim();
      const acts = Array.isArray(mod.actividades) ? mod.actividades : [];

      const actividades = acts
        .map((act, aIdx) => {
          if (!act || typeof act !== 'object') return null;
          const actId = String(act.id || `${id}-a${aIdx + 1}`).trim() || `${id}-a${aIdx + 1}`;
          const tipo = String(act.tipo || act.type || 'concepto').trim().toLowerCase();
          const tituloAct = String(act.titulo || `Actividad ${aIdx + 1}`).trim();
          const peso = clamp(Number(act.peso ?? act.puntos ?? 1) || 1, 0.5, 3);

          const base = { id: actId, tipo, titulo: tituloAct, peso };

          if (tipo === 'checklist') {
            const items = Array.isArray(act.items) ? act.items.map((x) => String(x).trim()).filter(Boolean) : [];
            return {
              ...base,
              intro: String(act.intro || '').trim(),
              items: items.slice(0, 8),
            };
          }

          if (tipo === 'simulacion' || tipo === 'quiz') {
            const opciones = Array.isArray(act.opciones) ? act.opciones.map((x) => String(x).trim()).filter(Boolean) : [];
            const correcta = clamp(Number(act.correcta) || 0, 0, Math.max(0, opciones.length - 1));
            return {
              ...base,
              escenario: String(act.escenario || '').trim(),
              opciones: opciones.slice(0, 5),
              correcta,
              explicacion: String(act.explicacion || '').trim(),
            };
          }

          if (tipo === 'abierta') {
            return {
              ...base,
              prompt: String(act.prompt || act.pregunta || '').trim(),
              pistas: Array.isArray(act.pistas) ? act.pistas.map((x) => String(x).trim()).filter(Boolean).slice(0, 4) : [],
            };
          }

          if (tipo === 'sim_chat') {
            return {
              ...base,
              escenario: String(act.escenario || '').trim(),
              inicio: String(act.inicio || '').trim(),
              turnos_max: clamp(Number(act.turnos_max) || 6, 3, 10),
            };
          }

          if (tipo === 'compare_domains') {
            const dominios = Array.isArray(act.dominios)
              ? act.dominios.map((x) => String(x).trim()).filter(Boolean)
              : Array.isArray(act.opciones)
                ? act.opciones.map((x) => String(x).trim()).filter(Boolean)
                : [];
            const correcta = clamp(Number(act.correcta) || 0, 0, Math.max(0, dominios.length - 1));
            return {
              ...base,
              prompt: String(act.prompt || act.pregunta || '').trim(),
              dominios: dominios.slice(0, 4),
              correcta,
              explicacion: String(act.explicacion || '').trim(),
              tip: String(act.tip || act.consejo || '').trim(),
            };
          }

          if (tipo === 'signal_hunt') {
            const mensaje = String(act.mensaje || act.texto || act.escenario || '').trim();
            const rawSignals = Array.isArray(act.senales)
              ? act.senales
              : Array.isArray(act.opciones)
                ? act.opciones
                : [];
            const senales = rawSignals
              .map((sig, sIdx) => {
                if (!sig) return null;
                if (typeof sig === 'string') {
                  const label = sig.trim();
                  if (!label) return null;
                  return { id: `s${sIdx + 1}`, label, correcta: false, explicacion: '' };
                }
                if (typeof sig !== 'object') return null;
                const label = String(sig.label || sig.texto || sig.senal || '').trim();
                if (!label) return null;
                const correcta = Boolean(sig.correcta ?? sig.es_correcta ?? sig.correcto);
                const explicacion = String(sig.explicacion || sig.razon || '').trim();
                const id = String(sig.id || `s${sIdx + 1}`).trim() || `s${sIdx + 1}`;
                return { id, label, correcta, explicacion };
              })
              .filter(Boolean)
              .slice(0, 10);

            return {
              ...base,
              mensaje,
              senales,
            };
          }

          if (tipo === 'inbox') {
            const kindRaw = String(act.kind || act.canal || act.tipo_inbox || '').toLowerCase();
            const kind = kindRaw.includes('sms') ? 'sms' : 'correo';
            const intro = String(act.intro || '').trim();
            const rawMsgs = Array.isArray(act.mensajes)
              ? act.mensajes
              : Array.isArray(act.items)
                ? act.items
                : [];
            const mensajes = rawMsgs
              .map((msg, m2Idx) => {
                if (!msg || typeof msg !== 'object') return null;
                const id = String(msg.id || `m${m2Idx + 1}`).trim() || `m${m2Idx + 1}`;
                const from = String(msg.from || msg.de || msg.remitente || '').trim();
                const subject = String(msg.subject || msg.asunto || '').trim();
                const text = String(msg.text || msg.mensaje || msg.cuerpo || '').trim();
                const clsRaw = String(msg.correcto || msg.clasificacion || msg.tipo || msg.clase || '').toLowerCase();
                const correcto = clsRaw.includes('estafa') || clsRaw.includes('fraud') || clsRaw.includes('phish') ? 'estafa' : 'seguro';
                const explicacion = String(msg.explicacion || msg.razon || '').trim();
                if (!text) return null;
                return { id, from, subject, text, correcto, explicacion };
              })
              .filter(Boolean)
              .slice(0, 8);

            return {
              ...base,
              kind,
              intro,
              mensajes,
            };
          }

          if (tipo === 'web_lab') {
            const intro = String(act.intro || '').trim();
            const page = act.pagina && typeof act.pagina === 'object' ? act.pagina : act.page && typeof act.page === 'object' ? act.page : {};
            const marca = String(page.marca || page.brand || '').trim() || 'NovaTienda';
            const dominio = String(page.dominio || page.url || '').trim() || 'novatienda-mx.shop';
            const banner = String(page.banner || page.hero || '').trim();
            const sub = String(page.sub || page.subtitulo || page.copy || '').trim();
            const contacto = String(page.contacto || page.contact || '').trim();
            const pagos = Array.isArray(page.pagos)
              ? page.pagos.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
              : [];
            const productosRaw = Array.isArray(page.productos) ? page.productos : [];
            const productos = productosRaw
              .map((p, pIdx) => {
                if (!p || typeof p !== 'object') return null;
                const nombre = String(p.nombre || p.name || '').trim();
                const precio = String(p.precio || p.price || '').trim();
                const antes = String(p.antes || p.old_price || '').trim();
                if (!nombre) return null;
                return { id: String(p.id || `p${pIdx + 1}`).trim() || `p${pIdx + 1}`, nombre, precio, antes };
              })
              .filter(Boolean)
              .slice(0, 6);

            const rawHotspots = Array.isArray(act.hotspots) ? act.hotspots : Array.isArray(act.senales) ? act.senales : [];
            const hotspots = rawHotspots
              .map((h, hIdx) => {
                if (!h || typeof h !== 'object') return null;
                const id = String(h.id || `h${hIdx + 1}`).trim() || `h${hIdx + 1}`;
                const target = String(h.target || h.objetivo || '').trim() || id;
                const label = String(h.label || h.titulo || h.senal || '').trim();
                const correcta = Boolean(h.correcta ?? h.es_correcta ?? h.correcto);
                const explicacion = String(h.explicacion || h.razon || '').trim();
                if (!label) return null;
                return { id, target, label, correcta, explicacion };
              })
              .filter(Boolean)
              .slice(0, 10);

            return {
              ...base,
              intro,
              pagina: { marca, dominio, banner, sub, contacto, pagos, productos },
              hotspots,
            };
          }

          if (tipo === 'scenario_flow') {
            const intro = String(act.intro || '').trim();
            const rawSteps = Array.isArray(act.pasos) ? act.pasos : Array.isArray(act.steps) ? act.steps : [];
            const pasos = rawSteps
              .map((st, sIdx) => {
                if (!st || typeof st !== 'object') return null;
                const texto = String(st.texto || st.text || '').trim();
                const rawOpts = Array.isArray(st.opciones) ? st.opciones : Array.isArray(st.options) ? st.options : [];
                const opciones = rawOpts
                  .map((opt, oIdx) => {
                    if (!opt || typeof opt !== 'object') return null;
                    const texto = String(opt.texto || opt.label || opt.text || '').trim();
                    if (!texto) return null;
                    const puntaje = clamp(Number(opt.puntaje ?? opt.score ?? 0.6) || 0.6, 0, 1);
                    const feedback = String(opt.feedback || opt.retro || '').trim();
                    const siguienteRaw = opt.siguiente ?? opt.next;
                    const siguiente =
                      Number.isFinite(Number(siguienteRaw)) ? clamp(Number(siguienteRaw), 0, 50) : null;
                    return { id: String(opt.id || `o${oIdx + 1}`).trim() || `o${oIdx + 1}`, texto, puntaje, feedback, siguiente };
                  })
                  .filter(Boolean)
                  .slice(0, 5);
                if (!texto || !opciones.length) return null;
                return { id: String(st.id || `p${sIdx + 1}`).trim() || `p${sIdx + 1}`, texto, opciones };
              })
              .filter(Boolean)
              .slice(0, 8);

            return {
              ...base,
              intro,
              pasos,
            };
          }

          // concepto u otros -> contenido
          return {
            ...base,
            contenido: String(act.contenido || act.texto || '').trim(),
          };
        })
        .filter(Boolean);

      return { id, categoria, nivel, titulo, descripcion, actividades };
    })
    .filter(Boolean);

  return safe;
};

const ensureCourseProgress = (plan, { reset, seed } = { reset: false, seed: null }) => {
  const sig = computePlanSignature(plan);
  const source = seed && typeof seed === 'object' ? seed : courseProgress;
  const prev = source && typeof source === 'object' ? source : null;

  let next = prev;
  if (reset || !prev || prev.planSig !== sig) {
    next = { planSig: sig, completed: {}, modules: {}, snapshots: [], lastAccessAt: new Date().toISOString() };
  } else {
    next = {
      ...prev,
      planSig: sig,
      completed: prev.completed && typeof prev.completed === 'object' ? prev.completed : {},
      modules: prev.modules && typeof prev.modules === 'object' ? prev.modules : {},
      snapshots: Array.isArray(prev.snapshots) ? prev.snapshots : [],
      lastAccessAt: new Date().toISOString(),
    };
  }

  const activityIds = new Set();
  const moduleIds = new Set();
  (Array.isArray(plan?.ruta) ? plan.ruta : []).forEach((mod) => {
    if (mod?.id) moduleIds.add(mod.id);
    (Array.isArray(mod?.actividades) ? mod.actividades : []).forEach((act) => activityIds.add(act.id));
  });
  Object.keys(next.completed).forEach((key) => {
    if (!activityIds.has(key)) delete next.completed[key];
  });
  Object.keys(next.modules).forEach((key) => {
    if (!moduleIds.has(key)) delete next.modules[key];
  });

  return next;
};

const computeCompetenciesFromProgress = (plan, progress) => {
  const base = plan?.competencias && typeof plan.competencias === 'object' ? plan.competencias : {};
  const totals = {};
  COMP_KEYS.forEach((k) => (totals[k] = { w: 0, e: 0 }));

  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  route.forEach((mod) => {
    const cat = normalizeCategory(mod?.categoria);
    const acts = Array.isArray(mod?.actividades) ? mod.actividades : [];
    acts.forEach((act) => {
      const w = clamp(Number(act?.peso ?? act?.puntos ?? 1) || 1, 0.5, 3);
      if (!totals[cat]) totals[cat] = { w: 0, e: 0 };
      totals[cat].w += w;
      const done = progress?.completed?.[act.id];
      const score = done ? clamp(Number(done.score) || 0, 0, 1) : 0;
      totals[cat].e += w * score;
    });
  });

  const computed = {};
  COMP_KEYS.forEach((cat) => {
    const baseVal = clamp(Number(base?.[cat]) || 0, 0, 100);
    const remaining = 100 - baseVal;
    const ratio = totals[cat]?.w ? totals[cat].e / totals[cat].w : 0;
    computed[cat] = clamp(Math.round(baseVal + remaining * ratio), 0, 100);
  });

  const score_total = computeTotalScore(computed);
  return { competencias: computed, score_total };
};

const getModuleProgressEntry = (module) => {
  if (!courseProgress || !module?.id) return null;
  courseProgress.modules = courseProgress.modules || {};
  if (!courseProgress.modules[module.id]) {
    courseProgress.modules[module.id] = {
      startedAt: new Date().toISOString(),
      completedAt: null,
      visits: 0,
      lastActivityId: null,
      durationMs: 0,
    };
  }
  return courseProgress.modules[module.id];
};

const recordCourseSnapshot = () => {
  if (!latestCoursePlan || !courseProgress) return;
  courseProgress.snapshots = Array.isArray(courseProgress.snapshots) ? courseProgress.snapshots : [];
  const computed = computeCompetenciesFromProgress(latestCoursePlan, courseProgress);
  const snapshot = {
    at: new Date().toISOString(),
    scoreTotal: computed.score_total,
    competencias: computed.competencias,
    completedCount: Object.keys(courseProgress.completed || {}).length,
  };
  const last = courseProgress.snapshots[courseProgress.snapshots.length - 1];
  if (
    !last ||
    last.scoreTotal !== snapshot.scoreTotal ||
    last.completedCount !== snapshot.completedCount
  ) {
    courseProgress.snapshots.push(snapshot);
  }
};

const summarizeProgressInsights = () => {
  const insights = {
    strengths: [],
    focus: [],
    mistakes: [],
  };
  if (!latestCoursePlan || !courseProgress) return insights;

  const computed = computeCompetenciesFromProgress(latestCoursePlan, courseProgress);
  const sortedCompetencies = Object.entries(computed.competencias || {}).sort((a, b) => b[1] - a[1]);
  insights.strengths = sortedCompetencies
    .slice(0, 2)
    .map(([key, value]) => `${CATEGORY_LABELS[key] || key}: ${value}%`);
  insights.focus = sortedCompetencies
    .slice(-2)
    .reverse()
    .map(([key, value]) => `${CATEGORY_LABELS[key] || key}: ${value}%`);

  const route = Array.isArray(latestCoursePlan?.ruta) ? latestCoursePlan.ruta : [];
  const weakActivities = [];
  route.forEach((module) => {
    (Array.isArray(module?.actividades) ? module.actividades : []).forEach((activity) => {
      const done = courseProgress?.completed?.[activity.id];
      if (!done) return;
      const score = Number(done.score);
      if (Number.isFinite(score) && score < 0.7) {
        weakActivities.push({
          label: `${module.titulo}: ${activity.titulo}`,
          score,
          feedback: done.feedback || '',
        });
      }
    });
  });
  insights.mistakes = weakActivities
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => item.feedback || item.label);

  return insights;
};

const renderCoursePlan = () => {
  if (!els.modulesList) return;
  els.modulesList.innerHTML = '';

  const route = Array.isArray(latestCoursePlan?.ruta) ? latestCoursePlan.ruta : [];
  if (!route.length) {
    els.modulesList.innerHTML = '<p class="hint">No hay módulos disponibles todavía.</p>';
    return;
  }

  route.forEach((module, moduleIndex) => {
    const card = document.createElement('div');
    card.className = 'module-card';

    const head = document.createElement('div');
    head.className = 'module-head';

    const left = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'module-title';
    title.textContent = module.titulo || `Modulo ${moduleIndex + 1}`;
    const desc = document.createElement('p');
    desc.className = 'module-desc';
    desc.textContent = module.descripcion || '';
    left.appendChild(title);
    left.appendChild(desc);

    const badges = document.createElement('div');
    badges.className = 'badges';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = CATEGORY_LABELS[module.categoria] || module.categoria || 'Curso';

    const lvlKey = normalizeModuleLevel(module.nivel);
    const lvl = document.createElement('span');
    lvl.className = `badge level ${lvlKey}`;
    lvl.textContent = LEVEL_LABELS[lvlKey] || 'Básico';

    badges.appendChild(badge);
    badges.appendChild(lvl);

    head.appendChild(left);
    head.appendChild(badges);

    const activities = Array.isArray(module.actividades) ? module.actividades : [];
    const completed = activities.filter((act) => Boolean(courseProgress?.completed?.[act.id])).length;
    const total = activities.length || 1;
    const pct = Math.round((completed / total) * 100);

    const mini = document.createElement('div');
    mini.className = 'progress-mini';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = `${pct}%`;
    mini.appendChild(fill);

    const actions = document.createElement('div');
    actions.className = 'module-actions';

    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = pct >= 100 ? 'Repasar' : pct > 0 ? 'Continuar' : 'Empezar';
    btn.addEventListener('click', () => openLesson(moduleIndex));

    actions.appendChild(btn);

    card.appendChild(head);
    card.appendChild(mini);
    card.appendChild(actions);
    els.modulesList.appendChild(card);
  });
};

const renderSummaryList = (element, items, emptyText) => {
  if (!element) return;
  element.innerHTML = '';
  if (!items.length) {
    element.innerHTML = `<p class="hint">${emptyText}</p>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'summary-item';
    card.textContent = item;
    element.appendChild(card);
  });
};

const renderHistory = () => {
  if (!els.historyList) return;
  els.historyList.innerHTML = '';
  const snapshots = Array.isArray(courseProgress?.snapshots) ? courseProgress.snapshots.slice(-5).reverse() : [];
  if (!snapshots.length) {
    els.historyList.innerHTML = '<p class="hint">Todavía no hay hitos guardados. En cuanto avances, aparecerán aquí.</p>';
    return;
  }

  snapshots.forEach((snapshot) => {
    const row = document.createElement('div');
    row.className = 'history-item';

    const left = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'history-title';
    title.textContent = `${snapshot.scoreTotal || 0}% de blindaje`;
    const meta = document.createElement('p');
    meta.className = 'history-meta';
    meta.textContent = `${formatDate(snapshot.at)} · ${snapshot.completedCount || 0} actividades registradas`;
    left.appendChild(title);
    left.appendChild(meta);

    row.appendChild(left);
    els.historyList.appendChild(row);
  });
};

const renderCoursesDashboard = () => {
  if (!latestCoursePlan || !courseProgress) return;
  const computed = computeCompetenciesFromProgress(latestCoursePlan, courseProgress);
  const insights = summarizeProgressInsights();
  setDonut(computed.score_total, latestCoursePlan.score_name);
  renderCompetencies(computed.competencias);
  renderCoursePlan();
  renderSummaryList(
    els.profileSummaryList,
    [
      `Fortalezas: ${insights.strengths.join(' · ') || 'Aún se están detectando.'}`,
      `Áreas a reforzar: ${insights.focus.join(' · ') || 'Seguimos recopilando señales.'}`,
      `Avance actual: ${Object.keys(courseProgress.completed || {}).length} actividades completadas.`,
    ],
    'La IA preparará un resumen en cuanto tengas actividad.'
  );
  renderSummaryList(
    els.mistakeList,
    insights.mistakes,
    'Aquí aparecerán señales específicas cuando detectemos errores frecuentes.'
  );
  renderHistory();
  if (els.courseReadyHint) els.courseReadyHint.classList.remove('hidden');
};

const defaultTopicsFromAnswers = () => {
  const set = new Set();
  const priority = answers.priority;
  if (priority === 'todo') {
    ['sms', 'whatsapp', 'web', 'llamadas', 'correo_redes', 'habitos'].forEach((t) => set.add(t));
    return Array.from(set);
  }
  if (priority) set.add(priority);

  const channels = Array.isArray(answers.channels) ? answers.channels : [];
  channels.forEach((ch) => {
    if (ch === 'correo' || ch === 'redes') set.add('correo_redes');
    else set.add(ch);
  });

  // Always keep habits as a safety baseline.
  set.add('habitos');

  if (set.size === 0) {
    ['sms', 'whatsapp', 'web', 'llamadas', 'habitos'].forEach((t) => set.add(t));
  }
  return Array.from(set);
};

const applyDefaultCoursePrefs = () => {
  if (!els.prefStyle || !els.prefDifficulty || !els.prefSession || !els.prefTopics) return;
  if (!els.prefStyle.value) els.prefStyle.value = 'mix';
  if (!els.prefDifficulty.value) els.prefDifficulty.value = 'auto';
  if (!els.prefSession.value) els.prefSession.value = '5-10';

  const topics = defaultTopicsFromAnswers();
  els.prefTopics.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = topics.includes(input.value);
  });
};

const readCoursePrefs = () => {
  const topics = [];
  if (els.prefTopics) {
    els.prefTopics.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      if (input.checked) topics.push(input.value);
    });
  }
  return {
    estilo: els.prefStyle ? els.prefStyle.value : 'mix',
    dificultad: els.prefDifficulty ? els.prefDifficulty.value : 'auto',
    duracion: els.prefSession ? els.prefSession.value : '5-10',
    temas: topics.length ? topics : defaultTopicsFromAnswers(),
  };
};

const generateCourse = async ({ reset } = { reset: false }) => {
  if (!latestAssessment) {
    alert('Primero completa la encuesta para generar tu ruta.');
    showView('survey');
    return;
  }

  if (els.courseSettings) els.courseSettings.classList.add('hidden');
  if (els.courseReadyHint) els.courseReadyHint.classList.add('hidden');
  if (els.modulesList) els.modulesList.innerHTML = '';

  if (els.courseLoading) els.courseLoading.classList.remove('hidden');
  const started = Date.now();

  try {
    const prefs = readCoursePrefs();
    const plan = await callBackend('/api/course', {
      answers,
      assessment: latestAssessment,
      prefs,
      progress: reset ? null : courseProgress,
    });

    latestCoursePlan = ensureCourseState(plan);
    courseProgress = ensureCourseProgress(latestCoursePlan, { reset });
    recordCourseSnapshot();
    persistState();
  } catch (error) {
    alert(`No se pudo generar el curso: ${error.message}`);
    latestCoursePlan = null;
    courseProgress = null;
  } finally {
    const elapsed = Date.now() - started;
    if (elapsed < 1300) await sleep(1300 - elapsed);
    if (els.courseLoading) els.courseLoading.classList.add('hidden');
  }

  if (latestCoursePlan && courseProgress) {
    renderCoursesDashboard();
  }
};

const enterCourses = async () => {
  showView('courses');
  applyDefaultCoursePrefs();

  if (latestCoursePlan && courseProgress) {
    renderCoursesDashboard();
    return;
  }

  setDonut(0, 'Blindaje Digital');
  renderCompetencies({});
  await generateCourse({ reset: true });
};

const renderParagraphs = (container, text) => {
  String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const p = document.createElement('p');
      p.textContent = line;
      container.appendChild(p);
    });
};

const getModuleAndActivity = (moduleIndex, activityIndex) => {
  const route = Array.isArray(latestCoursePlan?.ruta) ? latestCoursePlan.ruta : [];
  const module = route[moduleIndex];
  if (!module) return null;
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  const activity = activities[activityIndex];
  if (!activity) return null;
  return { module, activities, activity };
};

const pickNextActivityIndex = (moduleIndex) => {
  const route = Array.isArray(latestCoursePlan?.ruta) ? latestCoursePlan.ruta : [];
  const module = route[moduleIndex];
  if (!module) return 0;
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  if (!activities.length) return 0;

  // First: not completed
  const nextIncomplete = activities.findIndex((act) => !courseProgress?.completed?.[act.id]);
  if (nextIncomplete !== -1) return nextIncomplete;

  // Then: lowest score to encourage improvement
  let worst = 0;
  let worstScore = 2;
  activities.forEach((act, idx) => {
    const score = Number(courseProgress?.completed?.[act.id]?.score);
    const safe = Number.isFinite(score) ? score : 1;
    if (safe < worstScore) {
      worstScore = safe;
      worst = idx;
    }
  });
  return worst;
};

const setLessonMeta = (moduleIndex, activityIndex) => {
  const info = getModuleAndActivity(moduleIndex, activityIndex);
  if (!info) return;

  const { module, activities, activity } = info;
  const current = activityIndex + 1;
  const total = activities.length || 1;
  const pct = Math.round((current / total) * 100);

  if (els.lessonEyebrow) els.lessonEyebrow.textContent = `Módulo ${moduleIndex + 1}`;
  if (els.lessonTitle) els.lessonTitle.textContent = module.titulo || `Módulo ${moduleIndex + 1}`;
  if (els.lessonDesc) els.lessonDesc.textContent = module.descripcion || '';
  if (els.lessonBadge) els.lessonBadge.textContent = CATEGORY_LABELS[module.categoria] || module.categoria || 'Curso';
  if (els.lessonLevelBadge) {
    const lvlKey = normalizeModuleLevel(module.nivel);
    els.lessonLevelBadge.className = `badge level ${lvlKey}`;
    els.lessonLevelBadge.textContent = LEVEL_LABELS[lvlKey] || 'Básico';
  }
  if (els.lessonProgressText) {
    const typeLabel = activity.tipo ? ` • ${ACTIVITY_LABELS[activity.tipo] || activity.tipo}` : '';
    els.lessonProgressText.textContent = `Actividad ${current} de ${total} (${pct}%)${typeLabel}`;
  }
};

const markModuleVisited = (moduleIndex, activityIndex) => {
  const route = Array.isArray(latestCoursePlan?.ruta) ? latestCoursePlan.ruta : [];
  const module = route[moduleIndex];
  if (!module || !courseProgress) return;
  const entry = getModuleProgressEntry(module);
  if (!entry) return;
  entry.visits = clamp(Number(entry.visits) || 0, 0, 999) + 1;
  entry.lastActivityId =
    Array.isArray(module?.actividades) && module.actividades[activityIndex]
      ? module.actividades[activityIndex].id
      : entry.lastActivityId;
  courseProgress.lastAccessAt = new Date().toISOString();
  lessonActivityStartedAt = Date.now();
  persistState();
};

const markActivityCompleted = ({ moduleIndex, activityIndex, score, feedback, details = null }) => {
  const info = getModuleAndActivity(moduleIndex, activityIndex);
  if (!info) return;
  const { activity, module, activities } = info;

  const prev = courseProgress?.completed?.[activity.id];
  const attempts = clamp(Number(prev?.attempts) || 0, 0, 999) + 1;
  const durationMs = lessonActivityStartedAt ? Math.max(0, Date.now() - lessonActivityStartedAt) : 0;

  courseProgress.completed = courseProgress.completed || {};
  courseProgress.completed[activity.id] = {
    score: clamp(Number(score) || 0, 0, 1),
    attempts,
    feedback: String(feedback || prev?.feedback || '').slice(0, 600),
    durationMs,
    details,
    at: new Date().toISOString(),
  };

  const moduleEntry = getModuleProgressEntry(module);
  if (moduleEntry) {
    moduleEntry.lastActivityId = activity.id;
    moduleEntry.durationMs = clamp(Number(moduleEntry.durationMs) || 0, 0, Number.MAX_SAFE_INTEGER) + durationMs;
    const moduleDone = activities.every((item) => Boolean(courseProgress?.completed?.[item.id]));
    if (moduleDone && !moduleEntry.completedAt) {
      moduleEntry.completedAt = new Date().toISOString();
    }
  }

  courseProgress.lastAccessAt = new Date().toISOString();
  recordCourseSnapshot();

  persistState();
};

const renderModuleComplete = (moduleIndex) => {
  if (!els.lessonActivity) return;
  const route = Array.isArray(latestCoursePlan?.ruta) ? latestCoursePlan.ruta : [];
  const module = route[moduleIndex];

  els.lessonActivity.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'activity-head';

  const title = document.createElement('p');
  title.className = 'activity-title';
  title.textContent = 'Módulo completado';

  const type = document.createElement('span');
  type.className = 'activity-type';
  type.textContent = module?.titulo ? 'Siguiente paso' : 'Listo';

  head.appendChild(title);
  head.appendChild(type);

  const body = document.createElement('div');
  body.className = 'activity-body';
  const p = document.createElement('p');
  p.textContent =
    'Buen trabajo. Si quieres subir tu blindaje más rápido, repasa las actividades donde te costó más.';
  body.appendChild(p);

  const actions = document.createElement('div');
  actions.className = 'activity-actions';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn primary';
  backBtn.textContent = 'Volver a cursos';
  backBtn.addEventListener('click', () => {
    showView('courses');
    renderCoursesDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn ghost';
  retryBtn.textContent = 'Repasar módulo';
  retryBtn.addEventListener('click', () => renderLessonActivity(moduleIndex, 0));

  actions.appendChild(backBtn);
  actions.appendChild(retryBtn);

  els.lessonActivity.appendChild(head);
  els.lessonActivity.appendChild(body);
  els.lessonActivity.appendChild(actions);
};

const renderLessonActivity = (moduleIndex, activityIndex) => {
  if (!els.lessonActivity || !latestCoursePlan || !courseProgress) return;
  const info = getModuleAndActivity(moduleIndex, activityIndex);
  if (!info) return;
  const { module, activities, activity } = info;

  currentLesson = { moduleIndex, activityIndex };
  markModuleVisited(moduleIndex, activityIndex);
  setLessonMeta(moduleIndex, activityIndex);
  els.lessonActivity.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'activity-head';

  const title = document.createElement('p');
  title.className = 'activity-title';
  title.textContent = activity.titulo || 'Actividad';

  const type = document.createElement('span');
  type.className = 'activity-type';
  type.textContent = ACTIVITY_LABELS[activity.tipo] || activity.tipo || 'Actividad';

  head.appendChild(title);
  head.appendChild(type);

  const body = document.createElement('div');
  body.className = 'activity-body';

  const feedback = document.createElement('div');
  feedback.className = 'feedback hidden';

  const actions = document.createElement('div');
  actions.className = 'activity-actions';

  const quitBtn = document.createElement('button');
  quitBtn.className = 'btn ghost';
  quitBtn.textContent = 'Salir del módulo';
  quitBtn.addEventListener('click', () => {
    showView('courses');
    renderCoursesDashboard();
  });
  actions.appendChild(quitBtn);

  const clearPrimaryActions = () => {
    while (actions.firstChild && actions.firstChild !== quitBtn) {
      actions.removeChild(actions.firstChild);
    }
  };

  const addPrimaryActions = (...nodes) => {
    nodes.filter(Boolean).forEach((node) => actions.insertBefore(node, quitBtn));
  };

  const replacePrimaryActions = (...nodes) => {
    clearPrimaryActions();
    addPrimaryActions(...nodes);
  };

  const goNext = () => {
    const next = activityIndex + 1;
    if (next < activities.length) {
      renderLessonActivity(moduleIndex, next);
      return;
    }
    renderModuleComplete(moduleIndex);
  };

  const completeAndNext = (score, fbText, details = null) => {
    markActivityCompleted({ moduleIndex, activityIndex, score, feedback: fbText, details });
    renderCoursesDashboard();
    goNext();
  };

  const showFeedback = (text) => {
    feedback.classList.remove('hidden');
    feedback.textContent = text;
  };

  if (activity.tipo === 'simulacion' || activity.tipo === 'quiz') {
    renderParagraphs(body, activity.escenario);
    const options = Array.isArray(activity.opciones) ? activity.opciones : [];
    const correctIndex = Number(activity.correcta);

    let answered = false;
    options.forEach((optionText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';
      btn.textContent = optionText;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const isCorrect = idx === correctIndex;
        btn.classList.add(isCorrect ? 'correct' : 'wrong');
        showFeedback(activity.explicacion || (isCorrect ? 'Bien.' : 'Casi. Intenta otra vez.'));

        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn primary';
        continueBtn.textContent = 'Continuar';
        continueBtn.addEventListener('click', () => {
          completeAndNext(isCorrect ? 1 : 0.6, activity.explicacion, {
            selectedIndex: idx,
            selectedText: optionText,
            correctIndex,
            correctText: options[correctIndex] || '',
          });
        });

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn ghost';
        retryBtn.textContent = 'Reintentar';
        retryBtn.addEventListener('click', () => {
          renderLessonActivity(moduleIndex, activityIndex);
        });

        replacePrimaryActions(continueBtn, isCorrect ? null : retryBtn);
      });
      body.appendChild(btn);
    });
  } else if (activity.tipo === 'checklist') {
    renderParagraphs(body, activity.intro || 'Marca cada punto antes de continuar.');
    const items = Array.isArray(activity.items) ? activity.items : [];

    const boxWrap = document.createElement('div');
    boxWrap.className = 'question-body';

    const state = items.map(() => false);
    const allChecked = () => state.every(Boolean);

    items.forEach((item, idx) => {
      const label = document.createElement('label');
      label.className = 'option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      const span = document.createElement('span');
      span.textContent = item;
      label.appendChild(input);
      label.appendChild(span);
      input.addEventListener('change', () => {
        state[idx] = input.checked;
      });
      boxWrap.appendChild(label);
    });

    body.appendChild(boxWrap);

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn primary';
    doneBtn.textContent = 'Listo';
    doneBtn.addEventListener('click', () => {
      if (!allChecked()) {
        showFeedback('Marca todos los puntos para continuar.');
        return;
      }
      completeAndNext(1, 'Checklist completado.', {
        checkedItems: items,
        totalItems: items.length,
      });
    });
    addPrimaryActions(doneBtn);
  } else if (activity.tipo === 'abierta') {
    renderParagraphs(body, activity.prompt);
    if (Array.isArray(activity.pistas) && activity.pistas.length) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = `Tip: ${activity.pistas.join(' • ')}`;
      body.appendChild(hint);
    }

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Escribe tu respuesta (no incluyas datos reales como contraseñas o NIP).';
    body.appendChild(textarea);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn primary';
    submitBtn.textContent = 'Enviar';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn ghost';
    retryBtn.textContent = 'Mejorar respuesta';
    retryBtn.disabled = true;

    const setBusy = (busy) => {
      submitBtn.disabled = busy;
      retryBtn.disabled = busy;
      textarea.disabled = busy;
      if (busy) submitBtn.textContent = 'Analizando…';
      else submitBtn.textContent = 'Enviar';
    };

    const grade = async () => {
      const answerText = textarea.value.trim();
      if (answerText.length < 6) {
        showFeedback('Escribe un poco más para poder evaluarlo.');
        return;
      }
      setBusy(true);
      try {
        const resp = await callBackend('/api/course/grade-open', {
          prompt: activity.prompt,
          answer: answerText,
          module,
          activity,
          user: { answers, assessment: latestAssessment },
        });
        const score = clamp(Number(resp?.score) || 0, 0, 1);
        const fb = String(resp?.feedback || 'Listo.').trim();
        showFeedback(fb);

        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn primary';
        continueBtn.textContent = 'Continuar';
        continueBtn.addEventListener('click', () =>
          completeAndNext(score, fb, {
            answer: answerText.slice(0, 600),
          })
        );

        replacePrimaryActions(continueBtn, retryBtn);
        retryBtn.disabled = false;
        retryBtn.addEventListener('click', () => {
          renderLessonActivity(moduleIndex, activityIndex);
        });
      } catch (err) {
        showFeedback(`No pude evaluar con IA. ${err.message || ''}`.trim());
      } finally {
        setBusy(false);
      }
    };

    submitBtn.addEventListener('click', grade);
    addPrimaryActions(submitBtn);
  } else if (activity.tipo === 'sim_chat') {
    const intro = document.createElement('p');
    intro.className = 'hint';
    intro.textContent =
      'Simulación real: la IA actuará como estafador. Tu objetivo es NO caer y verificar por canales oficiales.';
    body.appendChild(intro);

    renderParagraphs(body, activity.escenario);

    const messages = document.createElement('div');
    messages.className = 'chat-messages';
    messages.style.maxHeight = '320px';
    messages.style.minHeight = '220px';

    const session =
      simSessions.get(activity.id) || { history: [], done: false, bestScore: 0, turns: 0 };
    simSessions.set(activity.id, session);

    const pushMsg = (text, who) => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${who}`;
      bubble.textContent = text;
      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
    };

    if (session.history.length === 0) {
      const opening = activity.inicio || 'Hola, soy soporte. Necesito confirmar unos datos rapido.';
      session.history.push({ role: 'scammer', content: opening });
    }

    messages.innerHTML = '';
    session.history.forEach((m) => pushMsg(m.content, m.role === 'user' ? 'user' : 'bot'));
    body.appendChild(messages);

    const form = document.createElement('form');
    form.className = 'chat-form';
    form.addEventListener('submit', (e) => e.preventDefault());

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Responde (sin datos reales)…';

    const send = document.createElement('button');
    send.className = 'btn primary';
    send.type = 'submit';
    send.textContent = 'Enviar';

    const setBusy = (busy) => {
      input.disabled = busy;
      send.disabled = busy;
      send.textContent = busy ? '…' : 'Enviar';
    };

    form.appendChild(input);
    form.appendChild(send);
    body.appendChild(form);

    const finish = (finalScore, fb) => {
      showFeedback(fb);
      const doneBtn = document.createElement('button');
      doneBtn.className = 'btn primary';
      doneBtn.textContent = 'Finalizar simulación';
      doneBtn.addEventListener('click', () =>
        completeAndNext(finalScore, fb, {
          turns: session.turns,
          transcript: session.history.slice(-8),
        })
      );
      replacePrimaryActions(doneBtn);
    };

    form.addEventListener('submit', async () => {
      const text = input.value.trim();
      if (!text || session.done) return;
      input.value = '';
      session.turns += 1;

      session.history.push({ role: 'user', content: text });
      pushMsg(text, 'user');
      setBusy(true);

      try {
        const resp = await callBackend('/api/course/sim-turn', {
          scenario: activity.escenario,
          history: session.history,
          userMessage: text,
          turn: session.turns,
          turnos_max: activity.turnos_max,
          user: { answers, assessment: latestAssessment },
        });

        const scammerReply = String(resp?.reply || '').trim();
        if (scammerReply) {
          session.history.push({ role: 'scammer', content: scammerReply });
          pushMsg(scammerReply, 'bot');
        }

        const coachFeedback = String(resp?.coach_feedback || '').trim();
        if (coachFeedback) showFeedback(coachFeedback);

        const score = clamp(Number(resp?.score) || 0, 0, 1);
        session.bestScore = Math.max(session.bestScore, score);
        session.done = Boolean(resp?.done) || session.turns >= activity.turnos_max;

        if (session.done) {
          finish(session.bestScore, coachFeedback || 'Simulación terminada.');
        }
      } catch (err) {
        showFeedback(`No pude continuar la simulación. ${err.message || ''}`.trim());
      } finally {
        setBusy(false);
      }
    });
  } else if (activity.tipo === 'compare_domains') {
    renderParagraphs(body, activity.prompt || 'Elige el dominio legítimo.');
    const domains = Array.isArray(activity.dominios) ? activity.dominios : [];
    const correctIndex = clamp(Number(activity.correcta) || 0, 0, Math.max(0, domains.length - 1));

    let answered = false;
    const buttons = [];
    domains.forEach((domain, idx) => {
      const btn = document.createElement('button');
      btn.className = 'domain-btn';
      btn.type = 'button';
      btn.textContent = domain;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const isCorrect = idx === correctIndex;
        btn.classList.add(isCorrect ? 'correct' : 'wrong');
        buttons.forEach((b, bIdx) => {
          if (bIdx === correctIndex) b.classList.add('correct');
          b.disabled = true;
        });

        const expl =
          activity.explicacion ||
          (isCorrect
            ? 'Bien: elegiste el dominio más consistente.'
            : 'Ojo: en estafas, cambian letras o agregan palabras al dominio.');
        const tip = activity.tip ? `Tip: ${activity.tip}` : '';
        showFeedback(`${expl}${tip ? `\n\n${tip}` : ''}`.trim());

        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn primary';
        continueBtn.textContent = 'Continuar';
        continueBtn.addEventListener('click', () => {
          completeAndNext(isCorrect ? 1 : 0.6, expl, {
            selectedDomain: domain,
            correctDomain: domains[correctIndex] || '',
          });
        });

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn ghost';
        retryBtn.textContent = 'Reintentar';
        retryBtn.addEventListener('click', () => renderLessonActivity(moduleIndex, activityIndex));

        replacePrimaryActions(continueBtn, isCorrect ? null : retryBtn);
      });
      buttons.push(btn);
      body.appendChild(btn);
    });
  } else if (activity.tipo === 'signal_hunt') {
    const msg = document.createElement('div');
    msg.className = 'message-box';
    msg.textContent = activity.mensaje || '';
    body.appendChild(msg);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'signal-list';

    const senales = Array.isArray(activity.senales) ? activity.senales : [];
    const chosen = new Set();
    const rows = new Map();

    senales.forEach((sig) => {
      const row = document.createElement('label');
      row.className = 'signal-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      const text = document.createElement('span');
      text.textContent = sig.label;
      row.appendChild(input);
      row.appendChild(text);
      input.addEventListener('change', () => {
        if (input.checked) chosen.add(sig.id);
        else chosen.delete(sig.id);
      });
      rows.set(sig.id, row);
      optionsWrap.appendChild(row);
    });

    body.appendChild(optionsWrap);

    const evalBtn = document.createElement('button');
    evalBtn.className = 'btn primary';
    evalBtn.textContent = 'Evaluar';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn ghost';
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', () => renderLessonActivity(moduleIndex, activityIndex));

    const computeF1 = (tp, fp, fn) => {
      const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
      const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
      if (precision + recall === 0) return 0;
      return (2 * precision * recall) / (precision + recall);
    };

    evalBtn.addEventListener('click', () => {
      const correctIds = new Set(senales.filter((s) => s.correcta).map((s) => s.id));
      let tp = 0;
      let fp = 0;
      let fn = 0;
      chosen.forEach((id) => {
        if (correctIds.has(id)) tp += 1;
        else fp += 1;
      });
      correctIds.forEach((id) => {
        if (!chosen.has(id)) fn += 1;
      });

      const score = clamp(computeF1(tp, fp, fn), 0, 1);
      const totalCorrect = correctIds.size || 1;
      const found = tp;

      senales.forEach((sig) => {
        const row = rows.get(sig.id);
        if (!row) return;
        row.classList.add('done');
        if (chosen.has(sig.id) && sig.correcta) row.classList.add('correct');
        if (chosen.has(sig.id) && !sig.correcta) row.classList.add('wrong');
        if (!chosen.has(sig.id) && sig.correcta) row.classList.add('missed');
      });

      const rating = score >= 0.85 ? 'Buena' : score >= 0.6 ? 'Regular' : 'Riesgosa';
      const missed = senales.filter((s) => s.correcta && !chosen.has(s.id)).map((s) => s.label);
      const extra = missed.length ? `Te faltó detectar: ${missed.slice(0, 3).join(', ')}.` : 'Detectaste las señales clave.';
      const fb = `Resultado: ${rating}. Encontraste ${found}/${totalCorrect} señales.\n${extra}`.trim();
      showFeedback(fb);

      const continueBtn = document.createElement('button');
      continueBtn.className = 'btn primary';
      continueBtn.textContent = 'Continuar';
      continueBtn.addEventListener('click', () =>
        completeAndNext(score, fb, {
          selectedSignals: senales
            .filter((sig) => chosen.has(sig.id))
            .map((sig) => sig.label),
        })
      );

      replacePrimaryActions(continueBtn, retryBtn);
    });

    addPrimaryActions(evalBtn);
  } else if (activity.tipo === 'inbox') {
    if (activity.intro) renderParagraphs(body, activity.intro);
    const kind = activity.kind === 'sms' ? 'SMS' : 'Correo';

    const list = document.createElement('div');
    list.className = 'inbox';

    const msgs = Array.isArray(activity.mensajes) ? activity.mensajes : [];
    const selections = new Map();
    const cards = new Map();

    const updateEval = (btn) => {
      btn.disabled = selections.size !== msgs.length;
    };

    const makeChoiceBtn = (label, choice, msgId, btnGroup) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inbox-choice';
      b.textContent = label;
      b.addEventListener('click', () => {
        selections.set(msgId, choice);
        btnGroup.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
      return b;
    };

    msgs.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'inbox-item';

      const top = document.createElement('div');
      top.className = 'inbox-top';

      const left = document.createElement('div');
      const from = document.createElement('p');
      from.className = 'inbox-from';
      from.textContent = m.from || (kind === 'SMS' ? 'Remitente desconocido' : 'Correo desconocido');
      left.appendChild(from);

      if (m.subject) {
        const subject = document.createElement('p');
        subject.className = 'inbox-subject';
        subject.textContent = m.subject;
        left.appendChild(subject);
      }

      const tag = document.createElement('span');
      tag.className = 'inbox-tag';
      tag.textContent = kind;

      top.appendChild(left);
      top.appendChild(tag);

      const text = document.createElement('p');
      text.className = 'inbox-text';
      text.textContent = m.text;

      const choices = document.createElement('div');
      choices.className = 'inbox-choices';
      const safeBtn = makeChoiceBtn('Seguro', 'seguro', m.id, choices);
      const scamBtn = makeChoiceBtn('Estafa', 'estafa', m.id, choices);
      choices.appendChild(safeBtn);
      choices.appendChild(scamBtn);

      card.appendChild(top);
      card.appendChild(text);
      card.appendChild(choices);

      list.appendChild(card);
      cards.set(m.id, card);
    });

    body.appendChild(list);

    const evalBtn = document.createElement('button');
    evalBtn.className = 'btn primary';
    evalBtn.textContent = 'Evaluar';
    evalBtn.disabled = true;

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn ghost';
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', () => renderLessonActivity(moduleIndex, activityIndex));

    // enable eval when all selected
    const obs = new MutationObserver(() => updateEval(evalBtn));
    obs.observe(body, { subtree: true, attributes: true, attributeFilter: ['class'] });

    evalBtn.addEventListener('click', () => {
      obs.disconnect();
      let ok = 0;
      msgs.forEach((m) => {
        const picked = selections.get(m.id);
        const correct = m.correcto === 'estafa' ? 'estafa' : 'seguro';
        const card = cards.get(m.id);
        if (!card) return;
        if (picked === correct) {
          ok += 1;
          card.classList.add('correct');
        } else {
          card.classList.add('wrong');
        }
        if (m.explicacion) {
          const expl = document.createElement('p');
          expl.className = 'inbox-expl';
          expl.textContent = m.explicacion;
          card.appendChild(expl);
        }
      });

      const score = msgs.length ? clamp(ok / msgs.length, 0, 1) : 1;
      const rating = score >= 0.85 ? 'Buena' : score >= 0.6 ? 'Regular' : 'Riesgosa';
      const fb = `Resultado: ${rating}. Acertaste ${ok}/${msgs.length}.`;
      showFeedback(fb);

      const continueBtn = document.createElement('button');
      continueBtn.className = 'btn primary';
      continueBtn.textContent = 'Continuar';
      continueBtn.addEventListener('click', () =>
        completeAndNext(score, fb, {
          selections: msgs.map((m) => ({
            from: m.from,
            picked: selections.get(m.id) || 'sin responder',
            correct: m.correcto === 'estafa' ? 'estafa' : 'seguro',
          })),
        })
      );

      replacePrimaryActions(continueBtn, retryBtn);
    });

    // Hook selection updates
    body.addEventListener('click', () => updateEval(evalBtn));
    addPrimaryActions(evalBtn);
  } else if (activity.tipo === 'web_lab') {
    if (activity.intro) renderParagraphs(body, activity.intro);

    const page = activity.pagina || {};
    const hotspots = Array.isArray(activity.hotspots) ? activity.hotspots : [];
    const hotspotByTarget = new Map(hotspots.map((h) => [h.target, h]));
    const flagged = new Set();
    const elements = new Map();

    const lab = document.createElement('div');
    lab.className = 'web-lab';

    const bar = document.createElement('div');
    bar.className = 'web-lab-bar hotspot';
    bar.dataset.hotspot = 'domain';
    bar.textContent = `https://${page.dominio || 'tienda-promos.shop'}`;
    lab.appendChild(bar);
    elements.set('domain', bar);

    const hero = document.createElement('div');
    hero.className = 'web-lab-hero';
    const brand = document.createElement('p');
    brand.className = 'web-lab-brand';
    brand.textContent = page.marca || 'NovaTienda';
    const banner = document.createElement('p');
    banner.className = 'web-lab-banner hotspot';
    banner.dataset.hotspot = 'banner';
    banner.textContent = page.banner || 'OFERTA ESPECIAL HOY';
    const sub = document.createElement('p');
    sub.className = 'web-lab-sub';
    sub.textContent = page.sub || 'Compra segura y envío rápido.';
    hero.appendChild(brand);
    hero.appendChild(banner);
    hero.appendChild(sub);
    lab.appendChild(hero);
    elements.set('banner', banner);

    const grid = document.createElement('div');
    grid.className = 'web-lab-grid';
    const cart = { count: 0 };
    const cartPill = document.createElement('span');
    cartPill.className = 'web-lab-cart';
    cartPill.textContent = 'Carrito: 0';

    (Array.isArray(page.productos) ? page.productos : []).forEach((p) => {
      const card = document.createElement('div');
      card.className = 'web-lab-product';
      const name = document.createElement('p');
      name.className = 'web-lab-product-name';
      name.textContent = p.nombre;
      const price = document.createElement('p');
      price.className = 'web-lab-product-price';
      price.textContent = p.antes ? `${p.antes} → ${p.precio}` : p.precio;
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn ghost web-lab-add';
      add.textContent = 'Agregar';
      add.addEventListener('click', () => {
        cart.count += 1;
        cartPill.textContent = `Carrito: ${cart.count}`;
      });
      card.appendChild(name);
      card.appendChild(price);
      card.appendChild(add);
      grid.appendChild(card);
    });
    lab.appendChild(cartPill);
    lab.appendChild(grid);

    const footer = document.createElement('div');
    footer.className = 'web-lab-footer hotspot';
    footer.dataset.hotspot = 'contacto';
    footer.textContent = page.contacto || 'Contacto: solo por mensaje (sin dirección).';
    lab.appendChild(footer);
    elements.set('contacto', footer);

    const checkout = document.createElement('div');
    checkout.className = 'web-lab-checkout hotspot';
    checkout.dataset.hotspot = 'pago';
    const payTitle = document.createElement('p');
    payTitle.className = 'web-lab-pay-title';
    payTitle.textContent = 'Pago';
    const payText = document.createElement('p');
    payText.className = 'web-lab-pay-text';
    const payments = Array.isArray(page.pagos) && page.pagos.length ? page.pagos.join(' • ') : 'Transferencia bancaria (único método)';
    payText.textContent = payments;
    const payBtn = document.createElement('button');
    payBtn.type = 'button';
    payBtn.className = 'btn primary web-lab-pay';
    payBtn.textContent = 'Pagar';
    payBtn.addEventListener('click', () => {
      showFeedback('Antes de pagar, revisa bien el dominio, el contacto y el método de pago.');
    });
    checkout.appendChild(payTitle);
    checkout.appendChild(payText);
    checkout.appendChild(payBtn);
    lab.appendChild(checkout);
    elements.set('pago', checkout);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Modo detective: haz click en lo que te parezca sospechoso.';

    const hud = document.createElement('div');
    hud.className = 'web-lab-hud';
    const counter = document.createElement('span');
    counter.className = 'web-lab-counter';
    counter.textContent = 'Señales marcadas: 0';
    hud.appendChild(counter);

    const updateCounter = () => {
      counter.textContent = `Señales marcadas: ${flagged.size}`;
    };

    const toggleFlag = (target) => {
      const el = elements.get(target);
      if (!el) return;
      if (flagged.has(target)) {
        flagged.delete(target);
        el.classList.remove('flagged');
      } else {
        flagged.add(target);
        el.classList.add('flagged');
      }
      updateCounter();
    };

    lab.addEventListener('click', (e) => {
      const t = e.target instanceof HTMLElement ? e.target.closest('[data-hotspot]') : null;
      if (!t) return;
      const target = String(t.dataset.hotspot || '').trim();
      if (!target) return;
      toggleFlag(target);
    });

    body.appendChild(hint);
    body.appendChild(lab);
    body.appendChild(hud);

    const evalBtn = document.createElement('button');
    evalBtn.className = 'btn primary';
    evalBtn.textContent = 'Evaluar';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn ghost';
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', () => renderLessonActivity(moduleIndex, activityIndex));

    const computeF1 = (tp, fp, fn) => {
      const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
      const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
      if (precision + recall === 0) return 0;
      return (2 * precision * recall) / (precision + recall);
    };

    evalBtn.addEventListener('click', () => {
      const correctTargets = new Set(hotspots.filter((h) => h.correcta).map((h) => h.target));
      let tp = 0;
      let fp = 0;
      let fn = 0;
      flagged.forEach((t) => {
        if (correctTargets.has(t)) tp += 1;
        else fp += 1;
      });
      correctTargets.forEach((t) => {
        if (!flagged.has(t)) fn += 1;
      });
      const score = clamp(computeF1(tp, fp, fn), 0, 1);

      // annotate elements
      correctTargets.forEach((t) => {
        const el = elements.get(t);
        if (!el) return;
        if (flagged.has(t)) el.classList.add('correct');
        else el.classList.add('missed');
      });
      flagged.forEach((t) => {
        if (correctTargets.has(t)) return;
        const el = elements.get(t);
        if (el) el.classList.add('wrong');
      });

      const missed = Array.from(correctTargets).filter((t) => !flagged.has(t));
      const fb = missed.length
        ? `Te faltó marcar ${missed.length} señal(es). En tiendas falsas, esos detalles son claves.`
        : 'Bien: marcaste las señales principales de riesgo.';
      showFeedback(fb);

      const continueBtn = document.createElement('button');
      continueBtn.className = 'btn primary';
      continueBtn.textContent = 'Continuar';
      continueBtn.addEventListener('click', () =>
        completeAndNext(score, fb, {
          flaggedTargets: Array.from(flagged),
          cartCount: cart.count,
        })
      );

      replacePrimaryActions(continueBtn, retryBtn);
    });

    addPrimaryActions(evalBtn);
  } else if (activity.tipo === 'scenario_flow') {
    if (activity.intro) renderParagraphs(body, activity.intro);
    const pasos = Array.isArray(activity.pasos) ? activity.pasos : [];
    let step = 0;
    const scores = [];
    const flowChoices = [];

    const stepWrap = document.createElement('div');
    stepWrap.className = 'flow';
    body.appendChild(stepWrap);

    const renderStep = () => {
      stepWrap.innerHTML = '';
      feedback.classList.add('hidden');

      const st = pasos[step];
      if (!st) {
        const final = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
        const fb = 'Simulación terminada.';
        showFeedback(fb);
        const doneBtn = document.createElement('button');
        doneBtn.className = 'btn primary';
        doneBtn.textContent = 'Continuar';
        doneBtn.addEventListener('click', () =>
          completeAndNext(final, fb, { flowChoices })
        );
        replacePrimaryActions(doneBtn);
        return;
      }

      const text = document.createElement('p');
      text.className = 'flow-text';
      text.textContent = st.texto;
      stepWrap.appendChild(text);

      (Array.isArray(st.opciones) ? st.opciones : []).forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.textContent = opt.texto;
        btn.addEventListener('click', () => {
          // lock options
          stepWrap.querySelectorAll('button').forEach((b) => (b.disabled = true));
          const score = clamp(Number(opt.puntaje) || 0.6, 0, 1);
          scores.push(score);
          flowChoices.push({
            step: st.texto,
            choice: opt.texto,
            score,
          });
          const fb = opt.feedback || 'Listo. En una situación real, verifica por un canal oficial.';
          showFeedback(fb);

          const nextIndex =
            Number.isFinite(Number(opt.siguiente)) ? Number(opt.siguiente) : step + 1;
          const continueBtn = document.createElement('button');
          continueBtn.className = 'btn primary';
          continueBtn.textContent = nextIndex < pasos.length ? 'Siguiente' : 'Finalizar';
          continueBtn.addEventListener('click', () => {
            if (nextIndex < pasos.length) {
              step = nextIndex;
              renderStep();
              replacePrimaryActions();
              return;
            }
            const final = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
            completeAndNext(final, fb, { flowChoices });
          });

          replacePrimaryActions(continueBtn);
        });
        stepWrap.appendChild(btn);
      });
    };

    renderStep();
  } else {
    renderParagraphs(body, activity.contenido);
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn primary';
    doneBtn.textContent = 'Continuar';
    doneBtn.addEventListener('click', () => completeAndNext(1, 'Actividad completada.', {
      viewed: true,
    }));
    addPrimaryActions(doneBtn);
  }

  els.lessonActivity.appendChild(head);
  els.lessonActivity.appendChild(body);
  els.lessonActivity.appendChild(feedback);
  els.lessonActivity.appendChild(actions);
  els.lessonActivity.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const openLesson = (moduleIndex) => {
  if (!latestCoursePlan || !courseProgress) return;
  showView('lesson');
  const nextActivityIndex = pickNextActivityIndex(moduleIndex);
  renderLessonActivity(moduleIndex, nextActivityIndex);
};

const renderMetricCards = (items) => {
  if (!els.adminOverview) return;
  els.adminOverview.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'stat-card';

    const label = document.createElement('p');
    label.className = 'stat-label';
    label.textContent = item.label;

    const value = document.createElement('p');
    value.className = 'stat-value';
    value.textContent = item.value;

    const note = document.createElement('p');
    note.className = 'stat-note';
    note.textContent = item.note;

    card.appendChild(label);
    card.appendChild(value);
    card.appendChild(note);
    els.adminOverview.appendChild(card);
  });
};

const renderBars = (element, items, { valueKey = 'value', labelKey = 'label', suffix = '', max = null } = {}) => {
  if (!element) return;
  element.innerHTML = '';
  if (!items.length) {
    element.innerHTML = '<p class="hint">Todavía no hay suficientes datos.</p>';
    return;
  }

  const peak = max || Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'analytics-bar-row';

    const top = document.createElement('div');
    top.className = 'analytics-bar-top';

    const label = document.createElement('span');
    label.className = 'analytics-bar-label';
    label.textContent = item[labelKey];

    const value = document.createElement('span');
    value.className = 'analytics-bar-value';
    value.textContent = `${item[valueKey]}${suffix}`;

    top.appendChild(label);
    top.appendChild(value);

    const track = document.createElement('div');
    track.className = 'analytics-bar-track';
    const fill = document.createElement('div');
    fill.className = 'analytics-bar-fill';
    fill.style.width = `${((Number(item[valueKey]) || 0) / peak) * 100}%`;
    track.appendChild(fill);

    row.appendChild(top);
    row.appendChild(track);
    element.appendChild(row);
  });
};

const renderAdminTable = (tbody, rows, columns) => {
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = columns.length;
    td.textContent = 'Todavía no hay datos suficientes.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((column) => {
      const td = document.createElement('td');
      td.textContent = column.format ? column.format(row[column.key], row) : row[column.key];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
};

const renderAdminAnalytics = (data) => {
  latestAnalytics = data;
  renderMetricCards([
    {
      label: 'Usuarios totales',
      value: data?.overview?.totalUsers ?? 0,
      note: `${data?.overview?.activeUsers7d ?? 0} activos en los últimos 7 días`,
    },
    {
      label: 'Blindaje promedio',
      value: `${data?.overview?.averageShield ?? 0}%`,
      note: `Mejora media: ${data?.overview?.averageImprovement ?? 0} puntos`,
    },
    {
      label: 'Finalización de módulos',
      value: `${data?.overview?.moduleCompletionRate ?? 0}%`,
      note: `Actividades completadas: ${data?.overview?.activityCompletionRate ?? 0}%`,
    },
    {
      label: 'Días para notar mejora',
      value:
        data?.overview?.avgDaysToImprove === null || data?.overview?.avgDaysToImprove === undefined
          ? '—'
          : `${data.overview.avgDaysToImprove}`,
      note: 'Promedio para superar el nivel base',
    },
  ]);

  renderBars(els.ageChart, data?.ageBuckets || [], { valueKey: 'count', labelKey: 'label' });
  renderBars(els.vulnerabilityChart, (data?.vulnerabilityByTopic || []).slice(0, 6), {
    valueKey: 'vulnerableCount',
    labelKey: 'label',
  });
  renderBars(els.topicPerformanceChart, data?.topicPerformance || [], {
    valueKey: 'avgScore',
    labelKey: 'label',
    suffix: '%',
    max: 100,
  });
  renderBars(els.decisionChart, data?.decisionMix || [], {
    valueKey: 'value',
    labelKey: 'label',
  });
  renderBars(els.improvementAgeChart, data?.improvementByAge || [], {
    valueKey: 'avgImprovement',
    labelKey: 'age',
    suffix: ' pts',
  });

  if (els.trendList) {
    els.trendList.innerHTML = '';
    const trend = Array.isArray(data?.learningTrend) ? data.learningTrend.slice(-7).reverse() : [];
    if (!trend.length) {
      els.trendList.innerHTML = '<p class="hint">Aún no hay suficiente historial para esta gráfica.</p>';
    } else {
      trend.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'history-item';
        row.innerHTML = `
          <div>
            <p class="history-title">${item.avgScore}% de blindaje promedio</p>
            <p class="history-meta">${item.day}</p>
          </div>
        `;
        els.trendList.appendChild(row);
      });
    }
  }

  renderAdminTable(
    els.moduleTableBody,
    Array.isArray(data?.modulePerformance) ? data.modulePerformance.slice(0, 12) : [],
    [
      { key: 'title' },
      { key: 'category', format: (value) => CATEGORY_LABELS[value] || value },
      { key: 'level', format: (value) => LEVEL_LABELS[value] || value },
      { key: 'avgScore', format: (value) => `${value}%` },
      { key: 'completionRate', format: (value) => `${value}%` },
      { key: 'avgTimeMin', format: (value) => `${value} min` },
    ]
  );

  renderAdminTable(
    els.userTableBody,
    Array.isArray(data?.users) ? data.users.slice(0, 20) : [],
    [
      { key: 'email' },
      { key: 'age' },
      { key: 'initialLevel' },
      { key: 'currentShield', format: (value) => `${value}%` },
      { key: 'improvement', format: (value) => `${value} pts` },
      { key: 'progressPercent', format: (value) => `${value}%` },
      { key: 'lastAccessAt', format: (value) => formatDate(value) },
    ]
  );
};

const loadAdminAnalytics = async () => {
  if (currentUser?.role !== 'admin') return;
  if (els.adminOverview) {
    els.adminOverview.innerHTML = '<p class="hint">Cargando métricas…</p>';
  }
  try {
    const data = await apiRequest('/api/admin/analytics', { method: 'GET' });
    renderAdminAnalytics(data);
  } catch (error) {
    if (els.adminOverview) {
      els.adminOverview.innerHTML = `<p class="hint">No se pudieron cargar las métricas: ${error.message}</p>`;
    }
  }
};

const exportAnalytics = () => {
  if (!latestAnalytics) return;
  const blob = new Blob([JSON.stringify(latestAnalytics, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `escudo-analytics-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Event wiring
els.showLoginBtn?.addEventListener('click', () => setAuthMode('login'));
els.showRegisterBtn?.addEventListener('click', () => setAuthMode('register'));

els.authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = els.authEmail?.value?.trim() || '';
  const password = els.authPassword?.value || '';
  if (!email || !password) return;

  if (els.authSubmitBtn) {
    els.authSubmitBtn.disabled = true;
    els.authSubmitBtn.textContent = authMode === 'login' ? 'Entrando…' : 'Creando…';
  }
  if (els.authError) {
    els.authError.classList.add('hidden');
    els.authError.textContent = '';
  }

  try {
    const data = await apiRequest(
      authMode === 'login' ? '/api/auth/login' : '/api/auth/register',
      {
        method: 'POST',
        payload: { email, password },
        includeAuth: false,
      }
    );
    handleAuthSuccess(data);
    if (els.authPassword) els.authPassword.value = '';
  } catch (error) {
    if (els.authError) {
      els.authError.textContent = error.message;
      els.authError.classList.remove('hidden');
    }
  } finally {
    if (els.authSubmitBtn) {
      els.authSubmitBtn.disabled = false;
      els.authSubmitBtn.textContent = authMode === 'login' ? 'Entrar' : 'Crear cuenta';
    }
  }
});

els.logoutBtn?.addEventListener('click', logout);
els.goSurveyBtn?.addEventListener('click', () => {
  showView('survey');
  setSurveyStage(latestAssessment ? 'results' : 'survey');
  if (latestAssessment) renderAssessment(latestAssessment);
  else renderQuestion();
});
els.goCoursesBtn?.addEventListener('click', () => enterCourses());
els.openAdminBtn?.addEventListener('click', async () => {
  showView('admin');
  await loadAdminAnalytics();
});
els.adminBackBtn?.addEventListener('click', () => {
  if (latestCoursePlan && courseProgress) {
    showView('courses');
    renderCoursesDashboard();
  } else {
    showView('survey');
    setSurveyStage(latestAssessment ? 'results' : 'survey');
  }
});
els.adminRefreshBtn?.addEventListener('click', loadAdminAnalytics);
els.adminExportBtn?.addEventListener('click', exportAnalytics);

els.nextBtn?.addEventListener('click', () => {
  if (!validateCurrent()) {
    els.alertBox?.classList.remove('hidden');
    return;
  }
  currentIndex += 1;
  renderQuestion();
});

els.prevBtn?.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderQuestion();
  }
});

els.restartBtn?.addEventListener('click', resetSurvey);

els.goToCoursesBtn?.addEventListener('click', () => {
  enterCourses();
});

els.backToResultsBtn?.addEventListener('click', () => {
  showView('survey');
  setSurveyStage('results');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

els.lessonBackBtn?.addEventListener('click', () => {
  showView('courses');
  renderCoursesDashboard();
});

els.openCourseSettingsBtn?.addEventListener('click', () => {
  els.courseSettings?.classList.remove('hidden');
  els.courseSettings?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

els.closeCourseSettingsBtn?.addEventListener('click', () => {
  els.courseSettings?.classList.add('hidden');
});

els.applyCoursePrefsBtn?.addEventListener('click', async () => {
  await generateCourse({ reset: true });
  els.courseSettings?.classList.add('hidden');
});

els.chatFab?.addEventListener('click', toggleChat);
els.chatClose?.addEventListener('click', closeChat);
els.chatBackdrop?.addEventListener('click', closeChat);
document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches('[data-chat-close]')) {
    closeChat();
  }
});

els.chatForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) {
    showAuth();
    return;
  }
  const text = els.chatInput?.value?.trim() || '';
  if (!text) return;
  if (els.chatInput) els.chatInput.value = '';

  appendChat(text, 'user');
  chatHistory.push({ role: 'user', content: text });

  try {
    const data = await callBackend('/api/chat', { messages: chatHistory });
    const reply = data.reply || 'No tengo respuesta en este momento.';
    appendChat(reply, 'bot');
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (error) {
    appendChat(`No pude conectar con la IA. ${error.message || 'Intenta de nuevo.'}`, 'bot');
  }
});

// Bootstrap
hydrateState();
setAuthMode('login');
showAuth();
renderQuestion();
loadSession();
