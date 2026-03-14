import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!OPENAI_API_KEY) {
  console.warn('Falta OPENAI_API_KEY en el entorno.');
}

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static('.'));

const buildAssessmentPrompt = (answers) => {
  return [
    {
      role: 'system',
      content:
        'Eres un analista de riesgos de estafas digitales en México. ' +
        'Debes evaluar el nivel de riesgo con base en sus respuestas. ' +
        'Devuelve SOLO JSON válido (sin Markdown) con estas llaves: ' +
        'nivel, resumen, recomendaciones, proximos_pasos. ' +
        'Reglas: ' +
        '1) nivel debe ser EXACTAMENTE: "Bajo", "Medio" o "Alto". ' +
        '2) resumen: 2–3 frases, específico; menciona al menos 2 factores del usuario ' +
        '(canales, frecuencia, hábito de verificación, estafa previa, prioridad). ' +
        '3) recomendaciones: array de 3 acciones concretas y personalizadas (10–14 palabras cada una). ' +
        'Evita recomendaciones genéricas repetidas (ej. solo "2FA"). ' +
        '4) proximos_pasos: array de 4 módulos de aprendizaje, no frases genéricas. ' +
        'Cada módulo debe ser un objeto con: titulo (3–6 palabras, estilo título) y descripcion (1 frase: qué aprenderá/practicará). ' +
        'Al menos 1 módulo debe atacar la estafa previa si existe. ' +
        'Al menos 2 módulos deben seguir la prioridad del usuario. ' +
        'Si la prioridad es "todo", incluye obligatoriamente: 1 módulo web, 1 módulo WhatsApp/SMS y 1 módulo de llamadas. ' +
        'Si nivel es "Alto", cubre varios canales, no solo uno. ' +
        'Prohibido usar estas frases: "Contenido personalizado", "Alertas sobre fraudes", "Ejercicios prácticos". ' +
        'Si hay anécdota, úsala para personalizar (sin pedir datos sensibles).',
    },
    {
      role: 'user',
      content: `Respuestas del usuario:\n${JSON.stringify(answers, null, 2)}`,
    },
  ];
};

const buildChatPrompt = (messages) => {
  return [
    {
      role: 'system',
      content:
        'Eres un asistente de prevención de estafas digitales que ayuda a personas comunes a navegar internet de forma segura. ' +
        'Tu objetivo es educar, guiar y dar consejos prácticos sin sonar robótico.\n\n' +
        'Reglas obligatorias:\n' +
        '1) Respuestas claras y concisas. Evita párrafos largos o explicaciones innecesarias.\n' +
        '2) Si el usuario pide recomendaciones o consejos: responde en 3 a 5 puntos cortos, con una breve frase introductoria si hace falta.\n' +
        '3) Cada punto debe ser directo y fácil de leer.\n' +
        '4) No uses más de 80–120 palabras en total, salvo que el usuario pida más detalle.\n' +
        '5) No digas que puedes revisar sitios ni investigar enlaces; enseña qué revisar por su cuenta.\n' +
        '6) Varía el tono: a veces directo, otras cercano, pero evita frases empáticas forzadas.\n' +
        '7) Termina con una señal de alerta o recomendación preventiva.\n' +
        '8) Nunca respondas solo con viñetas.\n' +
        '9) Limita el alcance a estafas digitales, fraudes en línea y seguridad digital. ' +
        'Si la pregunta NO está relacionada, responde breve y amablemente que solo puedes ayudar con seguridad digital y prevención de estafas, e invita a preguntar sobre eso.\n' +
        'Si el usuario menciona un fraude en curso, sugiere medidas inmediatas y canales oficiales sin inventar números.',
    },
    {
      role: 'user',
      content: '¿Cómo puedo saber si una tienda en línea es confiable antes de comprar?',
    },
    {
      role: 'assistant',
      content:
        'Buena idea revisarlo antes de pagar, sobre todo si es una tienda nueva. Unos minutos de verificación te pueden ahorrar un problema.\n\n' +
        'Puedes fijarte en cosas concretas como:\n' +
        '• Que el dominio sea exactamente el de la tienda y tenga https.\n' +
        '• Buscar el nombre del sitio con palabras como “opiniones” o “fraude”.\n' +
        '• Ver políticas claras de envío/devolución y un contacto real.\n' +
        '• Pagar con métodos que tengan protección al comprador.\n\n' +
        'Si algo se ve raro (precios muy bajos, urgencia, poca info), mejor no comprar ahí.',
    },
    ...messages,
  ];
};

const buildCoursePrompt = ({ answers, assessment, prefs, progress, categories }) => {
  return [
    {
      role: 'system',
      content:
        'Eres un diseñador instruccional y analista de estafas digitales en México. ' +
        'Vas a crear un programa de aprendizaje PERSONALIZADO tipo app (retos, práctica y simulaciones). ' +
        'Usa su edad, experiencia previa, canales de exposición, hábitos y prioridad de aprendizaje. ' +
        'No pidas datos sensibles. No inventes números telefónicos. No inventes enlaces reales. ' +
        'No digas que revisas enlaces o sitios; enseña qué revisar por su cuenta.\n\n' +
        'Devuelve SOLO JSON válido con estas llaves exactas:\n' +
        '- score_name (string creativo)\n' +
        '- score_total (entero 0-100)\n' +
        '- competencias (objeto con 0-100 por tema)\n' +
        '- ruta (array de 7 módulos)\n\n' +
        'Reglas:\n' +
        '1) competencias debe incluir (siempre): web, whatsapp, sms, llamadas, correo_redes, habitos.\n' +
        '2) ruta debe tener EXACTAMENTE 7 módulos. Cada módulo: id, titulo, descripcion, categoria, actividades.\n' +
        '3) categoria debe ser una de: web, whatsapp, sms, llamadas, correo_redes, habitos.\n' +
        '4) Cada módulo debe tener EXACTAMENTE 6 actividades. Tipos obligatorios: concepto, quiz, simulacion, abierta, sim_chat, checklist.\n' +
        '5) Cada actividad debe tener: id, tipo, titulo, peso.\n' +
        '   - peso es un número 0.5 a 3 (más peso = más impacto).\n' +
        '   - concepto: contenido (max 110 palabras)\n' +
        '   - checklist: items (4-8 bullets), intro (1 frase)\n' +
        '   - simulacion/quiz: escenario (max 120 palabras), opciones (3-5), correcta (index), explicacion (max 55 palabras)\n' +
        '   - abierta: prompt (1-2 frases) y opcional pistas (0-3 bullets)\n' +
        '   - sim_chat: escenario (max 90 palabras), inicio (1 mensaje del estafador), turnos_max (5-8)\n' +
        '6) La ruta DEBE respetar "categorias_sugeridas" (mismo orden y longitud) que viene en el input.\n' +
        '   Si una categoría se repite, ese módulo debe ser distinto (básico vs avanzado / recuperación).\n' +
        '7) Si la prioridad del usuario es "todo", cubre web + mensajería (sms/whatsapp) + llamadas en varios módulos.\n' +
        '8) Si hay estafa previa o anécdota, incluye al menos 1 sim_chat inspirado en esa situación (sin datos sensibles).\n' +
        '9) Ajusta el tono al usuario (por edad) y al nivel (Bajo/Medio/Alto).',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          respuestas: answers,
          evaluacion: assessment,
          preferencias: prefs,
          categorias_sugeridas: Array.isArray(categories) ? categories : [],
          progreso_actual: progress || null,
        },
        null,
        2
      ),
    },
  ];
};

const buildOpenAnswerGradePrompt = ({ prompt, answer, user }) => {
  return [
    {
      role: 'system',
      content:
        'Eres un entrenador de seguridad digital enfocado en evitar estafas en México. ' +
        'Vas a evaluar una respuesta abierta del usuario.\n\n' +
        'Devuelve SOLO JSON válido (sin Markdown) con estas llaves: score, feedback.\n' +
        '- score: número 0 a 1 (1 = excelente).\n' +
        '- feedback: 2–4 frases, empático, práctico y específico (sin tecnicismos).\n\n' +
        'Reglas: no pidas datos sensibles. No digas que investigaste o revisaste links. ' +
        'Si el usuario menciona que compartiría datos/códigos, bájale score y explica el riesgo.',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          pregunta: prompt,
          respuesta: answer,
          contexto: {
            edad: user?.answers?.age || '',
            nivel: user?.assessment?.nivel || '',
            prioridad: user?.answers?.priority || '',
            canales: user?.answers?.channels || [],
            estafa_previa: user?.answers?.scam_type || [],
          },
        },
        null,
        2
      ),
    },
  ];
};

const buildSimTurnPrompt = ({ scenario, history, userMessage, turn, turnos_max, user }) => {
  const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
  return [
    {
      role: 'system',
      content:
        'Vas a correr una simulación educativa de estafa (tipo chat) para entrenar al usuario. ' +
        'Tú interpretas al "estafador" (sin links reales, sin teléfonos, sin nombres reales) y al mismo tiempo actúas como coach.\n\n' +
        'Devuelve SOLO JSON válido con estas llaves exactas:\n' +
        '- reply (string): el siguiente mensaje del estafador (corto, manipulador, genérico).\n' +
        '- coach_feedback (string): 1–3 frases empáticas + 1 tip práctico.\n' +
        '- score (number 0-1): qué tan segura fue la respuesta del usuario.\n' +
        '- done (boolean): true si el usuario ya actuó de forma segura o si se llegó al límite.\n\n' +
        'Reglas de seguridad:\n' +
        '1) Nunca pidas datos reales del usuario.\n' +
        '2) No incluyas URLs, números de teléfono, ni instrucciones para cometer delitos.\n' +
        '3) El estafador usa presión/urgencia, pero siempre genérico.\n' +
        '4) Marca done=true si el usuario se niega, decide verificar por canal oficial, o propone bloquear/reportar, o si turn >= turnos_max.',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          scenario,
          turn,
          turnos_max,
          history: safeHistory,
          userMessage,
          contexto: {
            edad: user?.answers?.age || '',
            nivel: user?.assessment?.nivel || '',
            prioridad: user?.answers?.priority || '',
          },
        },
        null,
        2
      ),
    },
  ];
};

const callOpenAI = async (payload) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada.');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let errorText = '';
    try {
      if (contentType.includes('application/json')) {
        const json = await response.json();
        errorText = JSON.stringify(json);
      } else {
        errorText = await response.text();
      }
    } catch (err) {
      errorText = `No se pudo leer el error: ${err.message}`;
    }
    const err = new Error(`OpenAI API error: ${response.status} ${errorText}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
};

const extractText = (data) => {
  if (data.output_text) return data.output_text;
  if (!data.output) return '';
  const blocks = data.output
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text);
  return blocks.join('\n');
};

const extractJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract the first JSON object in the text.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
  }
  return null;
};

const normalizeNivel = (value) => {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith('alto')) return 'Alto';
  if (lower.startsWith('medio')) return 'Medio';
  if (lower.startsWith('bajo')) return 'Bajo';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
};

const toText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const candidate =
      value.texto || value.accion || value.recomendacion || value.label || value.titulo;
    return candidate ? String(candidate).trim() : '';
  }
  return String(value).trim();
};

const asStringArray = (value) =>
  Array.isArray(value) ? value.map(toText).filter(Boolean) : [];

const BANNED_GENERIC_PHRASES = [
  'contenido personalizado',
  'alertas sobre fraudes',
  'ejercicios prácticos',
  'ejercicios practicos',
];

const RECS_CONTEXT_PATTERN =
  /(sms|whatsapp|llamada|tel[eé]fono|web|dominio|enlace|link|transferencia|tarjeta|dep[oó]sito)/i;

const recLacksContext = (text) => !RECS_CONTEXT_PATTERN.test(String(text || ''));

const looksGeneric = (text) => {
  const lower = String(text || '').toLowerCase();
  return BANNED_GENERIC_PHRASES.some((phrase) => lower.includes(phrase));
};

const STEP_PATTERNS = {
  web: /(web|p[aá]gina|sitio|dominio|clon|clonad|compra|pago|checkout|carrito)/i,
  messaging: /(sms|whatsapp|mensaje|enlace|link|c[oó]digo)/i,
  calls: /(llamada|tel[eé]fono|telefono|banco|operador|extensi[oó]n)/i,
};

const categorizeStep = (step) => {
  const text = `${step?.titulo || ''} ${step?.descripcion || ''}`.trim();
  return {
    web: STEP_PATTERNS.web.test(text),
    messaging: STEP_PATTERNS.messaging.test(text),
    calls: STEP_PATTERNS.calls.test(text),
  };
};

const stepMatchesPriority = (step, priorityKey) => {
  const cats = categorizeStep(step);
  if (priorityKey === 'todo') return cats.web || cats.messaging || cats.calls;
  if (priorityKey === 'web') return cats.web;
  if (priorityKey === 'llamadas') return cats.calls;
  if (priorityKey === 'sms' || priorityKey === 'whatsapp') return cats.messaging;
  return false;
};

const detectSignals = (answers) => {
  const channels = Array.isArray(answers.channels) ? answers.channels : [];
  const scamTypes = Array.isArray(answers.scam_type) ? answers.scam_type : [];
  const story = String(answers.scam_story || '').toLowerCase();

  const storyHints = {
    web: /(web|p[aá]gina|sitio|dominio|clon|clonad)/i.test(story),
    sms: /(sms|mensaje|c[oó]digo|link|enlace)/i.test(story),
    whatsapp: /(whatsapp|wa|chat|grupo)/i.test(story),
    llamada: /(llamada|tel[eé]fono|banco|operador)/i.test(story),
  };

  const hit = (key) =>
    channels.includes(key) || scamTypes.includes(key) || storyHints[key] === true;

  return {
    channels,
    scamTypes,
    priority: answers.priority || '',
    scammed: answers.scammed || '',
    hasWeb: hit('web'),
    hasSms: hit('sms'),
    hasWhatsapp: hit('whatsapp'),
    hasCalls: hit('llamadas') || hit('llamada'),
    hasEmailOrSocial: channels.includes('correo') || channels.includes('redes'),
  };
};

const chooseCourseCategories = ({ answers, assessment, prefs }) => {
  const signals = detectSignals(answers || {});
  const priority = String(answers?.priority || '').toLowerCase();
  const temasRaw = Array.isArray(prefs?.temas) ? prefs.temas : [];
  const temas = temasRaw.map((t) => normalizeCourseCategory(t)).filter(Boolean);
  const wantAll = priority === 'todo' || temas.includes('todo');
  const level = normalizeNivel(assessment?.nivel || 'Medio');
  const messagingPreferred =
    signals.hasWhatsapp || temas.includes('whatsapp') ? 'whatsapp' : 'sms';

  const cats = [];
  const push = (cat) => cats.push(normalizeCourseCategory(cat));

  const pushScamHistoryFocus = () => {
    if (signals.scammed !== 'si') return;
    if (signals.hasWeb) return push('web');
    if (signals.hasWhatsapp) return push('whatsapp');
    if (signals.hasSms) return push('sms');
    if (signals.hasCalls) return push('llamadas');
    return push('habitos');
  };

  if (wantAll) {
    push('web');
    push(messagingPreferred);
    push('llamadas');
    push('correo_redes');
    push('habitos');
    pushScamHistoryFocus();

    // Extra module: reinforce the channel where the user is most exposed.
    if (cats.length < COURSE_MODULE_COUNT) {
      if (signals.hasWeb) push('web');
      else if (signals.hasCalls) push('llamadas');
      else push(messagingPreferred);
    }
  } else {
    // Give extra weight to the user's stated priority.
    if (priority && priority !== 'todo') {
      push(priority);
      push(priority);
    }

    // Ensure core coverage.
    if (!cats.includes('web')) push('web');
    if (!cats.some((c) => c === 'sms' || c === 'whatsapp')) push(messagingPreferred);
    if (!cats.includes('llamadas')) push('llamadas');

    // Include email/social if relevant or requested (or high risk).
    const wantsEmail =
      temas.includes('correo_redes') || signals.hasEmailOrSocial || level === 'Alto';
    if (wantsEmail) push('correo_redes');

    // Habits is always included.
    push('habitos');

    pushScamHistoryFocus();

    // Respect explicit topics (optional extras).
    temas.forEach((cat) => {
      if (cat === 'todo') return;
      if (cats.length < COURSE_MODULE_COUNT) push(cat);
    });

    // Fill remaining modules based on exposure.
    while (cats.length < COURSE_MODULE_COUNT) {
      if (signals.hasWeb) push('web');
      else if (signals.hasCalls) push('llamadas');
      else if (signals.hasWhatsapp) push('whatsapp');
      else if (signals.hasSms) push('sms');
      else push('habitos');
    }
  }

  // Ensure exact count.
  while (cats.length < COURSE_MODULE_COUNT) push('habitos');
  return cats.slice(0, COURSE_MODULE_COUNT);
};

const buildFallbackAssessment = (answers) => {
  const signals = detectSignals(answers);

  const modules = [];
  const pushModule = (titulo, descripcion) => {
    if (modules.some((m) => m.titulo === titulo)) return;
    modules.push({ titulo, descripcion });
  };

  // Focus on the user's previous scam first (if any).
  if (signals.scammed === 'si') {
    pushModule(
      'Qué Hacer Si Ya Caíste',
      'Pasos para bloquear, reportar y reducir daños sin pánico.'
    );
  }
  if (signals.hasWeb) {
    pushModule(
      'Páginas Clonadas y Dominios',
      'Cómo detectar sitios falsos antes de pagar o ingresar datos.'
    );
    pushModule(
      'Compras y Pagos Seguros',
      'Qué métodos te protegen y qué señales evitar al pagar.'
    );
  }
  if (signals.hasSms || signals.hasWhatsapp) {
    pushModule(
      'Enlaces Sospechosos (SMS/WhatsApp)',
      'Cómo identificar urgencia, links falsos y suplantación.'
    );
  }
  if (signals.hasCalls) {
    pushModule(
      'Llamadas Fraudulentas',
      'Qué datos nunca dar y cómo verificar en canales oficiales.'
    );
  }
  if (signals.hasEmailOrSocial) {
    pushModule(
      'Phishing en Correo y Redes',
      'Cómo reconocer mensajes falsos y proteger tus cuentas.'
    );
  }
  // Always include a habits/fundamentals module.
  pushModule(
    'Hábitos de Verificación',
    'Checklist rápido para validar mensajes, enlaces y “ofertas”.'
  );

  // Make sure the user's learning priority is represented, even if they haven't been scammed that way.
  if (signals.priority === 'web') {
    pushModule(
      'Páginas Clonadas y Dominios',
      'Cómo detectar sitios falsos antes de comprar o ingresar datos.'
    );
    pushModule(
      'Compras y Pagos Seguros',
      'Qué métodos te protegen y qué señales evitar al pagar.'
    );
  }

  if (signals.priority === 'sms') {
    pushModule(
      'SMS Fraudulentos y Enlaces',
      'Cómo detectar mensajes falsos y validar sin abrir enlaces.'
    );
  }

  if (signals.priority === 'whatsapp') {
    pushModule(
      'Seguridad y Suplantación en WhatsApp',
      'Cómo reconocer perfiles falsos y ajustar tu privacidad.'
    );
    pushModule(
      'Enlaces Sospechosos (SMS/WhatsApp)',
      'Cómo identificar urgencia, links falsos y suplantación.'
    );
  }

  if (signals.priority === 'llamadas') {
    pushModule(
      'Llamadas Fraudulentas',
      'Qué datos nunca dar y cómo verificar en canales oficiales.'
    );
  }

  if (signals.priority === 'todo') {
    pushModule(
      'Páginas Clonadas y Dominios',
      'Cómo detectar sitios falsos antes de comprar o ingresar datos.'
    );
    pushModule(
      'Enlaces Sospechosos (SMS/WhatsApp)',
      'Cómo identificar urgencia, links falsos y suplantación.'
    );
    pushModule(
      'Llamadas Fraudulentas',
      'Qué datos nunca dar y cómo verificar en canales oficiales.'
    );
  }

  // Order by the user's declared priority when possible.
  const priorityKey = String(signals.priority || '').toLowerCase();
  const priorityMatchers = {
    web: /p[aá]ginas clonadas|compras y pagos|dominios/i,
    sms: /sms|enlaces sospechosos/i,
    whatsapp: /whatsapp|enlaces sospechosos/i,
    llamadas: /llamadas fraudulentas/i,
    todo: /p[aá]ginas clonadas|compras y pagos|dominios|enlaces sospechosos|whatsapp|llamadas fraudulentas/i,
  };

  if (priorityMatchers[priorityKey]) {
    modules.sort((a, b) => {
      const aHit = priorityMatchers[priorityKey].test(a.titulo);
      const bHit = priorityMatchers[priorityKey].test(b.titulo);
      return Number(bHit) - Number(aHit);
    });
  }

  const proximos_pasos = modules.slice(0, 4);

  const recomendaciones = [];
  const pushRec = (text) => {
    if (recomendaciones.length >= 3) return;
    recomendaciones.push(text);
  };

  if (signals.hasWeb) {
    pushRec('Antes de pagar, compara dominio exacto y evita ofertas demasiado baratas.');
    pushRec('Prefiere tarjeta o plataforma con protección, evita transferencias o depósitos.');
  }
  if (signals.hasSms || signals.hasWhatsapp) {
    pushRec('No abras enlaces; valida la empresa en su app o web oficial.');
  }
  if (signals.hasCalls) {
    pushRec('Si te presionan por teléfono, cuelga y contacta por canales oficiales.');
  }
  if (recomendaciones.length < 3) {
    pushRec('Si algo te urge o asusta, pausa y verifica antes de actuar.');
  }

  return {
    // Keep the summary empty; the UI already has a fallback and the model should fill it.
    recomendaciones: recomendaciones.slice(0, 3),
    proximos_pasos,
  };
};

const normalizeSteps = (steps) =>
  (Array.isArray(steps) ? steps : [])
    .map((step) => {
      if (!step) return null;
      if (typeof step === 'string') return { titulo: step.trim(), descripcion: '' };
      if (typeof step === 'object') {
        const titulo = toText(step.titulo || step.title || step.tema || step.modulo);
        const descripcion = toText(
          step.descripcion || step.aprenderas || step.desc || step.detalle
        );
        return titulo ? { titulo, descripcion } : null;
      }
      return null;
    })
    .filter(Boolean);

const sanitizeAssessment = (parsed, answers) => {
  const priorityKey = String(answers?.priority || '').toLowerCase();
  const signals = detectSignals(answers);
  const fallback = buildFallbackAssessment(answers);
  const fallbackSteps = normalizeSteps(fallback.proximos_pasos);

  const safe = {
    nivel: normalizeNivel(parsed?.nivel),
    resumen: String(parsed?.resumen || '').trim(),
    recomendaciones: asStringArray(parsed?.recomendaciones),
    proximos_pasos: Array.isArray(parsed?.proximos_pasos) ? parsed.proximos_pasos : [],
  };

  // Normalize next steps into { titulo, descripcion } objects for consistent UI.
  safe.proximos_pasos = normalizeSteps(safe.proximos_pasos);

  // If the model gives generic recommendations with no context, prefer our context-aware fallback.
  const recsAreAllContextless =
    safe.recomendaciones.length >= 3 && safe.recomendaciones.every(recLacksContext);
  if (recsAreAllContextless) {
    safe.recomendaciones = asStringArray(fallback.recomendaciones);
  }

  // Ensure recommendations are present and not generic placeholders.
  const recsTooGeneric =
    safe.recomendaciones.length < 3 || safe.recomendaciones.every(looksGeneric);

  // Ensure next steps are present and not generic placeholders.
  const stepsTooGeneric =
    safe.proximos_pasos.length < 2 ||
    safe.proximos_pasos.some((step) => looksGeneric(step?.titulo || step?.descripcion));

  if (recsTooGeneric || stepsTooGeneric) {
    if (recsTooGeneric) safe.recomendaciones = asStringArray(fallback.recomendaciones);
    if (stepsTooGeneric) safe.proximos_pasos = fallbackSteps;
  }

  // Enforce alignment with priority and user's history, using fallback steps as a safety net.
  const pool = [
    ...safe.proximos_pasos,
    ...fallbackSteps,
  ];

  const titleKey = (step) => String(step?.titulo || '').trim().toLowerCase();
  const used = new Set();
  const selected = [];

  const take = (step) => {
    if (!step) return false;
    const key = titleKey(step);
    if (!key || used.has(key)) return false;
    used.add(key);
    selected.push(step);
    return true;
  };

  const pick = (predicate) => pool.find((step) => predicate(step) && !used.has(titleKey(step)));

  const pickCategory = (category) =>
    pick((step) => categorizeStep(step)[category] === true);

  const pickPriority = () => pick((step) => stepMatchesPriority(step, priorityKey));

  // Priority "todo": ensure breadth across channels (web + messaging + calls).
  if (priorityKey === 'todo') {
    take(pickCategory('web'));
    take(pickCategory('messaging'));
    take(pickCategory('calls'));

    // Fourth module: focus on recovery if scammed; otherwise habits.
    const extra = signals.scammed === 'si'
      ? pick((step) => /ca[ií]ste|recuper|reportar|bloquear|dañ/i.test(`${step.titulo} ${step.descripcion}`))
      : pick((step) => /h[aá]bitos|checklist|verific/i.test(`${step.titulo} ${step.descripcion}`));
    take(extra);
  } else if (priorityKey) {
    // For a specific priority, make sure at least two modules align with it.
    take(pickPriority());
    take(pickPriority());

    // Also include at least one module that matches the user's scam history (if any).
    if (signals.scammed === 'si') {
      if (signals.hasWeb) take(pickCategory('web'));
      if (signals.hasSms || signals.hasWhatsapp) take(pickCategory('messaging'));
      if (signals.hasCalls) take(pickCategory('calls'));
    }
  }

  // Fill remaining slots with the most relevant leftover modules.
  while (selected.length < 4) {
    take(
      pick((step) => /h[aá]bitos|checklist|verific/i.test(`${step.titulo} ${step.descripcion}`))
    );
    if (selected.length >= 4) break;
    take(pick(() => true));
    if (!pool.length) break;
  }

  if (selected.length) {
    safe.proximos_pasos = selected.slice(0, 4);
  }

  // Clip sizes for safety.
  safe.recomendaciones = safe.recomendaciones.slice(0, 3);
  safe.proximos_pasos = safe.proximos_pasos.slice(0, 4);

  // De-duplicate next steps by title.
  const seen = new Set();
  safe.proximos_pasos = safe.proximos_pasos.filter((step) => {
    const key = String(step.titulo || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return safe;
};

const COURSE_CATEGORIES = [
  'web',
  'whatsapp',
  'sms',
  'llamadas',
  'correo_redes',
  'habitos',
];

const COURSE_MODULE_COUNT = 7;

const clampNumber = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
};

const normalizeCourseCategory = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'habitos';
  if (raw.startsWith('web')) return 'web';
  if (raw.startsWith('whats')) return 'whatsapp';
  if (raw === 'wa') return 'whatsapp';
  if (raw.startsWith('sms')) return 'sms';
  if (raw.startsWith('llam')) return 'llamadas';
  if (raw.startsWith('call')) return 'llamadas';
  if (raw.includes('correo') || raw.includes('redes') || raw.includes('mail'))
    return 'correo_redes';
  if (raw.includes('háb') || raw.includes('hab')) return 'habitos';
  return COURSE_CATEGORIES.includes(raw) ? raw : 'habitos';
};

const buildModuleTemplate = ({ categoria, index, answers, assessment }) => {
  const level = normalizeNivel(assessment?.nivel || 'Medio');
  const age = String(answers?.age || '');
  const toneNote =
    age === '13-17'
      ? 'con ejemplos sencillos'
      : age === '55+'
        ? 'con pasos muy claros'
        : 'con ejemplos cotidianos';

  const cat = normalizeCourseCategory(categoria);
  const modId = `mod_${cat}_${index + 1}`;

  const templates = {
    web: {
      titulo: 'Detecta Páginas Clonadas',
      descripcion: `Aprenderás señales para identificar webs falsas ${toneNote}.`,
      concepto: {
        titulo: 'Señales Rápidas en una Web',
        contenido:
          'Antes de comprar, revisa el dominio exacto, la información de contacto y las políticas. ' +
          'Desconfía de precios demasiado bajos y de sitios con errores o enlaces raros.',
      },
      simulacion: {
        titulo: 'Simulación: Tienda con Descuento',
        escenario:
          'Ves una “tienda oficial” con 70% de descuento y te pide transferir para apartar. ¿Qué haces primero?',
        opciones: [
          'Pago la transferencia para asegurar el precio.',
          'Verifico dominio y busco reseñas fuera del sitio.',
          'Escribo mi tarjeta y luego reviso.',
          'Comparto el link con amigos para preguntarles.',
        ],
        correcta: 1,
        explicacion:
          'Primero valida el dominio y la reputación. Evita transferencias: son difíciles de recuperar.',
      },
      checklist: {
        titulo: 'Checklist Antes de Pagar',
        intro: 'Antes de pagar, confirma:',
        items: [
          'Dominio exacto y sin letras raras.',
          'Contacto real (dirección/correo/políticas).',
          'Método de pago con protección (tarjeta).',
          'Reseñas fuera del sitio y señales de alerta.',
        ],
      },
    },
    whatsapp: {
      titulo: 'WhatsApp: Suplantación y Enlaces',
      descripcion: `Aprenderás a detectar engaños en WhatsApp ${toneNote}.`,
      concepto: {
        titulo: 'Señales de Suplantación',
        contenido:
          'Si te piden dinero, códigos o urgencia, pausa. Verifica por otro canal: una llamada directa o pregunta clave. ' +
          'No confíes solo en foto o nombre.',
      },
      simulacion: {
        titulo: 'Simulación: “Soy tu familiar”',
        escenario:
          'Te escriben: “Cambié de número, necesito que me transfieras ya”. ¿Qué harías?',
        opciones: [
          'Transfiero para ayudar rápido.',
          'Pido un audio y verifico con una llamada al número de siempre.',
          'Le mando mi ubicación para que venga.',
          'Le paso mi contraseña para “confirmar”.',
        ],
        correcta: 1,
        explicacion:
          'Verifica identidad por un canal distinto antes de cualquier pago o dato.',
      },
      checklist: {
        titulo: 'Tu Regla de Oro en WhatsApp',
        intro: 'Si hay urgencia o dinero:',
        items: [
          'Pausa 30 segundos.',
          'Verifica por otro canal.',
          'No abras links sin validar.',
          'Nunca compartas códigos/NIP.',
        ],
      },
    },
    sms: {
      titulo: 'SMS: Enlaces y Falsos Avisos',
      descripcion: `Aprenderás a detectar SMS falsos ${toneNote}.`,
      concepto: {
        titulo: 'SMS Falso vs Real',
        contenido:
          'Los fraudes usan urgencia (“último aviso”) y enlaces acortados. ' +
          'Para verificar, entra a la app oficial o escribe el sitio tú mismo.',
      },
      simulacion: {
        titulo: 'Simulación: “Banco bloqueó tu cuenta”',
        escenario:
          'Recibes un SMS que dice que tu banco bloqueó tu cuenta y te deja un link. ¿Qué haces?',
        opciones: [
          'Abro el link para desbloquear.',
          'Entro a la app oficial y reviso notificaciones.',
          'Respondo con mis datos para confirmar.',
          'Reenvío el SMS para que “validen”.',
        ],
        correcta: 1,
        explicacion:
          'No uses el link del SMS. Verifica desde la app o sitio oficial escrito por ti.',
      },
      checklist: {
        titulo: 'Checklist de Enlaces',
        intro: 'Antes de abrir un link:',
        items: [
          '¿Esperaba este mensaje?',
          '¿Pide urgencia o datos?',
          '¿El enlace se ve raro/acortado?',
          'Mejor verifica por app oficial.',
        ],
      },
    },
    llamadas: {
      titulo: 'Llamadas Fraudulentas',
      descripcion: `Aprenderás a protegerte en llamadas ${toneNote}.`,
      concepto: {
        titulo: 'Datos que Nunca se Dan',
        contenido:
          'Ningún banco debe pedirte NIP, contraseñas o códigos por teléfono. ' +
          'Si te presionan, cuelga y llama tú al número oficial.',
      },
      simulacion: {
        titulo: 'Simulación: “Soy del banco”',
        escenario:
          'Te llaman diciendo que hay cargos raros y te piden un código SMS. ¿Qué haces?',
        opciones: [
          'Doy el código para cancelar.',
          'Cuelgo y llamo al número oficial del banco.',
          'Pido que me lo repitan más lento.',
          'Les doy mi contraseña para “verificar”.',
        ],
        correcta: 1,
        explicacion:
          'Cuelga y verifica por canales oficiales. El código SMS es una llave para entrar.',
      },
      checklist: {
        titulo: 'Guión Anti-Fraude',
        intro: 'Si recibes una llamada sospechosa:',
        items: [
          'No confirmes datos sensibles.',
          'Cuelga si hay presión/urgencia.',
          'Verifica desde tu app o número oficial.',
          'Reporta el intento si aplica.',
        ],
      },
    },
    correo_redes: {
      titulo: 'Correo y Redes: Phishing',
      descripcion: `Aprenderás a detectar engaños por correo/redes ${toneNote}.`,
      concepto: {
        titulo: 'Cómo se Ve un Phishing',
        contenido:
          'Los correos falsos imitan paqueterías o “soporte”. Revisa el remitente, el dominio y el mensaje. ' +
          'No descargues archivos ni abras links si no esperabas nada.',
      },
      simulacion: {
        titulo: 'Simulación: Paquete Detenido',
        escenario:
          'Te llega un correo: “Tu paquete está detenido, paga $45”. ¿Qué haces?',
        opciones: [
          'Pago para liberarlo.',
          'Verifico en la web oficial de la paquetería con mi guía.',
          'Respondo con mis datos.',
          'Descargo el archivo adjunto.',
        ],
        correcta: 1,
        explicacion:
          'Verifica desde la web oficial y nunca pagues desde links de correos sospechosos.',
      },
      checklist: {
        titulo: 'Checklist de Correo',
        intro: 'Antes de confiar en un correo:',
        items: [
          'Revisa el remitente y dominio.',
          'Evita adjuntos inesperados.',
          'Busca urgencia o amenazas.',
          'Verifica en la web oficial.',
        ],
      },
    },
    habitos: {
      titulo: 'Hábitos de Verificación',
      descripcion: `Crearás una rutina simple para evitar estafas ${toneNote}.`,
      concepto: {
        titulo: 'Tu Pausa de 10 Segundos',
        contenido:
          'La mayoría de estafas funcionan por prisa. Antes de actuar, respira, revisa y verifica por un canal oficial. ' +
          'Esta pausa reduce errores.',
      },
      simulacion: {
        titulo: 'Simulación: Mensaje Urgente',
        escenario:
          'Te llega un mensaje urgente con un link. ¿Cuál es tu primer paso?',
        opciones: [
          'Abrir el link para ver.',
          'Pausar y verificar por app/canal oficial.',
          'Reenviar a un amigo.',
          'Responder con mis datos.',
        ],
        correcta: 1,
        explicacion:
          'Primero pausa y verifica. La prisa es la herramienta #1 del fraude.',
      },
      checklist: {
        titulo: 'Checklist de 4 Pasos',
        intro: 'Antes de actuar:',
        items: [
          '¿Esperaba este mensaje?',
          '¿Me mete urgencia o miedo?',
          '¿Pide datos o dinero?',
          'Verifico por canal oficial.',
        ],
      },
    },
  };

  const base = templates[cat] || templates.habitos;

  const pesoConcepto = level === 'Bajo' ? 0.9 : level === 'Alto' ? 1.05 : 0.95;
  const pesoQuiz = level === 'Bajo' ? 1.0 : level === 'Alto' ? 1.15 : 1.05;
  const pesoSim = level === 'Bajo' ? 1.1 : level === 'Alto' ? 1.3 : 1.2;
  const pesoAbierta = level === 'Bajo' ? 1.15 : level === 'Alto' ? 1.35 : 1.25;
  const pesoChat = level === 'Bajo' ? 1.4 : level === 'Alto' ? 1.75 : 1.6;
  const pesoChecklist = level === 'Bajo' ? 1.0 : level === 'Alto' ? 1.15 : 1.05;

  const pickQuiz = () => {
    if (base.quiz) return base.quiz;
    if (cat === 'web') {
      return {
        titulo: 'Quiz: Señal Más Fuerte',
        escenario: '¿Qué te haría sospechar MÁS de una tienda en línea?',
        opciones: [
          'Solo acepta transferencia y tiene dominio raro.',
          'Tiene muchas fotos del producto.',
          'Tiene un logo moderno.',
          'Tiene varios productos.',
        ],
        correcta: 0,
        explicacion: 'Transferencia + dominio raro es una combinación muy sospechosa.',
      };
    }
    if (cat === 'llamadas') {
      return {
        titulo: 'Quiz: Dato Prohibido',
        escenario: '¿Qué NO se comparte por teléfono?',
        opciones: ['Nombre', 'NIP/contraseña/códigos', 'Estado', 'Correo'],
        correcta: 1,
        explicacion: 'NIP, contraseñas y códigos no se comparten por llamada.',
      };
    }
    return {
      titulo: 'Quiz: Urgencia',
      escenario: '¿Cuál es una señal típica de estafa?',
      opciones: [
        'Urgencia/amenaza (“hoy”, “último aviso”).',
        'Mensaje largo con detalles.',
        'Saludo cordial.',
        'Imagen bonita.',
      ],
      correcta: 0,
      explicacion: 'La urgencia es el gancho más común en fraudes.',
    };
  };

  const pickAbierta = () => {
    if (base.abierta) return base.abierta;
    if (cat === 'web') {
      return {
        titulo: 'Reto Abierto: Checklist',
        prompt: 'Escribe 3 a 5 cosas que revisarías antes de comprar en una web nueva.',
        pistas: ['dominio exacto', 'reseñas externas', 'método de pago', 'contacto real'],
      };
    }
    if (cat === 'whatsapp') {
      return {
        titulo: 'Reto Abierto: Respuesta Segura',
        prompt: 'Escribe una respuesta corta y segura si te piden dinero “urgente” por WhatsApp.',
        pistas: ['verificar por llamada', 'pausar', 'no transferir', 'no compartir códigos'],
      };
    }
    if (cat === 'sms') {
      return {
        titulo: 'Reto Abierto: 3 Pasos',
        prompt: 'Describe (en 3 pasos) qué harías si te llega un SMS del “banco” con un link.',
        pistas: ['no abrir link', 'verificar en app', 'llamar a número oficial'],
      };
    }
    if (cat === 'llamadas') {
      return {
        titulo: 'Reto Abierto: Guión',
        prompt: 'Escribe una frase para colgar con seguridad y verificar por canales oficiales.',
        pistas: ['cuelgo', 'verifico en app', 'yo llamo', 'no doy códigos'],
      };
    }
    if (cat === 'correo_redes') {
      return {
        titulo: 'Reto Abierto: Señales',
        prompt: 'Escribe 3 cosas que revisarías en un correo/DM antes de creerlo.',
        pistas: ['remitente/dominio', 'urgencia', 'links/adjuntos'],
      };
    }
    return {
      titulo: 'Reto Abierto: Tu Regla',
      prompt: 'Escribe tu “regla personal” (una frase) para no caer por prisa.',
      pistas: ['pausa', 'verifico', 'canal oficial'],
    };
  };

  const pickChat = () => {
    if (base.sim_chat) return base.sim_chat;
    if (cat === 'web') {
      return {
        titulo: 'Simulación Chat: Vendedor Presiona',
        escenario: 'Un “vendedor” te presiona para pagar por transferencia.',
        inicio:
          'Hola! Si transfieres hoy te guardo el descuento. Solo manda comprobante.',
        turnos_max: 6,
      };
    }
    if (cat === 'whatsapp') {
      return {
        titulo: 'Simulación Chat: Familiar Urgente',
        escenario: 'Alguien finge ser un familiar y pide dinero urgente.',
        inicio:
          'Soy yo, cambié de número. Me urge un depósito ahorita, por favor.',
        turnos_max: 6,
      };
    }
    if (cat === 'llamadas') {
      return {
        titulo: 'Simulación: “Agente” Insistente',
        escenario: 'Un “agente” te presiona para que le des un código.',
        inicio:
          'Hablo del banco. Necesito el código que te llegó para cancelar un cargo ya.',
        turnos_max: 6,
      };
    }
    return {
      titulo: 'Simulación Chat: Mensaje Urgente',
      escenario: 'Te presionan con urgencia para que abras un link o des un código.',
      inicio:
        'Último aviso: si no confirmas ahora, tu cuenta se bloquea hoy.',
      turnos_max: 6,
    };
  };

  const quiz = pickQuiz();
  const abierta = pickAbierta();
  const simChat = pickChat();

  return {
    id: modId,
    titulo: base.titulo,
    descripcion: base.descripcion,
    categoria: cat,
    actividades: [
      {
        id: `${modId}_a1`,
        tipo: 'concepto',
        titulo: base.concepto.titulo,
        contenido: base.concepto.contenido,
        peso: pesoConcepto,
      },
      {
        id: `${modId}_a2`,
        tipo: 'quiz',
        titulo: quiz.titulo,
        escenario: quiz.escenario,
        opciones: quiz.opciones,
        correcta: quiz.correcta,
        explicacion: quiz.explicacion,
        peso: pesoQuiz,
      },
      {
        id: `${modId}_a3`,
        tipo: 'simulacion',
        titulo: base.simulacion.titulo,
        escenario: base.simulacion.escenario,
        opciones: base.simulacion.opciones,
        correcta: base.simulacion.correcta,
        explicacion: base.simulacion.explicacion,
        peso: pesoSim,
      },
      {
        id: `${modId}_a4`,
        tipo: 'abierta',
        titulo: abierta.titulo,
        prompt: abierta.prompt,
        pistas: Array.isArray(abierta.pistas) ? abierta.pistas : [],
        peso: pesoAbierta,
      },
      {
        id: `${modId}_a5`,
        tipo: 'sim_chat',
        titulo: simChat.titulo,
        escenario: simChat.escenario,
        inicio: simChat.inicio,
        turnos_max: clampNumber(simChat.turnos_max, 5, 8),
        peso: pesoChat,
      },
      {
        id: `${modId}_a6`,
        tipo: 'checklist',
        titulo: base.checklist.titulo,
        intro: base.checklist.intro,
        items: base.checklist.items,
        peso: pesoChecklist,
      },
    ],
  };
};

const buildFallbackCoursePlan = ({ answers, assessment, prefs }) => {
  const priority = String(answers?.priority || '').toLowerCase();
  const topics = Array.isArray(prefs?.temas) ? prefs.temas : [];
  const wantAll = priority === 'todo' || topics.includes('todo');
  const signals = detectSignals(answers);

  const categories = chooseCourseCategories({ answers, assessment, prefs });
  const ruta = categories.map((cat, idx) =>
    buildModuleTemplate({ categoria: cat, index: idx, answers, assessment })
  );

  const base =
    normalizeNivel(assessment?.nivel) === 'Alto'
      ? 35
      : normalizeNivel(assessment?.nivel) === 'Bajo'
        ? 65
        : 50;

  const habit = String(answers?.habits || '').toLowerCase();
  const habitDelta = habit === 'siempre' ? 10 : habit === 'nunca' ? -15 : -5;
  const knowledge = String(answers?.knowledge || '').toLowerCase();
  const knowledgeDelta =
    knowledge === 'avanzado' ? 10 : knowledge === 'intermedio' ? 5 : knowledge === 'nada' ? -10 : 0;

  const competencias = {
    web: clampNumber(base + habitDelta + knowledgeDelta + (signals.hasWeb ? -5 : 0), 10, 95),
    whatsapp: clampNumber(base + habitDelta + knowledgeDelta + (signals.hasWhatsapp ? -5 : 0), 10, 95),
    sms: clampNumber(base + habitDelta + knowledgeDelta + (signals.hasSms ? -5 : 0), 10, 95),
    llamadas: clampNumber(base + habitDelta + knowledgeDelta + (signals.hasCalls ? -5 : 0), 10, 95),
    correo_redes: clampNumber(base + habitDelta + knowledgeDelta + (signals.hasEmailOrSocial ? -5 : 0), 10, 95),
    habitos: clampNumber(base + habitDelta + knowledgeDelta, 10, 95),
  };

  const score_total = Math.round(
    (competencias.web +
      competencias.whatsapp +
      competencias.sms +
      competencias.llamadas +
      competencias.correo_redes +
      competencias.habitos) /
      6
  );

  return {
    score_name: 'Blindaje Digital',
    score_total,
    competencias,
    ruta,
  };
};

const sanitizeCoursePlan = (plan, { answers, assessment, prefs }) => {
  const fallback = buildFallbackCoursePlan({ answers, assessment, prefs });
  const safe = {
    score_name: toText(plan?.score_name) || fallback.score_name,
    score_total: clampNumber(plan?.score_total, 0, 100),
    competencias: {},
    ruta: [],
  };

  // competencias
  const rawComp = plan?.competencias && typeof plan.competencias === 'object' ? plan.competencias : {};
  const keys = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];
  keys.forEach((key) => {
    safe.competencias[key] = clampNumber(rawComp[key], 0, 100);
    if (!Number.isFinite(Number(rawComp[key]))) {
      safe.competencias[key] = fallback.competencias[key];
    }
  });

  if (!Number.isFinite(Number(plan?.score_total))) {
    safe.score_total = Math.round(
      keys.reduce((acc, key) => acc + safe.competencias[key], 0) / keys.length
    );
  }

  // ruta
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  const modules = route
    .map((mod, idx) => {
      if (!mod || typeof mod !== 'object') return null;
      const categoria = normalizeCourseCategory(mod.categoria);
      const id = toText(mod.id) || `mod_${categoria}_${idx + 1}`;
      const titulo = toText(mod.titulo) || `Módulo ${idx + 1}`;
      const descripcion = toText(mod.descripcion) || '';
      const actividadesRaw = Array.isArray(mod.actividades) ? mod.actividades : [];
      const actividades = actividadesRaw
        .map((act, aIdx) => {
          if (!act || typeof act !== 'object') return null;
          const tipo = String(act.tipo || '').toLowerCase();
          const allowed = ['concepto', 'simulacion', 'checklist', 'quiz', 'abierta', 'sim_chat'];
          const safeTipo = allowed.includes(tipo) ? tipo : 'concepto';
          const actId = toText(act.id) || `${id}_a${aIdx + 1}`;
          const actTitle = toText(act.titulo) || `Actividad ${aIdx + 1}`;
          const peso = clampNumber(act.peso ?? act.puntos, 0.5, 3);

          const base = { id: actId, tipo: safeTipo, titulo: actTitle, peso };
          if (safeTipo === 'concepto') {
            return { ...base, contenido: toText(act.contenido) };
          }
          if (safeTipo === 'checklist') {
            const items = asStringArray(act.items).slice(0, 8);
            return { ...base, intro: toText(act.intro), items };
          }
          if (safeTipo === 'abierta') {
            const pistas = asStringArray(act.pistas).slice(0, 3);
            return { ...base, prompt: toText(act.prompt || act.pregunta), pistas };
          }
          if (safeTipo === 'sim_chat') {
            return {
              ...base,
              escenario: toText(act.escenario),
              inicio: toText(act.inicio),
              turnos_max: clampNumber(act.turnos_max, 5, 8),
            };
          }
          // simulacion/quiz
          const opciones = asStringArray(act.opciones).slice(0, 5);
          const correcta = clampNumber(act.correcta, 0, Math.max(0, opciones.length - 1));
          return {
            ...base,
            escenario: toText(act.escenario),
            opciones,
            correcta,
            explicacion: toText(act.explicacion),
          };
        })
        .filter(Boolean);

      const pickType = (t) => actividades.find((a) => a.tipo === t);
      const ordered = [
        pickType('concepto'),
        pickType('quiz'),
        pickType('simulacion'),
        pickType('abierta'),
        pickType('sim_chat'),
        pickType('checklist'),
      ].filter(Boolean);

      // Ensure required activity set. If missing, take from fallback template.
      if (ordered.length < 6) {
        return buildModuleTemplate({ categoria, index: idx, answers, assessment });
      }

      return { id, titulo, descripcion, categoria, actividades: ordered };
    })
    .filter(Boolean);

  safe.ruta = modules.length ? modules.slice(0, COURSE_MODULE_COUNT) : fallback.ruta;

  // Enforce coverage for "todo": web + messaging + calls.
  const priority = String(answers?.priority || '').toLowerCase();
  if (priority === 'todo') {
    const hasWeb = safe.ruta.some((m) => m.categoria === 'web');
    const hasCalls = safe.ruta.some((m) => m.categoria === 'llamadas');
    const hasMessaging = safe.ruta.some((m) => m.categoria === 'sms' || m.categoria === 'whatsapp');

    const needed = [];
    if (!hasWeb) needed.push('web');
    if (!hasMessaging) needed.push('sms');
    if (!hasCalls) needed.push('llamadas');

    needed.forEach((cat, i) => {
      const pos = Math.max(0, safe.ruta.length - 1 - i);
      safe.ruta[pos] = buildModuleTemplate({ categoria: cat, index: pos, answers, assessment });
    });
  }

  // Ensure exactly COURSE_MODULE_COUNT modules.
  while (safe.ruta.length < COURSE_MODULE_COUNT) {
    safe.ruta.push(fallback.ruta[safe.ruta.length] || buildModuleTemplate({ categoria: 'habitos', index: safe.ruta.length, answers, assessment }));
  }
  safe.ruta = safe.ruta.slice(0, COURSE_MODULE_COUNT);

  // Force the final route to respect our suggested categories/order.
  const expected = chooseCourseCategories({ answers, assessment, prefs });
  if (Array.isArray(expected) && expected.length === COURSE_MODULE_COUNT) {
    const pool = safe.ruta.slice();
    const used = new Set();
    safe.ruta = expected.map((cat, idx) => {
      const normalized = normalizeCourseCategory(cat);
      const found = pool.findIndex((m, mIdx) => !used.has(mIdx) && m.categoria === normalized);
      if (found !== -1) {
        used.add(found);
        return pool[found];
      }
      return buildModuleTemplate({ categoria: normalized, index: idx, answers, assessment });
    });
  }

  return safe;
};

app.post('/api/assess', async (req, res) => {
  try {
    const answers = req.body?.answers || {};
    const input = buildAssessmentPrompt(answers);

    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input,
      temperature: 0.2,
      max_output_tokens: 550,
    });

    const text = extractText(data);
    const parsed = extractJson(text);

    if (!parsed || !parsed.nivel) {
      const fallback = buildFallbackAssessment(answers);
      return res.json({
        nivel: 'Medio',
        resumen:
          'No se pudo interpretar la respuesta del modelo. Mostramos un resultado preliminar.',
        recomendaciones: fallback.recomendaciones,
        proximos_pasos: fallback.proximos_pasos,
      });
    }

    return res.json(sanitizeAssessment(parsed, answers));
  } catch (error) {
    console.error('Error /api/assess:', error);
    return res.status(500).json({
      error: error.message || 'Error interno',
      status: error.status || 500,
    });
  }
});

app.post('/api/course', async (req, res) => {
  try {
    const answers = req.body?.answers || {};
    const assessment = req.body?.assessment || {};
    const prefs = req.body?.prefs || {};
    const progress = req.body?.progress || null;

    const categories = chooseCourseCategories({ answers, assessment, prefs });
    const input = buildCoursePrompt({ answers, assessment, prefs, progress, categories });

    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input,
      temperature: 0.25,
      max_output_tokens: 1800,
    });

    const text = extractText(data);
    const parsed = extractJson(text);
    const safe = sanitizeCoursePlan(parsed, { answers, assessment, prefs });
    return res.json(safe);
  } catch (error) {
    console.error('Error /api/course:', error);
    return res.status(500).json({
      error: error.message || 'Error interno',
      status: error.status || 500,
    });
  }
});

app.post('/api/course/grade-open', async (req, res) => {
  try {
    const prompt = toText(req.body?.prompt);
    const answer = toText(req.body?.answer);
    const user = req.body?.user || {};

    if (!prompt || !answer) {
      return res.status(400).json({
        error: 'Falta prompt o answer.',
        status: 400,
      });
    }

    const input = buildOpenAnswerGradePrompt({ prompt, answer, user });
    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input,
      temperature: 0.2,
      max_output_tokens: 450,
    });

    const text = extractText(data);
    const parsed = extractJson(text) || {};
    const rawScore = parsed.score ?? parsed.puntaje ?? parsed.calificacion;
    const score = Number.isFinite(Number(rawScore)) ? clampNumber(rawScore, 0, 1) : 0.6;
    const feedback =
      toText(parsed.feedback || parsed.retro || parsed.comentario) ||
      'Buen intento. Revisa las señales clave y vuelve a intentarlo.';

    return res.json({ score, feedback });
  } catch (error) {
    console.error('Error /api/course/grade-open:', error);
    return res.status(500).json({
      error: error.message || 'Error interno',
      status: error.status || 500,
    });
  }
});

app.post('/api/course/sim-turn', async (req, res) => {
  try {
    const scenario = toText(req.body?.scenario);
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const userMessage = toText(req.body?.userMessage);
    const turn = clampNumber(req.body?.turn, 1, 50);
    const turnos_max = clampNumber(req.body?.turnos_max, 3, 12);
    const user = req.body?.user || {};

    if (!scenario) {
      return res.status(400).json({
        error: 'Falta scenario.',
        status: 400,
      });
    }

    const input = buildSimTurnPrompt({
      scenario,
      history,
      userMessage,
      turn,
      turnos_max,
      user,
    });

    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input,
      temperature: 0.35,
      max_output_tokens: 500,
    });

    const text = extractText(data);
    const parsed = extractJson(text) || {};

    let reply = toText(parsed.reply || parsed.estafador || parsed.mensaje);
    let coach_feedback = toText(parsed.coach_feedback || parsed.feedback || parsed.coach);
    const rawScore = parsed.score ?? parsed.puntaje ?? parsed.calificacion;
    const score = Number.isFinite(Number(rawScore)) ? clampNumber(rawScore, 0, 1) : 0.6;
    let done = Boolean(parsed.done);

    if (turn >= turnos_max) done = true;

    if (!reply) {
      reply = 'Necesito que lo resuelvas ya. Solo confirma y avanzamos.';
    }
    if (!coach_feedback) {
      coach_feedback =
        'Vas bien por pausar. Tip: verifica por un canal oficial antes de actuar.';
    }

    // Safety scrub: no links or phone numbers in the simulated scammer reply.
    reply = String(reply || '')
      .replaceAll(/https?:\/\/\S+/gi, '[link]')
      .replaceAll(/\b\d{6,}\b/g, '[numero]');
    coach_feedback = String(coach_feedback || '').slice(0, 700);

    return res.json({
      reply: String(reply).slice(0, 500),
      coach_feedback,
      score,
      done,
    });
  } catch (error) {
    console.error('Error /api/course/sim-turn:', error);
    return res.status(500).json({
      error: error.message || 'Error interno',
      status: error.status || 500,
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const messages = req.body?.messages || [];
    const input = buildChatPrompt(messages);

    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input,
      temperature: 0.2,
      max_output_tokens: 300,
    });

    const text = extractText(data);
    return res.json({ reply: text });
  } catch (error) {
    console.error('Error /api/chat:', error);
    return res.status(500).json({
      error: error.message || 'Error interno',
      status: error.status || 500,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
