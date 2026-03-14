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
const nextStepsGrid = document.getElementById('nextStepsGrid');
const restartBtn = document.getElementById('restartBtn');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const loadingSection = document.getElementById('loadingSection');

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

const normalizeRiskLevel = (value) => {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith('alto')) return 'Alto';
  if (lower.startsWith('medio')) return 'Medio';
  if (lower.startsWith('bajo')) return 'Bajo';
  // Capitalize first letter as a safe fallback.
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
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
  nextStepsGrid.innerHTML = '';

  document.getElementById('questionCard').classList.add('hidden');
  resultSection.classList.add('hidden');
  chatSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');

  try {
    const data = await callBackend('/api/assess', { answers });
    if (data.nivel) riskLevel.textContent = normalizeRiskLevel(data.nivel);
    if (data.resumen) riskSummary.textContent = data.resumen;
    if (Array.isArray(data.recomendaciones)) {
      data.recomendaciones.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        riskRecs.appendChild(li);
      });
    }
    if (Array.isArray(data.proximos_pasos)) {
      data.proximos_pasos.forEach((step) => {
        const card = document.createElement('div');
        card.className = 'step-card';

        const title = document.createElement('p');
        title.className = 'step-title';
        title.textContent =
          typeof step === 'string'
            ? step
            : step?.titulo || step?.title || 'Siguiente paso';

        const descText =
          typeof step === 'string'
            ? ''
            : step?.descripcion || step?.aprenderas || step?.desc || '';
        if (descText) {
          const desc = document.createElement('p');
          desc.className = 'step-desc';
          desc.textContent = descText;
          card.appendChild(title);
          card.appendChild(desc);
        } else {
          card.appendChild(title);
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
  resultSection.classList.add('hidden');
  chatSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  chatMessages.innerHTML = '';
  chatHistory.length = 0;
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

renderQuestion();
