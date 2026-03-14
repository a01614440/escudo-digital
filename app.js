const questionTitle = document.getElementById('questionTitle');
const questionHelper = document.getElementById('questionHelper');
const questionBody = document.getElementById('questionBody');
const questionEyebrow = document.getElementById('questionEyebrow');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const alertBox = document.getElementById('questionAlert');
const resultSection = document.getElementById('resultSection');
const resultLead = document.getElementById('resultLead');
const riskLevel = document.getElementById('riskLevel');
const riskSummary = document.getElementById('riskSummary');
const riskRecs = document.getElementById('riskRecs');
const nextStepsGrid =
  document.getElementById('nextStepsGrid') ||
  document.getElementById('nextStepsList');
const restartBtn = document.getElementById('restartBtn');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const loadingSection = document.getElementById('loadingSection');
const goToCoursesBtn = document.getElementById('goToCoursesBtn');
const coursesSection = document.getElementById('coursesSection');
const backToResultsBtn = document.getElementById('backToResultsBtn');
const scrollToChatBtn = document.getElementById('scrollToChatBtn');
const shieldDonut = document.getElementById('shieldDonut');
const shieldScoreLabel = document.getElementById('shieldScoreLabel');
const shieldScoreName = document.getElementById('shieldScoreName');
const competencyList = document.getElementById('competencyList');
const prefStyle = document.getElementById('prefStyle');
const prefDifficulty = document.getElementById('prefDifficulty');
const prefSession = document.getElementById('prefSession');
const prefTopics = document.getElementById('prefTopics');
const generateCourseBtn = document.getElementById('generateCourseBtn');
const courseLoading = document.getElementById('courseLoading');
const courseContent = document.getElementById('courseContent');
const regenerateCourseBtn = document.getElementById('regenerateCourseBtn');
const modulesList = document.getElementById('modulesList');
const activityPanel = document.getElementById('activityPanel');

const chatHistory = [];

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
    placeholder: 'Ejemplo: recibí un SMS del banco y di mis datos...',
    showIf: (answers) => answers.scammed === 'si',
  },
  {
    id: 'priority',
    title: '¿Qué te gustaría aprender primero?',
    helper: 'Con esto definimos el orden de los cursos.',
    type: 'single',
    options: [
      { label: 'Detectar SMS falsos', value: 'sms', score: 1 },
      { label: 'Verificar páginas web', value: 'web', score: 1 },
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

const STORAGE_KEYS = {
  assessment: 'escudo_assessment_v1',
  answers: 'escudo_answers_v1',
  coursePlan: 'escudo_course_plan_v1',
  courseProgress: 'escudo_course_progress_v1',
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const CATEGORY_LABELS = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  web: 'Web',
  llamadas: 'Llamadas',
  correo_redes: 'Correo/Redes',
  habitos: 'Hábitos',
};

const categoryNote = (value) => {
  if (value >= 75) return 'Fuerte';
  if (value >= 55) return 'Bien';
  if (value >= 35) return 'Por reforzar';
  return 'Prioridad alta';
};

const computeTotalScore = (competencias) => {
  const values = Object.values(competencias || {}).filter((v) => Number.isFinite(v));
  if (!values.length) return 0;
  const avg = values.reduce((acc, val) => acc + val, 0) / values.length;
  return Math.round(avg);
};

const normalizeRiskLevel = (value) => {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith('alto')) return 'Alto';
  if (lower.startsWith('medio')) return 'Medio';
  if (lower.startsWith('bajo')) return 'Bajo';
  // Capitalize first letter as a safe fallback.
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
};

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const persistState = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(answers));
    if (latestAssessment) {
      localStorage.setItem(
        STORAGE_KEYS.assessment,
        JSON.stringify(latestAssessment)
      );
    }
    if (latestCoursePlan) {
      localStorage.setItem(STORAGE_KEYS.coursePlan, JSON.stringify(latestCoursePlan));
    }
    if (courseProgress) {
      localStorage.setItem(
        STORAGE_KEYS.courseProgress,
        JSON.stringify(courseProgress)
      );
    }
  } catch {
    // ignore
  }
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

const setDonut = (score, label) => {
  if (!shieldDonut) return;
  const safe = clamp(Number(score) || 0, 0, 100);
  shieldDonut.style.setProperty('--p', String(safe));
  if (shieldScoreLabel) shieldScoreLabel.textContent = `${safe}%`;
  if (shieldScoreName && label) shieldScoreName.textContent = label;
};

const renderCompetencies = (competencias) => {
  if (!competencyList) return;
  competencyList.innerHTML = '';
  const entries = Object.entries(competencias || {});
  if (!entries.length) {
    competencyList.innerHTML =
      '<p class="hint">Genera tu curso para ver tu mapa.</p>';
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
    competencyList.appendChild(card);
  });
};

const defaultTopicsFromAnswers = () => {
  const set = new Set();
  const priority = answers.priority;
  if (priority === 'todo') {
    ['sms', 'whatsapp', 'web', 'llamadas', 'correo_redes'].forEach((t) => set.add(t));
    return Array.from(set);
  }
  if (priority) set.add(priority);
  const channels = Array.isArray(answers.channels) ? answers.channels : [];
  channels.forEach((ch) => {
    if (ch === 'correo' || ch === 'redes') set.add('correo_redes');
    else set.add(ch);
  });
  if (set.size === 0) {
    ['sms', 'whatsapp', 'web', 'llamadas'].forEach((t) => set.add(t));
  }
  return Array.from(set);
};

const applyDefaultCoursePrefs = () => {
  if (!prefStyle || !prefDifficulty || !prefSession || !prefTopics) return;
  if (!prefStyle.value) prefStyle.value = 'mix';
  if (!prefDifficulty.value) prefDifficulty.value = 'auto';
  if (!prefSession.value) prefSession.value = '5-10';

  const topics = defaultTopicsFromAnswers();
  prefTopics.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = topics.includes(input.value);
  });
};

const readCoursePrefs = () => {
  const topics = [];
  if (prefTopics) {
    prefTopics.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      if (input.checked) topics.push(input.value);
    });
  }
  return {
    estilo: prefStyle ? prefStyle.value : 'mix',
    dificultad: prefDifficulty ? prefDifficulty.value : 'auto',
    duracion: prefSession ? prefSession.value : '5-10',
    temas: topics.length ? topics : defaultTopicsFromAnswers(),
  };
};

const renderCoursePlan = () => {
  if (!modulesList || !latestCoursePlan || !courseProgress) return;
  modulesList.innerHTML = '';

  const route = Array.isArray(latestCoursePlan.ruta) ? latestCoursePlan.ruta : [];

  if (!route.length) {
    modulesList.innerHTML = '<p class="hint">No hay módulos disponibles todavía.</p>';
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
    title.textContent = module.titulo || `Módulo ${moduleIndex + 1}`;
    const desc = document.createElement('p');
    desc.className = 'module-desc';
    desc.textContent = module.descripcion || '';
    left.appendChild(title);
    left.appendChild(desc);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = CATEGORY_LABELS[module.categoria] || module.categoria || 'Curso';

    head.appendChild(left);
    head.appendChild(badge);

    const activities = Array.isArray(module.actividades) ? module.actividades : [];
    const completed = activities.filter((act) => courseProgress.completed?.[act.id]).length;
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
    btn.textContent = pct >= 100 ? 'Repetir' : pct > 0 ? 'Continuar' : 'Empezar';
    btn.addEventListener('click', () => startModule(moduleIndex));

    actions.appendChild(btn);

    card.appendChild(head);
    card.appendChild(mini);
    card.appendChild(actions);
    modulesList.appendChild(card);
  });
};

const renderActivityPanel = (moduleIndex, activityIndex) => {
  if (!activityPanel || !latestCoursePlan || !courseProgress) return;
  const route = Array.isArray(latestCoursePlan.ruta) ? latestCoursePlan.ruta : [];
  const module = route[moduleIndex];
  if (!module) return;
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  const activity = activities[activityIndex];
  if (!activity) return;

  activityPanel.classList.remove('hidden');
  activityPanel.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'activity-head';

  const title = document.createElement('p');
  title.className = 'activity-title';
  title.textContent = activity.titulo || 'Actividad';

  const type = document.createElement('span');
  type.className = 'activity-type';
  type.textContent = activity.tipo || 'actividad';

  head.appendChild(title);
  head.appendChild(type);

  const body = document.createElement('div');
  body.className = 'activity-body';

  const renderParagraphs = (text) => {
    String(text || '')
      .split('\\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        body.appendChild(p);
      });
  };

  const feedback = document.createElement('div');
  feedback.className = 'feedback hidden';

  const actions = document.createElement('div');
  actions.className = 'activity-actions';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn ghost';
  closeBtn.textContent = 'Cerrar';
  closeBtn.addEventListener('click', () => {
    activityPanel.classList.add('hidden');
  });

  const complete = (opts = {}) => {
    completeActivity(moduleIndex, activityIndex, opts);
  };

  if (activity.tipo === 'simulacion' || activity.tipo === 'quiz') {
    renderParagraphs(activity.escenario);

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
        feedback.classList.remove('hidden');
        feedback.textContent = activity.explicacion || (isCorrect ? '¡Bien!' : 'Casi.');
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn primary';
        nextBtn.textContent = 'Continuar';
        nextBtn.addEventListener('click', () => complete({ correct: isCorrect }));
        actions.appendChild(nextBtn);
      });
      body.appendChild(btn);
    });
  } else if (activity.tipo === 'checklist') {
    renderParagraphs(activity.intro || 'Marca cada punto antes de continuar.');
    const items = Array.isArray(activity.items) ? activity.items : [];
    const boxWrap = document.createElement('div');
    boxWrap.className = 'question-body';

    const state = items.map(() => false);
    const updateReady = () => state.every(Boolean);

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
      const ok = updateReady();
      if (!ok) {
        feedback.classList.remove('hidden');
        feedback.textContent = 'Marca todos los puntos para continuar.';
        return;
      }
      complete({ correct: true });
    });
    actions.appendChild(doneBtn);
  } else {
    renderParagraphs(activity.contenido);
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn primary';
    doneBtn.textContent = 'Marcar como completado';
    doneBtn.addEventListener('click', () => complete({ correct: true }));
    actions.appendChild(doneBtn);
  }

  actions.appendChild(closeBtn);

  activityPanel.appendChild(head);
  activityPanel.appendChild(body);
  activityPanel.appendChild(feedback);
  activityPanel.appendChild(actions);
};

const startModule = (moduleIndex) => {
  if (!latestCoursePlan || !courseProgress) return;
  const route = Array.isArray(latestCoursePlan.ruta) ? latestCoursePlan.ruta : [];
  const module = route[moduleIndex];
  if (!module) return;
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  const nextIndex = activities.findIndex((act) => !courseProgress.completed?.[act.id]);
  const activityIndex = nextIndex === -1 ? 0 : nextIndex;
  renderActivityPanel(moduleIndex, activityIndex);
  activityPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const completeActivity = (moduleIndex, activityIndex, { correct } = {}) => {
  const route = Array.isArray(latestCoursePlan?.ruta) ? latestCoursePlan.ruta : [];
  const module = route[moduleIndex];
  if (!module) return;
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  const activity = activities[activityIndex];
  if (!activity) return;

  const id = activity.id || `${moduleIndex}-${activityIndex}`;
  courseProgress.completed = courseProgress.completed || {};
  courseProgress.completed[id] = { correct: Boolean(correct) };

  const basePoints = Number(activity.puntos) || 4;
  const delta = Boolean(correct) ? basePoints : Math.max(1, Math.round(basePoints * 0.4));
  const cat = module.categoria || 'habitos';
  courseProgress.competencias = courseProgress.competencias || {};
  const prev = Number(courseProgress.competencias[cat]) || 0;
  courseProgress.competencias[cat] = clamp(prev + delta, 0, 100);
  courseProgress.score_total = computeTotalScore(courseProgress.competencias);

  setDonut(courseProgress.score_total, latestCoursePlan.score_name);
  renderCompetencies(courseProgress.competencias);
  renderCoursePlan();
  persistState();

  // Next activity
  const nextIndex = activities.findIndex((act, idx) => idx > activityIndex && !courseProgress.completed?.[act.id]);
  if (nextIndex !== -1) {
    renderActivityPanel(moduleIndex, nextIndex);
    return;
  }
  activityPanel.classList.add('hidden');
};

const ensureCourseState = (plan) => {
  // Normalize ids so progress tracking never prints [object Object] or misses completions.
  if (Array.isArray(plan?.ruta)) {
    plan.ruta.forEach((mod, mIdx) => {
      if (!mod || typeof mod !== 'object') return;
      if (!mod.id) mod.id = `m${mIdx + 1}`;
      if (!mod.categoria) mod.categoria = 'habitos';
      if (Array.isArray(mod.actividades)) {
        mod.actividades.forEach((act, aIdx) => {
          if (!act || typeof act !== 'object') return;
          if (!act.id) act.id = `${mod.id}-a${aIdx + 1}`;
        });
      }
    });
  }

  latestCoursePlan = plan;
  const competencias = plan?.competencias && typeof plan.competencias === 'object'
    ? plan.competencias
    : {};
  courseProgress = courseProgress && typeof courseProgress === 'object'
    ? courseProgress
    : { completed: {}, competencias: {}, score_total: 0 };
  courseProgress.competencias = { ...competencias, ...(courseProgress.competencias || {}) };
  courseProgress.score_total = computeTotalScore(courseProgress.competencias);
};

const showCourses = () => {
  if (!coursesSection) return;
  applyDefaultCoursePrefs();
  resultSection.classList.add('hidden');
  coursesSection.classList.remove('hidden');
  coursesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (latestCoursePlan && courseProgress) {
    setDonut(courseProgress.score_total, latestCoursePlan.score_name);
    renderCompetencies(courseProgress.competencias);
    renderCoursePlan();
    if (courseContent) courseContent.classList.remove('hidden');
  } else {
    setDonut(0, 'Blindaje Digital');
    renderCompetencies({});
  }
};

const hideCourses = () => {
  if (!coursesSection) return;
  coursesSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const generateCourse = async () => {
  if (!latestAssessment) return;
  if (!generateCourseBtn) return;

  const prefs = readCoursePrefs();

  generateCourseBtn.disabled = true;
  if (courseContent) courseContent.classList.add('hidden');
  if (courseLoading) courseLoading.classList.remove('hidden');
  if (activityPanel) activityPanel.classList.add('hidden');

  try {
    const plan = await callBackend('/api/course', {
      answers,
      assessment: latestAssessment,
      prefs,
      progress: courseProgress,
    });

    ensureCourseState(plan);
    persistState();

    setDonut(courseProgress.score_total, plan.score_name);
    renderCompetencies(courseProgress.competencias);
    renderCoursePlan();
    if (courseContent) courseContent.classList.remove('hidden');
  } catch (error) {
    alert(`No se pudo generar el curso: ${error.message}`);
  } finally {
    if (courseLoading) courseLoading.classList.add('hidden');
    generateCourseBtn.disabled = false;
  }
};

const getVisibleQuestions = () =>
  questions.filter((question) => !question.showIf || question.showIf(answers));

const renderQuestion = () => {
  const visible = getVisibleQuestions();
  const question = visible[currentIndex];

  if (!question) {
    showResults();
    return;
  }

  questionTitle.textContent = question.title;
  questionHelper.textContent = question.helper || '';
  questionEyebrow.textContent = `Pregunta ${currentIndex + 1}`;

  questionBody.innerHTML = '';
  alertBox.classList.add('hidden');

  const stored = answers[question.id];

  if (question.type === 'single' || question.type === 'multi') {
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
      questionBody.appendChild(wrapper);

      input.addEventListener('change', () => {
        if (isMulti) {
          const current = new Set(answers[question.id] || []);
          if (input.checked) {
            current.add(option.value);
            wrapper.classList.add('active');
          } else {
            current.delete(option.value);
            wrapper.classList.remove('active');
          }
          answers[question.id] = Array.from(current);
        } else {
          answers[question.id] = option.value;
          questionBody.querySelectorAll('.option').forEach((optionEl) => {
            optionEl.classList.remove('active');
          });
          wrapper.classList.add('active');
        }
      });
    });
  }

  if (question.type === 'select') {
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
    });

    questionBody.appendChild(select);
  }

  if (question.type === 'text') {
    const textarea = document.createElement('textarea');
    textarea.placeholder = question.placeholder || '';
    textarea.value = stored || '';
    textarea.addEventListener('input', () => {
      answers[question.id] = textarea.value.trim();
    });
    questionBody.appendChild(textarea);
  }

  updateProgress();
  updateButtons();
};

const updateProgress = () => {
  const visible = getVisibleQuestions();
  const total = visible.length;
  const current = currentIndex + 1;
  progressText.textContent = `Paso ${current} de ${total}`;
  progressBar.style.width = `${(current / total) * 100}%`;
};

const updateButtons = () => {
  prevBtn.disabled = currentIndex === 0;
  nextBtn.textContent =
    currentIndex === getVisibleQuestions().length - 1 ? 'Finalizar' : 'Siguiente';
};

const validateCurrent = () => {
  const visible = getVisibleQuestions();
  const question = visible[currentIndex];
  if (!question) return true;

  const value = answers[question.id];
  if (question.type === 'text') {
    return value && value.length > 3;
  }
  if (question.type === 'multi') {
    return Array.isArray(value) && value.length > 0;
  }
  return Boolean(value);
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

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const applyInlineFormatting = (value) =>
  value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const formatMessage = (text) => {
  const raw = text || '';
  const safe = applyInlineFormatting(escapeHtml(raw));
  const lines = safe.split('\n').map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.filter(
    (line) => line.startsWith('- ') || line.startsWith('• ')
  );
  if (bulletLines.length >= 2) {
    const hasIntro = lines[0] && !lines[0].startsWith('- ') && !lines[0].startsWith('• ');
    const intro = hasIntro
      ? `<p class="chat-intro">${lines[0]}</p>`
      : `<p class="chat-intro">Es buena idea revisar algunos detalles antes de comprar en un sitio nuevo.</p>`;
    const items = bulletLines
      .map((line) =>
        `<li>${line.replace(/^(-|•)\\s*/, '')}</li>`
      )
      .join('');
    const outro = `<p class="chat-outro">Si algo se ve raro o demasiado bueno para ser verdad, mejor toma precauciones.</p>`;
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
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = formatMessage(text);
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

const callBackend = async (path, payload) => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error || 'Error al conectar con la IA.';
    const status = error.status ? ` (status ${error.status})` : '';
    throw new Error(`${message}${status}`);
  }
  return response.json();
};

const showResults = async () => {
  const score = scoreAnswers();

  let level = 'Bajo';
  let summary =
    'Tienes buenas prácticas de seguridad. Reforzaremos con ejemplos reales.';

  if (score >= 10) {
    level = 'Alto';
    summary =
      'Estás más expuesto a estafas digitales. Te recomendaremos módulos básicos y alertas frecuentes.';
  } else if (score >= 5) {
    level = 'Medio';
    summary =
      'Hay oportunidades para reforzar hábitos y reconocer señales de riesgo.';
  }

  resultLead.textContent =
    'Analizando tus respuestas con IA para personalizar el contenido.';
  riskLevel.textContent = normalizeRiskLevel(level);
  riskSummary.textContent = summary;
  riskRecs.innerHTML = '';
  if (nextStepsGrid) {
    nextStepsGrid.innerHTML = '';
  }

  document.getElementById('questionCard').classList.add('hidden');
  resultSection.classList.add('hidden');
  chatSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');

  try {
    const data = await callBackend('/api/assess', { answers });
    latestAssessment = data;
    persistState();
    if (data.nivel) riskLevel.textContent = normalizeRiskLevel(data.nivel);
    if (data.resumen) riskSummary.textContent = data.resumen;
    if (Array.isArray(data.recomendaciones)) {
      data.recomendaciones.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        riskRecs.appendChild(li);
      });
    }
    if (Array.isArray(data.proximos_pasos) && nextStepsGrid) {
      data.proximos_pasos.forEach((step) => {
        const titleText =
          typeof step === 'string'
            ? step
            : step?.titulo || step?.title || step?.tema || 'Siguiente paso';
        const descText =
          typeof step === 'string'
            ? ''
            : step?.descripcion || step?.aprenderas || step?.desc || '';

        if (nextStepsGrid.tagName === 'UL') {
          const li = document.createElement('li');
          li.textContent = descText ? `${titleText}: ${descText}` : titleText;
          nextStepsGrid.appendChild(li);
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

        nextStepsGrid.appendChild(card);
      });
    }
    resultLead.textContent =
      'La IA ajustó tu perfil con base en tus respuestas.';
  } catch (error) {
    resultLead.textContent =
      `No se pudo conectar con la IA. ${error.message || ''}`.trim();
  } finally {
    loadingSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    chatSection.classList.remove('hidden');
  }
};

const resetSurvey = () => {
  Object.keys(answers).forEach((key) => delete answers[key]);
  currentIndex = 0;
  latestAssessment = null;
  latestCoursePlan = null;
  courseProgress = null;
  resultSection.classList.add('hidden');
  coursesSection?.classList.add('hidden');
  chatSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  chatMessages.innerHTML = '';
  chatHistory.length = 0;
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
  document.getElementById('questionCard').classList.remove('hidden');
  renderQuestion();
};

nextBtn.addEventListener('click', () => {
  if (!validateCurrent()) {
    alertBox.classList.remove('hidden');
    return;
  }

  currentIndex += 1;
  renderQuestion();
});

prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderQuestion();
  }
});

restartBtn.addEventListener('click', resetSurvey);

goToCoursesBtn?.addEventListener('click', () => {
  showCourses();
});

backToResultsBtn?.addEventListener('click', () => {
  hideCourses();
});

scrollToChatBtn?.addEventListener('click', () => {
  chatSection?.classList.remove('hidden');
  chatSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

generateCourseBtn?.addEventListener('click', generateCourse);
regenerateCourseBtn?.addEventListener('click', generateCourse);

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  appendChat(text, 'user');

  chatHistory.push({ role: 'user', content: text });

  try {
    const data = await callBackend('/api/chat', { messages: chatHistory });
    const reply = data.reply || 'No tengo respuesta en este momento.';
    appendChat(reply, 'bot');
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (error) {
    appendChat(
      `No pude conectar con la IA. ${error.message || 'Intenta de nuevo.'}`,
      'bot'
    );
  }
});

hydrateState();
renderQuestion();
