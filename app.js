// Escudo Digital (frontend)
// - Encuesta dinamica -> evaluacion IA
// - Cursos personalizados + simulaciones
// - Chat flotante (drawer)

const $ = (id) => document.getElementById(id);

const els = {
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

  // Lesson view
  lessonBackBtn: $('lessonBackBtn'),
  lessonEyebrow: $('lessonEyebrow'),
  lessonTitle: $('lessonTitle'),
  lessonDesc: $('lessonDesc'),
  lessonBadge: $('lessonBadge'),
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
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STORAGE_KEYS = {
  assessment: 'escudo_assessment_v1',
  answers: 'escudo_answers_v1',
  coursePlan: 'escudo_course_plan_v2',
  courseProgress: 'escudo_course_progress_v2',
};

const CATEGORY_LABELS = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  web: 'Web',
  llamadas: 'Llamadas',
  correo_redes: 'Correo/Redes',
  habitos: 'Hábitos',
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

const persistState = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(answers));
    if (latestAssessment) {
      localStorage.setItem(STORAGE_KEYS.assessment, JSON.stringify(latestAssessment));
    }
    if (latestCoursePlan) {
      localStorage.setItem(STORAGE_KEYS.coursePlan, JSON.stringify(latestCoursePlan));
    }
    if (courseProgress) {
      localStorage.setItem(STORAGE_KEYS.courseProgress, JSON.stringify(courseProgress));
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

const setSurveyStage = (stage) => {
  if (els.surveySection) els.surveySection.classList.toggle('hidden', stage !== 'survey');
  if (els.loadingSection) els.loadingSection.classList.toggle('hidden', stage !== 'loading');
  if (els.resultSection) els.resultSection.classList.toggle('hidden', stage !== 'results');
};

const showView = (view) => {
  const views = {
    survey: els.surveyView,
    courses: els.coursesView,
    lesson: els.lessonView,
  };

  Object.values(views).forEach((node) => node?.classList.add('hidden'));
  views[view]?.classList.remove('hidden');

  if (view === 'survey') document.title = 'Escudo Digital | Encuesta';
  if (view === 'courses') document.title = 'Escudo Digital | Cursos';
  if (view === 'lesson') document.title = 'Escudo Digital | Lección';
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

const openChat = () => {
  els.chatDrawer?.classList.remove('hidden');
  els.chatBackdrop?.classList.remove('hidden');
};

const closeChat = () => {
  els.chatDrawer?.classList.add('hidden');
  els.chatBackdrop?.classList.add('hidden');
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
          return;
        }

        answers[question.id] = option.value;
        els.questionBody.querySelectorAll('.option').forEach((optEl) => optEl.classList.remove('active'));
        wrapper.classList.add('active');
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
    });

    els.questionBody.appendChild(select);
  }

  if (question.type === 'text' && els.questionBody) {
    const textarea = document.createElement('textarea');
    textarea.placeholder = question.placeholder || '';
    textarea.value = stored || '';
    textarea.addEventListener('input', () => {
      answers[question.id] = textarea.value.trim();
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

  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }

  if (els.chatMessages) els.chatMessages.innerHTML = '';
  chatHistory.length = 0;

  closeChat();
  showView('survey');
  setSurveyStage('survey');
  renderQuestion();
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

          // concepto u otros -> contenido
          return {
            ...base,
            contenido: String(act.contenido || act.texto || '').trim(),
          };
        })
        .filter(Boolean);

      return { id, categoria, titulo, descripcion, actividades };
    })
    .filter(Boolean);

  return safe;
};

const ensureCourseProgress = (plan, { reset } = { reset: false }) => {
  const sig = computePlanSignature(plan);
  const prev = courseProgress && typeof courseProgress === 'object' ? courseProgress : null;

  let next = prev;
  if (reset || !prev || prev.planSig !== sig) {
    next = { planSig: sig, completed: {} };
  } else {
    next = { ...prev, planSig: sig, completed: prev.completed && typeof prev.completed === 'object' ? prev.completed : {} };
  }

  const ids = new Set();
  (Array.isArray(plan?.ruta) ? plan.ruta : []).forEach((mod) => {
    (Array.isArray(mod?.actividades) ? mod.actividades : []).forEach((act) => ids.add(act.id));
  });
  Object.keys(next.completed).forEach((key) => {
    if (!ids.has(key)) delete next.completed[key];
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

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = CATEGORY_LABELS[module.categoria] || module.categoria || 'Curso';

    head.appendChild(left);
    head.appendChild(badge);

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

const renderCoursesDashboard = () => {
  if (!latestCoursePlan || !courseProgress) return;
  const computed = computeCompetenciesFromProgress(latestCoursePlan, courseProgress);
  setDonut(computed.score_total, latestCoursePlan.score_name);
  renderCompetencies(computed.competencias);
  renderCoursePlan();
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
  if (els.lessonProgressText) {
    const typeLabel = activity.tipo ? ` • ${activity.tipo}` : '';
    els.lessonProgressText.textContent = `Actividad ${current} de ${total} (${pct}%)${typeLabel}`;
  }
};

const markActivityCompleted = ({ moduleIndex, activityIndex, score, feedback }) => {
  const info = getModuleAndActivity(moduleIndex, activityIndex);
  if (!info) return;
  const { activity } = info;

  const prev = courseProgress?.completed?.[activity.id];
  const attempts = clamp(Number(prev?.attempts) || 0, 0, 999) + 1;

  courseProgress.completed = courseProgress.completed || {};
  courseProgress.completed[activity.id] = {
    score: clamp(Number(score) || 0, 0, 1),
    attempts,
    feedback: String(feedback || prev?.feedback || '').slice(0, 600),
    at: new Date().toISOString(),
  };

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
  setLessonMeta(moduleIndex, activityIndex);
  els.lessonActivity.innerHTML = '';

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

  const completeAndNext = (score, fbText) => {
    markActivityCompleted({ moduleIndex, activityIndex, score, feedback: fbText });
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
          completeAndNext(isCorrect ? 1 : 0.6, activity.explicacion);
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
      completeAndNext(1, 'Checklist completado.');
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
        continueBtn.addEventListener('click', () => completeAndNext(score, fb));

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
      doneBtn.addEventListener('click', () => completeAndNext(finalScore, fb));
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
  } else {
    renderParagraphs(body, activity.contenido);
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn primary';
    doneBtn.textContent = 'Continuar';
    doneBtn.addEventListener('click', () => completeAndNext(1, 'Actividad completada.'));
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

// Event wiring
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

els.chatFab?.addEventListener('click', openChat);
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
showView('survey');

if (latestAssessment) {
  renderAssessment(latestAssessment);
  setSurveyStage('results');
} else {
  setSurveyStage('survey');
}

renderQuestion();
