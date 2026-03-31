import express from 'express';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'escudo-store.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 45;
const MIN_PASSWORD_LENGTH = 6;
const scryptAsync = promisify(crypto.scrypt);

let storeCache = null;
let storeLoaded = false;
let storeSaveQueue = Promise.resolve();

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

const nowIso = () => new Date().toISOString();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const deepCopy = (value) => JSON.parse(JSON.stringify(value ?? null));

const emptyStore = () => ({
  meta: { createdAt: nowIso() },
  users: {},
  sessions: {},
});

const sanitizeStoreShape = (store) => {
  const safe = store && typeof store === 'object' ? store : {};
  safe.meta = safe.meta && typeof safe.meta === 'object' ? safe.meta : { createdAt: nowIso() };
  safe.users = safe.users && typeof safe.users === 'object' ? safe.users : {};
  safe.sessions = safe.sessions && typeof safe.sessions === 'object' ? safe.sessions : {};
  return safe;
};

const loadStore = async () => {
  if (storeLoaded && storeCache) return storeCache;

  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    storeCache = sanitizeStoreShape(JSON.parse(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('No se pudo leer el store:', error);
    }
    storeCache = emptyStore();
    await fs.writeFile(STORE_PATH, JSON.stringify(storeCache, null, 2), 'utf8');
  }

  storeLoaded = true;
  return storeCache;
};

const saveStore = async (store) => {
  const safe = sanitizeStoreShape(store);
  storeCache = safe;
  storeSaveQueue = storeSaveQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(safe, null, 2), 'utf8');
  });
  return storeSaveQueue;
};

const findUserByEmail = (store, email) => {
  const normalized = normalizeEmail(email);
  return Object.values(store.users || {}).find((user) => user?.email === normalized) || null;
};

const getAdminCount = (store) =>
  Object.values(store.users || {}).filter((user) => user?.role === 'admin').length;

const pickRoleForEmail = (store, email) => {
  const normalized = normalizeEmail(email);
  if (ADMIN_EMAILS.has(normalized)) return 'admin';
  if (!ADMIN_EMAILS.size && getAdminCount(store) === 0) return 'admin';
  return 'user';
};

const createEmptyUserState = () => ({
  answers: {},
  assessment: null,
  coursePlan: null,
  courseProgress: null,
  currentView: 'survey',
  surveyIndex: 0,
  surveyStage: 'survey',
  currentLesson: { moduleIndex: 0, activityIndex: 0 },
  updatedAt: nowIso(),
});

const sanitizeUserForClient = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role || 'user',
  createdAt: user.createdAt,
  lastAccessAt: user.lastAccessAt || user.createdAt,
});

const sanitizeClientStatePayload = (payload) => {
  const safe = payload && typeof payload === 'object' ? payload : {};
  return {
    answers: safe.answers && typeof safe.answers === 'object' ? deepCopy(safe.answers) : {},
    assessment: safe.assessment && typeof safe.assessment === 'object' ? deepCopy(safe.assessment) : null,
    coursePlan: safe.coursePlan && typeof safe.coursePlan === 'object' ? deepCopy(safe.coursePlan) : null,
    courseProgress: safe.courseProgress && typeof safe.courseProgress === 'object' ? deepCopy(safe.courseProgress) : null,
    currentView: ['survey', 'courses', 'lesson', 'admin'].includes(String(safe.currentView))
      ? String(safe.currentView)
      : 'survey',
    surveyIndex: Number.isFinite(Number(safe.surveyIndex)) ? Math.max(0, Number(safe.surveyIndex)) : 0,
    surveyStage: ['survey', 'loading', 'results'].includes(String(safe.surveyStage))
      ? String(safe.surveyStage)
      : 'survey',
    currentLesson:
      safe.currentLesson && typeof safe.currentLesson === 'object'
        ? {
            moduleIndex: Number.isFinite(Number(safe.currentLesson.moduleIndex))
              ? Math.max(0, Number(safe.currentLesson.moduleIndex))
              : 0,
            activityIndex: Number.isFinite(Number(safe.currentLesson.activityIndex))
              ? Math.max(0, Number(safe.currentLesson.activityIndex))
              : 0,
          }
        : { moduleIndex: 0, activityIndex: 0 },
    updatedAt: nowIso(),
  };
};

const createPasswordHash = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString('hex')}`;
};

const verifyPassword = async (password, stored) => {
  const [salt, hashed] = String(stored || '').split(':');
  if (!salt || !hashed) return false;
  const derived = await scryptAsync(password, salt, 64);
  const left = Buffer.from(hashed, 'hex');
  const right = Buffer.from(derived);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const cleanupExpiredSessions = (store) => {
  const now = Date.now();
  Object.entries(store.sessions || {}).forEach(([token, session]) => {
    const expiresAt = Date.parse(session?.expiresAt || '');
    if (!session?.userId || !store.users?.[session.userId] || !Number.isFinite(expiresAt) || expiresAt <= now) {
      delete store.sessions[token];
    }
  });
};

const createSession = (store, userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  store.sessions[token] = {
    userId,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  return token;
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
};

const requireAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Sesión no válida.', status: 401 });
    }

    const store = await loadStore();
    cleanupExpiredSessions(store);
    const session = store.sessions[token];
    const user = session ? store.users?.[session.userId] : null;

    if (!session || !user) {
      await saveStore(store);
      return res.status(401).json({ error: 'Sesión expirada.', status: 401 });
    }

    session.lastSeenAt = nowIso();
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    user.lastAccessAt = nowIso();
    user.state = user.state && typeof user.state === 'object' ? user.state : createEmptyUserState();
    user.state.updatedAt = nowIso();
    await saveStore(store);

    req.auth = { token, store, session, user };
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    res.status(500).json({ error: 'No se pudo validar la sesión.', status: 500 });
  }
};

const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (req.auth?.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso restringido.', status: 403 });
    }
    next();
  });
};

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

const buildCoursePrompt = ({ answers, assessment, prefs, progress, categories, levels }) => {
  return [
    {
      role: 'system',
      content: `Eres un diseñador instruccional y analista de estafas digitales en México.
Vas a crear un programa de aprendizaje PERSONALIZADO tipo app (retos, práctica y simulaciones).
Usa su edad, experiencia previa, canales de exposición, hábitos y prioridad de aprendizaje.
No pidas datos sensibles. No inventes números telefónicos. No inventes enlaces reales.
No digas que revisas enlaces o sitios; enseña qué revisar por su cuenta.

Devuelve SOLO JSON válido con estas llaves exactas:
- score_name (string creativo)
- score_total (entero 0-100)
- competencias (objeto con 0-100 por tema)
- ruta (array de 7 módulos)

Reglas globales:
1) competencias debe incluir (siempre): web, whatsapp, sms, llamadas, correo_redes, habitos.
2) ruta debe tener EXACTAMENTE 7 módulos. Cada módulo: id, titulo, descripcion, categoria, nivel, actividades.
3) categoria debe ser una de: web, whatsapp, sms, llamadas, correo_redes, habitos.
4) nivel debe ser EXACTAMENTE: "basico", "refuerzo" o "avanzado".
5) actividades: entre 6 y 10 por módulo (varía el formato; no todos iguales).
6) Tipos permitidos de actividad:
   - concepto, quiz, simulacion, abierta, sim_chat, checklist,
   - compare_domains, signal_hunt, inbox, web_lab, scenario_flow.
7) Cada actividad debe tener: id, tipo, titulo, peso (0.5 a 3).

Campos por tipo:
- concepto: contenido (max 120 palabras)
- checklist: intro (1 frase), items (4-9)
- quiz/simulacion: escenario (max 140 palabras), opciones (3-5), correcta (index), explicacion (max 55 palabras)
- abierta: prompt (1-2 frases) y opcional pistas (0-3)
- sim_chat: escenario (max 90 palabras), inicio (1 mensaje del estafador), turnos_max (5-8)
- compare_domains: prompt (1 frase), dominios (2-4), correcta (index), explicacion (max 55 palabras), tip (opcional)
- signal_hunt: mensaje (max 160 palabras), senales (4-8 objetos con: id, label, correcta, explicacion corta)
- inbox: kind ("sms" o "correo"), intro (1 frase), mensajes (4-7 objetos con: id, from, subject opcional, text, correcto ("seguro"|"estafa"), explicacion corta)
- web_lab: intro (1 frase), pagina (marca, dominio, banner, sub, contacto, pagos[], productos[]), hotspots (target debe ser: "domain","banner","contacto","pago"; 2-4 correctas)
- scenario_flow: intro (1 frase), pasos (2-5; cada paso: texto y 2-4 opciones con: texto, puntaje 0-1, feedback corto, siguiente opcional)

Reglas de dificultad por nivel:
- basico: señales claras y decisiones fáciles.
- refuerzo: señales mezcladas y más ambiguas.
- avanzado: escenarios realistas; señales menos obvias; requiere verificar y analizar.

Reglas por categoría (evita repetición):
- web: incluye web_lab y compare_domains (ideal también signal_hunt). No uses sim_chat aquí salvo que aporte.
- sms: incluye inbox(kind="sms") y signal_hunt.
- correo_redes: incluye inbox(kind="correo") y signal_hunt.
- whatsapp: incluye sim_chat y signal_hunt (enlaces/urgencia/suplantación).
- llamadas: incluye scenario_flow (y una abierta tipo “guión para colgar/verificar”).
- habitos: incluye scenario_flow (rutina) y checklist (regla personal).

Reglas de consistencia:
- La ruta DEBE respetar "categorias_sugeridas" (mismo orden y longitud).
- Si viene "niveles_sugeridos", úsalo para nivel por módulo (mismo orden).
- Si una categoría se repite, cambia enfoque y sube dificultad (básico -> refuerzo -> avanzado).
- No repitas títulos ni actividades “clonadas”.

Seguridad:
- No incluyas URLs ni teléfonos.
- No des instrucciones para estafar; es solo educación defensiva.
`,
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          respuestas: answers,
          evaluacion: assessment,
          preferencias: prefs,
          categorias_sugeridas: Array.isArray(categories) ? categories : [],
          niveles_sugeridos: Array.isArray(levels) ? levels : [],
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
        'Tú interpretas al "estafador" (sin links reales, sin teléfonos, sin nombres reales) y al mismo tiempo actúas como instructor.\n\n' +
        'Devuelve SOLO JSON válido con estas llaves exactas:\n' +
        '- reply (string): el siguiente mensaje del estafador (corto, manipulador, genérico).\n' +
        '- coach_feedback (string): retroalimentación breve y directa (2–4 frases).\n' +
        '- score (number 0-1): qué tan segura fue la respuesta del usuario.\n' +
        '- done (boolean): true si el usuario ya actuó de forma segura o si se llegó al límite.\n\n' +
        'Reglas para coach_feedback:\n' +
        'A) No uses frases empáticas repetitivas ni del tipo “Es comprensible…” o “Entiendo…”.\n' +
        'B) Explica la señal de estafa presente (urgencia, presión, transferencia, premio, etc.).\n' +
        'C) Indica qué debería hacer el usuario en una situación real.\n' +
        'D) Señala si la respuesta fue buena, regular o riesgosa.\n' +
        'E) Da una recomendación concreta y práctica.\n' +
        'F) Sé claro, breve y orientado a la acción; evita respuestas largas o genéricas.\n\n' +
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
  const push = (cat) => {
    const normalized = normalizeCourseCategory(cat);
    cats.push(normalized);
  };

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

const computeDifficultyDelta = ({ answers, assessment, prefs }) => {
  const pref = String(prefs?.dificultad || '').toLowerCase();
  if (pref === 'facil') return -1;
  if (pref === 'normal') return 0;
  if (pref === 'avanzada') return 1;

  // auto: lightly adapt using the assessment + self-reported knowledge (without turning it into an exam).
  const nivel = normalizeNivel(assessment?.nivel || 'Medio');
  const knowledge = String(answers?.knowledge || '').toLowerCase();
  const deltaFromNivel = nivel === 'Alto' ? 1 : nivel === 'Bajo' ? -1 : 0;
  const deltaFromKnowledge = knowledge === 'avanzado' ? 1 : knowledge === 'nada' ? -1 : 0;
  const raw = deltaFromNivel + deltaFromKnowledge;
  return clampNumber(raw, -1, 1);
};

const computeModuleLevels = (categories, { answers, assessment, prefs }) => {
  const cats = Array.isArray(categories) ? categories.map(normalizeCourseCategory) : [];
  const counts = {};
  const base = cats.map((cat) => {
    const n = counts[cat] || 0;
    counts[cat] = n + 1;
    if (n === 0) return 'basico';
    if (n === 1) return 'refuerzo';
    return 'avanzado';
  });

  const delta = computeDifficultyDelta({ answers, assessment, prefs });
  return base.map((lvl) => shiftModuleLevel(lvl, delta));
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

const MODULE_LEVELS = ['basico', 'refuerzo', 'avanzado'];

const clampNumber = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
};

const normalizeModuleLevel = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'basico';
  if (raw.startsWith('ava')) return 'avanzado';
  if (raw.startsWith('ref')) return 'refuerzo';
  if (raw.startsWith('bas')) return 'basico';
  if (raw.startsWith('int') || raw.startsWith('med')) return 'refuerzo';
  return MODULE_LEVELS.includes(raw) ? raw : 'basico';
};

const shiftModuleLevel = (nivel, delta) => {
  const idx = MODULE_LEVELS.indexOf(normalizeModuleLevel(nivel));
  const next = clampNumber(idx + (Number(delta) || 0), 0, MODULE_LEVELS.length - 1);
  return MODULE_LEVELS[next] || 'basico';
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

const buildModuleTemplate = ({ categoria, index, answers, assessment, nivel }) => {
  const userNivel = normalizeNivel(assessment?.nivel || 'Medio');
  const modNivel = normalizeModuleLevel(nivel);
  const cat = normalizeCourseCategory(categoria);
  const modId = `mod_${cat}_${index + 1}`;

  const age = String(answers?.age || '');
  const toneNote =
    age === '13-17'
      ? 'con ejemplos muy simples'
      : age === '55+'
        ? 'con pasos muy claros'
        : 'con ejemplos cotidianos';

  const levelBoost = modNivel === 'avanzado' ? 1.15 : modNivel === 'refuerzo' ? 1.05 : 1;
  const peso = (base) => clampNumber((Number(base) || 1) * levelBoost, 0.5, 3);

  const mk = (n, base) => ({ id: `${modId}_a${n}`, ...base, peso: peso(base.peso ?? 1) });

  const levelHint =
    modNivel === 'basico'
      ? 'señales claras y decisiones simples'
      : modNivel === 'refuerzo'
        ? 'señales mezcladas y un poco ambiguas'
        : 'escenarios realistas con señales menos obvias';

  if (cat === 'web') {
    const page =
      modNivel === 'basico'
        ? {
            marca: 'NovaTienda',
            dominio: 'novatienda-descuentos.shop',
            banner: '90% OFF SOLO HOY',
            sub: 'Venta “oficial” con envío inmediato.',
            contacto: 'Contacto: solo chat (sin dirección ni razón social).',
            pagos: ['Transferencia bancaria (único método)'],
            productos: [
              { nombre: 'Audífonos X', antes: '$1,299', precio: '$199' },
              { nombre: 'Smartwatch Z', antes: '$2,499', precio: '$349' },
              { nombre: 'Bocina Mini', antes: '$999', precio: '$149' },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              marca: 'NovaTienda',
              dominio: 'novatienda-mx-promos.com',
              banner: '30% OFF fin de semana',
              sub: 'Diseño “pro” pero con detalles raros al pagar.',
              contacto: 'Contacto: correo genérico y sin políticas claras.',
              pagos: ['Tarjeta (enlace externo)', 'Transferencia'],
              productos: [
                { nombre: 'Cámara Compacta', antes: '$3,799', precio: '$2,599' },
                { nombre: 'Teclado Mecánico', antes: '$1,799', precio: '$1,299' },
                { nombre: 'Mouse Gamer', antes: '$899', precio: '$599' },
              ],
            }
          : {
              marca: 'NovaTienda',
              dominio: 'novatienda-mx.com',
              banner: 'Descuento por “verificación”',
              sub: 'Parece normal, pero te empuja a “confirmar” fuera del flujo.',
              contacto: 'Contacto: solo formulario; sin datos fiscales visibles.',
              pagos: ['Tarjeta (sin 3D Secure)', 'Depósito “para confirmar”'],
              productos: [
                { nombre: 'Tablet 10"', antes: '$5,999', precio: '$4,999' },
                { nombre: 'Celular A1', antes: '$4,499', precio: '$3,999' },
                { nombre: 'Cargador Rápido', antes: '$399', precio: '$329' },
              ],
            };

    const hotspots =
      modNivel === 'basico'
        ? [
            { id: 'h1', target: 'domain', label: 'Dominio raro', correcta: true, explicacion: 'El dominio no coincide con uno “oficial”.' },
            { id: 'h2', target: 'banner', label: 'Descuento exagerado', correcta: true, explicacion: 'Descuentos extremos buscan que actúes con prisa.' },
            { id: 'h3', target: 'contacto', label: 'Contacto incompleto', correcta: true, explicacion: 'Sin dirección/políticas claras es mala señal.' },
            { id: 'h4', target: 'pago', label: 'Pago riesgoso', correcta: true, explicacion: 'Transferencia/depósito es difícil de recuperar.' },
          ]
        : modNivel === 'refuerzo'
          ? [
              { id: 'h1', target: 'domain', label: 'Dominio “promos”', correcta: true, explicacion: 'Los estafadores agregan palabras para parecer oficiales.' },
              { id: 'h3', target: 'contacto', label: 'Contacto dudoso', correcta: true, explicacion: 'Correo genérico y políticas vagas aumentan el riesgo.' },
              { id: 'h4', target: 'pago', label: 'Pago por enlace externo', correcta: true, explicacion: 'Pagos fuera del sitio oficial son una bandera roja.' },
              { id: 'h2', target: 'banner', label: 'Oferta normal', correcta: false, explicacion: 'No todo descuento es estafa: mira el conjunto de señales.' },
            ]
          : [
              { id: 'h1', target: 'domain', label: 'Dominio similar', correcta: true, explicacion: 'Un dominio “casi igual” es una técnica común (typosquatting).' },
              { id: 'h4', target: 'pago', label: '“Confirmación” con depósito', correcta: true, explicacion: 'Piden pago extra para saltarse verificación real.' },
              { id: 'h2', target: 'banner', label: 'Banner normal', correcta: false, explicacion: 'Aquí la estafa no está en el diseño: está en el flujo de pago.' },
              { id: 'h3', target: 'contacto', label: 'Formulario sin datos', correcta: true, explicacion: 'Sin razón social/aviso legal, es difícil reclamar.' },
            ];

    const domains =
      modNivel === 'basico'
        ? ['novatienda.com.mx', 'novatienda-descuentos.shop']
        : modNivel === 'refuerzo'
          ? ['novatienda.com.mx', 'novatienda-mx-promos.com', 'novatiendaoficial.com.mx']
          : ['novatienda.com.mx', 'novatienda-mx.com', 'novatienda-mex.com', 'novatienda.com-mx.site'];

    const signalMessage =
      modNivel === 'basico'
        ? 'Tu compra quedó “pendiente”. Para confirmar el descuento, envía tu comprobante y tus datos hoy.'
        : modNivel === 'refuerzo'
          ? 'Para “validar” tu pedido, necesitamos una confirmación rápida: responde con tus datos y paga en 30 minutos.'
          : 'Tu pago requiere “verificación manual”. Si confirmas ahora, conservas el precio; si no, se cancela.';

    const signals =
      modNivel === 'basico'
        ? [
            { id: 's1', label: 'Urgencia (“hoy”)', correcta: true, explicacion: 'Te empuja a actuar sin verificar.' },
            { id: 's2', label: 'Pide comprobante/pago', correcta: true, explicacion: 'Quieren cerrar la transacción rápido.' },
            { id: 's3', label: 'Pide datos personales', correcta: true, explicacion: 'Pueden usarlo para robo de identidad.' },
            { id: 's4', label: 'Mensaje claro y largo', correcta: false, explicacion: 'No es señal por sí sola.' },
            { id: 's5', label: 'Amenaza de cancelación', correcta: true, explicacion: 'Presión típica para que no revises.' },
          ]
        : modNivel === 'refuerzo'
          ? [
              { id: 's1', label: '“Validación” fuera del sitio', correcta: true, explicacion: 'Te sacan del canal oficial.' },
              { id: 's2', label: 'Tiempo límite corto', correcta: true, explicacion: 'Reduce tu capacidad de revisar.' },
              { id: 's3', label: 'Pide datos por respuesta', correcta: true, explicacion: 'No es un canal seguro.' },
              { id: 's4', label: 'Menciona políticas de envío', correcta: false, explicacion: 'Puede ser texto copiado.' },
              { id: 's5', label: '“Confirmación” sin referencia', correcta: true, explicacion: 'No da números verificables.' },
            ]
          : [
              { id: 's1', label: '“Verificación manual”', correcta: true, explicacion: 'Excusa común para pedir pasos extra.' },
              { id: 's2', label: 'Presión por mantener el precio', correcta: true, explicacion: 'Juega con tu miedo a perder la oferta.' },
              { id: 's3', label: 'Falta de canal oficial claro', correcta: true, explicacion: 'No te da cómo verificar por tu cuenta.' },
              { id: 's4', label: 'Buen tono y ortografía', correcta: false, explicacion: 'Hoy las estafas pueden verse “profesionales”.' },
              { id: 's5', label: 'Cambia de método de pago', correcta: true, explicacion: 'Red flag: te empuja a algo sin protección.' },
            ];

    return {
      id: modId,
      titulo: 'Detecta Páginas Clonadas',
      descripcion: `Entrenamiento ${levelHint} para compras seguras ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: [
        mk(1, {
          tipo: 'concepto',
          titulo: 'Mapa Rápido: Qué Revisar',
          contenido:
            'Antes de comprar, revisa dominio, contacto y métodos de pago. ' +
            'No te guíes solo por diseño o “candado”. Si te presionan o te piden depósito/transferencia, frena y verifica por canales oficiales.',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'web_lab',
          titulo: 'Modo Detective: Tienda en Vivo',
          intro: 'Explora la tienda y marca lo que te parezca sospechoso.',
          pagina: page,
          hotspots,
          peso: 1.5,
        }),
        mk(3, {
          tipo: 'compare_domains',
          titulo: 'Comparación de Dominios',
          prompt: '¿Cuál dominio se ve más legítimo?',
          dominios: domains,
          correcta: 0,
          explicacion:
            'El dominio oficial suele ser simple y consistente. Los falsos agregan palabras o cambian letras.',
          tip: 'Si dudas, no entres desde anuncios: escribe tú el dominio.',
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'signal_hunt',
          titulo: 'Encuentra Señales en el Mensaje',
          mensaje: signalMessage,
          senales: signals,
          peso: 1.2,
        }),
        mk(5, {
          tipo: 'quiz',
          titulo: 'Decisión Rápida',
          escenario: 'Si una web te empuja a pagar por transferencia, ¿qué haces?',
          opciones: [
            'Pagar para no perder la oferta.',
            'Pausar y verificar dominio/reseñas fuera del sitio.',
            'Mandar captura del pago para que “confirmen”.',
            'Dar datos para “validar” mi compra.',
          ],
          correcta: 1,
          explicacion: 'Primero verifica fuera del sitio y evita pagos sin protección.',
          peso: 1.0,
        }),
        mk(6, {
          tipo: 'abierta',
          titulo: 'Tu Checklist Personal',
          prompt:
            modNivel === 'avanzado'
              ? 'Escribe 4–6 cosas que verificarías antes de pagar en una web “muy bien hecha”.'
              : 'Escribe 3–5 cosas que verificarías antes de pagar en una web nueva.',
          pistas: ['dominio exacto', 'contacto/políticas', 'método de pago', 'reseñas fuera del sitio'],
          peso: 1.2,
        }),
        mk(7, {
          tipo: 'checklist',
          titulo: 'Checklist Final Antes de Pagar',
          intro: 'Antes de pagar, confirma:',
          items: [
            'Dominio exacto (sin letras raras).',
            'Contacto y políticas claras.',
            'Pago con protección (tarjeta/plataforma).',
            'Reseñas fuera del sitio.',
            'Nada de prisa: si te presionan, te sales.',
          ],
          peso: 1.0,
        }),
      ],
    };
  }

  if (cat === 'sms') {
    const inbox =
      modNivel === 'basico'
        ? [
            {
              id: 'm1',
              from: 'Aviso',
              text: 'Tu cuenta será bloqueada hoy. Confirma en el enlace.',
              correcto: 'estafa',
              explicacion: 'Urgencia + “enlace” es una combinación típica de fraude.',
            },
            {
              id: 'm2',
              from: 'Paquetería',
              text: 'Tu envío requiere pago extra. Entra a “confirmar” ahora.',
              correcto: 'estafa',
              explicacion: 'Te pide pago/acción urgente fuera de un canal verificable.',
            },
            {
              id: 'm3',
              from: 'Servicio',
              text: 'Tu código de verificación es 123456. No lo compartas.',
              correcto: 'seguro',
              explicacion: 'Un código legítimo suele decir “no lo compartas”.',
            },
            {
              id: 'm4',
              from: 'Promo',
              text: 'Ganaste un premio. Responde con tus datos para reclamar.',
              correcto: 'estafa',
              explicacion: 'Premios + datos personales: señal muy común de estafa.',
            },
          ]
        : modNivel === 'refuerzo'
          ? [
              {
                id: 'm1',
                from: 'Notificación',
                text: 'Actividad inusual detectada. Confirma tu acceso en el enlace.',
                correcto: 'estafa',
                explicacion: 'Te empuja a “confirmar” con urgencia sin canal oficial claro.',
              },
              {
                id: 'm2',
                from: 'Paquetería',
                text: 'Tu paquete está en revisión. Consulta el estatus en la app oficial.',
                correcto: 'seguro',
                explicacion: 'Te orienta a un canal oficial (app), sin pedir datos/pago.',
              },
              {
                id: 'm3',
                from: 'Banco',
                text: 'Cargo no reconocido. Llama al número oficial o revisa tu app.',
                correcto: 'seguro',
                explicacion: 'Recomienda verificación por canales oficiales.',
              },
              {
                id: 'm4',
                from: 'Soporte',
                text: 'Tu sesión caducó. Reingresa con tus datos para evitar suspensión.',
                correcto: 'estafa',
                explicacion: 'Presión + “reingresa” suele ser phishing.',
              },
            ]
          : [
              {
                id: 'm1',
                from: 'Seguridad',
                text: 'Se detectó un cambio de dispositivo. Si no fuiste tú, confirma ahora.',
                correcto: 'estafa',
                explicacion: 'Mensaje realista, pero te empuja a “confirmar” ya.',
              },
              {
                id: 'm2',
                from: 'Servicio',
                text: 'Tu pago fue rechazado. Revisa tu app y vuelve a intentar desde allí.',
                correcto: 'seguro',
                explicacion: 'No pide datos ni te manda a “enlaces”.',
              },
              {
                id: 'm3',
                from: 'Atención',
                text: 'Para liberar tu envío, envía comprobante y tu nombre completo.',
                correcto: 'estafa',
                explicacion: 'Pide datos + comprobante: intento de manipulación.',
              },
              {
                id: 'm4',
                from: 'Recibo',
                text: 'Gracias por tu compra. Si no la hiciste, entra a tu app y reporta.',
                correcto: 'seguro',
                explicacion: 'Te lleva a tu app, no a un link del SMS.',
              },
            ];

    const hunt =
      modNivel === 'basico'
        ? {
            mensaje: 'Último aviso: tu cuenta será suspendida. Entra a confirmar hoy.',
            senales: [
              { id: 's1', label: 'Urgencia', correcta: true, explicacion: 'Te presiona a actuar rápido.' },
              { id: 's2', label: 'Amenaza', correcta: true, explicacion: 'Usa miedo para que no verifiques.' },
              { id: 's3', label: 'Pide “confirmar”', correcta: true, explicacion: 'Suele llevar a phishing.' },
              { id: 's4', label: 'Mensaje corto', correcta: false, explicacion: 'No es señal por sí sola.' },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              mensaje: 'Actividad inusual. Para evitar bloqueo, confirma acceso cuanto antes.',
              senales: [
                { id: 's1', label: 'Presión de tiempo', correcta: true, explicacion: 'Reduce tu revisión.' },
                { id: 's2', label: '“Evitar bloqueo”', correcta: true, explicacion: 'Amenaza disfrazada.' },
                { id: 's3', label: 'Canal no oficial', correcta: true, explicacion: 'No sugiere app o número oficial.' },
                { id: 's4', label: 'Tono formal', correcta: false, explicacion: 'Puede ser copiado.' },
              ],
            }
          : {
              mensaje: 'Tu seguridad requiere verificación. Si no respondes, la operación se cancelará.',
              senales: [
                { id: 's1', label: '“Verificación” sin contexto', correcta: true, explicacion: 'No da forma de validar.' },
                { id: 's2', label: 'Consecuencia inmediata', correcta: true, explicacion: 'Presión para apurarte.' },
                { id: 's3', label: 'Pide respuesta por SMS', correcta: true, explicacion: 'Canal inseguro para datos.' },
                { id: 's4', label: 'Buena ortografía', correcta: false, explicacion: 'Las estafas pueden verse bien.' },
              ],
            };

    return {
      id: modId,
      titulo: 'SMS: Detecta Mensajes Falsos',
      descripcion: `Entrenamiento ${levelHint} para identificar SMS fraudulentos ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: [
        mk(1, {
          tipo: 'concepto',
          titulo: 'Regla de Oro en SMS',
          contenido:
            'No uses links de SMS para “confirmar” cuentas o pagos. Si el mensaje es real, podrás verificar desde tu app o escribiendo tú el sitio. ' +
            'La urgencia y las amenazas son señales clásicas.',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'inbox',
          titulo: 'Bandeja Simulada',
          kind: 'sms',
          intro: 'Clasifica cada SMS como Seguro o Estafa.',
          mensajes: inbox,
          peso: 1.4,
        }),
        mk(3, {
          tipo: 'signal_hunt',
          titulo: 'Señales Dentro del SMS',
          ...hunt,
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'compare_domains',
          titulo: 'Dominio en el Enlace',
          prompt: 'Si un SMS trae un link, ¿qué dominio se ve más legítimo?',
          dominios: ['servicio.com.mx', 'servicio-seguridad.com-mx.site'],
          correcta: 0,
          explicacion: 'Los dominios falsos suelen agregar palabras o cambiar el final.',
          tip: 'Mejor entra escribiendo tú el dominio o desde tu app.',
          peso: 1.0,
        }),
        mk(5, {
          tipo: 'quiz',
          titulo: 'Qué Hacer Primero',
          escenario: 'Te llega un SMS “del banco” con un link. ¿Cuál es tu primer paso?',
          opciones: [
            'Abrir el link para ver.',
            'Entrar a la app oficial y revisar ahí.',
            'Responder con mis datos.',
            'Reenviar a un amigo para preguntar.',
          ],
          correcta: 1,
          explicacion: 'Verifica por la app/canal oficial, no por el link del SMS.',
          peso: 1.0,
        }),
        mk(6, {
          tipo: 'checklist',
          titulo: 'Checklist de SMS',
          intro: 'Antes de actuar:',
          items: [
            '¿Esperaba este SMS?',
            '¿Mete urgencia o miedo?',
            '¿Pide datos, dinero o link?',
            'Verifico en app o canal oficial.',
          ],
          peso: 1.0,
        }),
      ],
    };
  }

  if (cat === 'correo_redes') {
    const inbox =
      modNivel === 'basico'
        ? [
            {
              id: 'c1',
              from: 'Soporte',
              subject: 'Tu cuenta será suspendida',
              text: 'Necesitamos que confirmes tus datos hoy para evitar bloqueo.',
              correcto: 'estafa',
              explicacion: 'Urgencia + “confirma datos” es phishing típico.',
            },
            {
              id: 'c2',
              from: 'Paquetería',
              subject: 'Estatus de envío',
              text: 'Revisa el estatus desde la web/app oficial con tu guía.',
              correcto: 'seguro',
              explicacion: 'Te manda a un canal oficial, sin pedir pago/datos.',
            },
            {
              id: 'c3',
              from: 'Factura',
              subject: 'Comprobante adjunto',
              text: 'Adjunto factura. Si no lo esperabas, no abras archivos.',
              correcto: 'estafa',
              explicacion: 'Adjunto inesperado puede traer malware o phishing.',
            },
            {
              id: 'c4',
              from: 'Red social',
              subject: '',
              text: '“Tu cuenta tiene un problema, entra a verificar.”',
              correcto: 'estafa',
              explicacion: 'Mensaje genérico con presión a “verificar”.',
            },
          ]
        : modNivel === 'refuerzo'
          ? [
              {
                id: 'c1',
                from: 'Atención',
                subject: 'Actividad inusual',
                text: 'Detectamos un intento de acceso. Verifica desde tu app.',
                correcto: 'seguro',
                explicacion: 'Menciona un canal oficial (app) sin links.',
              },
              {
                id: 'c2',
                from: 'Pagos',
                subject: 'Reembolso pendiente',
                text: 'Para liberar tu reembolso, confirma tus datos de pago.',
                correcto: 'estafa',
                explicacion: 'Reembolso “pendiente” + datos = gancho común.',
              },
              {
                id: 'c3',
                from: 'Soporte',
                subject: 'Actualiza seguridad',
                text: 'Tu contraseña expira. Reingresa con tus datos.',
                correcto: 'estafa',
                explicacion: 'Te empuja a reingresar: típico phishing.',
              },
              {
                id: 'c4',
                from: 'Comunidad',
                subject: 'Aviso',
                text: 'No compartas códigos. Si dudas, revisa ajustes de seguridad.',
                correcto: 'seguro',
                explicacion: 'Mensaje preventivo sin pedir acción peligrosa.',
              },
            ]
          : [
              {
                id: 'c1',
                from: 'Soporte',
                subject: 'Cambio de dispositivo',
                text: 'Si no reconoces el cambio, entra a tu cuenta por tu app.',
                correcto: 'seguro',
                explicacion: 'Canal oficial, sin pedir datos por correo.',
              },
              {
                id: 'c2',
                from: 'Cobranza',
                subject: 'Pago rechazado',
                text: 'Para reactivar tu servicio, confirma datos y adjunta comprobante.',
                correcto: 'estafa',
                explicacion: 'Pide comprobante/datos: señal roja.',
              },
              {
                id: 'c3',
                from: 'Promoción',
                subject: 'Oferta exclusiva',
                text: 'Oferta limitada. Entra a “apartar” hoy con depósito.',
                correcto: 'estafa',
                explicacion: 'Depósito + urgencia es riesgo alto.',
              },
              {
                id: 'c4',
                from: 'Red social',
                subject: '',
                text: 'Alguien reportó tu cuenta. Verifica identidad en 1 hora.',
                correcto: 'estafa',
                explicacion: 'Presión de tiempo para evitar que verifiques.',
              },
            ];

    return {
      id: modId,
      titulo: 'Correo/Redes: Phishing',
      descripcion: `Entrenamiento ${levelHint} para detectar phishing ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: [
        mk(1, {
          tipo: 'concepto',
          titulo: '3 Cosas que Se Revisan',
          contenido:
            'En correos y DMs, lo más importante es: remitente/dominio, urgencia y petición de datos/pagos. ' +
            'Si no lo esperabas, no abras adjuntos ni “verifiques” desde el mensaje: entra tú a la app o web oficial.',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'inbox',
          titulo: 'Inbox Simulada',
          kind: 'correo',
          intro: 'Clasifica cada mensaje como Seguro o Estafa.',
          mensajes: inbox,
          peso: 1.4,
        }),
        mk(3, {
          tipo: 'signal_hunt',
          titulo: 'Señales en un Correo',
          mensaje:
            '“Tu reembolso está pendiente. Para liberarlo, confirma tus datos de pago y responde este correo hoy.”',
          senales: [
            { id: 's1', label: 'Reembolso como gancho', correcta: true, explicacion: 'Te atrae con dinero.' },
            { id: 's2', label: 'Pide datos de pago', correcta: true, explicacion: 'Es información sensible.' },
            { id: 's3', label: 'Urgencia (“hoy”)', correcta: true, explicacion: 'Presión para actuar sin revisar.' },
            { id: 's4', label: 'Tiene asunto', correcta: false, explicacion: 'No es señal.' },
          ],
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'quiz',
          titulo: 'Adjuntos Inesperados',
          escenario: 'Si recibes un adjunto que no esperabas, ¿qué haces?',
          opciones: [
            'Lo abro para ver “qué es”.',
            'Pido verificación por un canal oficial antes de abrir.',
            'Lo reenvío a alguien.',
            'Respondo con mis datos.',
          ],
          correcta: 1,
          explicacion: 'Primero verifica por un canal oficial. Adjuntos pueden ser peligrosos.',
          peso: 1.0,
        }),
        mk(5, {
          tipo: 'abierta',
          titulo: 'Respuesta Segura (Sin Caer)',
          prompt:
            'Escribe una respuesta corta para no caer en phishing y decir que verificarás por canales oficiales.',
          pistas: ['no dar datos', 'verificar en app/web oficial', 'no abrir adjuntos'],
          peso: 1.1,
        }),
        mk(6, {
          tipo: 'checklist',
          titulo: 'Checklist Anti-Phishing',
          intro: 'Antes de confiar:',
          items: [
            '¿Lo esperaba?',
            '¿Pide datos, pago o link?',
            '¿Mete urgencia o amenaza?',
            'Verifico en canal oficial.',
          ],
          peso: 1.0,
        }),
      ],
    };
  }

  if (cat === 'whatsapp') {
    const signal =
      modNivel === 'basico'
        ? {
            mensaje: '“Soy tu familiar. Cambié de número. Me urge un depósito ahorita.”',
            senales: [
              { id: 's1', label: 'Cambio de número', correcta: true, explicacion: 'Técnica típica de suplantación.' },
              { id: 's2', label: 'Urgencia', correcta: true, explicacion: 'Busca que no verifiques.' },
              { id: 's3', label: 'Pide dinero', correcta: true, explicacion: 'Red flag principal.' },
              { id: 's4', label: 'Saluda por tu nombre', correcta: false, explicacion: 'Pueden saberlo.' },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              mensaje: '“Soy yo. Estoy en una reunión y no puedo hablar. ¿Me transfieres y te explico después?”',
              senales: [
                { id: 's1', label: 'Evita llamada', correcta: true, explicacion: 'Quiere impedir verificación.' },
                { id: 's2', label: 'Presión a transferir', correcta: true, explicacion: 'Busca cerrar rápido.' },
                { id: 's3', label: 'Excusa creíble', correcta: true, explicacion: 'Hace la estafa más realista.' },
                { id: 's4', label: 'Mensaje corto', correcta: false, explicacion: 'No es señal por sí sola.' },
              ],
            }
          : {
              mensaje:
                '“Soy tu familiar. Me robaron el celular y este es temporal. Necesito que me ayudes, pero no se lo digas a nadie.”',
              senales: [
                { id: 's1', label: 'Secreto/aislamiento', correcta: true, explicacion: 'Te aísla para que no verifiques.' },
                { id: 's2', label: 'Historia creíble', correcta: true, explicacion: 'Baja tus defensas.' },
                { id: 's3', label: 'Pide ayuda rápida', correcta: true, explicacion: 'Te empuja a actuar.' },
                { id: 's4', label: 'Usa buen tono', correcta: false, explicacion: 'No garantiza nada.' },
              ],
            };

    return {
      id: modId,
      titulo: 'WhatsApp: Suplantación y Enlaces',
      descripcion: `Entrenamiento ${levelHint} para detectar engaños en WhatsApp ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: [
        mk(1, {
          tipo: 'concepto',
          titulo: 'Regla Rápida en WhatsApp',
          contenido:
            'En WhatsApp, la estafa suele usar urgencia + dinero + evitar verificación. ' +
            'La defensa es simple: pausa, verifica por otro canal (llamada al número guardado) y no compartas códigos.',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'signal_hunt',
          titulo: 'Detecta Señales en el Mensaje',
          ...signal,
          peso: 1.1,
        }),
        mk(3, {
          tipo: 'sim_chat',
          titulo: 'Simulación de Chat (Suplantación)',
          escenario:
            modNivel === 'avanzado'
              ? 'Alguien finge ser alguien cercano y mezcla urgencia con una historia creíble.'
              : 'Alguien finge ser alguien cercano y pide dinero urgente.',
          inicio:
            modNivel === 'basico'
              ? 'Soy yo, cambié de número. Me urge un depósito ahorita, por favor.'
              : modNivel === 'refuerzo'
                ? 'Estoy en una situación. No puedo hablar. ¿Me transfieres y te explico después?'
                : 'Me robaron el celular, este número es temporal. Ayúdame rápido, por favor.',
          turnos_max: 6,
          peso: 1.6,
        }),
        mk(4, {
          tipo: 'quiz',
          titulo: 'Qué Harías',
          escenario: 'Te piden dinero por WhatsApp y dicen que “no pueden hablar”. ¿Qué haces?',
          opciones: [
            'Transfiero para ayudar.',
            'Verifico llamando al número de siempre o por otra vía.',
            'Pido que me manden una foto.',
            'Les comparto un código para “confirmar”.',
          ],
          correcta: 1,
          explicacion: 'La verificación por otro canal es la clave.',
          peso: 1.0,
        }),
        mk(5, {
          tipo: 'abierta',
          titulo: 'Tu Mensaje Seguro',
          prompt:
            'Escribe una respuesta corta que frene la urgencia y exija verificación (sin discutir).',
          pistas: ['“Te llamo al número de siempre”', 'no transferir', 'pausar'],
          peso: 1.1,
        }),
        mk(6, {
          tipo: 'checklist',
          titulo: 'Checklist WhatsApp',
          intro: 'Si hay urgencia o dinero:',
          items: [
            'Pausa 30 segundos.',
            'Verifica por llamada/otro canal.',
            'No abras links sin validar.',
            'Nunca compartas códigos o NIP.',
          ],
          peso: 1.0,
        }),
      ],
    };
  }

  if (cat === 'llamadas') {
    const flow =
      modNivel === 'basico'
        ? {
            intro: 'Simula una llamada. Elige cómo actuar en cada paso.',
            pasos: [
              {
                texto: 'Te llaman diciendo: “Soy del banco, detectamos un cargo. Necesito tu código SMS para cancelarlo”.',
                opciones: [
                  { texto: 'Dar el código para cancelar', puntaje: 0.1, feedback: 'Riesgoso: el código es la llave de acceso.' },
                  { texto: 'Colgar y llamar tú al número oficial', puntaje: 1, feedback: 'Correcto: verificas por canal oficial.' },
                  { texto: 'Pedir que te lo repitan', puntaje: 0.3, feedback: 'No resuelve: siguen controlando la llamada.' },
                ],
              },
              {
                texto: 'Insisten: “Si cuelgas, perderás tu dinero”.',
                opciones: [
                  { texto: 'Seguir en la llamada', puntaje: 0.2, feedback: 'Riesgoso: la presión es señal de estafa.' },
                  { texto: 'Mantenerte firme y verificar por tu app', puntaje: 1, feedback: 'Bien: no te dejas presionar.' },
                ],
              },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              intro: 'La llamada es más ambigua: decide con calma.',
              pasos: [
                {
                  texto: 'Te llaman: “Hay un problema con tu cuenta. ¿Me confirmas tu nombre completo y los 16 dígitos?”',
                  opciones: [
                    { texto: 'Confirmar para “resolver rápido”', puntaje: 0.2, feedback: 'Riesgoso: no des datos sensibles.' },
                    { texto: 'Colgar y revisar en app / número oficial', puntaje: 1, feedback: 'Bien: verificas sin dar datos.' },
                    { texto: 'Pedir un folio y colgar', puntaje: 0.8, feedback: 'Mejor: pide folio y verifica por canal oficial.' },
                  ],
                },
                {
                  texto: 'Te ofrecen “pasarte” a otro departamento sin colgar.',
                  opciones: [
                    { texto: 'Aceptar y seguir', puntaje: 0.4, feedback: 'Puede ser parte del engaño. Mejor corta tú.' },
                    { texto: 'Cortar y llamar tú al oficial', puntaje: 1, feedback: 'Correcto: tú inicias el contacto.' },
                  ],
                },
              ],
            }
          : {
              intro: 'Escenario avanzado: suena profesional pero busca controlarte.',
              pasos: [
                {
                  texto: 'Te llaman: “Detectamos fraude. Para protegerte, necesitamos que instales una app y sigas pasos”.',
                  opciones: [
                    { texto: 'Instalar la app para “asegurar”', puntaje: 0.1, feedback: 'Muy riesgoso: podría ser control remoto.' },
                    { texto: 'Cortar y contactar al banco por tu app', puntaje: 1, feedback: 'Correcto: verificación oficial.' },
                    { texto: 'Pedir que te manden un correo', puntaje: 0.5, feedback: 'Mejor verifica tú: no sigas instrucciones.' },
                  ],
                },
                {
                  texto: 'Dicen: “No cuelgues o se pierde la protección”.',
                  opciones: [
                    { texto: 'Ignorar presión y verificar por tu cuenta', puntaje: 1, feedback: 'Bien: la urgencia es la trampa.' },
                    { texto: 'Seguir porque suena serio', puntaje: 0.3, feedback: 'Riesgoso: la seriedad puede ser actuada.' },
                  ],
                },
              ],
            };

    return {
      id: modId,
      titulo: 'Llamadas Fraudulentas',
      descripcion: `Entrenamiento ${levelHint} para protegerte en llamadas ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: [
        mk(1, {
          tipo: 'concepto',
          titulo: 'Qué Nunca se Comparte',
          contenido:
            'Por llamada no se comparten NIP, contraseñas ni códigos SMS. Si hay presión o urgencia, cuelga. ' +
            'La regla es: tú llamas al número oficial (app, tarjeta o sitio que escribes tú).',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'scenario_flow',
          titulo: 'Simulación de Llamada',
          ...flow,
          peso: 1.5,
        }),
        mk(3, {
          tipo: 'signal_hunt',
          titulo: 'Señales Durante la Llamada',
          mensaje: '“No cuelgues, dame el código y lo resolvemos hoy mismo. Si no, se bloquea tu cuenta”.',
          senales: [
            { id: 's1', label: 'Presión por no colgar', correcta: true, explicacion: 'Buscan controlar la conversación.' },
            { id: 's2', label: 'Pide código', correcta: true, explicacion: 'El código abre acceso a tu cuenta.' },
            { id: 's3', label: 'Amenaza de bloqueo', correcta: true, explicacion: 'Miedo para apresurarte.' },
            { id: 's4', label: 'Tono serio', correcta: false, explicacion: 'No garantiza legitimidad.' },
          ],
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'abierta',
          titulo: 'Tu Guión para Colgar',
          prompt: 'Escribe una frase corta para colgar con seguridad y decir que verificarás por el canal oficial.',
          pistas: ['“Voy a llamar al número oficial”', 'no dar datos', 'cortar la llamada'],
          peso: 1.1,
        }),
        mk(5, {
          tipo: 'checklist',
          titulo: 'Checklist de Llamadas',
          intro: 'Si te llaman “del banco/empresa”:',
          items: [
            'No confirmo códigos, NIP ni contraseñas.',
            'Cuelgo si hay urgencia o presión.',
            'Verifico en mi app o llamo yo al oficial.',
            'No instalo apps por instrucciones de una llamada.',
          ],
          peso: 1.0,
        }),
      ],
    };
  }

  // habitos (default)
  const habitFlow =
    modNivel === 'basico'
      ? {
          intro: 'Elige tu rutina en escenarios reales (sin complicarlo).',
          pasos: [
            {
              texto: 'Te llega un mensaje inesperado con “último aviso” y te pide acción rápida.',
              opciones: [
                { texto: 'Actuar rápido para “evitar problemas”', puntaje: 0.2, feedback: 'Riesgoso: la prisa es el gancho.' },
                { texto: 'Pausar, respirar y verificar por canal oficial', puntaje: 1, feedback: 'Bien: reduces errores.' },
              ],
            },
            {
              texto: 'No estás seguro si es real. ¿Qué haces?',
              opciones: [
                { texto: 'Pedir datos por el mismo chat', puntaje: 0.4, feedback: 'Mejor usa otro canal; el chat puede ser falso.' },
                { texto: 'Buscar el canal oficial (app/web que escribes tú)', puntaje: 1, feedback: 'Correcto: tú controlas el canal.' },
                { texto: 'Compartir el mensaje y preguntar', puntaje: 0.6, feedback: 'Puede ayudar, pero no es verificación oficial.' },
              ],
            },
          ],
        }
      : modNivel === 'refuerzo'
        ? {
            intro: 'Ahora es más ambiguo: hay señales mezcladas.',
            pasos: [
              {
                texto: 'Te escribe alguien conocido y manda un link “para confirmar” algo que no esperabas.',
                opciones: [
                  { texto: 'Abrir el link por confianza', puntaje: 0.3, feedback: 'Regular: “conocido” no garantiza; pudo ser hackeo.' },
                  { texto: 'Pedir verificación por otro canal (llamada)', puntaje: 1, feedback: 'Bien: verificas identidad antes de abrir.' },
                  { texto: 'Reenviar el link a otros', puntaje: 0.4, feedback: 'Riesgoso: amplificas el fraude.' },
                ],
              },
              {
                texto: 'La “oferta” se ve buena pero no absurda. ¿Cómo decides?',
                opciones: [
                  { texto: 'Comprar si el sitio “se ve bonito”', puntaje: 0.4, feedback: 'Regular: el diseño no prueba que sea real.' },
                  { texto: 'Verificar dominio/contacto/pago con calma', puntaje: 1, feedback: 'Correcto: verificas por pasos.' },
                ],
              },
            ],
          }
        : {
            intro: 'Escenario avanzado: el mensaje suena profesional, pero puede ser fraude.',
            pasos: [
              {
                texto: 'Te llega un aviso “muy formal” y te pide que confirmes datos para “proteger” tu cuenta.',
                opciones: [
                  { texto: 'Responder con mis datos “para cerrar el tema”', puntaje: 0.2, feedback: 'Riesgoso: datos por mensaje = phishing.' },
                  { texto: 'Ignorar el mensaje y verificar en app/canal oficial', puntaje: 1, feedback: 'Bien: tú controlas el canal.' },
                  { texto: 'Pedir que te lo manden por otro medio', puntaje: 0.6, feedback: 'Mejor verifica tú: no sigas su flujo.' },
                ],
              },
              {
                texto: 'Te meten urgencia con consecuencias (“se cancela”, “se bloquea”). ¿Qué haces?',
                opciones: [
                  { texto: 'Acelerar y hacer lo que piden', puntaje: 0.2, feedback: 'Riesgoso: la urgencia es la trampa.' },
                  { texto: 'Pausar y validar 2 señales clave antes de actuar', puntaje: 1, feedback: 'Correcto: verificas antes de mover dinero/datos.' },
                ],
              },
            ],
          };

  return {
    id: modId,
    titulo: 'Hábitos de Verificación',
    descripcion: `Construye una rutina ${levelHint} para evitar fraudes ${toneNote}.`,
    categoria: 'habitos',
    nivel: modNivel,
    actividades: [
      mk(1, {
        tipo: 'concepto',
        titulo: 'Tu Pausa de 10 Segundos',
        contenido:
          'La mayoría de estafas funcionan por prisa. Antes de actuar: pausa, revisa señales y verifica por un canal oficial. ' +
          'No necesitas ser experto: necesitas una rutina simple.',
        peso: 0.9,
      }),
      mk(2, {
        tipo: 'scenario_flow',
        titulo: 'Rutina en Acción',
        ...habitFlow,
        peso: 1.3,
      }),
      mk(3, {
        tipo: 'quiz',
        titulo: 'Prioridad Correcta',
        escenario: '¿Qué va primero cuando algo te mete urgencia?',
        opciones: ['Actuar', 'Pausar y verificar', 'Compartir datos', 'Pagar para “resolver”'],
        correcta: 1,
        explicacion: 'Primero pausa y verifica por un canal oficial.',
        peso: 1.0,
      }),
      mk(4, {
        tipo: 'abierta',
        titulo: 'Tu Regla Personal',
        prompt: 'Escribe tu regla personal (1 frase) para no caer por prisa.',
        pistas: ['pausa', 'verifico', 'canal oficial'],
        peso: 1.0,
      }),
      mk(5, {
        tipo: 'checklist',
        titulo: 'Checklist de Rutina',
        intro: 'Antes de actuar:',
        items: [
          '¿Lo esperaba?',
          '¿Hay urgencia/miedo?',
          '¿Pide datos/dinero?',
          'Verifico por canal oficial.',
        ],
        peso: 1.0,
      }),
    ],
  };
};

const buildFallbackCoursePlan = ({ answers, assessment, prefs }) => {
  const priority = String(answers?.priority || '').toLowerCase();
  const topics = Array.isArray(prefs?.temas) ? prefs.temas : [];
  const wantAll = priority === 'todo' || topics.includes('todo');
  const signals = detectSignals(answers);

  const categories = chooseCourseCategories({ answers, assessment, prefs });
  const levels = computeModuleLevels(categories, { answers, assessment, prefs });
  const ruta = categories.map((cat, idx) =>
    buildModuleTemplate({ categoria: cat, index: idx, answers, assessment, nivel: levels[idx] })
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
  const rawComp =
    plan?.competencias && typeof plan.competencias === 'object' ? plan.competencias : {};
  const keys = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];
  keys.forEach((key) => {
    const raw = Number(rawComp[key]);
    safe.competencias[key] = Number.isFinite(raw) ? clampNumber(raw, 0, 100) : fallback.competencias[key];
  });
  if (!Number.isFinite(Number(plan?.score_total))) {
    safe.score_total = Math.round(keys.reduce((acc, k) => acc + safe.competencias[k], 0) / keys.length);
  }

  const allowedTypes = new Set([
    'concepto',
    'quiz',
    'simulacion',
    'abierta',
    'sim_chat',
    'checklist',
    'compare_domains',
    'signal_hunt',
    'inbox',
    'web_lab',
    'scenario_flow',
  ]);

  const typeRank = (t) => {
    const order = {
      concepto: 0,
      web_lab: 1,
      inbox: 1,
      scenario_flow: 1,
      signal_hunt: 2,
      compare_domains: 2,
      quiz: 3,
      simulacion: 3,
      sim_chat: 4,
      abierta: 5,
      checklist: 6,
    };
    return Number.isFinite(Number(order[t])) ? order[t] : 9;
  };

  const sanitizeActivity = (act, { baseId, aIdx }) => {
    if (!act || typeof act !== 'object') return null;
    const tipoRaw = String(act.tipo || act.type || '').toLowerCase().trim();
    const tipo = allowedTypes.has(tipoRaw) ? tipoRaw : 'concepto';
    const id = toText(act.id) || `${baseId}_a${aIdx + 1}`;
    const titulo = toText(act.titulo) || `Actividad ${aIdx + 1}`;
    const peso = clampNumber(act.peso ?? act.puntos ?? 1, 0.5, 3);

    const base = { id, tipo, titulo, peso };

    if (tipo === 'concepto') {
      return { ...base, contenido: toText(act.contenido || act.texto || act.descripcion).slice(0, 900) };
    }

    if (tipo === 'checklist') {
      const items = asStringArray(act.items || act.lista).slice(0, 9);
      return { ...base, intro: toText(act.intro).slice(0, 220), items };
    }

    if (tipo === 'abierta') {
      const pistas = asStringArray(act.pistas).slice(0, 3);
      return { ...base, prompt: toText(act.prompt || act.pregunta).slice(0, 260), pistas };
    }

    if (tipo === 'sim_chat') {
      return {
        ...base,
        escenario: toText(act.escenario).slice(0, 400),
        inicio: toText(act.inicio).slice(0, 220),
        turnos_max: clampNumber(act.turnos_max, 3, 10),
      };
    }

    if (tipo === 'quiz' || tipo === 'simulacion') {
      const opciones = asStringArray(act.opciones).slice(0, 5);
      const correcta = clampNumber(act.correcta, 0, Math.max(0, opciones.length - 1));
      return {
        ...base,
        escenario: toText(act.escenario).slice(0, 520),
        opciones,
        correcta,
        explicacion: toText(act.explicacion).slice(0, 380),
      };
    }

    if (tipo === 'compare_domains') {
      const dominios = asStringArray(act.dominios || act.opciones).slice(0, 4);
      const correcta = clampNumber(act.correcta, 0, Math.max(0, dominios.length - 1));
      return {
        ...base,
        prompt: toText(act.prompt || act.pregunta).slice(0, 220),
        dominios,
        correcta,
        explicacion: toText(act.explicacion).slice(0, 380),
        tip: toText(act.tip || act.consejo).slice(0, 220),
      };
    }

    if (tipo === 'signal_hunt') {
      const mensaje = toText(act.mensaje || act.texto || act.escenario).slice(0, 600);
      const raw = Array.isArray(act.senales) ? act.senales : Array.isArray(act.opciones) ? act.opciones : [];
      const senales = raw
        .map((s, idx) => {
          if (!s || typeof s !== 'object') return null;
          const id = toText(s.id) || `s${idx + 1}`;
          const label = toText(s.label || s.texto || s.senal).slice(0, 120);
          if (!label) return null;
          const correcta = Boolean(s.correcta ?? s.es_correcta ?? s.correcto);
          const explicacion = toText(s.explicacion || s.razon).slice(0, 220);
          return { id, label, correcta, explicacion };
        })
        .filter(Boolean)
        .slice(0, 10);
      if (senales.length < 4) return null;
      return { ...base, mensaje, senales };
    }

    if (tipo === 'inbox') {
      const kindRaw = String(act.kind || act.canal || '').toLowerCase();
      const kind = kindRaw.includes('sms') ? 'sms' : 'correo';
      const intro = toText(act.intro).slice(0, 220);
      const raw = Array.isArray(act.mensajes) ? act.mensajes : Array.isArray(act.items) ? act.items : [];
      const mensajes = raw
        .map((m, idx) => {
          if (!m || typeof m !== 'object') return null;
          const id = toText(m.id) || `m${idx + 1}`;
          const from = toText(m.from || m.de || m.remitente).slice(0, 120);
          const subject = toText(m.subject || m.asunto).slice(0, 160);
          const text = toText(m.text || m.mensaje || m.cuerpo).slice(0, 320);
          const cls = String(m.correcto || m.clasificacion || m.tipo || '').toLowerCase();
          const correcto = cls.includes('estafa') || cls.includes('fraud') || cls.includes('phish') ? 'estafa' : 'seguro';
          const explicacion = toText(m.explicacion || m.razon).slice(0, 220);
          if (!text) return null;
          return { id, from, subject, text, correcto, explicacion };
        })
        .filter(Boolean)
        .slice(0, 8);
      if (mensajes.length < 3) return null;
      return { ...base, kind, intro, mensajes };
    }

    if (tipo === 'web_lab') {
      const intro = toText(act.intro).slice(0, 220);
      const p = act.pagina && typeof act.pagina === 'object' ? act.pagina : {};
      const pagina = {
        marca: toText(p.marca || p.brand).slice(0, 50) || 'NovaTienda',
        dominio: toText(p.dominio || p.url).slice(0, 80) || 'novatienda-mx.shop',
        banner: toText(p.banner || p.hero).slice(0, 90),
        sub: toText(p.sub || p.subtitulo || p.copy).slice(0, 120),
        contacto: toText(p.contacto || p.contact).slice(0, 160),
        pagos: asStringArray(p.pagos).slice(0, 5),
        productos: Array.isArray(p.productos)
          ? p.productos
              .map((x) => ({
                nombre: toText(x?.nombre || x?.name).slice(0, 70),
                antes: toText(x?.antes || x?.old_price).slice(0, 30),
                precio: toText(x?.precio || x?.price).slice(0, 30),
              }))
              .filter((x) => x.nombre)
              .slice(0, 6)
          : [],
      };
      const raw = Array.isArray(act.hotspots) ? act.hotspots : [];
      const hotspots = raw
        .map((h, idx) => {
          if (!h || typeof h !== 'object') return null;
          const id = toText(h.id) || `h${idx + 1}`;
          const target = String(h.target || h.objetivo || '').toLowerCase().trim();
          const allowedTargets = ['domain', 'banner', 'contacto', 'pago'];
          const safeTarget = allowedTargets.includes(target) ? target : '';
          const label = toText(h.label || h.titulo || h.senal).slice(0, 120);
          const correcta = Boolean(h.correcta ?? h.es_correcta ?? h.correcto);
          const explicacion = toText(h.explicacion || h.razon).slice(0, 220);
          if (!safeTarget || !label) return null;
          return { id, target: safeTarget, label, correcta, explicacion };
        })
        .filter(Boolean)
        .slice(0, 8);
      if (!pagina.dominio || hotspots.length < 2) return null;
      return { ...base, intro, pagina, hotspots };
    }

    if (tipo === 'scenario_flow') {
      const intro = toText(act.intro).slice(0, 220);
      const raw = Array.isArray(act.pasos) ? act.pasos : Array.isArray(act.steps) ? act.steps : [];
      const pasos = raw
        .map((st, idx) => {
          if (!st || typeof st !== 'object') return null;
          const texto = toText(st.texto || st.text).slice(0, 360);
          const rawOpts = Array.isArray(st.opciones) ? st.opciones : Array.isArray(st.options) ? st.options : [];
          const opciones = rawOpts
            .map((opt, oIdx) => {
              if (!opt || typeof opt !== 'object') return null;
              const texto = toText(opt.texto || opt.label || opt.text).slice(0, 220);
              if (!texto) return null;
              const puntaje = clampNumber(opt.puntaje ?? opt.score ?? 0.6, 0, 1);
              const feedback = toText(opt.feedback || opt.retro).slice(0, 260);
              const siguienteRaw = opt.siguiente ?? opt.next;
              const siguiente =
                Number.isFinite(Number(siguienteRaw)) ? clampNumber(siguienteRaw, 0, 50) : null;
              return { id: toText(opt.id) || `o${oIdx + 1}`, texto, puntaje, feedback, siguiente };
            })
            .filter(Boolean)
            .slice(0, 5);
          if (!texto || opciones.length < 2) return null;
          return { id: toText(st.id) || `p${idx + 1}`, texto, opciones };
        })
        .filter(Boolean)
        .slice(0, 8);
      if (pasos.length < 2) return null;
      return { ...base, intro, pasos };
    }

    return null;
  };

  const sanitizeModule = (mod, idx) => {
    if (!mod || typeof mod !== 'object') return null;
    const categoria = normalizeCourseCategory(mod.categoria || mod.category);
    const id = toText(mod.id) || `mod_${categoria}_${idx + 1}`;
    const titulo = toText(mod.titulo) || `Módulo ${idx + 1}`;
    const descripcion = toText(mod.descripcion) || '';
    const nivel = normalizeModuleLevel(mod.nivel || mod.level || mod.dificultad);
    const actsRaw = Array.isArray(mod.actividades) ? mod.actividades : [];
    const actividades = actsRaw
      .map((act, aIdx) => sanitizeActivity(act, { baseId: id, aIdx }))
      .filter(Boolean)
      .sort((a, b) => typeRank(a.tipo) - typeRank(b.tipo));

    if (actividades.length < 5) return null;
    return { id, titulo, descripcion, categoria, nivel, actividades };
  };

  const pool = (Array.isArray(plan?.ruta) ? plan.ruta : [])
    .map((m, idx) => sanitizeModule(m, idx))
    .filter(Boolean);

  const expectedCats = chooseCourseCategories({ answers, assessment, prefs });
  const expectedLevels = computeModuleLevels(expectedCats, { answers, assessment, prefs });

  const moduleMeetsRequirements = (module) => {
    const acts = Array.isArray(module?.actividades) ? module.actividades : [];
    const types = new Set(acts.map((a) => a.tipo));
    if (acts.length < 5) return false;
    const cat = normalizeCourseCategory(module?.categoria);
    if (cat === 'web') return types.has('web_lab') && types.has('compare_domains');
    if (cat === 'sms') return types.has('inbox') && types.has('signal_hunt') && acts.find((a) => a.tipo === 'inbox')?.kind === 'sms';
    if (cat === 'correo_redes') return types.has('inbox') && types.has('signal_hunt') && acts.find((a) => a.tipo === 'inbox')?.kind === 'correo';
    if (cat === 'whatsapp') return types.has('sim_chat') && types.has('signal_hunt');
    if (cat === 'llamadas') return types.has('scenario_flow') && types.has('abierta');
    return types.has('scenario_flow') && types.has('checklist');
  };

  const used = new Set();
  const finalRoute = Array.isArray(expectedCats) && expectedCats.length === COURSE_MODULE_COUNT
    ? expectedCats.map((cat, idx) => {
        const normalized = normalizeCourseCategory(cat);
        const found = pool.findIndex((m, mIdx) => !used.has(mIdx) && m.categoria === normalized);
        const nivel = expectedLevels[idx] || 'basico';
        let mod =
          found !== -1
            ? { ...pool[found], categoria: normalized, nivel }
            : buildModuleTemplate({ categoria: normalized, index: idx, answers, assessment, nivel });
        if (found !== -1) used.add(found);

        if (!moduleMeetsRequirements(mod)) {
          mod = buildModuleTemplate({ categoria: normalized, index: idx, answers, assessment, nivel });
        }
        return mod;
      })
    : fallback.ruta;

  // Avoid duplicate module titles by adding a level suffix when needed.
  const titleCounts = {};
  safe.ruta = finalRoute.map((mod, idx) => {
    const baseTitle = String(mod?.titulo || `Módulo ${idx + 1}`).trim();
    const key = baseTitle.toLowerCase();
    titleCounts[key] = (titleCounts[key] || 0) + 1;
    const levelLabel =
      normalizeModuleLevel(mod?.nivel) === 'avanzado'
        ? 'Avanzado'
        : normalizeModuleLevel(mod?.nivel) === 'refuerzo'
          ? 'Refuerzo'
          : 'Básico';
    if (titleCounts[key] === 1) return { ...mod, titulo: baseTitle };
    return { ...mod, titulo: `${baseTitle} — ${levelLabel}` };
  });

  return safe;
};

const COURSE_TOPICS = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];

const average = (values) => {
  const safe = values.filter((value) => Number.isFinite(value));
  if (!safe.length) return 0;
  return safe.reduce((acc, value) => acc + value, 0) / safe.length;
};

const bucketDecision = (score) => {
  if (score >= 0.85) return 'acierto';
  if (score >= 0.6) return 'regular';
  return 'riesgo';
};

const getUserState = (user) => {
  const state = user?.state && typeof user.state === 'object' ? user.state : createEmptyUserState();
  return sanitizeClientStatePayload(state);
};

const computePlanSnapshot = (state) => {
  const plan = state?.coursePlan && typeof state.coursePlan === 'object' ? state.coursePlan : null;
  const progress = state?.courseProgress && typeof state.courseProgress === 'object' ? state.courseProgress : null;
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  const completedMap = progress?.completed && typeof progress.completed === 'object' ? progress.completed : {};
  const moduleMap = progress?.modules && typeof progress.modules === 'object' ? progress.modules : {};
  const totalsByTopic = {};
  const totalsByModule = [];
  const decisionMix = { acierto: 0, regular: 0, riesgo: 0 };
  const activityRows = [];

  COURSE_TOPICS.forEach((topic) => {
    totalsByTopic[topic] = {
      scoreSum: 0,
      scoreCount: 0,
      risky: 0,
      regular: 0,
      correct: 0,
      timeSum: 0,
      timeCount: 0,
    };
  });

  route.forEach((module, index) => {
    const category = normalizeCourseCategory(module?.categoria);
    const level = normalizeModuleLevel(module?.nivel);
    const activities = Array.isArray(module?.actividades) ? module.actividades : [];
    const completedActivities = activities
      .map((activity) => ({ activity, entry: completedMap[activity.id] || null }))
      .filter(({ entry }) => Boolean(entry));

    const started = Boolean(moduleMap?.[module.id]?.startedAt) || completedActivities.length > 0;
    const moduleScores = completedActivities.map(({ entry }) => clampNumber(entry?.score ?? 0, 0, 1));
    const moduleTimes = completedActivities
      .map(({ entry }) => Number(entry?.durationMs))
      .filter((value) => Number.isFinite(value) && value > 0);

    completedActivities.forEach(({ activity, entry }) => {
      const score = clampNumber(entry?.score ?? 0, 0, 1);
      const topic = totalsByTopic[category] || totalsByTopic.habitos;
      const bucket = bucketDecision(score);
      topic.scoreSum += score;
      topic.scoreCount += 1;
      topic.timeSum += Number(entry?.durationMs) || 0;
      topic.timeCount += Number(entry?.durationMs) ? 1 : 0;
      topic.correct += bucket === 'acierto' ? 1 : 0;
      topic.regular += bucket === 'regular' ? 1 : 0;
      topic.risky += bucket === 'riesgo' ? 1 : 0;
      decisionMix[bucket] += 1;

      activityRows.push({
        moduleId: module.id,
        moduleTitle: module.titulo || `Módulo ${index + 1}`,
        category,
        level,
        activityId: activity.id,
        activityType: activity.tipo,
        score,
        durationMs: Number(entry?.durationMs) || 0,
        attempts: Number(entry?.attempts) || 1,
        completedAt: entry?.at || null,
        decision: entry?.details || null,
      });
    });

    const totalActivities = activities.length || 1;
    const completionRate = completedActivities.length / totalActivities;
    const avgScore = average(moduleScores);
    const completedModule =
      Boolean(moduleMap?.[module.id]?.completedAt) || (activities.length > 0 && completedActivities.length === activities.length);

    totalsByModule.push({
      id: module.id || `module-${index + 1}`,
      title: module.titulo || `Módulo ${index + 1}`,
      category,
      level,
      started,
      completed: completedModule,
      completionRate,
      avgScore,
      avgTimeMs: average(moduleTimes),
      durationMs: Number(moduleMap?.[module.id]?.durationMs) || average(moduleTimes) * completedActivities.length || 0,
    });
  });

  const completedActivitiesCount = activityRows.length;
  const totalActivities = route.reduce(
    (acc, module) => acc + (Array.isArray(module?.actividades) ? module.actividades.length : 0),
    0
  );

  const snapshots = Array.isArray(progress?.snapshots) ? progress.snapshots : [];
  const baseline =
    Number.isFinite(Number(snapshots[0]?.scoreTotal))
      ? Number(snapshots[0].scoreTotal)
      : average(
          COURSE_TOPICS.map((topic) => Number(plan?.competencias?.[topic])).filter((value) =>
            Number.isFinite(value)
          )
        );
  const currentTotal =
    Number.isFinite(Number(snapshots.at(-1)?.scoreTotal))
      ? Number(snapshots.at(-1).scoreTotal)
      : average(
          COURSE_TOPICS.map((topic) => {
            const stat = totalsByTopic[topic];
            if (!stat?.scoreCount) return Number(plan?.competencias?.[topic]) || 0;
            const baseTopic = clampNumber(plan?.competencias?.[topic] ?? 0, 0, 100);
            return clampNumber(baseTopic + (100 - baseTopic) * (stat.scoreSum / stat.scoreCount), 0, 100);
          })
        );

  return {
    totalActivities,
    completedActivities: completedActivitiesCount,
    modules: totalsByModule,
    topics: totalsByTopic,
    decisionMix,
    activityRows,
    snapshots,
    baseline,
    currentTotal,
    improvement: currentTotal - baseline,
  };
};

const summarizeUserForAnalytics = (user) => {
  const state = getUserState(user);
  const metrics = computePlanSnapshot(state);
  const age = state.answers?.age || 'Sin dato';
  const startedModules = metrics.modules.filter((module) => module.started).length;
  const completedModules = metrics.modules.filter((module) => module.completed).length;
  const avgModuleTimeMs = average(metrics.modules.map((module) => module.durationMs).filter(Boolean));
  const targetSnapshot = metrics.snapshots.find(
    (snapshot) => Number(snapshot?.scoreTotal) >= metrics.baseline + 5
  );
  const createdAtMs = Date.parse(user?.createdAt || '') || Date.now();
  const targetMs = Date.parse(targetSnapshot?.at || '') || null;
  const daysToImprove =
    targetMs && Number.isFinite(createdAtMs)
      ? Math.max(0, Math.round((targetMs - createdAtMs) / (1000 * 60 * 60 * 24)))
      : null;

  return {
    userId: user.id,
    email: user.email,
    role: user.role || 'user',
    createdAt: user.createdAt,
    lastAccessAt: user.lastAccessAt || user.createdAt,
    age,
    initialLevel: state.assessment?.nivel || 'Sin evaluar',
    progressPercent: metrics.totalActivities
      ? Math.round((metrics.completedActivities / metrics.totalActivities) * 100)
      : 0,
    baseline: Math.round(metrics.baseline || 0),
    currentTotal: Math.round(metrics.currentTotal || 0),
    improvement: Math.round(metrics.improvement || 0),
    daysToImprove,
    startedModules,
    completedModules,
    avgModuleTimeMs,
    metrics,
  };
};

const aggregateAnalytics = (store) => {
  const users = Object.values(store.users || {});
  const learners = users.map(summarizeUserForAnalytics);
  const ageMap = new Map();
  const topicMap = new Map();
  const moduleMap = new Map();
  const trendMap = new Map();
  const ageImprovement = new Map();
  const decisionTotals = { acierto: 0, regular: 0, riesgo: 0 };

  COURSE_TOPICS.forEach((topic) => {
    topicMap.set(topic, {
      topic,
      scoreSum: 0,
      scoreCount: 0,
      risky: 0,
      regular: 0,
      correct: 0,
    });
  });

  learners.forEach((learner) => {
    ageMap.set(learner.age, (ageMap.get(learner.age) || 0) + 1);

    const ageRow = ageImprovement.get(learner.age) || {
      age: learner.age,
      improvementSum: 0,
      count: 0,
    };
    ageRow.improvementSum += learner.improvement || 0;
    ageRow.count += 1;
    ageImprovement.set(learner.age, ageRow);

    Object.entries(learner.metrics?.topics || {}).forEach(([topic, stat]) => {
      const row = topicMap.get(topic);
      if (!row) return;
      row.scoreSum += stat.scoreSum;
      row.scoreCount += stat.scoreCount;
      row.risky += stat.risky;
      row.regular += stat.regular;
      row.correct += stat.correct;
    });

    (learner.metrics?.modules || []).forEach((module) => {
      const key = module.id || `${module.title}:${module.category}`;
      const row = moduleMap.get(key) || {
        title: module.title,
        category: module.category,
        level: module.level,
        completionRateSum: 0,
        avgScoreSum: 0,
        avgTimeMsSum: 0,
        count: 0,
      };
      row.completionRateSum += module.completionRate || 0;
      row.avgScoreSum += module.avgScore || 0;
      row.avgTimeMsSum += module.avgTimeMs || 0;
      row.count += 1;
      moduleMap.set(key, row);
    });

    Object.entries(learner.metrics?.decisionMix || {}).forEach(([bucket, value]) => {
      decisionTotals[bucket] = (decisionTotals[bucket] || 0) + (Number(value) || 0);
    });

    (learner.metrics?.snapshots || []).forEach((snapshot) => {
      const day = String(snapshot?.at || '').slice(0, 10);
      if (!day) return;
      const row = trendMap.get(day) || { day, totalSum: 0, count: 0 };
      row.totalSum += Number(snapshot?.scoreTotal) || 0;
      row.count += 1;
      trendMap.set(day, row);
    });
  });

  const totalActivities = learners.reduce((acc, learner) => acc + learner.metrics.totalActivities, 0);
  const completedActivities = learners.reduce((acc, learner) => acc + learner.metrics.completedActivities, 0);
  const startedModules = learners.reduce((acc, learner) => acc + learner.startedModules, 0);
  const completedModules = learners.reduce((acc, learner) => acc + learner.completedModules, 0);
  const averageShield = Math.round(average(learners.map((learner) => learner.currentTotal)));
  const averageImprovement = Math.round(average(learners.map((learner) => learner.improvement)));
  const daysToImproveAverage = average(
    learners.map((learner) => learner.daysToImprove).filter((value) => Number.isFinite(value))
  );
  const activeUsers7d = learners.filter((learner) => {
    const lastAccess = Date.parse(learner.lastAccessAt || '');
    return Number.isFinite(lastAccess) && Date.now() - lastAccess <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  return {
    generatedAt: nowIso(),
    overview: {
      totalUsers: learners.length,
      activeUsers7d,
      averageShield,
      averageImprovement,
      activityCompletionRate: totalActivities ? Math.round((completedActivities / totalActivities) * 100) : 0,
      moduleCompletionRate: startedModules ? Math.round((completedModules / startedModules) * 100) : 0,
      avgDaysToImprove: Number.isFinite(daysToImproveAverage) ? Math.round(daysToImproveAverage * 10) / 10 : null,
    },
    ageBuckets: Array.from(ageMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    topicPerformance: Array.from(topicMap.values()).map((row) => ({
      topic: row.topic,
      label:
        row.topic === 'correo_redes'
          ? 'Correo/Redes'
          : row.topic.charAt(0).toUpperCase() + row.topic.slice(1),
      avgScore: row.scoreCount ? Math.round((row.scoreSum / row.scoreCount) * 100) : 0,
      riskRate:
        row.correct + row.regular + row.risky
          ? Math.round((row.risky / (row.correct + row.regular + row.risky)) * 100)
          : 0,
      correct: row.correct,
      regular: row.regular,
      risky: row.risky,
    })),
    vulnerabilityByTopic: Array.from(topicMap.values())
      .map((row) => ({
        topic: row.topic,
        label:
          row.topic === 'correo_redes'
            ? 'Correo/Redes'
            : row.topic.charAt(0).toUpperCase() + row.topic.slice(1),
        vulnerableCount: row.risky,
      }))
      .sort((a, b) => b.vulnerableCount - a.vulnerableCount),
    modulePerformance: Array.from(moduleMap.values())
      .map((row) => ({
        title: row.title,
        category: row.category,
        level: row.level,
        avgScore: row.count ? Math.round((row.avgScoreSum / row.count) * 100) : 0,
        completionRate: row.count ? Math.round((row.completionRateSum / row.count) * 100) : 0,
        avgTimeMin: row.count ? Math.round((row.avgTimeMsSum / row.count / 60000) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.avgScore - b.avgScore),
    improvementByAge: Array.from(ageImprovement.values()).map((row) => ({
      age: row.age,
      avgImprovement: row.count ? Math.round(row.improvementSum / row.count) : 0,
    })),
    learningTrend: Array.from(trendMap.values())
      .map((row) => ({
        day: row.day,
        avgScore: row.count ? Math.round(row.totalSum / row.count) : 0,
      }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    decisionMix: [
      { label: 'Aciertos', value: decisionTotals.acierto || 0 },
      { label: 'Dudas', value: decisionTotals.regular || 0 },
      { label: 'Decisiones de riesgo', value: decisionTotals.riesgo || 0 },
    ],
    timeByModule: Array.from(moduleMap.values())
      .map((row) => ({
        title: row.title,
        avgTimeMin: row.count ? Math.round((row.avgTimeMsSum / row.count / 60000) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avgTimeMin - a.avgTimeMin),
    users: learners.map((learner) => ({
      email: learner.email,
      age: learner.age,
      initialLevel: learner.initialLevel,
      currentShield: learner.currentTotal,
      improvement: learner.improvement,
      progressPercent: learner.progressPercent,
      lastAccessAt: learner.lastAccessAt,
    })),
  };
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Correo inválido.', status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        status: 400,
      });
    }

    const store = await loadStore();
    cleanupExpiredSessions(store);
    if (findUserByEmail(store, email)) {
      return res.status(409).json({ error: 'Ese correo ya está registrado.', status: 409 });
    }

    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email,
      passwordHash: await createPasswordHash(password),
      role: pickRoleForEmail(store, email),
      createdAt: nowIso(),
      lastAccessAt: nowIso(),
      state: createEmptyUserState(),
    };

    store.users[userId] = user;
    const token = createSession(store, userId);
    await saveStore(store);

    return res.json({
      token,
      user: sanitizeUserForClient(user),
      state: getUserState(user),
    });
  } catch (error) {
    console.error('Error /api/auth/register:', error);
    return res.status(500).json({ error: 'No se pudo crear la cuenta.', status: 500 });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const store = await loadStore();
    cleanupExpiredSessions(store);
    const user = findUserByEmail(store, email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.', status: 401 });
    }

    user.lastAccessAt = nowIso();
    user.state = user.state && typeof user.state === 'object' ? user.state : createEmptyUserState();
    user.state.updatedAt = nowIso();
    const token = createSession(store, user.id);
    await saveStore(store);

    return res.json({
      token,
      user: sanitizeUserForClient(user),
      state: getUserState(user),
    });
  } catch (error) {
    console.error('Error /api/auth/login:', error);
    return res.status(500).json({ error: 'No se pudo iniciar sesión.', status: 500 });
  }
});

app.get('/api/auth/session', requireAuth, async (req, res) => {
  return res.json({
    user: sanitizeUserForClient(req.auth.user),
    state: getUserState(req.auth.user),
  });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const { store, token } = req.auth;
    delete store.sessions[token];
    await saveStore(store);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error /api/auth/logout:', error);
    return res.status(500).json({ error: 'No se pudo cerrar la sesión.', status: 500 });
  }
});

app.get('/api/user/state', requireAuth, async (req, res) => {
  return res.json({
    user: sanitizeUserForClient(req.auth.user),
    state: getUserState(req.auth.user),
  });
});

app.post('/api/user/state', requireAuth, async (req, res) => {
  try {
    const { store, user } = req.auth;
    user.state = sanitizeClientStatePayload({
      ...getUserState(user),
      ...req.body,
    });
    user.lastAccessAt = nowIso();
    await saveStore(store);
    return res.json({
      ok: true,
      user: sanitizeUserForClient(user),
      state: getUserState(user),
    });
  } catch (error) {
    console.error('Error /api/user/state:', error);
    return res.status(500).json({ error: 'No se pudo guardar el progreso.', status: 500 });
  }
});

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    const store = await loadStore();
    cleanupExpiredSessions(store);
    await saveStore(store);
    return res.json(aggregateAnalytics(store));
  } catch (error) {
    console.error('Error /api/admin/analytics:', error);
    return res.status(500).json({ error: 'No se pudieron generar las métricas.', status: 500 });
  }
});

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
    const levels = computeModuleLevels(categories, { answers, assessment, prefs });
    const input = buildCoursePrompt({ answers, assessment, prefs, progress, categories, levels });

    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input,
      temperature: 0.25,
      max_output_tokens: 2400,
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
