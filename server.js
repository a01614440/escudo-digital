import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import {
  buildUserState,
  createSession as createDbSession,
  createUser as createDbUser,
  deleteExpiredSessions,
  deleteSession as deleteDbSession,
  findUserByEmail,
  getAdminCount,
  getSessionWithUser,
  initDb,
  listUsers,
  saveSession,
  saveUser,
  syncUserState,
} from './db.js';

dotenv.config();

const app = express();
const APP_ROOT = fileURLToPath(new URL('.', import.meta.url));
const ROOT_INDEX_PATH = fileURLToPath(new URL('./index.html', import.meta.url));
const DIST_INDEX_PATH = fileURLToPath(new URL('./dist/index.html', import.meta.url));
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 45;
const MIN_PASSWORD_LENGTH = 6;
const scryptAsync = promisify(crypto.scrypt);

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

const htmlNoStoreHeader = 'no-store, no-cache, must-revalidate';

app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', htmlNoStoreHeader);
  return res.sendFile(ROOT_INDEX_PATH);
});

app.get(/^\/dist$/, (_req, res) => {
  res.setHeader('Cache-Control', htmlNoStoreHeader);
  return res.redirect(302, '/dist/');
});

app.get('/dist/', (_req, res) => {
  res.setHeader('Cache-Control', htmlNoStoreHeader);
  return res.sendFile(DIST_INDEX_PATH);
});

app.use(
  express.static(APP_ROOT, {
    setHeaders: (res, filePath) => {
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.endsWith('.html')) {
        res.setHeader('Cache-Control', htmlNoStoreHeader);
        return;
      }

      if (normalizedPath.includes(path.normalize(path.join('dist', 'assets')))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

const nowIso = () => new Date().toISOString();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const deepCopy = (value) => JSON.parse(JSON.stringify(value ?? null));

const pickRoleForEmail = async (email) => {
  const normalized = normalizeEmail(email);
  if (ADMIN_EMAILS.has(normalized)) return 'admin';
  if (!ADMIN_EMAILS.size && (await getAdminCount()) === 0) return 'admin';
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
  return sanitizeCoursePayload({
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
  });
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

const createSession = async (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await createDbSession({
    token,
    userId,
    createdAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
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
      return res.status(401).json({ error: 'SesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n no vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida.', status: 401 });
    }

    await deleteExpiredSessions();
    const auth = await getSessionWithUser(token);

    if (!auth) {
      return res.status(401).json({ error: 'SesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n expirada.', status: 401 });
    }

    const session = auth.session;
    const user = auth.user;

    session.lastSeenAt = nowIso();
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    user.lastAccessAt = nowIso();
    user.state = user.state && typeof user.state === 'object' ? user.state : createEmptyUserState();
    user.state.updatedAt = nowIso();
    const [savedSession, savedUser] = await Promise.all([saveSession(session), saveUser(user)]);

    req.auth = {
      token,
      session: savedSession || session,
      user: savedUser || user,
    };
    next();
  } catch (error) {
    console.error('Error de autenticaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n:', error);
    res.status(500).json({ error: 'No se pudo validar la sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.', status: 500 });
  }
};

const resolveOptionalAuth = async (req) => {
  const token = getBearerToken(req);
  if (!token) return null;
  await deleteExpiredSessions();
  const auth = await getSessionWithUser(token);
  if (!auth) return null;
  return sanitizeCoursePayload({
    token,
    session: auth.session,
    user: auth.user,
  });
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
        'Eres un analista de riesgos de estafas digitales en MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xico. ' +
        'Debes evaluar el nivel de riesgo con base en sus respuestas. ' +
        'Devuelve SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido (sin Markdown) con estas llaves: ' +
        'nivel, resumen, recomendaciones, proximos_pasos. ' +
        'Reglas: ' +
        '1) nivel debe ser EXACTAMENTE: "Bajo", "Medio" o "Alto". ' +
        '2) resumen: 2ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ3 frases, especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fico; menciona al menos 2 factores del usuario ' +
        '(canales, frecuencia, hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡bito de verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, estafa previa, prioridad). ' +
        '3) recomendaciones: array de 3 acciones concretas y personalizadas (10ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ14 palabras cada una). ' +
        'Evita recomendaciones genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ricas repetidas (ej. solo "2FA"). ' +
        '4) proximos_pasos: array de 4 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos de aprendizaje, no frases genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ricas. ' +
        'Cada mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo debe ser un objeto con: titulo (3ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ6 palabras, estilo tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulo) y descripcion (1 frase: quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© aprenderÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡/practicarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡). ' +
        'Al menos 1 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo debe atacar la estafa previa si existe. ' +
        'Al menos 2 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos deben seguir la prioridad del usuario. ' +
        'Si la prioridad es "todo", incluye obligatoriamente: 1 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo web, 1 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo WhatsApp/SMS y 1 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo de llamadas. ' +
        'Si nivel es "Alto", cubre varios canales, no solo uno. ' +
        'Prohibido usar estas frases: "Contenido personalizado", "Alertas sobre fraudes", "Ejercicios prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cticos". ' +
        'Si hay anÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cdota, ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsala para personalizar (sin pedir datos sensibles).',
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
        'Eres un asistente de prevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de estafas digitales que ayuda a personas comunes a navegar internet de forma segura. ' +
        'Tu objetivo es educar, guiar y dar consejos prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cticos sin sonar robÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³tico.\n\n' +
        'Reglas obligatorias:\n' +
        '1) Respuestas claras y concisas. Evita pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rrafos largos o explicaciones innecesarias.\n' +
        '2) Si el usuario pide recomendaciones o consejos: responde en 3 a 5 puntos cortos, con una breve frase introductoria si hace falta.\n' +
        '3) Cada punto debe ser directo y fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cil de leer.\n' +
        '4) No uses mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s de 80ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ120 palabras en total, salvo que el usuario pida mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s detalle.\n' +
        '5) No digas que puedes revisar sitios ni investigar enlaces; enseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© revisar por su cuenta.\n' +
        '6) VarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el tono: a veces directo, otras cercano, pero evita frases empÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticas forzadas.\n' +
        '7) Termina con una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al de alerta o recomendaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n preventiva.\n' +
        '8) Nunca respondas solo con viÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±etas.\n' +
        '9) Limita el alcance a estafas digitales, fraudes en lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea y seguridad digital. ' +
        'Si la pregunta NO estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ relacionada, responde breve y amablemente que solo puedes ayudar con seguridad digital y prevenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de estafas, e invita a preguntar sobre eso.\n' +
        'Si el usuario menciona un fraude en curso, sugiere medidas inmediatas y canales oficiales sin inventar nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmeros.',
    },
    {
      role: 'user',
      content: 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo puedo saber si una tienda en lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea es confiable antes de comprar?',
    },
    {
      role: 'assistant',
      content:
        'Buena idea revisarlo antes de pagar, sobre todo si es una tienda nueva. Unos minutos de verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n te pueden ahorrar un problema.\n\n' +
        'Puedes fijarte en cosas concretas como:\n' +
        'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Que el dominio sea exactamente el de la tienda y tenga https.\n' +
        'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Buscar el nombre del sitio con palabras como ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“opinionesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â o ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“fraudeÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.\n' +
        'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Ver polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas claras de envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o/devoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y un contacto real.\n' +
        'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Pagar con mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todos que tengan protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al comprador.\n\n' +
        'Si algo se ve raro (precios muy bajos, urgencia, poca info), mejor no comprar ahÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­.',
    },
    ...messages,
  ];
};

const buildCoursePrompt = ({ answers, assessment, prefs, progress, categories, levels }) => {
  return [
    {
      role: 'system',
      content: `Eres un diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ador instruccional y analista de estafas digitales en MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xico.
Vas a crear un programa de aprendizaje PERSONALIZADO tipo app (retos, prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctica y simulaciones).
Usa su edad, experiencia previa, canales de exposiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡bitos y prioridad de aprendizaje.
No pidas datos sensibles. No inventes nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmeros telefÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nicos. No inventes enlaces reales.
No digas que revisas enlaces o sitios; enseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© revisar por su cuenta.

Devuelve SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido con estas llaves exactas:
- score_name (string creativo)
- score_total (entero 0-100)
- competencias (objeto con 0-100 por tema)
- ruta (array de 7 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos)

Reglas globales:
1) competencias debe incluir (siempre): web, whatsapp, sms, llamadas, correo_redes, habitos.
2) ruta debe tener EXACTAMENTE 7 mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos. Cada mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo: id, titulo, descripcion, categoria, nivel, actividades.
3) categoria debe ser una de: web, whatsapp, sms, llamadas, correo_redes, habitos.
4) nivel debe ser EXACTAMENTE: "basico", "refuerzo" o "avanzado".
5) actividades: entre 6 y 10 por mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo (varÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a el formato; no todos iguales).
6) Tipos permitidos de actividad:
   - concepto, quiz, simulacion, abierta, sim_chat, checklist,
   - compare_domains, signal_hunt, inbox, web_lab, scenario_flow, call_sim.
7) Cada actividad debe tener: id, scenarioId, tipo, titulo, peso (0.5 a 3).
8) scenarioId debe ser estable, descriptivo y ÃƒÆ’Ã†â€™Ãƒâ€¦Ã‚Â¡NICO dentro del mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo y dentro de mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulos repetidos de la misma categorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.

Campos por tipo:
- concepto: contenido (max 120 palabras) y opcional bloques (3-5 objetos con: titulo, texto)
- checklist: intro (1 frase), items (4-9)
- quiz/simulacion: escenario (max 140 palabras), opciones (3-5), correcta (index), explicacion (max 55 palabras)
- abierta: prompt (1-2 frases) y opcional pistas (0-3)
- sim_chat: escenario (max 90 palabras), inicio (1 mensaje del estafador), turnos_max (5-8), contactName, avatarLabel, contactStatus, quickReplies (0-4)
- compare_domains: prompt (1 frase), dominios (2-4), correcta (index), explicacion (max 55 palabras), tip (opcional)
- signal_hunt: mensaje (max 160 palabras), senales (4-8 objetos con: id, label, correcta, explicacion corta)
- inbox: kind ("sms" o "correo"), intro (1 frase), mensajes (4-7 objetos con: id, displayName opcional, from, subject opcional, preview opcional, dateLabel opcional, warning opcional, text, body opcional[], attachments opcional[], details opcional {from, replyTo, returnPath}, ctaLabel opcional, linkPreview opcional, correcto ("seguro"|"estafa"), explicacion corta)
- web_lab: intro (1 frase), pagina (marca, dominio, browserTitle opcional, banner, sub, contacto, pagos[], productos[], shipping opcional, reviews opcional, policy opcional, cartNote opcional, checkoutPrompt opcional, themeVariant opcional, layoutVariant opcional, guideMode opcional, brandMark opcional, headerTagline opcional, heroTitle opcional, heroBody opcional, sealLabel opcional, cartHeadline opcional, checkoutHeadline opcional, reviewsLabel opcional, liveToasts opcional[]), hotspots (target debe ser: "domain","banner","contacto","pago","shipping","reviews","policy","search","cart_icon","order_summary","address_form"; 2-6 correctas), decisionPrompt opcional, decisionOptions opcional[], correctDecision opcional
- scenario_flow: intro (1 frase), pasos (2-5; cada paso: texto y 2-4 opciones con: texto, puntaje 0-1, feedback corto, siguiente opcional)
- call_sim: intro (1 frase), callerName, callerNumber, opening, allowVoice (boolean), voiceProfile opcional ("male"|"female"), steps (2-4; cada step: texto y 2-4 opciones con: texto, puntaje 0-1, feedback corto)

Reglas de dificultad por nivel:
- basico: seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales claras y decisiones fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ciles.
- refuerzo: seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales mezcladas y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s ambiguas.
- avanzado: escenarios realistas; seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales menos obvias; requiere verificar y analizar.

Reglas por categorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a (evita repeticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n):
- web: incluye web_lab y compare_domains (ideal tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n signal_hunt). No uses sim_chat aquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ salvo que aporte.
- sms: incluye inbox(kind="sms") y signal_hunt.
- correo_redes: incluye inbox(kind="correo") y signal_hunt.
- whatsapp: incluye sim_chat y signal_hunt (enlaces/urgencia/suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n).
- llamadas: incluye call_sim (y una abierta tipo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“guiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para colgar/verificarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â).
- habitos: incluye scenario_flow (rutina) y checklist (regla personal).

Reglas de consistencia:
- La ruta DEBE respetar "categorias_sugeridas" (mismo orden y longitud).
- Si viene "niveles_sugeridos", ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsalo para nivel por mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo (mismo orden).
- Si una categorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a se repite, cambia enfoque y sube dificultad (bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sico -> refuerzo -> avanzado).
- No repitas tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tulos, scenarioId ni actividades ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“clonadasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.
- Si "progreso_actual" incluye seenScenarioIds, evita reciclar esos mismos escenarios.

Seguridad:
- No incluyas URLs ni telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fonos.
- No des instrucciones para estafar; es solo educaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n defensiva.
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
        'Eres un entrenador de seguridad digital enfocado en evitar estafas en MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xico. ' +
        'Vas a evaluar una respuesta abierta del usuario.\n\n' +
        'Devuelve SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido (sin Markdown) con estas llaves: score, feedback.\n' +
        '- score: nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero 0 a 1 (1 = excelente).\n' +
        '- feedback: 2ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ4 frases, empÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico, prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctico y especÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fico (sin tecnicismos).\n\n' +
        'Reglas: no pidas datos sensibles. No digas que investigaste o revisaste links. ' +
        'Si el usuario menciona que compartirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a datos/cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡jale score y explica el riesgo.',
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
        'Vas a correr una simulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n educativa de estafa (tipo chat) para entrenar al usuario. ' +
        'TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº interpretas al "estafador" (sin links reales, sin telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fonos, sin nombres reales) y al mismo tiempo actÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºas como instructor.\n\n' +
        'Devuelve SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido con estas llaves exactas:\n' +
        '- reply (string): el siguiente mensaje del estafador (corto, manipulador, genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico).\n' +
        '- coach_feedback (string): retroalimentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n breve y directa (2ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ4 frases).\n' +
        '- signal_detected (string): seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al exacta detectada en ese turno.\n' +
        '- risk (string): por quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© esa seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al es peligrosa.\n' +
        '- safe_action (string): quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© deberÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a hacer el usuario en una situaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real.\n' +
        '- rating (string): "Buena", "Regular" o "Riesgosa".\n' +
        '- score (number 0-1): quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© tan segura fue la respuesta del usuario.\n' +
        '- done (boolean): true si el usuario ya actuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ de forma segura o si se llegÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ al lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite.\n\n' +
        'Reglas para coach_feedback:\n' +
        'A) No uses frases empÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticas repetitivas ni del tipo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Es comprensibleÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â o ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“EntiendoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.\n' +
        'B) Explica la seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al de estafa presente (urgencia, presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, transferencia, premio, etc.).\n' +
        'C) Indica quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© deberÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a hacer el usuario en una situaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real.\n' +
        'D) SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ala si la respuesta fue buena, regular o riesgosa.\n' +
        'E) Da una recomendaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n concreta y prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctica.\n' +
        'F) SÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© claro, breve y orientado a la acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n; evita respuestas largas o genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ricas.\n\n' +
        'Reglas de seguridad:\n' +
        '1) Nunca pidas datos reales del usuario.\n' +
        '2) No incluyas URLs, nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmeros de telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono, ni instrucciones para cometer delitos.\n' +
        '3) El estafador usa presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/urgencia, pero siempre genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico.\n' +
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

const repairPossibleMojibake = (value) => {
  if (typeof value !== 'string') return value;
  if (!/[ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â]/.test(value) && !/\bcontrasena\b/i.test(value)) return value;

  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â°', 'ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â', 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“', 'ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡', 'ÃƒÆ’Ã†â€™Ãƒâ€¦Ã‚Â¡')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ', 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â', 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢', 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“', 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â')
      .replaceAll('ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿', 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿')
      .replaceAll('ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡', 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡')
      .replaceAll('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦', 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦')
      .replaceAll('contrasena', 'contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a');
  }
};

const sanitizeCoursePayload = (value) => {
  if (typeof value === 'string') return repairPossibleMojibake(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeCoursePayload(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeCoursePayload(entry)])
    );
  }
  return value;
};

const asStringArray = (value) =>
  Array.isArray(value) ? value.map(toText).filter(Boolean) : [];

const BANNED_GENERIC_PHRASES = [
  'contenido personalizado',
  'alertas sobre fraudes',
  'ejercicios prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cticos',
  'ejercicios practicos',
];

const RECS_CONTEXT_PATTERN =
  /(sms|whatsapp|llamada|tel[eÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©]fono|web|dominio|enlace|link|transferencia|tarjeta|dep[oÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³]sito)/i;

const recLacksContext = (text) => !RECS_CONTEXT_PATTERN.test(String(text || ''));

const looksGeneric = (text) => {
  const lower = String(text || '').toLowerCase();
  return BANNED_GENERIC_PHRASES.some((phrase) => lower.includes(phrase));
};

const STEP_PATTERNS = {
  web: /(web|p[aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡]gina|sitio|dominio|clon|clonad|compra|pago|checkout|carrito)/i,
  messaging: /(sms|whatsapp|mensaje|enlace|link|c[oÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³]digo)/i,
  calls: /(llamada|tel[eÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©]fono|telefono|banco|operador|extensi[oÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³]n)/i,
};

const categorizeStep = (step) => {
  const text = `${step?.titulo || ''} ${step?.descripcion || ''}`.trim();
  return sanitizeCoursePayload({
    web: STEP_PATTERNS.web.test(text),
    messaging: STEP_PATTERNS.messaging.test(text),
    calls: STEP_PATTERNS.calls.test(text),
  });
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
    web: /(web|p[aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡]gina|sitio|dominio|clon|clonad)/i.test(story),
    sms: /(sms|mensaje|c[oÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³]digo|link|enlace)/i.test(story),
    whatsapp: /(whatsapp|wa|chat|grupo)/i.test(story),
    llamada: /(llamada|tel[eÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©]fono|banco|operador)/i.test(story),
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
      'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© Hacer Si Ya CaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ste',
      'Pasos para bloquear, reportar y reducir daÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±os sin pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nico.'
    );
  }
  if (signals.hasWeb) {
    pushModule(
      'PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas Clonadas y Dominios',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo detectar sitios falsos antes de pagar o ingresar datos.'
    );
    pushModule(
      'Compras y Pagos Seguros',
      'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todos te protegen y quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales evitar al pagar.'
    );
  }
  if (signals.hasSms || signals.hasWhatsapp) {
    pushModule(
      'Enlaces Sospechosos (SMS/WhatsApp)',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo identificar urgencia, links falsos y suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.'
    );
  }
  if (signals.hasCalls) {
    pushModule(
      'Llamadas Fraudulentas',
      'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© datos nunca dar y cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo verificar en canales oficiales.'
    );
  }
  if (signals.hasEmailOrSocial) {
    pushModule(
      'Phishing en Correo y Redes',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo reconocer mensajes falsos y proteger tus cuentas.'
    );
  }
  // Always include a habits/fundamentals module.
  pushModule(
    'HÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡bitos de VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
    'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido para validar mensajes, enlaces y ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ofertasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.'
  );

  // Make sure the user's learning priority is represented, even if they haven't been scammed that way.
  if (signals.priority === 'web') {
    pushModule(
      'PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas Clonadas y Dominios',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo detectar sitios falsos antes de comprar o ingresar datos.'
    );
    pushModule(
      'Compras y Pagos Seguros',
      'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todos te protegen y quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales evitar al pagar.'
    );
  }

  if (signals.priority === 'sms') {
    pushModule(
      'SMS Fraudulentos y Enlaces',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo detectar mensajes falsos y validar sin abrir enlaces.'
    );
  }

  if (signals.priority === 'whatsapp') {
    pushModule(
      'Seguridad y SuplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en WhatsApp',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo reconocer perfiles falsos y ajustar tu privacidad.'
    );
    pushModule(
      'Enlaces Sospechosos (SMS/WhatsApp)',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo identificar urgencia, links falsos y suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.'
    );
  }

  if (signals.priority === 'llamadas') {
    pushModule(
      'Llamadas Fraudulentas',
      'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© datos nunca dar y cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo verificar en canales oficiales.'
    );
  }

  if (signals.priority === 'todo') {
    pushModule(
      'PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas Clonadas y Dominios',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo detectar sitios falsos antes de comprar o ingresar datos.'
    );
    pushModule(
      'Enlaces Sospechosos (SMS/WhatsApp)',
      'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo identificar urgencia, links falsos y suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.'
    );
    pushModule(
      'Llamadas Fraudulentas',
      'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© datos nunca dar y cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo verificar en canales oficiales.'
    );
  }

  // Order by the user's declared priority when possible.
  const priorityKey = String(signals.priority || '').toLowerCase();
  const priorityMatchers = {
    web: /p[aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡]ginas clonadas|compras y pagos|dominios/i,
    sms: /sms|enlaces sospechosos/i,
    whatsapp: /whatsapp|enlaces sospechosos/i,
    llamadas: /llamadas fraudulentas/i,
    todo: /p[aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡]ginas clonadas|compras y pagos|dominios|enlaces sospechosos|whatsapp|llamadas fraudulentas/i,
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
    pushRec('Prefiere tarjeta o plataforma con protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, evita transferencias o depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sitos.');
  }
  if (signals.hasSms || signals.hasWhatsapp) {
    pushRec('No abras enlaces; valida la empresa en su app o web oficial.');
  }
  if (signals.hasCalls) {
    pushRec('Si te presionan por telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono, cuelga y contacta por canales oficiales.');
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
      ? pick((step) => /ca[iÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­]ste|recuper|reportar|bloquear|daÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±/i.test(`${step.titulo} ${step.descripcion}`))
      : pick((step) => /h[aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡]bitos|checklist|verific/i.test(`${step.titulo} ${step.descripcion}`));
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
      pick((step) => /h[aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡]bitos|checklist|verific/i.test(`${step.titulo} ${step.descripcion}`))
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
const COURSE_PLAN_VERSION = 4;

const MODULE_LEVELS = ['basico', 'refuerzo', 'avanzado'];
const ADMIN_REVIEW_CATEGORIES = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];

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
  if (raw.includes('hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡b') || raw.includes('hab')) return 'habitos';
  return COURSE_CATEGORIES.includes(raw) ? raw : 'habitos';
};

const normalizeScenarioToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const createScenarioId = ({ category, level, label, variant = 0 }) => {
  const parts = [
    normalizeScenarioToken(category),
    normalizeScenarioToken(level),
    normalizeScenarioToken(label),
    `v${Number(variant) || 0}`,
  ].filter(Boolean);
  return parts.join('__') || `scenario__${Date.now()}`;
};

const fingerprintScenarioId = (...parts) => {
  const raw = parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join('||');
  const hash = crypto.createHash('sha1').update(raw || 'escudo').digest('hex').slice(0, 12);
  return `sc_${hash}`;
};

const getActivityRepeatKey = (activity) =>
  fingerprintScenarioId(
    activity?.tipo,
    activity?.titulo,
    activity?.escenario,
    activity?.prompt,
    activity?.mensaje,
    activity?.intro,
    activity?.inicio,
    activity?.opening,
    activity?.contactName,
    activity?.callerName,
    activity?.callerNumber,
    activity?.from,
    activity?.subject,
    activity?.pagina?.dominio,
    Array.isArray(activity?.senales)
      ? activity.senales.map((item) => `${item?.label || ''}:${item?.correcta ? '1' : '0'}`).join('|')
      : '',
    Array.isArray(activity?.mensajes)
      ? activity.mensajes
          .map((item) => `${item?.from || ''}|${item?.subject || ''}|${item?.text || ''}`)
          .join('|')
      : '',
    Array.isArray(activity?.hotspots)
      ? activity.hotspots.map((item) => `${item?.target || ''}:${item?.label || ''}`).join('|')
      : ''
  );

const getSeenScenarioIds = (progress, { category = '', level = '' } = {}) => {
  const map =
    progress?.seenScenarioIds && typeof progress.seenScenarioIds === 'object'
      ? progress.seenScenarioIds
      : {};
  const keys = Object.keys(map);
  const normalizedCategory = normalizeCourseCategory(category);
  const normalizedLevel = normalizeModuleLevel(level);
  return keys
    .filter((key) => {
      if (!normalizedCategory) return true;
      const [cat, lvl] = String(key).split(':');
      if (normalizeCourseCategory(cat) !== normalizedCategory) return false;
      if (!normalizedLevel) return true;
      return normalizeModuleLevel(lvl) === normalizedLevel;
    })
    .flatMap((key) => (Array.isArray(map[key]) ? map[key] : []))
    .filter(Boolean);
};

const pickModuleVariant = ({ category, level, occurrence = 0, progress, total = 2 }) => {
  if (!total || total <= 1) return 0;
  const seen = getSeenScenarioIds(progress, { category, level });
  return (Number(occurrence) + seen.length) % total;
};

const buildConceptBlocks = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const titulo = toText(item.titulo || item.label);
      const texto = toText(item.texto || item.text);
      if (!titulo || !texto) return null;
      return { titulo: titulo.slice(0, 60), texto: texto.slice(0, 260) };
    })
    .filter(Boolean)
    .slice(0, 5);

const MODULE_ACTIVITY_SEQUENCES = {
  web: {
    basico: [
      [1, 2, 3, 4, 6, 5],
      [1, 3, 2, 4, 6, 5],
    ],
    refuerzo: [
      [3, 2, 1, 4, 5, 6],
      [2, 3, 1, 4, 6, 5],
    ],
    avanzado: [
      [4, 2, 3, 1, 5, 6],
      [3, 4, 2, 1, 6, 5],
    ],
  },
  whatsapp: {
    basico: [
      [1, 2, 3, 4, 6, 5],
      [1, 3, 2, 4, 6, 5],
    ],
    refuerzo: [
      [2, 3, 1, 4, 5, 6],
      [3, 2, 1, 4, 6, 5],
    ],
    avanzado: [
      [4, 2, 3, 1, 5, 6],
      [2, 4, 3, 1, 6, 5],
    ],
  },
  correo_redes: {
    basico: [
      [1, 2, 3, 4, 6, 5],
      [1, 3, 2, 4, 6, 5],
    ],
    refuerzo: [
      [2, 3, 1, 4, 5, 6],
      [3, 2, 1, 4, 6, 5],
    ],
    avanzado: [
      [4, 2, 3, 1, 5, 6],
      [2, 4, 3, 1, 6, 5],
    ],
  },
  llamadas: {
    basico: [
      [1, 2, 3, 4, 6, 5],
      [1, 3, 2, 4, 6, 5],
    ],
    refuerzo: [
      [2, 3, 1, 4, 5, 6],
      [3, 2, 1, 4, 6, 5],
    ],
    avanzado: [
      [4, 2, 3, 1, 5, 6],
      [2, 4, 3, 1, 6, 5],
    ],
  },
  habitos: {
    basico: [
      [1, 2, 3, 4, 5, 6],
      [1, 3, 2, 4, 5, 6],
    ],
    refuerzo: [
      [2, 1, 3, 4, 5, 6],
      [2, 3, 1, 4, 6, 5],
    ],
    avanzado: [
      [3, 2, 1, 4, 5, 6],
      [2, 3, 1, 4, 6, 5],
    ],
  },
};

const arrangeModuleActivities = ({ category, level, variant = 0, activities }) => {
  const items = Array.isArray(activities) ? activities.filter(Boolean) : [];
  if (!items.length) return items;

  const categorySequences = MODULE_ACTIVITY_SEQUENCES[normalizeCourseCategory(category)] || {};
  const levelSequences = categorySequences[normalizeModuleLevel(level)] || [];
  const sequence = levelSequences.length ? levelSequences[Math.abs(Number(variant) || 0) % levelSequences.length] : null;

  if (!Array.isArray(sequence) || !sequence.length) {
    return items;
  }

  const ordered = [];
  const usedIndexes = new Set();

  sequence.forEach((position) => {
    const index = Number(position) - 1;
    if (Number.isInteger(index) && index >= 0 && index < items.length && !usedIndexes.has(index)) {
      ordered.push(items[index]);
      usedIndexes.add(index);
    }
  });

  items.forEach((activity, index) => {
    if (!usedIndexes.has(index)) {
      ordered.push(activity);
    }
  });

  return ordered;
};

const buildWhatsAppModule = ({ modId, cat, modNivel, toneNote, levelHint, mk, variant }) => {
  const scenarioSets = {
    basico: [
      {
        key: 'familiar-deposito',
        contactName: 'Prima Ana',
        avatarLabel: 'PA',
        contactStatus: 'en lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea',
        opening:
          'Hola, cambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero. Estoy cerrando un pago urgente y no me deja entrar a la app. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Me ayudas con una transferencia y te la regreso hoy?',
        huntMessage:
          'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“CambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero, me urge una transferencia ahorita y no le digas a nadie porque me da penaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        redFlags: [
          { id: 'w1', label: 'Cambio inesperado de nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero', correcta: true, explicacion: 'La suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n suele empezar asÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­.' },
          { id: 'w2', label: 'Urgencia para mover dinero', correcta: true, explicacion: 'La prisa busca que no verifiques.' },
          { id: 'w3', label: 'Pide secreto', correcta: true, explicacion: 'Aislarte evita que confirmes con alguien real.' },
          { id: 'w4', label: 'Usa saludo cercano', correcta: false, explicacion: 'El tono cercano no prueba identidad.' },
        ],
        safestChoice:
          'Responder que llamarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero guardado y no transferirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s nada hasta confirmar.',
        riskyChoices: [
          'Transferir para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“sacarlo del apuroÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
          'Pedir solo una foto como prueba.',
          'Seguir la conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sin verificar por otro canal.',
        ],
      },
      {
        key: 'link-paquete',
        contactName: 'Entrega Express',
        avatarLabel: 'EE',
        contactStatus: 'escribiendoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦',
        opening:
          'Tu paquete no pudo salir hoy. Necesito que abras este enlace y confirmes el pago de reintento antes de 20 minutos.',
        huntMessage:
          'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Tu envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o quedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ retenido. Entra al enlace corto y confirma hoy para evitar devoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        redFlags: [
          { id: 'w1', label: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tiempo', correcta: true, explicacion: 'Busca que abras el enlace sin pensar.' },
          { id: 'w2', label: 'Enlace corto o raro', correcta: true, explicacion: 'Oculta el sitio real al que quiere llevarte.' },
          { id: 'w3', label: 'Pago inesperado', correcta: true, explicacion: 'Muchas estafas inventan ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“cargos de entregaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.' },
          { id: 'w4', label: 'Habla de un paquete', correcta: false, explicacion: 'Eso solo no basta para confiar.' },
        ],
        safestChoice:
          'No abrir el enlace y revisar el envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o en la app o sitio oficial que tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº escribes.',
        riskyChoices: [
          'Pagar para evitar retrasos.',
          'Reenviar el enlace a alguien para preguntar.',
          'Escribir tus datos en el enlace.',
        ],
      },
    ],
    refuerzo: [
      {
        key: 'familiar-secreto',
        contactName: 'MamÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡',
        avatarLabel: 'MA',
        contactStatus: 'en lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea',
        opening:
          'Estoy en una junta y no puedo hablar. Necesito que hagas una transferencia ahorita y luego te explico. No le digas a nadie porque es algo personal.',
        huntMessage:
          'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Estoy ocupada, no puedo contestar llamadas. Hazme el depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito y luego lo vemos; por favor no se lo comentes a nadieÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        redFlags: [
          { id: 'w1', label: 'Impide la llamada', correcta: true, explicacion: 'Evita que confirmes identidad.' },
          { id: 'w2', label: 'Pide secreto', correcta: true, explicacion: 'Una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­pica en suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
          { id: 'w3', label: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n emocional', correcta: true, explicacion: 'Te empuja a actuar sin revisar.' },
          { id: 'w4', label: 'Mensaje bien escrito', correcta: false, explicacion: 'Hoy las estafas se redactan muy bien.' },
        ],
        safestChoice:
          'Decir que solo ayudarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de llamar al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero guardado o hablar con otro familiar.',
        riskyChoices: [
          'Hacer la transferencia y avisar despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s.',
          'Seguir escribiendo hasta sentirte seguro.',
          'Pedir una nota de voz y confiar si suena parecida.',
        ],
      },
      {
        key: 'codigo-otp',
        contactName: 'Soporte Cuenta',
        avatarLabel: 'SC',
        contactStatus: 'escribiendoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦',
        opening:
          'Estamos cerrando un intento de acceso en tu cuenta. Te llegarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ un cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo por SMS; envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­amelo aquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ para bloquear el movimiento.',
        huntMessage:
          'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Te llegÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de seguridad. PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡samelo en este chat para cancelar el movimiento antes de que se proceseÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        redFlags: [
          { id: 'w1', label: 'Pide un cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo OTP', correcta: true, explicacion: 'Ese cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo nunca se comparte.' },
          { id: 'w2', label: 'Se presenta como soporte', correcta: true, explicacion: 'Puede ser una identidad falsa.' },
          { id: 'w3', label: 'Usa urgencia por ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“seguridadÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', correcta: true, explicacion: 'La presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n evita que verifiques por la app.' },
          { id: 'w4', label: 'Habla de proteger tu cuenta', correcta: false, explicacion: 'El pretexto puede sonar legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timo.' },
        ],
        safestChoice:
          'No compartir el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo y revisar la cuenta desde la app oficial o soporte oficial.',
        riskyChoices: [
          'Mandar el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“cancelarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â la operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          'Pedir que te espere mientras revisas el SMS.',
          'Seguir la conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para ver si ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“suena realÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        ],
      },
    ],
    avanzado: [
      {
        key: 'viaje-bloqueado',
        contactName: 'Daniel',
        avatarLabel: 'DA',
        contactStatus: 'en lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea',
        opening:
          'Estoy atorado con un pago del hotel y me bloquearon la app. Traigo el otro celular descompuesto. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Me ayudas con una transferencia? En cuanto quede, te marco desde recepciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
        huntMessage:
          'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“No puedo marcar ahorita porque estoy resolviendo esto en recepciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Si me ayudas ya, en cuanto termine te regreso todoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        redFlags: [
          { id: 'w1', label: 'Historia muy alineada al contexto', correcta: true, explicacion: 'Mientras mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ble suena, mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡cil es confiar.' },
          { id: 'w2', label: 'Evita verificar por llamada', correcta: true, explicacion: 'Te deja solo en el canal del estafador.' },
          { id: 'w3', label: 'Promesa de devoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n inmediata', correcta: true, explicacion: 'Busca bajar tu resistencia.' },
          { id: 'w4', label: 'No tiene faltas de ortografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a', correcta: false, explicacion: 'Eso ya no es una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al confiable.' },
        ],
        safestChoice:
          'Cortar la conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, llamar al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero guardado y validar con otro familiar antes de mover dinero.',
        riskyChoices: [
          'Mandar una cantidad menor ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“solo para ayudarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
          'Pedir mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s contexto y seguir chateando.',
          'Esperar el comprobante del hotel y transferir si se ve creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ble.',
        ],
      },
      {
        key: 'cliente-pago',
        contactName: 'Pago Pendiente',
        avatarLabel: 'PP',
        contactStatus: 'escribiendoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦',
        opening:
          'Soy del ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea de pagos. Tu compra quedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ retenida por seguridad. Si me compartes aquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ el comprobante y tu cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo temporal, libero el envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o sin que pierdas el descuento.',
        huntMessage:
          'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Tu compra sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ existe, solo falta la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida. Si hoy no mandas el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo y el comprobante, se pierde el precio especialÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        redFlags: [
          { id: 'w1', label: 'Pide comprobante y cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo en el chat', correcta: true, explicacion: 'Quiere saltarse el canal real de pago.' },
          { id: 'w2', label: 'Usa presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sutil por el precio', correcta: true, explicacion: 'La urgencia no siempre viene con amenazas directas.' },
          { id: 'w3', label: 'Se presenta como ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea de pagos', correcta: true, explicacion: 'La identidad aparente no prueba legitimidad.' },
          { id: 'w4', label: 'Tono profesional', correcta: false, explicacion: 'Una estafa pulida tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n suena profesional.' },
        ],
        safestChoice:
          'Salir del chat y revisar la compra solo desde la app o web oficial que tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº escribes.',
        riskyChoices: [
          'Mandar el comprobante ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“para avanzarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
          'Pedir que te llamen pero seguir dentro del mismo flujo.',
          'Compartir el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo si ya revisaste el cargo.',
        ],
      },
    ],
  };

  const scenario = scenarioSets[modNivel][variant % scenarioSets[modNivel].length];
  const riskOptions = [scenario.safestChoice, ...scenario.riskyChoices];

  const activities = [
      mk(1, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
        tipo: 'concepto',
        titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© revisar antes de contestar',
        bloques: buildConceptBlocks([
          { titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales de alerta', texto: 'Cambio de nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero, urgencia, secreto o un enlace que no esperabas.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© quiere el estafador', texto: 'Que respondas rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido, abras el enlace o envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­es dinero/cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos sin confirmar.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© hacer ahora (pasos)', texto: 'Pausa, llama al contacto real o revisa desde la app oficial. No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos.' },
          { titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', texto: 'Verifica el nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero, confirma por otro canal y no transfieras por presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
        ]),
        contenido:
          'Si alguien te escribe con urgencia por WhatsApp, no tomes la decisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n dentro del mismo chat. Verifica por otro canal antes de abrir enlaces o mandar dinero.',
        peso: 0.9,
      }),
      mk(2, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-chat`, variant }),
        tipo: 'sim_chat',
        titulo: 'SimulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tipo WhatsApp',
        escenario: `Escenario ${levelHint}: ${scenario.opening}`,
        inicio: scenario.opening,
        contactName: scenario.contactName,
        avatarLabel: scenario.avatarLabel,
        contactStatus: scenario.contactStatus,
        quickReplies: [
          'Te llamo al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero de siempre.',
          'No voy a transferir sin verificar.',
          'Reviso por mi cuenta y te confirmo.',
        ],
        turnos_max: modNivel === 'avanzado' ? 7 : 6,
        peso: 1.6,
      }),
      mk(3, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-alertas`, variant }),
        tipo: 'signal_hunt',
        titulo: 'Marca las seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales de alerta',
        mensaje: scenario.huntMessage,
        senales: scenario.redFlags,
        accion: scenario.safestChoice,
        peso: 1.2,
      }),
      mk(4, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-decision`, variant }),
        tipo: 'quiz',
        titulo: 'Elige la respuesta mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s segura',
        escenario: 'Si esto te llegara en la vida real, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿cuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡l serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a tu siguiente paso?',
        opciones: riskOptions,
        correcta: 0,
        explicacion: `La opciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n segura es verificar por otro canal y no compartir dinero, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos ni datos en el mismo chat.`,
        senal: 'La conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mete urgencia y evita que confirmes identidad.',
        riesgo: 'Si resuelves todo dentro del mismo WhatsApp, el estafador controla el contexto.',
        accion: scenario.safestChoice,
        peso: 1.0,
      }),
      mk(5, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-guion`, variant }),
        tipo: 'abierta',
        titulo: 'Escribe tu respuesta segura',
        prompt: 'Redacta una respuesta breve para frenar la urgencia sin discutir y dejando claro que verificarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s por otro canal.',
        pistas: ['te llamo al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero guardado', 'no envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o dinero ni cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos', 'verifico por mi cuenta'],
        peso: 1.0,
      }),
      mk(6, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
        tipo: 'checklist',
        titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido de WhatsApp',
        intro: 'Antes de responder, confirma esto:',
        items: [
          'Verifica si el nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero coincide con el contacto real.',
          'Confirma por llamada o por otra persona de confianza.',
          'No abras enlaces ni pagues por presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni comprobantes en el chat.',
        ],
        peso: 1.0,
      }),
  ];

  const selectedActivities =
    modNivel === 'basico'
      ? activities
      : modNivel === 'refuerzo'
        ? [activities[1], activities[2], activities[3], activities[5], activities[4]]
        : [activities[1], activities[3], activities[2], activities[4], activities[5]];

  return sanitizeCoursePayload({
    id: modId,
    titulo: 'WhatsApp: SuplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y Enlaces',
    descripcion: `Entrenamiento ${levelHint} para reconocer engaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±os en WhatsApp ${toneNote}.`,
    categoria: cat,
    nivel: modNivel,
    actividades: arrangeModuleActivities({
      category: cat,
      level: modNivel,
      variant,
      activities: selectedActivities,
    }),
  });
};

const buildWebModule = ({ modId, cat, modNivel, toneNote, levelHint, mk, variant }) => {
  const scenarioSets = {
    basico: [
      {
        key: 'cyber-zone',
        store: {
          marca: 'Cyber Zone MX',
          dominio: 'cyberzone-ofertas.shop',
          browserTitle: 'Cyber Zone MX | PromociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n relÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mpago',
          banner: 'LiquidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n total: 85% de descuento solo hoy',
          sub: 'EnviÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido y ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“garantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a totalÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â sin detalles claros.',
          contacto: 'AtenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n solo por formulario. Sin direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ni razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social visible.',
          pagos: ['Transferencia bancaria', 'Tarjeta por enlace externo'],
          shipping: 'EnvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“aseguradoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â con costo extra obligatorio.',
          reviews: 'Testimonios genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ricos sin fecha ni nombres verificables.',
          policy: 'Devoluciones sujetas a aprobaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n interna; sin tiempos claros.',
          cartNote: 'Tu carrito se reserva solo 12 minutos.',
          checkoutPrompt: 'Para mantener el descuento, termina el pago hoy.',
          productos: [
            { nombre: 'Laptop Air 14', antes: '$18,999', precio: '$3,499' },
            { nombre: 'AudÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fonos Pro', antes: '$2,799', precio: '$399' },
            { nombre: 'Tablet Mini', antes: '$7,999', precio: '$1,299' },
          ],
        },
        hotspots: [
          { id: 'w1', target: 'domain', label: 'Dominio extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o', correcta: true, explicacion: 'No coincide con una tienda conocida ni suena institucional.' },
          { id: 'w2', target: 'banner', label: 'Descuento exagerado', correcta: true, explicacion: 'Busca que compres antes de revisar.' },
          { id: 'w3', target: 'contacto', label: 'Contacto incompleto', correcta: true, explicacion: 'Sin datos formales es difÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cil reclamar.' },
          { id: 'w4', target: 'pago', label: 'Pago de alto riesgo', correcta: true, explicacion: 'Transferencia y enlaces externos ofrecen poca protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
          { id: 'w5', target: 'policy', label: 'PolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica poco clara', correcta: true, explicacion: 'Una tienda confiable explica devoluciones y tiempos.' },
        ],
        domains: ['cyberzone.com.mx', 'cyberzone-ofertas.shop', 'cyberzone-mx.site'],
      },
      {
        key: 'hogar-express',
        store: {
          marca: 'Hogar Express',
          dominio: 'hogar-express-remate.store',
          browserTitle: 'Hogar Express | Remate especial',
          banner: 'Todo el catÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡logo con envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o gratis y descuento VIP',
          sub: 'Muebles y electrodomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©sticos con pago inmediato.',
          contacto: 'Chat 24/7, sin domicilio fiscal ni aviso legal.',
          pagos: ['Transferencia', 'Gift card'],
          shipping: 'Entrega en 24 horas para todo MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©xico sin restricciones.',
          reviews: 'Solo reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as de 5 estrellas, todas del mismo dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.',
          policy: 'No hay devoluciones en productos en remate.',
          cartNote: 'Si sales del sitio, pierdes la oferta exclusiva.',
          checkoutPrompt: 'Sube tu comprobante para validar tu pedido al instante.',
          productos: [
            { nombre: 'SofÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ Terra', antes: '$12,499', precio: '$2,099' },
            { nombre: 'Freidora Smart', antes: '$2,199', precio: '$349' },
            { nombre: 'TV 50"', antes: '$11,999', precio: '$1,899' },
          ],
        },
        hotspots: [
          { id: 'w1', target: 'domain', label: 'Dominio promocional', correcta: true, explicacion: 'Agrega palabras de remate para parecer temporal.' },
          { id: 'w2', target: 'shipping', label: 'Promesa de envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o poco realista', correcta: true, explicacion: 'Se ve demasiado buena para ser verdad.' },
          { id: 'w3', target: 'reviews', label: 'ReseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as sospechosas', correcta: true, explicacion: 'Todas iguales y del mismo dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a sugieren manipulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
          { id: 'w4', target: 'pago', label: 'MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todos sin protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', correcta: true, explicacion: 'Gift card y transferencia son muy riesgosos.' },
          { id: 'w5', target: 'banner', label: 'Banner llamativo', correcta: false, explicacion: 'No todo banner bonito es una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ sola.' },
        ],
        domains: ['hogarexpress.com.mx', 'hogar-express-remate.store', 'hogarexpress-seguro.online'],
      },
    ],
    refuerzo: [
      {
        key: 'pixel-foundry',
        store: {
          marca: 'Pixel Foundry',
          brandMark: 'PF',
          dominio: 'pixelfoundry-market.com',
          browserTitle: 'Pixel Foundry | Creator Week',
          themeVariant: 'neon',
          layoutVariant: 'market',
          guideMode: 'light',
          headerTagline: 'Setup creator ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· stock curado',
          sealLabel: 'Creator Week',
          heroTitle: 'SelecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n creator con combos muy bien diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ados',
          heroBody: 'El sitio se ve moderno y aspiracional, pero las seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales delicadas aparecen en pagos, reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as y soporte.',
          banner: 'Creator Week: beneficios extra al validar hoy',
          sub: 'DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o limpio, checkout con fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sutil y descuentos poco obvios.',
          contacto: 'Centro de ayuda por ticket y correo genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico; no aparece razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social.',
          pagos: ['Tarjeta', 'Transferencia con bono del 8%'],
          shipping: 'Tracking enviado despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manual del pedido.',
          reviews: 'Opiniones muy positivas, pero sin fotos, fechas ni perfiles enlazados.',
          policy: 'Cambios sujetos a revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de inventario y validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea de riesgo.',
          cartHeadline: 'Tu selecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se apartÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ en fila preferente',
          cartNote: 'Reservamos tu carrito 09:45 min mientras validas el mejor mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo de pago.',
          checkoutHeadline: 'Confirma tu pedido con revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manual',
          checkoutPrompt: 'Puedes desbloquear precio partner si cambias a transferencia ahora.',
          reviewsLabel: 'Comentarios de la comunidad',
          liveToasts: [
            'Andrea de QuerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©taro acaba de apartar una cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mara Nova.',
            'Luis de Monterrey activÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el combo creator hace 2 min.',
            'MarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de CDMX estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ validando su compra partner.',
          ],
          productos: [
            { nombre: 'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mara Nova C1', antes: '$8,999', precio: '$7,299', badge: 'Creator pick', caption: 'Sensor 4K ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· setup mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³vil' },
            { nombre: 'Teclado Frame 75', antes: '$2,199', precio: '$1,849', badge: 'Bundle studio', caption: 'Wireless ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· creator desk' },
            { nombre: 'Monitor Halo 27"', antes: '$5,499', precio: '$4,699', badge: 'EdiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n color', caption: 'Panel IPS ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 99% sRGB' },
          ],
        },
        hotspots: [
          { id: 'w1', target: 'domain', label: 'Dominio marketplace no oficial', correcta: true, explicacion: 'Se ve profesional, pero no coincide con una marca conocida ni con un dominio institucional.' },
          { id: 'w2', target: 'contacto', label: 'Soporte sin empresa visible', correcta: true, explicacion: 'No muestra razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social ni domicilio verificable.' },
          { id: 'w3', target: 'pago', label: 'Bono extra por transferencia', correcta: true, explicacion: 'El incentivo empuja justo al mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo menos recuperable.' },
          { id: 'w4', target: 'reviews', label: 'Comentarios sin respaldo externo', correcta: true, explicacion: 'Se ven bien, pero no enlazan a compradores o perfiles reales.' },
          { id: 'w5', target: 'shipping', label: 'Tracking diferido', correcta: false, explicacion: 'Puede ser una prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctica rara, pero no basta por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ sola para decidir fraude.' },
        ],
        domains: ['pixelfoundry.mx', 'pixelfoundry-market.com', 'pixelfoundry-partner.shop'],
      },
      {
        key: 'urban-circuit',
        store: {
          marca: 'Urban Circuit',
          brandMark: 'UC',
          dominio: 'urbancircuit-showroom.com.mx',
          browserTitle: 'Urban Circuit | Showroom oficial',
          themeVariant: 'street',
          layoutVariant: 'split',
          guideMode: 'light',
          headerTagline: 'Drop del mes ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· gadgets urbanos',
          sealLabel: 'Aniversario showroom',
          heroTitle: 'Bundles urbanos con compra anticipada',
          heroBody: 'La tienda se ve sobria y bien pensada, pero el checkout mete una validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n extra y un flujo de pago mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s riesgoso.',
          banner: 'Beneficios por compra anticipada',
          sub: 'DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o serio con una fricciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n peligrosa justo antes de pagar.',
          contacto: 'Formulario y correo; no aparece domicilio ni razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social.',
          pagos: ['Tarjeta', 'DepÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito para asegurar inventario'],
          shipping: 'Entrega nacional con ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“seguro opcionalÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â y tracking posterior.',
          reviews: 'Calificaciones altas, pero sin comentarios verificables ni historial.',
          policy: 'Cambios y devoluciones solo por incidencias autorizadas.',
          cartHeadline: 'Aparta el bundle antes del siguiente corte',
          cartNote: 'Tu pedido estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ casi listo y conserva precio anticipado por 08:35 min.',
          checkoutHeadline: 'ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de inventario antes del pago final',
          checkoutPrompt: 'DepÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito requerido para asegurar inventario en promociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          reviewsLabel: 'Valoraciones del showroom',
          liveToasts: [
            'Pedro de LeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n apartÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un smartphone Lite hace 1 min.',
            'Diana de Puebla activÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ el beneficio de aniversario.',
            'Julio de MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rida estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ cerrando un bundle urbano.',
          ],
          productos: [
            { nombre: 'Smartphone Lite 5G', antes: '$6,499', precio: '$5,449', badge: 'Drop del mes', caption: 'Pantalla OLED ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 128 GB' },
            { nombre: 'AudÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fonos Beam Pro', antes: '$1,599', precio: '$1,279', badge: 'Street audio', caption: 'ANC ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· baterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a extendida' },
            { nombre: 'Consola Pocket Neo', antes: '$4,799', precio: '$4,199', badge: 'EdiciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n urbana', caption: 'PortÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡til ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· color graphite' },
          ],
        },
        hotspots: [
          { id: 'w1', target: 'pago', label: 'DepÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito para asegurar inventario', correcta: true, explicacion: 'Es una excusa comÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn para sacarte del pago con mayor protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
          { id: 'w2', target: 'contacto', label: 'Contacto parcial y sin empresa', correcta: true, explicacion: 'Dificulta reclamar si algo sale mal.' },
          { id: 'w3', target: 'policy', label: 'PolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica abierta a interpretaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', correcta: true, explicacion: 'No deja claras tus garantÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as reales como comprador.' },
          { id: 'w4', target: 'domain', label: 'Dominio plausible, pero demasiado armado', correcta: true, explicacion: 'Usa ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“showroomÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â para sonar oficial, sin que eso pruebe legitimidad.' },
          { id: 'w5', target: 'banner', label: 'CampaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a de aniversario', correcta: false, explicacion: 'Una campaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a bonita no es seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al de fraude por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ sola.' },
        ],
        domains: ['urbancircuit.com.mx', 'urbancircuit-showroom.com.mx', 'urbancircuit-valida.com'],
      },
    ],
    avanzado: [
      {
        key: 'luna-atelier',
        store: {
          marca: 'Luna Atelier',
          brandMark: 'LA',
          dominio: 'lunaatelier.com',
          browserTitle: 'Luna Atelier | Casa y tecnologÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a',
          themeVariant: 'premium',
          layoutVariant: 'editorial',
          guideMode: 'minimal',
          headerTagline: 'CuradurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a hogar ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ediciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n weekend',
          sealLabel: 'Weekend picks',
          heroTitle: 'ColecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n hogar inteligente con precio protegido',
          heroBody: 'Todo se ve premium y coherente. Las seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales reales estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n escondidas en validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, datos legales y letra pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a.',
          banner: 'Weekend picks con envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o preferente',
          sub: 'Precios razonables, reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­bles y un checkout que no parece agresivo.',
          contacto: 'Chat, formulario y horario comercial. La razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social no aparece en el checkout.',
          pagos: ['Tarjeta', 'Transferencia para validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n prioritaria'],
          shipping: 'Entrega estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar con seguimiento posterior a validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          reviews: 'ReseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­bles, pero no enlazan a compradores verificables.',
          policy: 'Las promociones quedan fuera de devoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tras la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n del pedido.',
          cartHeadline: 'Tu selecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mantiene precio protegido',
          cartNote: 'Tu selecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n conserva este precio durante 08:20 min.',
          checkoutHeadline: 'ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n prioritaria disponible',
          checkoutPrompt: 'Si eliges validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n prioritaria, el pedido se confirma hoy.',
          reviewsLabel: 'Historias de compra',
          liveToasts: [
            'Claudia de CDMX acaba de cerrar una notebook Air.',
            'TomÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s de Guadalajara reservÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una tablet Home.',
            'Regina de Saltillo confirmÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un pedido premium.',
          ],
          productos: [
            { nombre: 'Notebook Air 13', antes: '$13,999', precio: '$12,699', badge: 'SelecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n curada', caption: 'Aluminio ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 16 GB RAM' },
            { nombre: 'Tablet Home 11', antes: '$5,499', precio: '$4,999', badge: 'Home pick', caption: 'LÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡piz incluido ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Wi-Fi 6' },
            { nombre: 'Barra de sonido Arc', antes: '$2,899', precio: '$2,499', badge: 'Audio studio', caption: 'Dolby Atmos ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· sala compacta' },
          ],
        },
        hotspots: [
          { id: 'w1', target: 'pago', label: 'ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n prioritaria por transferencia', correcta: true, explicacion: 'La presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n es sutil, pero sigue moviÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ndote al mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo menos recuperable.' },
          { id: 'w2', target: 'policy', label: 'Promociones fuera de devoluciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', correcta: true, explicacion: 'La letra pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a limita demasiado tus opciones reales.' },
          { id: 'w3', target: 'contacto', label: 'RazÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social ausente', correcta: true, explicacion: 'Un comercio serio muestra empresa, razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social y canales formales.' },
          { id: 'w4', target: 'reviews', label: 'ReseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ticas', correcta: false, explicacion: 'Que las reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as no tengan perfil visible es raro, pero no basta por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ solo para decidir.' },
        ],
        domains: ['lunaatelier.com', 'lunaatelier-oficial.com', 'lunaatelier-checkout.mx'],
      },
      {
        key: 'terra-desk',
        store: {
          marca: 'Terra Desk',
          brandMark: 'TD',
          dominio: 'terradesk.com.mx',
          browserTitle: 'Terra Desk | Objetos de trabajo',
          themeVariant: 'sage',
          layoutVariant: 'minimal',
          guideMode: 'minimal',
          headerTagline: 'Desk objects ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ediciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n studio',
          sealLabel: 'Compra anticipada',
          heroTitle: 'Accesorios de escritorio con estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tica premium',
          heroBody: 'DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o limpio, reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as sobrias y checkout elegante. Las alertas son pocas, pero importan mucho.',
          banner: 'Beneficios por compra anticipada',
          sub: 'Todo parece normal hasta que el pago ofrece un beneficio extra con un mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo irrecuperable.',
          contacto: 'Formulario y correo; no muestra empresa ni domicilio en la confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          pagos: ['Tarjeta', 'Cripto para conservar envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o sin costo'],
          shipping: 'Entrega estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ndar sin sobrepromesas.',
          reviews: 'Comentarios breves, sin historial ni fotos de compra.',
          policy: 'Cancelaciones solo antes de la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n interna del pedido.',
          cartHeadline: 'Beneficio activo por compra anticipada',
          cartNote: 'Tu selecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n conserva este beneficio durante 07:10 min.',
          checkoutHeadline: 'ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n adicional para mantener beneficio',
          checkoutPrompt: 'Completa la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n adicional ahora para conservar el beneficio.',
          reviewsLabel: 'Notas de compradores',
          liveToasts: [
            'IvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n de Aguascalientes asegurÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o sin costo.',
            'SofÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de QuerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©taro activÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un beneficio anticipado.',
            'MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nica de Puebla estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ validando su pedido studio.',
          ],
          productos: [
            { nombre: 'Reloj Pulse One', antes: '$3,299', precio: '$2,999', badge: 'Desk edit', caption: 'Acero mate ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· correa tejida' },
            { nombre: 'Teclado Air Slim', antes: '$1,899', precio: '$1,699', badge: 'Workspace', caption: 'Perfil bajo ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· triple pairing' },
            { nombre: 'Hub USB-C Stone', antes: '$899', precio: '$799', badge: 'Studio mini', caption: 'Aluminio ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· 7 puertos' },
          ],
        },
        hotspots: [
          { id: 'w1', target: 'pago', label: 'Cripto para conservar envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o sin costo', correcta: true, explicacion: 'Te empuja al mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo menos recuperable con un beneficio pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o pero efectivo.' },
          { id: 'w2', target: 'policy', label: 'CancelaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n limitada por validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n interna', correcta: true, explicacion: 'El checkout redefine el proceso a favor de la tienda.' },
          { id: 'w3', target: 'contacto', label: 'Empresa ausente en la confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', correcta: true, explicacion: 'Sin empresa o domicilio visible, reclamar se complica mucho.' },
          { id: 'w4', target: 'domain', label: 'Dominio creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ble', correcta: false, explicacion: 'AquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ el dominio por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ solo no basta para descartar ni confirmar fraude.' },
        ],
        domains: ['terradesk.com.mx', 'terra-desk.com.mx', 'terradesk-benefits.com'],
      },
    ],
  };

  const scenario = scenarioSets[modNivel][variant % scenarioSets[modNivel].length];
  const activities = [
      mk(1, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
        tipo: 'concepto',
        titulo: 'Antes de confiar en una tienda',
        bloques: buildConceptBlocks([
          { titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales de alerta', texto: 'Dominio raro, contacto incompleto, reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as poco creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­bles o pago por transferencia.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© quiere el estafador', texto: 'Que compres por emociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n o prisa y pagues por un mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo difÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cil de recuperar.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© hacer ahora (pasos)', texto: 'Revisa dominio, empresa, polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas, reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as externas y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo de pago antes de comprar.' },
          { titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', texto: 'Si algo te presiona a pagar hoy, sal del sitio y verifica fuera de ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©l.' },
        ]),
        contenido:
          'Una tienda falsa puede verse muy bien. Lo importante es revisar seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales concretas antes del pago, no confiar solo por el diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o.',
        peso: 0.9,
      }),
      mk(2, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-lab`, variant }),
        tipo: 'web_lab',
        titulo: 'Laboratorio: tienda en vivo',
        intro:
          modNivel === 'avanzado'
            ? 'Recorre producto, carrito y checkout. Marca solo las seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales que realmente te harÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an frenar la compra.'
            : modNivel === 'refuerzo'
              ? 'Explora la tienda y marca las seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales que sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ afectarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­an tu decisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n antes de pagar.'
              : 'Explora la tienda, cambia entre producto, carrito y checkout, y marca lo que te parezca sospechoso.',
        pagina: scenario.store,
        hotspots: scenario.hotspots,
        decisionPrompt: 'Con lo que viste, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿comprarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as aquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ o no?',
        decisionOptions: ['SÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ comprarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a', 'No comprarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a hasta verificar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s', 'Solo si me llaman primero'],
        correctDecision: 1,
        peso: 1.7,
      }),
      mk(3, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-dominios`, variant }),
        tipo: 'compare_domains',
        titulo: 'ComparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida de dominios',
        prompt: 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡l dominio te da mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s confianza para verificar por tu cuenta?',
        dominios: scenario.domains,
        correcta: 0,
        explicacion: 'El dominio mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s simple y consistente suele ser el punto de partida mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s seguro para verificar.',
        tip: 'Si llegaste desde anuncio o mensaje, mejor escribe tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº el dominio en el navegador.',
        peso: 1.0,
      }),
      mk(4, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checkout`, variant }),
        tipo: 'quiz',
        titulo: 'DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en checkout',
        escenario: scenario.store.checkoutPrompt,
        opciones: [
          'Seguir con el pago para no perder la oferta.',
          'Salir y revisar reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as, empresa y dominio fuera del sitio.',
          'Mandar comprobante para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“agilizarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â la compra.',
          'Compartir datos extra para que validen el pedido.',
        ],
        correcta: 1,
        explicacion: 'Cuando el sitio cambia el flujo de pago o mete urgencia, lo seguro es salir y verificar por fuera.',
        senal: 'El checkout cambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ las reglas y te presiona a decidir rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido.',
        riesgo: 'Los mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todos como transferencia o cripto hacen difÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cil recuperar el dinero.',
        accion: 'Busca reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as externas, revisa la empresa y usa solo pagos con protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
        peso: 1.0,
      }),
      mk(5, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-abierta`, variant }),
        tipo: 'abierta',
        titulo: 'Tu rutina de compra segura',
        prompt: modNivel === 'avanzado'
          ? 'Escribe 4 pasos que seguirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as para verificar una tienda que se ve muy profesional pero te genera duda.'
          : 'Escribe 3 o 4 pasos para verificar una tienda nueva antes de pagar.',
        pistas: ['dominio exacto', 'reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as fuera del sitio', 'empresa/contacto real', 'pago con protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n'],
        peso: 1.0,
      }),
      mk(6, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
        tipo: 'checklist',
        titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido antes de comprar',
        intro: 'Confirma esto antes de pagar:',
        items: [
          'Verifica el dominio exacto y cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo llegaste al sitio.',
          'Busca reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as fuera de la tienda.',
          'Revisa si la empresa y el contacto son completos.',
          'Evita transferencias, cripto o gift cards.',
          'Si el checkout cambia el proceso, sal y revisa primero.',
        ],
        peso: 1.0,
      }),
  ];

  const selectedActivities =
    modNivel === 'basico'
      ? activities
      : modNivel === 'refuerzo'
        ? [activities[1], activities[2], activities[3], activities[5], activities[4]]
        : [activities[1], activities[2], activities[4], activities[3], activities[5]];

  return sanitizeCoursePayload({
    id: modId,
    titulo: 'Correo/Redes: Phishing',
    descripcion: `Entrenamiento ${levelHint} para detectar phishing en correo y redes ${toneNote}.`,
    categoria: cat,
    nivel: modNivel,
    actividades: arrangeModuleActivities({
      category: cat,
      level: modNivel,
      variant,
      activities: selectedActivities,
    }),
  });
};

const buildEmailModule = ({ modId, cat, modNivel, toneNote, levelHint, mk, variant }) => {
  const scenarioSets = {
    basico: [
      {
        key: 'reembolso',
        inbox: [
          {
            id: 'e1',
            displayName: 'Centro de pagos',
            from: 'pagos@soporte-seguro-mail.com',
            subject: 'Tu reembolso estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ pendiente',
            preview: 'Confirma tus datos para liberar el pago hoy.',
            dateLabel: 'Hoy',
            warning: 'Ten cuidado con este mensaje',
            text: 'Hola. Detectamos un saldo a favor. Para liberarlo hoy, confirma tus datos de pago y tu identidad desde el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de abajo.',
            body: [
              'Hola.',
              'Detectamos un saldo a favor pendiente.',
              'Para liberarlo hoy, confirma tus datos de pago y tu identidad desde el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de abajo.',
              'Si no respondes antes de hoy, el folio se cancela.',
            ],
            attachments: ['reembolso_formulario.pdf'],
            details: {
              from: 'Centro de pagos <pagos@soporte-seguro-mail.com>',
              replyTo: 'validacion@seguro-pago-mail.com',
              returnPath: 'bounce@mailer.seguro-pago-mail.com',
            },
            ctaLabel: 'Liberar reembolso',
            linkPreview: 'https://seguro-pago-mail.com/validacion',
            correcto: 'estafa',
            explicacion: 'Usa dinero y urgencia para que entregues datos sensibles.',
          },
          {
            id: 'e2',
            displayName: 'PaqueterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a oficial',
            from: 'avisos@app-paquetes.com',
            subject: 'Consulta el estatus de tu envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o',
            preview: 'Revisa el movimiento desde tu app oficial.',
            dateLabel: 'Ayer',
            text: 'Tu envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o sigue en trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nsito. Consulta el estatus desde la app o sitio que ya conoces.',
            body: [
              'Tu envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o sigue en trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nsito.',
              'Si quieres revisar el estatus, entra a tu app oficial o al sitio que ya usas normalmente.',
            ],
            details: {
              from: 'PaqueterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a oficial <avisos@app-paquetes.com>',
              replyTo: 'no-reply@app-paquetes.com',
              returnPath: 'bounce@app-paquetes.com',
            },
            ctaLabel: 'Abrir app oficial',
            linkPreview: 'Abre la app que ya tienes instalada',
            correcto: 'seguro',
            explicacion: 'No pide datos, dinero ni un enlace extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o.',
          },
          {
            id: 'e3',
            displayName: 'Factura servicio',
            from: 'factura@servicio-alerta.com',
            subject: 'Comprobante adjunto',
            preview: 'Revisa el archivo adjunto.',
            dateLabel: 'Mar 28',
            warning: 'Este mensaje parece peligroso',
            text: 'Adjuntamos tu comprobante. Si no lo esperabas, no abras el archivo.',
            body: [
              'Adjuntamos tu comprobante del servicio.',
              'Si no reconoces este movimiento, responde con tu nombre completo y telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono.',
            ],
            attachments: ['comprobante.zip'],
            details: {
              from: 'Factura servicio <factura@servicio-alerta.com>',
              replyTo: 'soporte@servicio-alerta.com',
              returnPath: 'mailer@servicio-alerta.com',
            },
            ctaLabel: 'Descargar adjunto',
            linkPreview: 'Descarga directa del archivo adjunto',
            correcto: 'estafa',
            explicacion: 'Adjunto inesperado y peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de datos: combinaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de alto riesgo.',
          },
          {
            id: 'e4',
            displayName: 'Aviso de seguridad',
            from: 'seguridad@app-cuenta.com',
            subject: 'Consejos para proteger tu cuenta',
            preview: 'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.',
            dateLabel: 'Mar 27',
            text: 'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as. Si dudas, entra a la app oficial.',
            body: [
              'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.',
              'Si recibes un aviso inesperado, entra a tu app oficial para revisar.',
            ],
            details: {
              from: 'Aviso de seguridad <seguridad@app-cuenta.com>',
              replyTo: 'no-reply@app-cuenta.com',
              returnPath: 'bounce@app-cuenta.com',
            },
            correcto: 'seguro',
            explicacion: 'Es preventivo y no te empuja a un flujo riesgoso.',
          },
        ],
        huntMessage: 'Tu reembolso estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ pendiente. Si no validas hoy tus datos de pago, el folio caduca.',
      },
      {
        key: 'red-social',
        inbox: [
          {
            id: 'e1',
            displayName: 'Red Social',
            from: 'alertas@seguridad-redes.net',
            subject: 'Tu cuenta fue reportada',
            preview: 'Verifica en una hora para evitar suspensiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
            dateLabel: 'Hoy',
            warning: 'Ten cuidado con este mensaje',
            text: 'Tu cuenta fue reportada por actividad inusual. Verifica tu identidad en la prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³xima hora para evitar suspensiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
            body: [
              'Detectamos actividad inusual en tu cuenta.',
              'Verifica tu identidad dentro de la prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³xima hora para evitar suspensiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
            ],
            details: {
              from: 'Red Social <alertas@seguridad-redes.net>',
              replyTo: 'validacion@seguridad-redes.net',
              returnPath: 'mailer@seguridad-redes.net',
            },
            ctaLabel: 'Verificar cuenta',
            linkPreview: 'https://seguridad-redes.net/verify',
            correcto: 'estafa',
            explicacion: 'Urgencia y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n fuera de la app son seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales claras.',
          },
          {
            id: 'e2',
            displayName: 'Comunidad',
            from: 'avisos@tu-comunidad.app',
            subject: 'Resumen semanal',
            preview: 'Tus novedades estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n listas en la app.',
            dateLabel: 'Ayer',
            text: 'Tus novedades estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n listas. Revisa desde la app si quieres verlas.',
            body: ['Tus novedades estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n listas.', 'Entra a la app oficial para revisarlas.'],
            details: {
              from: 'Comunidad <avisos@tu-comunidad.app>',
              replyTo: 'no-reply@tu-comunidad.app',
              returnPath: 'mailer@tu-comunidad.app',
            },
            correcto: 'seguro',
            explicacion: 'No te pide datos ni te apura.',
          },
          {
            id: 'e3',
            displayName: 'Soporte de cuenta',
            from: 'soporte@cuenta-ayuda.org',
            subject: 'Actualiza tu contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a',
            preview: 'Reingresa tus datos para conservar acceso.',
            dateLabel: 'Mar 28',
            text: 'Tu contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a expirarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ hoy. Reingresa tus datos desde este enlace para conservar acceso.',
            body: [
              'Tu contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a expirarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ hoy.',
              'Reingresa tus datos desde este enlace para conservar acceso.',
            ],
            details: {
              from: 'Soporte de cuenta <soporte@cuenta-ayuda.org>',
              replyTo: 'soporte@cuenta-ayuda.org',
              returnPath: 'mailer@cuenta-ayuda.org',
            },
            ctaLabel: 'Actualizar contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a',
            linkPreview: 'https://cuenta-ayuda.org/login',
            correcto: 'estafa',
            explicacion: 'Te empuja a escribir credenciales en un sitio controlado por el atacante.',
          },
          {
            id: 'e4',
            displayName: 'Seguridad',
            from: 'seguridad@app-cuenta.com',
            subject: 'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos',
            preview: 'Recuerda verificar desde canales oficiales.',
            dateLabel: 'Mar 26',
            text: 'Si recibes avisos inesperados, verifica desde la app oficial. Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos.',
            body: [
              'Si recibes avisos inesperados, verifica desde la app oficial.',
              'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos.',
            ],
            details: {
              from: 'Seguridad <seguridad@app-cuenta.com>',
              replyTo: 'no-reply@app-cuenta.com',
              returnPath: 'mailer@app-cuenta.com',
            },
            correcto: 'seguro',
            explicacion: 'Es un recordatorio preventivo y no te arrastra a un flujo de riesgo.',
          },
        ],
        huntMessage: 'Tu cuenta fue reportada. Verifica tu identidad en menos de una hora para no perder el acceso.',
      },
    ],
    refuerzo: [
      {
        key: 'nombre-visible',
        inbox: [
          {
            id: 'e1',
            displayName: 'Soporte de NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mina',
            from: 'notificaciones@pagos-soporte.co',
            subject: 'ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de datos bancarios',
            preview: 'Completa la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n antes del cierre.',
            dateLabel: 'Hoy',
            warning: 'Ten cuidado con este mensaje',
            text: 'Necesitamos actualizar tus datos bancarios antes del cierre. Completa la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con tu cuenta y CLABE.',
            body: [
              'Hola,',
              'Necesitamos actualizar tus datos bancarios antes del cierre del dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.',
              'Completa la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con tu cuenta y CLABE para evitar retrasos.',
            ],
            details: {
              from: 'Soporte de NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mina <notificaciones@pagos-soporte.co>',
              replyTo: 'validacion@pagos-soporte.co',
              returnPath: 'bounce@mailer.pagos-soporte.co',
            },
            ctaLabel: 'Completar validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
            linkPreview: 'https://pagos-soporte.co/actualiza',
            correcto: 'estafa',
            explicacion: 'Suena laboral, pero te pide datos bancarios por correo.',
          },
          {
            id: 'e2',
            displayName: 'Seguridad de cuenta',
            from: 'alertas@app-segura.com',
            subject: 'Intento de acceso',
            preview: 'Revisa desde tu app si no reconoces la actividad.',
            dateLabel: 'Hoy',
            text: 'Detectamos un intento de acceso. Si no lo reconoces, entra a tu app o al sitio que escribes tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº normalmente.',
            body: [
              'Detectamos un intento de acceso.',
              'Si no lo reconoces, entra a tu app o al sitio que escribes tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº normalmente.',
            ],
            details: {
              from: 'Seguridad de cuenta <alertas@app-segura.com>',
              replyTo: 'no-reply@app-segura.com',
              returnPath: 'mailer@app-segura.com',
            },
            correcto: 'seguro',
            explicacion: 'Te lleva a verificar por tus propios canales, no desde un enlace sospechoso.',
          },
          {
            id: 'e3',
            displayName: 'Compras Premium',
            from: 'compras@premium-club.vip',
            subject: 'Pago rechazado',
            preview: 'Actualiza tu tarjeta desde el portal temporal.',
            dateLabel: 'Ayer',
            warning: 'Este mensaje parece peligroso',
            text: 'Tu pago fue rechazado. Actualiza tu tarjeta desde el portal temporal para no perder tu membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.',
            body: [
              'Tu pago fue rechazado.',
              'Actualiza tu tarjeta desde el portal temporal para no perder tu membresÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.',
            ],
            details: {
              from: 'Compras Premium <compras@premium-club.vip>',
              replyTo: 'pagos@premium-club.vip',
              returnPath: 'mailer@premium-club.vip',
            },
            ctaLabel: 'Actualizar tarjeta',
            linkPreview: 'https://premium-club.vip/portal-temporal',
            correcto: 'estafa',
            explicacion: 'Un portal temporal y urgencia sobre pagos son seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales claras.',
          },
          {
            id: 'e4',
            displayName: 'Comunidad',
            from: 'avisos@comunidad.app',
            subject: 'Resumen semanal',
            preview: 'Tus novedades estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n listas.',
            dateLabel: 'Mar 29',
            text: 'Tus novedades estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n listas. Puedes verlas desde la app cuando quieras.',
            body: ['Tus novedades estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡n listas.', 'Puedes verlas desde la app cuando quieras.'],
            details: {
              from: 'Comunidad <avisos@comunidad.app>',
              replyTo: 'no-reply@comunidad.app',
              returnPath: 'mailer@comunidad.app',
            },
            correcto: 'seguro',
            explicacion: 'No mete urgencia ni pide datos.',
          },
        ],
        huntMessage: 'Completa la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tu cuenta bancaria antes del cierre del dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a para no afectar tu pago.',
      },
      {
        key: 'reply-to',
        inbox: [
          {
            id: 'e1',
            displayName: 'AtenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n clientes',
            from: 'alerta@cliente-servicios.com',
            subject: 'ConfirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n pendiente',
            preview: 'Responde este correo con tu nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero y fecha de nacimiento.',
            dateLabel: 'Hoy',
            warning: 'Este mensaje parece peligroso',
            text: 'Para terminar tu proceso, responde este correo con tu nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero y fecha de nacimiento.',
            body: [
              'Para terminar tu proceso, responde este correo con tu nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero y fecha de nacimiento.',
              'Si no lo haces hoy, el folio se cerrarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡.',
            ],
            details: {
              from: 'AtenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n clientes <alerta@cliente-servicios.com>',
              replyTo: 'validacion@cliente-servicios-help.net',
              returnPath: 'mailer@cliente-servicios-help.net',
            },
            ctaLabel: 'Responder ahora',
            linkPreview: 'Responder directo al mensaje',
            correcto: 'estafa',
            explicacion: 'El Reply-To cambia de dominio y pide datos personales.',
          },
          {
            id: 'e2',
            displayName: 'Seguridad',
            from: 'seguridad@app-cuenta.com',
            subject: 'Consejo del dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a',
            preview: 'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos por chat o llamada.',
            dateLabel: 'Ayer',
            text: 'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos por chat o llamada. Si algo te preocupa, entra a la app oficial.',
            body: [
              'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos por chat o llamada.',
              'Si algo te preocupa, entra a la app oficial.',
            ],
            details: {
              from: 'Seguridad <seguridad@app-cuenta.com>',
              replyTo: 'no-reply@app-cuenta.com',
              returnPath: 'mailer@app-cuenta.com',
            },
            correcto: 'seguro',
            explicacion: 'Es un mensaje preventivo y no te pide datos ni clics raros.',
          },
          {
            id: 'e3',
            displayName: 'Aviso financiero',
            from: 'avisos@finanzas-clientes.org',
            subject: 'Documento pendiente',
            preview: 'Descarga el PDF y confÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­rmalo hoy.',
            dateLabel: 'Mar 28',
            warning: 'Ten cuidado con este mensaje',
            text: 'Descarga el PDF adjunto y confÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­rmalo hoy para liberar el documento pendiente.',
            body: [
              'Descarga el PDF adjunto y confÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­rmalo hoy para liberar el documento pendiente.',
            ],
            attachments: ['documento_pendiente.docm'],
            details: {
              from: 'Aviso financiero <avisos@finanzas-clientes.org>',
              replyTo: 'avisos@finanzas-clientes.org',
              returnPath: 'mailer@finanzas-clientes.org',
            },
            ctaLabel: 'Descargar documento',
            linkPreview: 'Descarga adjunto .docm',
            correcto: 'estafa',
            explicacion: 'Adjunto macro y urgencia: alto riesgo.',
          },
          {
            id: 'e4',
            displayName: 'ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de servicio',
            from: 'avisos@app-servicio.com',
            subject: 'Resumen mensual',
            preview: 'Consulta desde tu app los cambios recientes.',
            dateLabel: 'Mar 25',
            text: 'Consulta desde tu app los cambios recientes en tu cuenta.',
            body: ['Consulta desde tu app los cambios recientes en tu cuenta.'],
            details: {
              from: 'ActualizaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de servicio <avisos@app-servicio.com>',
              replyTo: 'no-reply@app-servicio.com',
              returnPath: 'mailer@app-servicio.com',
            },
            correcto: 'seguro',
            explicacion: 'No presiona y dirige al usuario a la app que ya conoce.',
          },
        ],
        huntMessage: 'Responde con tus datos hoy o cerraremos el folio. El correo parece normal, pero el Reply-To cambia.',
      },
    ],
    avanzado: [
      {
        key: 'dominio-sutil',
        inbox: [
          {
            id: 'e1',
            displayName: 'Equipo de seguridad',
            from: 'alerts@cuentasegura.co',
            subject: 'Actividad inusual en tu cuenta',
            preview: 'Revisa el cambio desde el portal de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
            dateLabel: 'Hoy',
            warning: 'Ten cuidado con este mensaje',
            text: 'Detectamos un cambio de dispositivo. Para revisar el evento, entra al portal de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n que aparece abajo.',
            body: [
              'Detectamos un cambio de dispositivo.',
              'Para revisar el evento, entra al portal de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n que aparece abajo.',
              'Si no validas hoy, el acceso se limitarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ temporalmente.',
            ],
            details: {
              from: 'Equipo de seguridad <alerts@cuentasegura.co>',
              replyTo: 'alerts@cuentasegura.co',
              returnPath: 'mailer@cuentasegura.co',
            },
            ctaLabel: 'Abrir portal de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
            linkPreview: 'https://cuentasegura.co/portal/validacion',
            correcto: 'estafa',
            explicacion: 'El dominio se ve plausible, pero te saca a un portal de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n no verificado.',
          },
          {
            id: 'e2',
            displayName: 'Aviso de cuenta',
            from: 'seguridad@app-cuenta.com',
            subject: 'Intento de acceso detectado',
            preview: 'Si no fuiste tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº, revisa la app oficial.',
            dateLabel: 'Hoy',
            text: 'Detectamos un intento de acceso. Si no fuiste tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº, revisa la app oficial desde tu dispositivo.',
            body: [
              'Detectamos un intento de acceso.',
              'Si no fuiste tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº, revisa la app oficial desde tu dispositivo.',
            ],
            details: {
              from: 'Aviso de cuenta <seguridad@app-cuenta.com>',
              replyTo: 'no-reply@app-cuenta.com',
              returnPath: 'mailer@app-cuenta.com',
            },
            correcto: 'seguro',
            explicacion: 'Te lleva a tu propio canal, no a uno controlado por el mensaje.',
          },
          {
            id: 'e3',
            displayName: 'Compras Terra',
            from: 'ventas@terra-clientes.com',
            subject: 'Necesitamos validar tu compra',
            preview: 'Confirma el comprobante y tu nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero para liberar el envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o.',
            dateLabel: 'Ayer',
            text: 'Tu compra ya estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ capturada. Solo falta confirmar el comprobante y tu nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero para liberar el envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o hoy.',
            body: [
              'Tu compra ya estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ capturada.',
              'Solo falta confirmar el comprobante y tu nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero para liberar el envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o hoy.',
            ],
            details: {
              from: 'Compras Terra <ventas@terra-clientes.com>',
              replyTo: 'pagos@terra-clientes-help.net',
              returnPath: 'mailer@terra-clientes-help.net',
            },
            ctaLabel: 'Confirmar compra',
            linkPreview: 'https://terra-clientes-help.net/checkout',
            correcto: 'estafa',
            explicacion: 'Cambia el Reply-To y pide comprobante fuera del flujo real.',
          },
          {
            id: 'e4',
            displayName: 'BoletÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­n',
            from: 'boletin@comunidad.app',
            subject: 'Resumen de la semana',
            preview: 'Disponible en la app cuando quieras.',
            dateLabel: 'Mar 29',
            text: 'Tu resumen estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ disponible en la app cuando quieras revisarlo.',
            body: ['Tu resumen estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ disponible en la app cuando quieras revisarlo.'],
            details: {
              from: 'BoletÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­n <boletin@comunidad.app>',
              replyTo: 'no-reply@comunidad.app',
              returnPath: 'mailer@comunidad.app',
            },
            correcto: 'seguro',
            explicacion: 'No hay urgencia ni un flujo externo peligroso.',
          },
        ],
        huntMessage: 'Para revisar la actividad inusual, entra al portal de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n hoy. El dominio se ve razonable, pero no es el oficial.',
      },
      {
        key: 'firma-creible',
        inbox: [
          {
            id: 'e1',
            displayName: 'Servicio al cliente',
            from: 'notificaciones@cliente-total.com',
            subject: 'Seguimiento de caso',
            preview: 'Confirma tu identidad para cerrar el ticket.',
            dateLabel: 'Hoy',
            warning: 'Ten cuidado con este mensaje',
            text: 'Para cerrar tu ticket, confirma tu identidad y adjunta el comprobante mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s reciente.',
            body: [
              'Hola,',
              'Para cerrar tu ticket necesitamos confirmar tu identidad y adjuntar el comprobante mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s reciente.',
              'Gracias por tu atenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
              'Servicio al cliente',
            ],
            details: {
              from: 'Servicio al cliente <notificaciones@cliente-total.com>',
              replyTo: 'casos@cliente-total-help.com',
              returnPath: 'mailer@cliente-total-help.com',
            },
            ctaLabel: 'Responder ticket',
            linkPreview: 'Responder con documento y comprobante',
            correcto: 'estafa',
            explicacion: 'La firma se ve normal, pero el Reply-To y la peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n son riesgosos.',
          },
          {
            id: 'e2',
            displayName: 'Seguridad',
            from: 'alertas@app-cuenta.com',
            subject: 'Revisa tu historial',
            preview: 'Hazlo desde tu app si no reconoces una operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
            dateLabel: 'Hoy',
            text: 'Si no reconoces una operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, revisa tu historial en la app o portal que ya utilizas.',
            body: [
              'Si no reconoces una operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, revisa tu historial en la app o portal que ya utilizas.',
            ],
            details: {
              from: 'Seguridad <alertas@app-cuenta.com>',
              replyTo: 'no-reply@app-cuenta.com',
              returnPath: 'mailer@app-cuenta.com',
            },
            correcto: 'seguro',
            explicacion: 'Invita a verificar por tu cuenta, sin pedir datos.',
          },
          {
            id: 'e3',
            displayName: 'Promociones Plus',
            from: 'promos@plus-beneficios.co',
            subject: 'Oferta exclusiva por tiempo limitado',
            preview: 'ActÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vala desde el enlace seguro.',
            dateLabel: 'Ayer',
            text: 'Activa tu beneficio exclusivo desde el enlace seguro. Solo aplica hoy.',
            body: [
              'Activa tu beneficio exclusivo desde el enlace seguro.',
              'Solo aplica hoy.',
            ],
            details: {
              from: 'Promociones Plus <promos@plus-beneficios.co>',
              replyTo: 'promos@plus-beneficios.co',
              returnPath: 'mailer@plus-beneficios.co',
            },
            ctaLabel: 'Activar beneficio',
            linkPreview: 'https://plus-beneficios.co/beneficio',
            correcto: 'estafa',
            explicacion: 'La urgencia y el dominio poco conocido vuelven la oferta sospechosa.',
          },
          {
            id: 'e4',
            displayName: 'BoletÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­n de seguridad',
            from: 'seguridad@servicio.app',
            subject: 'Consejos del mes',
            preview: 'Recuerda revisar por canales oficiales.',
            dateLabel: 'Mar 28',
            text: 'Recuerda revisar por canales oficiales si recibes un aviso inesperado.',
            body: ['Recuerda revisar por canales oficiales si recibes un aviso inesperado.'],
            details: {
              from: 'BoletÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­n de seguridad <seguridad@servicio.app>',
              replyTo: 'no-reply@servicio.app',
              returnPath: 'mailer@servicio.app',
            },
            correcto: 'seguro',
            explicacion: 'Es solo una recomendaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n preventiva.',
          },
        ],
        huntMessage: 'El correo se ve profesional y trae una firma completa, pero te pide identidad y comprobante por ese mismo hilo.',
      },
    ],
  };

  const scenario = scenarioSets[modNivel][variant % scenarioSets[modNivel].length];
  const activities = [
      mk(1, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
        tipo: 'concepto',
        titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© revisar en un correo sospechoso',
        bloques: buildConceptBlocks([
          { titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales de alerta', texto: 'Urgencia, adjuntos inesperados, dominios raros o botones que piden validar datos.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© quiere el estafador', texto: 'Que abras un adjunto, des clic en un enlace o entregues datos sensibles.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© hacer ahora (pasos)', texto: 'Revisa remitente real, Reply-To, adjuntos y verifica por la app o sitio oficial.' },
          { titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', texto: 'Si no esperabas el mensaje, no abras archivos ni enlaces antes de confirmar.' },
        ]),
        contenido:
          'Un correo puede verse profesional y aun asÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ ser phishing. Lo importante es revisar el remitente real, el motivo y si te empuja a salir del canal oficial.',
        peso: 0.9,
      }),
      mk(2, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-inbox`, variant }),
        tipo: 'inbox',
        titulo: 'Inbox simulada',
        kind: 'correo',
        intro: 'Abre cada correo, revÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­salo y clasifÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­calo como Seguro o Sospechoso.',
        mensajes: scenario.inbox,
        peso: 1.6,
      }),
      mk(3, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-hunt`, variant }),
        tipo: 'signal_hunt',
        titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ala la pista clave',
        mensaje: scenario.huntMessage,
        senales: [
          { id: 'p1', label: 'Urgencia o plazo corto', correcta: true, explicacion: 'Busca que decidas sin verificar.' },
          { id: 'p2', label: 'Pide datos, adjuntos o comprobantes', correcta: true, explicacion: 'Es informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sensible.' },
          { id: 'p3', label: 'Canal de validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n no oficial', correcta: true, explicacion: 'Te saca del flujo real de la cuenta.' },
          { id: 'p4', label: 'Buen diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o o firma', correcta: false, explicacion: 'La presentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n no prueba legitimidad.' },
        ],
        peso: 1.1,
      }),
      mk(4, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-decision`, variant }),
        tipo: 'quiz',
        titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© harÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as primero',
        escenario: 'Abres un correo inesperado con botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y adjunto. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡l es el paso mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s seguro?',
        opciones: [
          'Abrir el adjunto para entender mejor.',
          'Verificar por la app o canal oficial antes de tocar el archivo o el botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          'Responder con tus datos para cerrar el tema.',
          'Reenviar el correo a otra persona para que lo abra.',
        ],
        correcta: 1,
        explicacion: 'Lo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s seguro es salir del mensaje y verificar por un canal que tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº controles.',
        senal: 'El mensaje intenta llevarte a un flujo externo con urgencia o adjuntos.',
        riesgo: 'Un clic puede abrir malware o robar credenciales.',
        accion: 'No abras archivos ni enlaces antes de confirmar por la app o web oficial.',
        peso: 1.0,
      }),
      mk(5, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-abierta`, variant }),
        tipo: 'abierta',
        titulo: 'Tu regla anti-phishing',
        prompt: 'Escribe una regla corta que seguirÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s cuando un correo o mensaje te pida validar datos o descargar algo.',
        pistas: ['reviso remitente real', 'no abro adjuntos inesperados', 'verifico por canal oficial'],
        peso: 1.0,
      }),
      mk(6, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
        tipo: 'checklist',
        titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido de phishing',
        intro: 'Antes de confiar en un correo o DM:',
        items: [
          'Verifica remitente real y Reply-To.',
          'No abras adjuntos inesperados.',
          'No entregues datos ni comprobantes por correo.',
          'Verifica desde tu app o sitio oficial.',
        ],
        peso: 1.0,
      }),
  ];

  const selectedActivities =
    modNivel === 'basico'
      ? activities
      : modNivel === 'refuerzo'
        ? [activities[1], activities[2], activities[3], activities[5], activities[4]]
        : [activities[1], activities[3], activities[2], activities[4], activities[5]];

  return sanitizeCoursePayload({
    id: modId,
    titulo: 'Llamadas Fraudulentas',
    descripcion: `Entrenamiento ${levelHint} para cortar vishing con criterio ${toneNote}.`,
    categoria: cat,
    nivel: modNivel,
    actividades: arrangeModuleActivities({
      category: cat,
      level: modNivel,
      variant,
      activities: selectedActivities,
    }),
  });
};

const buildCallModule = ({ modId, cat, modNivel, toneNote, levelHint, mk, variant }) => {
  const scenarioSets = {
    basico: [
      {
        key: 'banco-otp',
        callerName: 'Seguridad bancaria',
        callerNumber: 'NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oculto',
        opening:
          'Detectamos un cargo sospechoso. Para cancelarlo necesito el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo que te acaba de llegar por SMS.',
        steps: [
          {
            texto: 'La supuesta agente te dice que el movimiento sigue ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“en procesoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â y que necesitas dar el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo en ese momento.',
            opciones: [
              { id: 'c1', texto: 'Dar el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo para cancelar rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', puntaje: 0.1, feedback: 'Riesgosa. El cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo es la llave que el estafador necesita.' },
              { id: 'c2', texto: 'Colgar y revisar la app o llamar al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial', puntaje: 1, feedback: 'Buena. TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº retomas el control por un canal real.' },
              { id: 'c3', texto: 'Seguir escuchando para ver si convence mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s', puntaje: 0.4, feedback: 'Regular. Mientras sigues en la llamada, el estafador controla la presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
            ],
          },
          {
            texto: 'Antes de colgar, insiste: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Si cuelgas, el cargo se confirmaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'c4', texto: 'Ignorar la presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y cortar', puntaje: 1, feedback: 'Buena. Esa urgencia es parte de la estafa.' },
              { id: 'c5', texto: 'Quedarte en lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nea para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“protegerÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â la cuenta', puntaje: 0.2, feedback: 'Riesgosa. Un banco real no te obliga a seguir en la llamada.' },
            ],
          },
        ],
      },
      {
        key: 'cargo-extra',
        callerName: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Ârea de fraude',
        callerNumber: 'Llamada entrante',
        opening:
          'Vemos un cargo no reconocido. Para detenerlo, confirma tu identidad y el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo temporal que te enviamos.',
        steps: [
          {
            texto: 'La llamada suena convincente y parece traer informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n parcial de tu cuenta.',
            opciones: [
              { id: 'c1', texto: 'Compartir los datos para salir de dudas', puntaje: 0.2, feedback: 'Riesgosa. Esa combinaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de datos + cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo expone tu cuenta.' },
              { id: 'c2', texto: 'Colgar y entrar a la app por tu cuenta', puntaje: 1, feedback: 'Buena. La verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n debe iniciar de tu lado.' },
              { id: 'c3', texto: 'Pedir que te llamen luego y seguir conversando', puntaje: 0.5, feedback: 'Regular. Mejor corta y busca tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº el canal oficial.' },
            ],
          },
          {
            texto: 'DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s insiste con mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s urgencia para evitar que ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“se procese el cargoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'c4', texto: 'Cortar sin dar mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', puntaje: 1, feedback: 'Correcto. No necesitas convencerlos, necesitas salir de la llamada.' },
              { id: 'c5', texto: 'Seguir para escuchar el ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“procedimientoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.3, feedback: 'Riesgosa. Te mantienen dentro del guion del fraude.' },
            ],
          },
        ],
      },
    ],
    refuerzo: [
      {
        key: 'caller-id',
        callerName: 'Mesa de seguridad',
        callerNumber: 'NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero similar al banco',
        opening:
          'Hablo del ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea de seguridad. Tenemos un intento de acceso y necesito confirmar tu nombre completo y los ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltimos movimientos.',
        steps: [
          {
            texto: 'La llamada usa tono profesional y conoce datos bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sicos tuyos.',
            opciones: [
              { id: 'c1', texto: 'Responder porque ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ saben quiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n soyÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.2, feedback: 'Riesgosa. Tener datos bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sicos no prueba que sea legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timo.' },
              { id: 'c2', texto: 'Pedir folio, colgar y validar desde la app o el nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial', puntaje: 1, feedback: 'Buena. Tomas nota, pero verificas fuera de la llamada.' },
              { id: 'c3', texto: 'Pedir que te transfieran a otro agente sin colgar', puntaje: 0.5, feedback: 'Regular. Sigues dentro del canal del estafador.' },
            ],
          },
          {
            texto: 'Ahora te piden mover tu dinero a una ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“cuenta seguraÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â para protegerlo.',
            opciones: [
              { id: 'c4', texto: 'Aceptar si prometen revertirlo despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s', puntaje: 0.1, feedback: 'Muy riesgosa. ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Cuenta seguraÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â es una tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ctica clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sica de vishing.' },
              { id: 'c5', texto: 'Negarte, colgar y comunicarte tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº con la instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', puntaje: 1, feedback: 'Correcto. Ninguna instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n te pide mover dinero por telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono.' },
            ],
          },
        ],
      },
      {
        key: 'robollamada',
        callerName: 'Sistema automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tico',
        callerNumber: 'Llamada automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica',
        opening:
          'Sistema de seguridad. Se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ una operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Presiona 1 para hablar con un agente y proteger tu cuenta.',
        steps: [
          {
            texto: 'DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s de presionar 1, una persona te pide confirmar tu tarjeta ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“para ayudarteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'c1', texto: 'Seguir porque la llamada empezÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.2, feedback: 'Riesgosa. Una robollamada no valida la autenticidad.' },
              { id: 'c2', texto: 'Colgar y llamar tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial', puntaje: 1, feedback: 'Buena. Rompes el flujo que el estafador controla.' },
              { id: 'c3', texto: 'Dar solo parte de los datos', puntaje: 0.3, feedback: 'Riesgosa. Cualquier dato puede usarse para manipularte.' },
            ],
          },
          {
            texto: 'El ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“agenteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â te mete presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Si cuelgas, ya no podremos ayudarteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'c4', texto: 'Cortar y revisar la app', puntaje: 1, feedback: 'Correcto. La urgencia es parte del engaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o.' },
              { id: 'c5', texto: 'Quedarte por miedo a perder la ayuda', puntaje: 0.3, feedback: 'Riesgosa. Esa frase busca que no verifiques por tu cuenta.' },
            ],
          },
        ],
      },
    ],
    avanzado: [
      {
        key: 'cuenta-segura',
        callerName: 'Monitoreo de fraudes',
        callerNumber: 'Identificador similar a la instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
        opening:
          'Estamos intentando contener una posible filtraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Para blindar tu cuenta, necesitamos mover temporalmente el saldo a una cuenta protegida.',
        steps: [
          {
            texto: 'La persona habla con calma, no usa groserÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as y responde con seguridad.',
            opciones: [
              { id: 'c1', texto: 'Seguir por lo profesional del tono', puntaje: 0.2, feedback: 'Riesgosa. El tono profesional no reemplaza la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
              { id: 'c2', texto: 'Cortar y revisar la app; si hace falta, llamar tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº a la instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', puntaje: 1, feedback: 'Buena. Lo seguro es confirmar por un canal propio.' },
              { id: 'c3', texto: 'Pedir que te manden un correo y seguir la llamada', puntaje: 0.5, feedback: 'Regular. Sigues aceptando su canal y su ritmo.' },
            ],
          },
          {
            texto: 'DespuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s te dicen que no hagas preguntas a otros ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“para no alertar al sistemaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'c4', texto: 'Desconfiar y colgar de inmediato', puntaje: 1, feedback: 'Correcto. El secreto es una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al de manipulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
              { id: 'c5', texto: 'Seguir solo un poco mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s', puntaje: 0.3, feedback: 'Riesgosa. Esa presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sutil sigue siendo estafa.' },
            ],
          },
        ],
      },
      {
        key: 'app-remota',
        callerName: 'Centro de protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
        callerNumber: 'NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero con apariencia legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tima',
        opening:
          'Te vamos a ayudar a proteger tu cuenta. Instala una app de soporte y sigue mis pasos para bloquear el acceso sospechoso.',
        steps: [
          {
            texto: 'La persona dice que la app es solo para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“diagnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sticoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â y que no verÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ tus datos.',
            opciones: [
              { id: 'c1', texto: 'Instalarla para resolver rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', puntaje: 0.1, feedback: 'Muy riesgosa. Una app remota puede dar control total al atacante.' },
              { id: 'c2', texto: 'Negarte y verificar por tu app o soporte oficial', puntaje: 1, feedback: 'Buena. Una instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n no te dicta instalaciones por llamada entrante.' },
              { id: 'c3', texto: 'Pedir el nombre de la app y buscarla luego', puntaje: 0.5, feedback: 'Regular. Primero corta; luego valida por un canal oficial.' },
            ],
          },
          {
            texto: 'Para convencerte, promete que asÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ganas prioridad de atenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'c4', texto: 'No aceptar y cortar', puntaje: 1, feedback: 'Correcto. El beneficio aparente es parte de la manipulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
              { id: 'c5', texto: 'Aceptar si la app tiene buenas reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as', puntaje: 0.3, feedback: 'Riesgosa. El canal sigue siendo controlado por la llamada.' },
            ],
          },
        ],
      },
    ],
  };

  const scenario = scenarioSets[modNivel][variant % scenarioSets[modNivel].length];
  const selectedActivities = (() => {
    const concept = mk(1, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
      tipo: 'concepto',
      titulo: 'Tu rutina en 4 pasos',
      bloques: buildConceptBlocks([
        { titulo: 'Pausa', texto: 'No decidas con prisa. Si algo mete urgencia, respira y separa emociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
        { titulo: 'Verifica', texto: 'Revisa remitente, dominio o identidad antes de abrir enlaces o mover dinero.' },
        { titulo: 'Confirma', texto: 'Usa un canal oficial o independiente que tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº controles.' },
        { titulo: 'Protege', texto: 'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni datos sensibles por mensaje o llamada.' },
      ]),
      contenido:
        'No necesitas memorizar todas las estafas. Una rutina corta y constante te ayuda a reaccionar mejor en casi cualquier canal.',
      peso: 0.8,
    });
    const flow = mk(2, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-flow`, variant }),
      tipo: 'scenario_flow',
      titulo: 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© harÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as siÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦?',
      intro: 'Practica tu rutina en situaciones cortas y cotidianas.',
      pasos: scenario.flow,
      peso: 1.3,
    });
    const quiz1 = mk(3, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-quiz-1`, variant }),
      tipo: 'quiz',
      titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© va primero',
      escenario: 'Cuando un mensaje te pide actuar rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces primero?',
      opciones: [
        'ActÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºo para no perder tiempo.',
        'Pauso y verifico por un canal confiable.',
        'Comparto el mensaje para que alguien me diga.',
        'Respondo con los datos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimos.',
      ],
      correcta: 1,
      explicacion: 'La rutina segura siempre empieza con una pausa y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
      senal: 'La urgencia busca saltarse tu proceso mental.',
      riesgo: 'Decidir con prisa te hace mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s vulnerable a errores.',
      accion: 'Pausa, revisa la seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al principal y confirma por un canal oficial.',
      peso: 1.0,
    });
    const quiz2 = mk(4, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-quiz-2`, variant }),
      tipo: 'quiz',
      titulo: 'ComparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida',
      escenario: 'Una oferta se ve bien y el mensaje estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ bien escrito. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© pesa mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s en tu decisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n?',
      opciones: [
        'La buena redacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
        'La emociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de aprovechar el momento.',
        'Las verificaciones que puedes hacer fuera del mensaje.',
        'Que otra persona tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n la vio.',
      ],
      correcta: 2,
      explicacion: 'Lo que mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s vale es lo que puedes verificar por tu cuenta, no cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo se ve el mensaje.',
      senal: 'La estafa avanzada se apoya en buena presentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y contexto realista.',
      riesgo: 'Si confÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as por apariencia, te saltas la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n importante.',
      accion: 'Sigue tu rutina: verifica identidad, canal y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo antes de actuar.',
      peso: 1.0,
    });
    const checklist = mk(5, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
      tipo: 'checklist',
      titulo: 'Mi rutina personal',
      intro: 'Marca los pasos que quieres convertir en hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡bito:',
      items: [
        'Pauso antes de abrir enlaces o pagar.',
        'Verifico remitente, nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero o dominio.',
        'Confirmo por app, web o telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono oficial.',
        'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni datos sensibles.',
        'Bloqueo o reporto si la seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al es clara.',
      ],
      peso: 1.0,
    });
    const openResponse = mk(6, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-regla`, variant }),
      tipo: 'abierta',
      titulo: 'Tu regla de oro',
      prompt: 'Escribe una frase corta que puedas recordar cuando algo te meta presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n digital.',
      pistas: ['pauso', 'verifico', 'canal oficial'],
      peso: 1.0,
    });

    return modNivel === 'basico'
      ? [concept, flow, quiz1, quiz2, checklist, openResponse]
      : modNivel === 'refuerzo'
        ? [flow, quiz1, checklist, openResponse, quiz2]
        : [flow, quiz2, openResponse, checklist];
  })();
  const callSelectedActivities = (() => {
    const concept = mk(1, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
      tipo: 'concepto',
      titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© nunca debes hacer en una llamada',
      bloques: buildConceptBlocks([
        { titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales de alerta', texto: 'Urgencia, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos OTP, ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“cuenta seguraÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â, apps remotas o presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para no colgar.' },
        { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© quiere el estafador', texto: 'Que tomes decisiones dentro de la llamada y compartas datos o muevas dinero.' },
        { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© hacer ahora', texto: 'Cuelga, entra a tu app o marca tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial y explica la situaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
        { titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', texto: 'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as por llamada entrante.' },
      ]),
      contenido:
        'Una llamada puede sonar profesional y seguir siendo fraude. La clave es no resolver nada dentro de la llamada: cuelga y verifica por tu cuenta.',
      peso: 0.9,
    });
    const simulation = mk(2, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-call`, variant }),
      tipo: 'call_sim',
      titulo: 'SimulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de llamada',
      intro: 'Escucha o lee la llamada y decide cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo responder.',
      callerName: scenario.callerName,
      callerNumber: scenario.callerNumber,
      opening: scenario.opening,
      steps: scenario.steps,
      allowVoice: true,
      voiceProfile: variant % 2 === 0 ? 'female' : 'male',
      peso: 1.6,
    });
    const hunt = mk(3, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-hunt`, variant }),
      tipo: 'signal_hunt',
      titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales que debes escuchar',
      mensaje: `${scenario.opening} Si cuelgas, perderÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s la protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.`,
      senales: [
        { id: 'l1', label: 'Pide cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos o datos sensibles', correcta: true, explicacion: 'Ninguna instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tima te lo pide por llamada entrante.' },
        { id: 'l2', label: 'Urgencia o amenaza si cuelgas', correcta: true, explicacion: 'La prisa es una tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica para bloquear tu verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
        { id: 'l3', label: 'Propone mover dinero o instalar algo', correcta: true, explicacion: 'Es una acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de alto riesgo controlada por el atacante.' },
        { id: 'l4', label: 'Tono profesional', correcta: false, explicacion: 'Eso no demuestra autenticidad.' },
      ],
      peso: 1.1,
    });
    const decision = mk(4, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-decision`, variant }),
      tipo: 'quiz',
      titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces al colgar',
      escenario: 'TerminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la llamada. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© paso sigue si quieres estar seguro?',
      opciones: [
        'Volver a contestar para pedir mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s detalles.',
        'Entrar a la app o llamar tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial de la instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
        'Mandar por mensaje los datos que te pidieron.',
        'Esperar a que el ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“agenteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â vuelva a marcar.',
      ],
      correcta: 1,
      explicacion: 'La acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n segura es iniciar la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por un canal oficial controlado por ti.',
      senal: 'La llamada intentÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ retenerte dentro de su propio canal.',
      riesgo: 'Si sigues el flujo del estafador, puede robar datos o dinero.',
      accion: 'Cuelga, revisa la app y, si hace falta, llama tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial.',
      peso: 1.0,
    });
    const openResponse = mk(5, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-abierta`, variant }),
      tipo: 'abierta',
      titulo: 'Tu frase para cortar',
      prompt: 'Escribe una frase breve y firme para colgar una llamada sospechosa sin engancharte en la conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
      pistas: ['voy a verificar por mi cuenta', 'no comparto datos', 'gracias, hasta luego'],
      peso: 1.0,
    });
    const checklist = mk(6, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
      tipo: 'checklist',
      titulo: 'Checklist de llamadas',
      intro: 'Si una llamada te mete presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n:',
      items: [
        'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.',
        'No muevas dinero a cuentas ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“segurasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
        'No instales apps por instrucciones de una llamada entrante.',
        'Cuelga y llama tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial.',
      ],
      peso: 1.0,
    });

    return modNivel === 'basico'
      ? [concept, simulation, hunt, decision, openResponse, checklist]
      : modNivel === 'refuerzo'
        ? [simulation, hunt, decision, checklist, openResponse]
        : [simulation, decision, hunt, openResponse, checklist];
  })();
  return sanitizeCoursePayload({
    id: modId,
    titulo: 'Llamadas Fraudulentas',
    descripcion: `Entrenamiento ${levelHint} para cortar vishing con criterio ${toneNote}.`,
    categoria: cat,
    nivel: modNivel,
    actividades: arrangeModuleActivities({
      category: cat,
      level: modNivel,
      variant,
      activities: callSelectedActivities.length ? callSelectedActivities : [
      mk(1, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
        tipo: 'concepto',
        titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© nunca debes hacer en una llamada',
        bloques: buildConceptBlocks([
          { titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales de alerta', texto: 'Urgencia, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos OTP, ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“cuenta seguraÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â, apps remotas o presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para no colgar.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© quiere el estafador', texto: 'Que tomes decisiones dentro de la llamada y compartas datos o muevas dinero.' },
          { titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© hacer ahora (pasos)', texto: 'Cuelga, entra a tu app o marca tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial y explica la situaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
          { titulo: 'Checklist rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', texto: 'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as por llamada entrante.' },
        ]),
        contenido:
          'Una llamada puede sonar profesional y seguir siendo fraude. La clave es no resolver nada dentro de la llamada: cuelga y verifica por tu cuenta.',
        peso: 0.9,
      }),
      mk(2, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-call`, variant }),
        tipo: 'call_sim',
        titulo: 'SimulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de llamada',
        intro: 'Escucha o lee la llamada y decide cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo responder.',
        callerName: scenario.callerName,
        callerNumber: scenario.callerNumber,
        opening: scenario.opening,
        steps: scenario.steps,
        allowVoice: true,
        voiceProfile: variant % 2 === 0 ? 'female' : 'male',
        peso: 1.6,
      }),
      mk(3, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-hunt`, variant }),
        tipo: 'signal_hunt',
        titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales que debes escuchar',
        mensaje: `${scenario.opening} Si cuelgas, perderÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s la protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.`,
        senales: [
          { id: 'l1', label: 'Pide cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos o datos sensibles', correcta: true, explicacion: 'Ninguna instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tima te lo pide por llamada entrante.' },
          { id: 'l2', label: 'Urgencia o amenaza si cuelgas', correcta: true, explicacion: 'La prisa es una tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica para bloquear tu verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
          { id: 'l3', label: 'Propone mover dinero o instalar algo', correcta: true, explicacion: 'Es una acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de alto riesgo controlada por el atacante.' },
          { id: 'l4', label: 'Tono profesional', correcta: false, explicacion: 'Eso no demuestra autenticidad.' },
        ],
        peso: 1.1,
      }),
      mk(4, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-decision`, variant }),
        tipo: 'quiz',
        titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces al colgar',
        escenario: 'TerminÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ la llamada. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© paso sigue si quieres estar seguro?',
        opciones: [
          'Volver a contestar para pedir mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s detalles.',
          'Entrar a la app o llamar tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial de la instituciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          'Mandar por mensaje los datos que te pidieron.',
          'Esperar a que el ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“agenteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â vuelva a marcar.',
        ],
        correcta: 1,
        explicacion: 'La acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n segura es iniciar la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por un canal oficial controlado por ti.',
        senal: 'La llamada intentÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ retenerte dentro de su propio canal.',
        riesgo: 'Si sigues el flujo del estafador, puede robar datos o dinero.',
        accion: 'Cuelga, revisa la app y, si hace falta, llama tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial.',
        peso: 1.0,
      }),
      mk(5, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-abierta`, variant }),
        tipo: 'abierta',
        titulo: 'Tu frase para cortar',
        prompt: 'Escribe una frase breve y firme para colgar una llamada sospechosa sin engancharte en la conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
        pistas: ['voy a verificar por mi cuenta', 'no comparto datos', 'gracias, hasta luego'],
        peso: 1.0,
      }),
      mk(6, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
        tipo: 'checklist',
        titulo: 'Checklist de llamadas',
        intro: 'Si una llamada te mete presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n:',
        items: [
          'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.',
          'No muevas dinero a cuentas ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“segurasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
          'No instales apps por instrucciones de una llamada entrante.',
          'Cuelga y llama tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial.',
        ],
        peso: 1.0,
      }),
      ],
    }),
  });
};

const buildHabitsModule = ({ modId, cat, modNivel, toneNote, levelHint, mk, variant }) => {
  const scenarioSets = {
    basico: [
      {
        key: 'pausa-basica',
        flow: [
          {
            texto: 'Te llega un mensaje inesperado con ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltimo avisoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â y un enlace.',
            opciones: [
              { id: 'h1', texto: 'Abrirlo para ver de quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© se trata', puntaje: 0.2, feedback: 'Riesgosa. Primero necesitas frenar la urgencia.' },
              { id: 'h2', texto: 'Pausar, revisar el remitente y verificar por un canal oficial', puntaje: 1, feedback: 'Buena. Esa pausa reduce errores.' },
              { id: 'h3', texto: 'Reenviarlo a alguien para preguntar', puntaje: 0.5, feedback: 'Regular. Puede ayudar, pero no sustituye un canal oficial.' },
            ],
          },
          {
            texto: 'TodavÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a tienes duda. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s?',
            opciones: [
              { id: 'h4', texto: 'Confirmar desde la app o sitio oficial que tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº escribes', puntaje: 1, feedback: 'Correcto. TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº controlas el canal.' },
              { id: 'h5', texto: 'Seguir el enlace solo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“un momentoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.2, feedback: 'Riesgosa. Un clic puede ser suficiente.' },
            ],
          },
        ],
      },
      {
        key: 'compra-basica',
        flow: [
          {
            texto: 'Vas a comprar en una tienda nueva y el precio te emociona.',
            opciones: [
              { id: 'h1', texto: 'Comprar rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido para no perder la oferta', puntaje: 0.2, feedback: 'Riesgosa. La emociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n puede hacerte ignorar seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales.' },
              { id: 'h2', texto: 'Revisar dominio, reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo de pago antes de seguir', puntaje: 1, feedback: 'Buena. Esa rutina baja mucho el riesgo.' },
            ],
          },
          {
            texto: 'La tienda pide transferencia para respetar el descuento.',
            opciones: [
              { id: 'h3', texto: 'Aceptar si el descuento vale la pena', puntaje: 0.2, feedback: 'Riesgosa. Sin protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n, recuperar el dinero es difÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cil.' },
              { id: 'h4', texto: 'Salir y buscar otra opciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n con pago protegido', puntaje: 1, feedback: 'Correcto. El pago protegido es parte de tu rutina.' },
            ],
          },
        ],
      },
    ],
    refuerzo: [
      {
        key: 'mensaje-mixto',
        flow: [
          {
            texto: 'Te escribe alguien conocido y envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a un enlace que ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“necesita confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'h1', texto: 'Abrirlo porque conoces a la persona', puntaje: 0.3, feedback: 'Regular tirando a riesgosa. La cuenta pudo ser comprometida.' },
              { id: 'h2', texto: 'Verificar por llamada o con una pregunta que solo esa persona pueda responder', puntaje: 1, feedback: 'Buena. Separas confianza de verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
              { id: 'h3', texto: 'Esperar a que la persona insista mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s', puntaje: 0.5, feedback: 'Regular. Mejor verifica antes de seguir.' },
            ],
          },
          {
            texto: 'La respuesta llega bien escrita y con buena excusa. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© mantiene tu rutina segura?',
            opciones: [
              { id: 'h4', texto: 'Buscar un canal oficial o independiente para confirmar', puntaje: 1, feedback: 'Correcto. La forma no reemplaza la verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
              { id: 'h5', texto: 'Confiar si suena coherente', puntaje: 0.3, feedback: 'Riesgosa. Las estafas creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­bles existen justo para eso.' },
            ],
          },
        ],
      },
      {
        key: 'oferta-mixta',
        flow: [
          {
            texto: 'Una oferta parece razonable, no absurda. Aun asÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­, no conoces la tienda.',
            opciones: [
              { id: 'h1', texto: 'Comprar porque el precio no se ve tan extraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o', puntaje: 0.4, feedback: 'Regular. Un precio razonable tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n puede estar en una tienda falsa.' },
              { id: 'h2', texto: 'Verificar dominio, empresa y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo de pago antes de decidir', puntaje: 1, feedback: 'Buena. Tu rutina no depende de si el precio parece normal.' },
            ],
          },
          {
            texto: 'El checkout pide un paso adicional ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“para validarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'h3', texto: 'Seguir si el resto del sitio se ve profesional', puntaje: 0.3, feedback: 'Riesgosa. El cambio de flujo es una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al importante.' },
              { id: 'h4', texto: 'Pausar y revisar fuera del sitio antes de pagar', puntaje: 1, feedback: 'Correcto. La verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n externa es tu respaldo.' },
            ],
          },
        ],
      },
    ],
    avanzado: [
      {
        key: 'rutina-avanzada',
        flow: [
          {
            texto: 'Recibes un aviso muy bien redactado sobre seguridad. No hay faltas y el diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o se ve cuidado.',
            opciones: [
              { id: 'h1', texto: 'Confiar porque se ve profesional', puntaje: 0.3, feedback: 'Riesgosa. Hoy la presentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ya no es filtro suficiente.' },
              { id: 'h2', texto: 'Buscar dos seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales verificables antes de actuar', puntaje: 1, feedback: 'Buena. Tu rutina debe apoyarse en evidencia, no en apariencia.' },
            ],
          },
          {
            texto: 'Una de esas seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales parece correcta, pero el canal final no te convence.',
            opciones: [
              { id: 'h3', texto: 'Seguir si solo ves una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al rara', puntaje: 0.4, feedback: 'Regular. En escenarios finos, una seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al rara sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ merece pausa.' },
              { id: 'h4', texto: 'Salir del flujo y verificar por tu cuenta', puntaje: 1, feedback: 'Correcto. La mejor rutina corta el impulso y valida fuera del mensaje.' },
            ],
          },
        ],
      },
      {
        key: 'rutina-contexto',
        flow: [
          {
            texto: 'El mensaje encaja con algo que sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ hiciste hoy: una compra, un acceso o un trÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mite.',
            opciones: [
              { id: 'h1', texto: 'Confiar porque coincide con tu contexto', puntaje: 0.4, feedback: 'Regular. Los estafadores aprovechan coincidencias reales.' },
              { id: 'h2', texto: 'Verificar si el canal y el dominio tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n son consistentes', puntaje: 1, feedback: 'Buena. Coincidencia no significa legitimidad.' },
            ],
          },
          {
            texto: 'El mensaje te pide una acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a, ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“solo para validarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            opciones: [
              { id: 'h3', texto: 'Hacerla porque parece inofensiva', puntaje: 0.3, feedback: 'Riesgosa. Muchas estafas avanzadas piden algo pequeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o primero.' },
              { id: 'h4', texto: 'Mantener tu rutina: pausar, verificar y usar canal oficial', puntaje: 1, feedback: 'Correcto. La rutina funciona mejor cuando el fraude es mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s fino.' },
            ],
          },
        ],
      },
    ],
  };

  const scenario = scenarioSets[modNivel][variant % scenarioSets[modNivel].length];
  const selectedActivities = (() => {
    const concept = mk(1, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
      tipo: 'concepto',
      titulo: 'Tu rutina en 4 pasos',
      bloques: buildConceptBlocks([
        { titulo: 'Pausa', texto: 'No decidas con prisa. Si algo mete urgencia, respira y separa emocion de accion.' },
        { titulo: 'Verifica', texto: 'Revisa remitente, dominio o identidad antes de abrir enlaces o mover dinero.' },
        { titulo: 'Confirma', texto: 'Usa un canal oficial o independiente que tu controles.' },
        { titulo: 'Protege', texto: 'No compartas codigos, NIP ni datos sensibles por mensaje o llamada.' },
      ]),
      contenido:
        'No necesitas memorizar todas las estafas. Una rutina corta y constante te ayuda a reaccionar mejor en casi cualquier canal.',
      peso: 0.8,
    });
    const flow = mk(2, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-flow`, variant }),
      tipo: 'scenario_flow',
      titulo: 'Que harias si...',
      intro: 'Practica tu rutina en situaciones cortas y cotidianas.',
      pasos: scenario.flow,
      peso: 1.3,
    });
    const quiz1 = mk(3, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-quiz-1`, variant }),
      tipo: 'quiz',
      titulo: 'Que va primero',
      escenario: 'Cuando un mensaje te pide actuar rapido, que haces primero?',
      opciones: [
        'Actuo para no perder tiempo.',
        'Pauso y verifico por un canal confiable.',
        'Comparto el mensaje para que alguien me diga.',
        'Respondo con los datos minimos.',
      ],
      correcta: 1,
      explicacion: 'La rutina segura siempre empieza con una pausa y verificacion.',
      senal: 'La urgencia busca saltarse tu proceso mental.',
      riesgo: 'Decidir con prisa te hace mas vulnerable a errores.',
      accion: 'Pausa, revisa la senal principal y confirma por un canal oficial.',
      peso: 1.0,
    });
    const quiz2 = mk(4, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-quiz-2`, variant }),
      tipo: 'quiz',
      titulo: 'Comparacion rapida',
      escenario: 'Una oferta se ve bien y el mensaje esta bien escrito. Que pesa mas en tu decision?',
      opciones: [
        'La buena redaccion.',
        'La emocion de aprovechar el momento.',
        'Las verificaciones que puedes hacer fuera del mensaje.',
        'Que otra persona tambien la vio.',
      ],
      correcta: 2,
      explicacion: 'Lo que mas vale es lo que puedes verificar por tu cuenta, no como se ve el mensaje.',
      senal: 'La estafa avanzada se apoya en buena presentacion y contexto realista.',
      riesgo: 'Si confias por apariencia, te saltas la validacion importante.',
      accion: 'Sigue tu rutina: verifica identidad, canal y metodo antes de actuar.',
      peso: 1.0,
    });
    const checklist = mk(5, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
      tipo: 'checklist',
      titulo: 'Mi rutina personal',
      intro: 'Marca los pasos que quieres convertir en habito:',
      items: [
        'Pauso antes de abrir enlaces o pagar.',
        'Verifico remitente, numero o dominio.',
        'Confirmo por app, web o telefono oficial.',
        'No comparto codigos, NIP ni datos sensibles.',
        'Bloqueo o reporto si la senal es clara.',
      ],
      peso: 1.0,
    });
    const openResponse = mk(6, {
      scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-regla`, variant }),
      tipo: 'abierta',
      titulo: 'Tu regla de oro',
      prompt: 'Escribe una frase corta que puedas recordar cuando algo te meta presion digital.',
      pistas: ['pauso', 'verifico', 'canal oficial'],
      peso: 1.0,
    });

    return modNivel === 'basico'
      ? [concept, flow, quiz1, quiz2, checklist, openResponse]
      : modNivel === 'refuerzo'
        ? [flow, quiz1, checklist, openResponse, quiz2]
        : [flow, quiz2, openResponse, checklist];
  })();
  return sanitizeCoursePayload({
    id: modId,
    titulo: 'HÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡bitos de VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
    descripcion: `Rutina ${levelHint} para decidir con calma y menos riesgo ${toneNote}.`,
    categoria: cat,
    nivel: modNivel,
    actividades: arrangeModuleActivities({
      category: cat,
      level: modNivel,
      variant,
      activities: selectedActivities.length ? selectedActivities : [
      mk(1, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-concepto`, variant }),
        tipo: 'concepto',
        titulo: 'Tu rutina en 4 pasos',
        bloques: buildConceptBlocks([
          { titulo: 'Pausa', texto: 'No decidas con prisa. Si algo mete urgencia, respira y separa emociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
          { titulo: 'Verifica', texto: 'Revisa remitente, dominio o identidad antes de abrir enlaces o mover dinero.' },
          { titulo: 'Confirma', texto: 'Usa un canal oficial o independiente que tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº controles.' },
          { titulo: 'Protege', texto: 'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni datos sensibles por mensaje o llamada.' },
        ]),
        contenido:
          'No necesitas memorizar todas las estafas. Una rutina corta y constante te ayuda a reaccionar mejor en casi cualquier canal.',
        peso: 0.8,
      }),
      mk(2, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-flow`, variant }),
        tipo: 'scenario_flow',
        titulo: 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© harÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as siÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦?',
        intro: 'Practica tu rutina en situaciones cortas y cotidianas.',
        pasos: scenario.flow,
        peso: 1.3,
      }),
      mk(3, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-quiz-1`, variant }),
        tipo: 'quiz',
        titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© va primero',
        escenario: 'Cuando un mensaje te pide actuar rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces primero?',
        opciones: [
          'ActÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºo para no perder tiempo.',
          'Pauso y verifico por un canal confiable.',
          'Comparto el mensaje para que alguien me diga.',
          'Respondo con los datos mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nimos.',
        ],
        correcta: 1,
        explicacion: 'La rutina segura siempre empieza con una pausa y verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
        senal: 'La urgencia busca saltarse tu proceso mental.',
        riesgo: 'Decidir con prisa te hace mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s vulnerable a errores.',
        accion: 'Pausa, revisa la seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al principal y confirma por un canal oficial.',
        peso: 1.0,
      }),
      mk(4, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-quiz-2`, variant }),
        tipo: 'quiz',
        titulo: 'ComparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida',
        escenario: 'Una oferta se ve bien y el mensaje estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ bien escrito. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© pesa mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s en tu decisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n?',
        opciones: [
          'La buena redacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          'La emociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de aprovechar el momento.',
          'Las verificaciones que puedes hacer fuera del mensaje.',
          'Que otra persona tambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n la vio.',
        ],
        correcta: 2,
        explicacion: 'Lo que mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s vale es lo que puedes verificar por tu cuenta, no cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo se ve el mensaje.',
        senal: 'La estafa avanzada se apoya en buena presentaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y contexto realista.',
        riesgo: 'Si confÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as por apariencia, te saltas la validaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n importante.',
        accion: 'Sigue tu rutina: verifica identidad, canal y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo antes de actuar.',
        peso: 1.0,
      }),
      mk(5, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-checklist`, variant }),
        tipo: 'checklist',
        titulo: 'Mi rutina personal',
        intro: 'Marca los pasos que quieres convertir en hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡bito:',
        items: [
          'Pauso antes de abrir enlaces o pagar.',
          'Verifico remitente, nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero o dominio.',
          'Confirmo por app, web o telÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fono oficial.',
          'No comparto cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni datos sensibles.',
          'Bloqueo o reporto si la seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al es clara.',
        ],
        peso: 1.0,
      }),
      mk(6, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${scenario.key}-regla`, variant }),
        tipo: 'abierta',
        titulo: 'Tu regla de oro',
        prompt: 'Escribe una frase corta que puedas recordar cuando algo te meta presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n digital.',
        pistas: ['pauso', 'verifico', 'canal oficial'],
        peso: 1.0,
      }),
      ],
    }),
  });
};

const buildCourseRoute = ({ categories, levels, answers, assessment, prefs, progress }) => {
  const occurrences = {};
  return (Array.isArray(categories) ? categories : []).map((cat, idx) => {
    const normalized = normalizeCourseCategory(cat);
    const occurrence = occurrences[normalized] || 0;
    occurrences[normalized] = occurrence + 1;
    return buildModuleTemplate({
      categoria: normalized,
      index: idx,
      answers,
      assessment,
      nivel: Array.isArray(levels) ? levels[idx] : 'basico',
      progress,
      occurrence,
    });
  });
};

const buildModuleTemplate = ({ categoria, index, answers, assessment, nivel, progress, occurrence = 0 }) => {
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
  const variant = pickModuleVariant({ category: cat, level: modNivel, occurrence, progress, total: 2 });

  const mk = (n, base) => ({
    id: `${modId}_a${n}`,
    scenarioId:
      toText(base?.scenarioId) ||
      createScenarioId({
        category: cat,
        level: modNivel,
        label: `${base?.tipo || 'actividad'}-${base?.titulo || n}`,
        variant,
      }),
    ...base,
    peso: peso(base.peso ?? 1),
  });

  const levelHint =
    modNivel === 'basico'
      ? 'seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales claras y decisiones simples'
      : modNivel === 'refuerzo'
        ? 'seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales mezcladas y un poco ambiguas'
        : 'escenarios realistas con seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales menos obvias';

  if (cat === 'web') {
    return buildWebModule({ modId, cat, modNivel, toneNote, levelHint, mk, variant });
  }

  if (cat === 'whatsapp') {
    return buildWhatsAppModule({ modId, cat, modNivel, toneNote, levelHint, mk, variant });
  }

  if (cat === 'correo_redes') {
    return buildEmailModule({ modId, cat, modNivel, toneNote, levelHint, mk, variant });
  }

  if (cat === 'llamadas') {
    return buildCallModule({ modId, cat, modNivel, toneNote, levelHint, mk, variant });
  }

  if (cat === 'habitos') {
    return buildHabitsModule({ modId, cat, modNivel, toneNote, levelHint, mk, variant });
  }

  if (cat === 'web') {
    const page =
      modNivel === 'basico'
        ? {
            marca: 'NovaTienda',
            dominio: 'novatienda-descuentos.shop',
            banner: '90% OFF SOLO HOY',
            sub: 'Venta ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“oficialÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â con envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o inmediato.',
            contacto: 'Contacto: solo chat (sin direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n ni razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social).',
            pagos: ['Transferencia bancaria (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºnico mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo)'],
            productos: [
              { nombre: 'AudÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­fonos X', antes: '$1,299', precio: '$199' },
              { nombre: 'Smartwatch Z', antes: '$2,499', precio: '$349' },
              { nombre: 'Bocina Mini', antes: '$999', precio: '$149' },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              marca: 'NovaTienda',
              dominio: 'novatienda-mx-promos.com',
              banner: '30% OFF fin de semana',
              sub: 'DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“proÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â pero con detalles raros al pagar.',
              contacto: 'Contacto: correo genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico y sin polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas claras.',
              pagos: ['Tarjeta (enlace externo)', 'Transferencia'],
              productos: [
                { nombre: 'CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡mara Compacta', antes: '$3,799', precio: '$2,599' },
                { nombre: 'Teclado MecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡nico', antes: '$1,799', precio: '$1,299' },
                { nombre: 'Mouse Gamer', antes: '$899', precio: '$599' },
              ],
            }
          : {
              marca: 'NovaTienda',
              dominio: 'novatienda-mx.com',
              banner: 'Descuento por ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â',
              sub: 'Parece normal, pero te empuja a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â fuera del flujo.',
              contacto: 'Contacto: solo formulario; sin datos fiscales visibles.',
              pagos: ['Tarjeta (sin 3D Secure)', 'DepÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“para confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â'],
              productos: [
                { nombre: 'Tablet 10"', antes: '$5,999', precio: '$4,999' },
                { nombre: 'Celular A1', antes: '$4,499', precio: '$3,999' },
                { nombre: 'Cargador RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido', antes: '$399', precio: '$329' },
              ],
            };

    const hotspots =
      modNivel === 'basico'
        ? [
            { id: 'h1', target: 'domain', label: 'Dominio raro', correcta: true, explicacion: 'El dominio no coincide con uno ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“oficialÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.' },
            { id: 'h2', target: 'banner', label: 'Descuento exagerado', correcta: true, explicacion: 'Descuentos extremos buscan que actÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºes con prisa.' },
            { id: 'h3', target: 'contacto', label: 'Contacto incompleto', correcta: true, explicacion: 'Sin direcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n/polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas claras es mala seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al.' },
            { id: 'h4', target: 'pago', label: 'Pago riesgoso', correcta: true, explicacion: 'Transferencia/depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito es difÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cil de recuperar.' },
          ]
        : modNivel === 'refuerzo'
          ? [
              { id: 'h1', target: 'domain', label: 'Dominio ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“promosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', correcta: true, explicacion: 'Los estafadores agregan palabras para parecer oficiales.' },
              { id: 'h3', target: 'contacto', label: 'Contacto dudoso', correcta: true, explicacion: 'Correo genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico y polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas vagas aumentan el riesgo.' },
              { id: 'h4', target: 'pago', label: 'Pago por enlace externo', correcta: true, explicacion: 'Pagos fuera del sitio oficial son una bandera roja.' },
              { id: 'h2', target: 'banner', label: 'Oferta normal', correcta: false, explicacion: 'No todo descuento es estafa: mira el conjunto de seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales.' },
            ]
          : [
              { id: 'h1', target: 'domain', label: 'Dominio similar', correcta: true, explicacion: 'Un dominio ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“casi igualÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â es una tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica comÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn (typosquatting).' },
              { id: 'h4', target: 'pago', label: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ConfirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â con depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito', correcta: true, explicacion: 'Piden pago extra para saltarse verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n real.' },
              { id: 'h2', target: 'banner', label: 'Banner normal', correcta: false, explicacion: 'AquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ la estafa no estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ en el diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o: estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ en el flujo de pago.' },
              { id: 'h3', target: 'contacto', label: 'Formulario sin datos', correcta: true, explicacion: 'Sin razÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n social/aviso legal, es difÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cil reclamar.' },
            ];

    const domains =
      modNivel === 'basico'
        ? ['novatienda.com.mx', 'novatienda-descuentos.shop']
        : modNivel === 'refuerzo'
          ? ['novatienda.com.mx', 'novatienda-mx-promos.com', 'novatiendaoficial.com.mx']
          : ['novatienda.com.mx', 'novatienda-mx.com', 'novatienda-mex.com', 'novatienda.com-mx.site'];

    const signalMessage =
      modNivel === 'basico'
        ? 'Tu compra quedÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“pendienteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â. Para confirmar el descuento, envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a tu comprobante y tus datos hoy.'
        : modNivel === 'refuerzo'
          ? 'Para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“validarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â tu pedido, necesitamos una confirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida: responde con tus datos y paga en 30 minutos.'
          : 'Tu pago requiere ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manualÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â. Si confirmas ahora, conservas el precio; si no, se cancela.';

    const signals =
      modNivel === 'basico'
        ? [
            { id: 's1', label: 'Urgencia (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“hoyÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â)', correcta: true, explicacion: 'Te empuja a actuar sin verificar.' },
            { id: 's2', label: 'Pide comprobante/pago', correcta: true, explicacion: 'Quieren cerrar la transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido.' },
            { id: 's3', label: 'Pide datos personales', correcta: true, explicacion: 'Pueden usarlo para robo de identidad.' },
            { id: 's4', label: 'Mensaje claro y largo', correcta: false, explicacion: 'No es seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ sola.' },
            { id: 's5', label: 'Amenaza de cancelaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n', correcta: true, explicacion: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­pica para que no revises.' },
          ]
        : modNivel === 'refuerzo'
          ? [
              { id: 's1', label: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ValidaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â fuera del sitio', correcta: true, explicacion: 'Te sacan del canal oficial.' },
              { id: 's2', label: 'Tiempo lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­mite corto', correcta: true, explicacion: 'Reduce tu capacidad de revisar.' },
              { id: 's3', label: 'Pide datos por respuesta', correcta: true, explicacion: 'No es un canal seguro.' },
              { id: 's4', label: 'Menciona polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas de envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o', correcta: false, explicacion: 'Puede ser texto copiado.' },
              { id: 's5', label: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ConfirmaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â sin referencia', correcta: true, explicacion: 'No da nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmeros verificables.' },
            ]
          : [
              { id: 's1', label: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n manualÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', correcta: true, explicacion: 'Excusa comÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn para pedir pasos extra.' },
              { id: 's2', label: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por mantener el precio', correcta: true, explicacion: 'Juega con tu miedo a perder la oferta.' },
              { id: 's3', label: 'Falta de canal oficial claro', correcta: true, explicacion: 'No te da cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo verificar por tu cuenta.' },
              { id: 's4', label: 'Buen tono y ortografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a', correcta: false, explicacion: 'Hoy las estafas pueden verse ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“profesionalesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.' },
              { id: 's5', label: 'Cambia de mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo de pago', correcta: true, explicacion: 'Red flag: te empuja a algo sin protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
            ];


    return {
      id: modId,
      titulo: 'Detecta PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ginas Clonadas',
      descripcion: `Entrenamiento ${levelHint} para compras seguras ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: [
        mk(1, {
          tipo: 'concepto',
          titulo: 'Mapa RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido: QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© Revisar',
          contenido:
            'Antes de comprar, revisa dominio, contacto y mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todos de pago. ' +
            'No te guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­es solo por diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o o ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“candadoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â. Si te presionan o te piden depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito/transferencia, frena y verifica por canales oficiales.',
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
          titulo: 'ComparaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Dominios',
          prompt: 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡l dominio se ve mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timo?',
          dominios: domains,
          correcta: 0,
          explicacion:
            'El dominio oficial suele ser simple y consistente. Los falsos agregan palabras o cambian letras.',
          tip: 'Si dudas, no entres desde anuncios: escribe tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº el dominio.',
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'signal_hunt',
          titulo: 'Encuentra SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales en el Mensaje',
          mensaje: signalMessage,
          senales: signals,
          peso: 1.2,
        }),
        mk(5, {
          tipo: 'quiz',
          titulo: 'DecisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida',
          escenario: 'Si una web te empuja a pagar por transferencia, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces?',
          opciones: [
            'Pagar para no perder la oferta.',
            'Pausar y verificar dominio/reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as fuera del sitio.',
            'Mandar captura del pago para que ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmenÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            'Dar datos para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“validarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â mi compra.',
          ],
          correcta: 1,
          explicacion: 'Primero verifica fuera del sitio y evita pagos sin protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
          peso: 1.0,
        }),
        mk(6, {
          tipo: 'abierta',
          titulo: 'Tu Checklist Personal',
          prompt:
            modNivel === 'avanzado'
              ? 'Escribe 4ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ6 cosas que verificarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as antes de pagar en una web ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“muy bien hechaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.'
              : 'Escribe 3ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ5 cosas que verificarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as antes de pagar en una web nueva.',
          pistas: ['dominio exacto', 'contacto/polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas', 'mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©todo de pago', 'reseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as fuera del sitio'],
          peso: 1.2,
        }),
        mk(7, {
          tipo: 'checklist',
          titulo: 'Checklist Final Antes de Pagar',
          intro: 'Antes de pagar, confirma:',
          items: [
            'Dominio exacto (sin letras raras).',
            'Contacto y polÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ticas claras.',
            'Pago con protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (tarjeta/plataforma).',
            'ReseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as fuera del sitio.',
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
              text: 'Tu cuenta serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ bloqueada hoy. Confirma en el enlace.',
              correcto: 'estafa',
              explicacion: 'Urgencia + ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“enlaceÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â es una combinaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­pica de fraude.',
            },
            {
              id: 'm2',
              from: 'PaqueterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a',
              text: 'Tu envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o requiere pago extra. Entra a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ahora.',
              correcto: 'estafa',
              explicacion: 'Te pide pago/acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n urgente fuera de un canal verificable.',
            },
            {
              id: 'm3',
              from: 'Servicio',
              text: 'Tu cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n es 123456. No lo compartas.',
              correcto: 'seguro',
              explicacion: 'Un cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timo suele decir ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“no lo compartasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            },
            {
              id: 'm4',
              from: 'Promo',
              text: 'Ganaste un premio. Responde con tus datos para reclamar.',
              correcto: 'estafa',
              explicacion: 'Premios + datos personales: seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al muy comÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn de estafa.',
            },
          ]
        : modNivel === 'refuerzo'
          ? [
              {
                id: 'm1',
                from: 'NotificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
                text: 'Actividad inusual detectada. Confirma tu acceso en el enlace.',
                correcto: 'estafa',
                explicacion: 'Te empuja a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â con urgencia sin canal oficial claro.',
              },
              {
                id: 'm2',
                from: 'PaqueterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a',
                text: 'Tu paquete estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ en revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Consulta el estatus en la app oficial.',
                correcto: 'seguro',
                explicacion: 'Te orienta a un canal oficial (app), sin pedir datos/pago.',
              },
              {
                id: 'm3',
                from: 'Banco',
                text: 'Cargo no reconocido. Llama al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial o revisa tu app.',
                correcto: 'seguro',
                explicacion: 'Recomienda verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por canales oficiales.',
              },
              {
                id: 'm4',
                from: 'Soporte',
                text: 'Tu sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n caducÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³. Reingresa con tus datos para evitar suspensiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
                correcto: 'estafa',
                explicacion: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n + ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“reingresaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â suele ser phishing.',
              },
            ]
          : [
              {
                id: 'm1',
                from: 'Seguridad',
                text: 'Se detectÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ un cambio de dispositivo. Si no fuiste tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº, confirma ahora.',
                correcto: 'estafa',
                explicacion: 'Mensaje realista, pero te empuja a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ya.',
              },
              {
                id: 'm2',
                from: 'Servicio',
                text: 'Tu pago fue rechazado. Revisa tu app y vuelve a intentar desde allÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­.',
                correcto: 'seguro',
                explicacion: 'No pide datos ni te manda a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“enlacesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
              },
              {
                id: 'm3',
                from: 'AtenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
                text: 'Para liberar tu envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o, envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a comprobante y tu nombre completo.',
                correcto: 'estafa',
                explicacion: 'Pide datos + comprobante: intento de manipulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
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
            mensaje: 'ÃƒÆ’Ã†â€™Ãƒâ€¦Ã‚Â¡ltimo aviso: tu cuenta serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ suspendida. Entra a confirmar hoy.',
            senales: [
              { id: 's1', label: 'Urgencia', correcta: true, explicacion: 'Te presiona a actuar rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido.' },
              { id: 's2', label: 'Amenaza', correcta: true, explicacion: 'Usa miedo para que no verifiques.' },
              { id: 's3', label: 'Pide ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', correcta: true, explicacion: 'Suele llevar a phishing.' },
              { id: 's4', label: 'Mensaje corto', correcta: false, explicacion: 'No es seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ sola.' },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              mensaje: 'Actividad inusual. Para evitar bloqueo, confirma acceso cuanto antes.',
              senales: [
                { id: 's1', label: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tiempo', correcta: true, explicacion: 'Reduce tu revisiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
                { id: 's2', label: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Evitar bloqueoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', correcta: true, explicacion: 'Amenaza disfrazada.' },
                { id: 's3', label: 'Canal no oficial', correcta: true, explicacion: 'No sugiere app o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial.' },
                { id: 's4', label: 'Tono formal', correcta: false, explicacion: 'Puede ser copiado.' },
              ],
            }
          : {
              mensaje: 'Tu seguridad requiere verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. Si no respondes, la operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n se cancelarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡.',
              senales: [
                { id: 's1', label: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â sin contexto', correcta: true, explicacion: 'No da forma de validar.' },
                { id: 's2', label: 'Consecuencia inmediata', correcta: true, explicacion: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para apurarte.' },
                { id: 's3', label: 'Pide respuesta por SMS', correcta: true, explicacion: 'Canal inseguro para datos.' },
                { id: 's4', label: 'Buena ortografÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a', correcta: false, explicacion: 'Las estafas pueden verse bien.' },
              ],
            };

    const smsVariants = {
      basico: [
        {
          inbox: [
            {
              id: 'v1',
              displayName: 'Streaming Plus',
              from: 'STREAM',
              preview: 'Actualiza tu pago hoy.',
              dateLabel: 'Hoy',
              text: 'Tu cuenta se pausa hoy. Actualiza el pago desde este enlace.',
              body: ['Tu cuenta se pausa hoy.', 'Actualiza el pago desde este enlace.'],
              linkPreview: 'https://streaming-plus-soporte.today',
              correcto: 'estafa',
              explicacion: 'Usa urgencia y te manda a un enlace fuera del canal oficial.',
            },
            {
              id: 'v2',
              displayName: 'Farmacia App',
              from: 'SALUD',
              preview: 'Tu pedido ya puede recogerse.',
              dateLabel: 'Hoy',
              text: 'Tu pedido ya puede recogerse. Revisa el detalle desde la app oficial.',
              body: ['Tu pedido ya puede recogerse.', 'Revisa el detalle desde la app oficial.'],
              correcto: 'seguro',
              explicacion: 'Te lleva a la app oficial y no pide datos ni pago extra.',
            },
            {
              id: 'v3',
              displayName: 'Banco Centro',
              from: 'BCENTRO',
              preview: 'Si no reconoces un cargo, revisa tu app.',
              dateLabel: 'Hoy',
              text: 'Si no reconoces un cargo, revisa tu app oficial o llama al numero del reverso.',
              body: ['Si no reconoces un cargo, revisa tu app oficial o llama al numero del reverso.'],
              correcto: 'seguro',
              explicacion: 'La verificacion se mueve a un canal que tu controlas.',
            },
            {
              id: 'v4',
              displayName: 'Mensajeria',
              from: 'MSJ',
              preview: 'Confirma tu identidad para liberar el envio.',
              dateLabel: 'Ayer',
              text: 'Confirma tu identidad en bit.ly/libera-tu-envio hoy mismo.',
              body: ['Confirma tu identidad para liberar tu envio hoy mismo.'],
              linkPreview: 'https://bit.ly/libera-tu-envio',
              correcto: 'estafa',
              explicacion: 'Oculta el destino real y te mete presion para responder rapido.',
            },
          ],
          hunt: {
            mensaje: 'Pago rechazado. Actualiza hoy o tu servicio se pausara. Entra al enlace.',
            senales: [
              { id: 'sv1', label: 'Te saca a un enlace', correcta: true, explicacion: 'No te manda a la app oficial.' },
              { id: 'sv2', label: 'Te da plazo corto', correcta: true, explicacion: 'La prisa reduce tu revision.' },
              { id: 'sv3', label: 'Te pide actualizar ya', correcta: true, explicacion: 'Busca que resuelvas dentro del SMS.' },
              { id: 'sv4', label: 'Habla de un pago', correcta: false, explicacion: 'Hablar de pago no siempre es fraude por si solo.' },
            ],
          },
          domains: { list: ['farmaciaapp.com.mx', 'farmaciaapp-ayuda.com-secure.site'], correct: 0 },
        },
      ],
      refuerzo: [
        {
          inbox: [
            {
              id: 'v1',
              displayName: 'Facturacion',
              from: 'PAGOS',
              preview: 'Abre el enlace para evitar recargos.',
              dateLabel: 'Hoy',
              text: 'Tu factura quedo pendiente. Abre el enlace para evitar recargos hoy.',
              body: ['Tu factura quedo pendiente.', 'Abre el enlace para evitar recargos hoy.'],
              linkPreview: 'https://factura-centro-rapido.help',
              correcto: 'estafa',
              explicacion: 'Usa recargos y urgencia para empujarte a un enlace externo.',
            },
            {
              id: 'v2',
              displayName: 'Linea movil',
              from: 'MOVIL',
              preview: 'Revisa tu consumo desde la app.',
              dateLabel: 'Hoy',
              text: 'Tu consumo esta disponible. Revisa el detalle desde la app oficial.',
              body: ['Tu consumo esta disponible.', 'Revisa el detalle desde la app oficial.'],
              correcto: 'seguro',
              explicacion: 'Es informativo y te lleva a un canal oficial.',
            },
            {
              id: 'v3',
              displayName: 'Reembolso',
              from: 'REEMBOLSO',
              preview: 'Responde con tu CLABE para depositar.',
              dateLabel: 'Ayer',
              text: 'Tenemos un reembolso a tu favor. Responde con tu CLABE para depositar.',
              body: ['Tenemos un reembolso a tu favor.', 'Responde con tu CLABE para depositar.'],
              correcto: 'estafa',
              explicacion: 'No debes mandar datos bancarios por respuesta a un SMS.',
            },
            {
              id: 'v4',
              displayName: 'Mi cuenta',
              from: 'CUENTA',
              preview: 'Si no reconoces el acceso, entra a tu app.',
              dateLabel: 'Ayer',
              text: 'Si no reconoces el acceso, entra a tu app y cambia la contrasena.',
              body: ['Si no reconoces el acceso, entra a tu app y cambia la contrasena.'],
              correcto: 'seguro',
              explicacion: 'Te saca del SMS y te lleva a un canal que controlas.',
            },
          ],
          hunt: {
            mensaje: 'Tu cuenta necesita validacion. Responde a este SMS con tus datos para evitar suspension.',
            senales: [
              { id: 'sv1', label: 'Pide datos por SMS', correcta: true, explicacion: 'Canal inseguro para datos sensibles.' },
              { id: 'sv2', label: 'Habla de suspension', correcta: true, explicacion: 'Usa presion emocional.' },
              { id: 'sv3', label: 'Resuelve en el mismo canal', correcta: true, explicacion: 'No te manda a app o sitio oficial.' },
              { id: 'sv4', label: 'Texto ordenado', correcta: false, explicacion: 'Que este bien escrito no basta.' },
            ],
          },
          domains: { list: ['micuenta.com.mx', 'mi-cuenta-validacion-help.net', 'micuentaoficial.mx'], correct: 0 },
        },
      ],
      avanzado: [
        {
          inbox: [
            {
              id: 'v1',
              displayName: 'Suscripcion Pro',
              from: 'PRO',
              preview: 'Renueva hoy para no perder acceso.',
              dateLabel: 'Hoy',
              text: 'Tu suscripcion vence hoy. Renueva desde este enlace para no perder acceso.',
              body: ['Tu suscripcion vence hoy.', 'Renueva desde este enlace para no perder acceso.'],
              linkPreview: 'https://renovacion-premium.seguro-login.site',
              correcto: 'estafa',
              explicacion: 'Es convincente, pero te lleva a un enlace de renovacion que no controlas.',
            },
            {
              id: 'v2',
              displayName: 'Streaming App',
              from: 'APP',
              preview: 'Tu plan se actualizo. Revisa detalles en la app.',
              dateLabel: 'Hoy',
              text: 'Tu plan se actualizo. Revisa los detalles desde la app oficial.',
              body: ['Tu plan se actualizo.', 'Revisa los detalles desde la app oficial.'],
              correcto: 'seguro',
              explicacion: 'Es solo una notificacion y te mueve a la app oficial.',
            },
            {
              id: 'v3',
              displayName: 'Aduana Express',
              from: 'ADUANA',
              preview: 'Falta un pago para liberar tu paquete.',
              dateLabel: 'Ayer',
              text: 'Falta un pago para liberar tu paquete internacional. Confirma en el enlace.',
              body: ['Falta un pago para liberar tu paquete internacional.', 'Confirma en el enlace.'],
              linkPreview: 'https://aduana-pago-ayuda.help',
              correcto: 'estafa',
              explicacion: 'Paquete mas pago urgente sigue siendo una combinacion muy usada en fraude.',
            },
            {
              id: 'v4',
              displayName: 'Banco aviso',
              from: 'BANCO',
              preview: 'Si no reconoces el movimiento, revisa tu app.',
              dateLabel: 'Ayer',
              text: 'Movimiento rechazado. Si no lo reconoces, revisa tu app y valida ahi.',
              body: ['Movimiento rechazado.', 'Si no lo reconoces, revisa tu app y valida ahi.'],
              correcto: 'seguro',
              explicacion: 'Te dirige a la app, no a responder ni abrir el enlace del SMS.',
            },
          ],
          hunt: {
            mensaje: 'Renueva hoy o perderas el acceso. Entra al enlace y valida tu identidad ahora.',
            senales: [
              { id: 'sv1', label: 'Presiona con perdida inmediata', correcta: true, explicacion: 'Quiere que actues antes de revisar.' },
              { id: 'sv2', label: 'Te manda a validar por enlace', correcta: true, explicacion: 'No propone una web que tu escribas.' },
              { id: 'sv3', label: 'Pide identidad en el mismo flujo', correcta: true, explicacion: 'Eso incrementa mucho el riesgo.' },
              { id: 'sv4', label: 'Nombre del servicio', correcta: false, explicacion: 'Nombrar una marca no lo hace legitimo.' },
            ],
          },
          domains: { list: ['renovacionapp.com.mx', 'renovacionapp-ayuda-login.site', 'renovacion-app.mx'], correct: 0 },
        },
      ],
    };
    const selectedSmsVariant = smsVariants[modNivel]?.[variant % smsVariants[modNivel].length];
    const selectedInbox = selectedSmsVariant?.inbox || inbox;
    const selectedHunt = selectedSmsVariant?.hunt || hunt;
    const selectedDomainCheck = selectedSmsVariant?.domains || {
      list: ['servicio.com.mx', 'servicio-seguridad.com-mx.site'],
      correct: 0,
    };
    const smsDecisionSets = {
      basico: [
        {
          key: 'sms-paquete',
          pasos: [
            {
              texto: 'Llega un SMS de paqueteria con un enlace para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“liberarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â tu envio hoy.',
              opciones: [
                { id: 'sd1', texto: 'Abrir el enlace para confirmar rapido', puntaje: 0.2, feedback: 'Riesgosa. El enlace es justo lo que debes evitar tocar.' },
                { id: 'sd2', texto: 'Entrar a la app oficial o escribir tu la web de paqueteria', puntaje: 1, feedback: 'Buena. Mueves la verificacion a un canal que controlas.' },
              ],
            },
            {
              texto: 'El mensaje insiste con un pago pequeno para destrabar el envio.',
              opciones: [
                { id: 'sd3', texto: 'Pagar para no perder el paquete', puntaje: 0.2, feedback: 'Riesgosa. El pago urgente es una tecnica comun de fraude.' },
                { id: 'sd4', texto: 'Pausar y validar si ese cobro existe en tu cuenta oficial', puntaje: 1, feedback: 'Correcto. Verificas antes de mover dinero.' },
              ],
            },
          ],
        },
      ],
      refuerzo: [
        {
          key: 'sms-cuenta',
          pasos: [
            {
              texto: 'Recibes un SMS convincente sobre actividad inusual en tu cuenta.',
              opciones: [
                { id: 'sd1', texto: 'Confiar porque el mensaje se ve profesional', puntaje: 0.3, feedback: 'Regular tirando a riesgosa. La forma no basta.' },
                { id: 'sd2', texto: 'Revisar la app oficial antes de tocar cualquier enlace', puntaje: 1, feedback: 'Buena. Separas apariencia de verificacion real.' },
              ],
            },
            {
              texto: 'El mismo remitente te pide responder por SMS con un codigo.',
              opciones: [
                { id: 'sd3', texto: 'Mandarlo si parece una validacion simple', puntaje: 0.2, feedback: 'Riesgosa. No compartas codigos en el mismo canal sospechoso.' },
                { id: 'sd4', texto: 'Ignorar la solicitud y validar solo desde el canal oficial', puntaje: 1, feedback: 'Correcto. La regla sigue siendo la misma aunque el mensaje parezca serio.' },
              ],
            },
          ],
        },
      ],
      avanzado: [
        {
          key: 'sms-renovacion',
          pasos: [
            {
              texto: 'Te llega un SMS casi perfecto de una suscripcion que si usas. Solo cambia una pequena parte del enlace.',
              opciones: [
                { id: 'sd1', texto: 'Abrirlo porque coincide con algo real', puntaje: 0.3, feedback: 'Riesgosa. La coincidencia es justo lo que explota el fraude avanzado.' },
                { id: 'sd2', texto: 'Abrir la app oficial y revisar si de verdad hay un problema', puntaje: 1, feedback: 'Buena. Verificas el contexto sin obedecer el enlace.' },
              ],
            },
            {
              texto: 'El SMS promete conservar el acceso si validas en menos de cinco minutos.',
              opciones: [
                { id: 'sd3', texto: 'Validar rapido para no perder la cuenta', puntaje: 0.2, feedback: 'Riesgosa. La prisa busca desactivar tu analisis.' },
                { id: 'sd4', texto: 'Mantener la calma y revisar dominio, canal y metodos desde fuera', puntaje: 1, feedback: 'Correcto. En escenarios finos, la rutina importa mas.' },
              ],
            },
          ],
        },
      ],
    };
    const selectedSmsDecision = smsDecisionSets[modNivel]?.[variant % smsDecisionSets[modNivel].length];
    const selectedActivities = (() => {
      const concept = mk(1, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${selectedSmsDecision?.key || 'sms'}-concepto`, variant }),
        tipo: 'concepto',
        titulo: 'Regla de oro en SMS',
        contenido:
          'No uses links de SMS para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â cuentas o pagos. Si el mensaje es real, podras verificar desde tu app o escribiendo tu el sitio oficial.',
        peso: 0.9,
      });
      const inboxActivity = mk(2, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${selectedSmsDecision?.key || 'sms'}-inbox`, variant }),
        tipo: 'inbox',
        titulo: 'Bandeja simulada',
        kind: 'sms',
        intro: 'Clasifica cada SMS como Seguro o Estafa.',
        mensajes: selectedInbox,
        peso: 1.4,
      });
      const huntActivity = mk(3, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${selectedSmsDecision?.key || 'sms'}-hunt`, variant }),
        tipo: 'signal_hunt',
        titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales dentro del SMS',
        ...selectedHunt,
        peso: 1.1,
      });
      const decisionFlow = mk(4, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${selectedSmsDecision?.key || 'sms'}-flow`, variant }),
        tipo: 'scenario_flow',
        titulo: 'Antes de tocar el enlace',
        intro: 'Practica la decision correcta antes de abrir, responder o pagar.',
        pasos: selectedSmsDecision?.pasos || [],
        peso: 1.2,
      });
      const domainCheck = mk(5, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${selectedSmsDecision?.key || 'sms'}-domain`, variant }),
        tipo: 'compare_domains',
        titulo: 'Dominio en el enlace',
        prompt: 'Si un SMS trae un link, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© dominio se ve mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timo?',
        dominios: selectedDomainCheck.list,
        correcta: selectedDomainCheck.correct,
        explicacion: 'Los dominios falsos suelen agregar palabras o cambiar el final.',
        tip: 'Mejor entra escribiendo tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº el dominio o desde tu app.',
        peso: 1.0,
      });
      const checklist = mk(6, {
        scenarioId: createScenarioId({ category: cat, level: modNivel, label: `${selectedSmsDecision?.key || 'sms'}-checklist`, variant }),
        tipo: 'checklist',
        titulo: 'Checklist de SMS',
        intro: 'Antes de actuar:',
        items: [
          'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Esperaba este SMS?',
          'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Mete urgencia o miedo?',
          'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Pide datos, dinero o link?',
          'Verifico en app o canal oficial.',
        ],
        peso: 1.0,
      });

      return modNivel === 'basico'
        ? [concept, inboxActivity, huntActivity, decisionFlow, domainCheck, checklist]
        : modNivel === 'refuerzo'
          ? [inboxActivity, huntActivity, decisionFlow, domainCheck, checklist]
          : [inboxActivity, decisionFlow, domainCheck, checklist];
    })();

    return sanitizeCoursePayload({
      id: modId,
      titulo: 'SMS: Detecta Mensajes Falsos',
      descripcion: `Entrenamiento ${levelHint} para identificar SMS fraudulentos ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: selectedActivities.length ? selectedActivities : [
        mk(1, {
          tipo: 'concepto',
          titulo: 'Regla de Oro en SMS',
          contenido:
            'No uses links de SMS para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â cuentas o pagos. Si el mensaje es real, podrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s verificar desde tu app o escribiendo tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº el sitio. ' +
            'La urgencia y las amenazas son seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales clÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sicas.',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'inbox',
          titulo: 'Bandeja Simulada',
          kind: 'sms',
          intro: 'Clasifica cada SMS como Seguro o Estafa.',
          mensajes: selectedInbox,
          peso: 1.4,
        }),
        mk(3, {
          tipo: 'signal_hunt',
          titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales Dentro del SMS',
          ...selectedHunt,
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'compare_domains',
          titulo: 'Dominio en el Enlace',
          prompt: 'Si un SMS trae un link, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© dominio se ve mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s legÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­timo?',
          dominios: selectedDomainCheck.list,
          correcta: selectedDomainCheck.correct,
          explicacion: 'Los dominios falsos suelen agregar palabras o cambiar el final.',
          tip: 'Mejor entra escribiendo tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº el dominio o desde tu app.',
          peso: 1.0,
        }),
        mk(5, {
          tipo: 'quiz',
          titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© Hacer Primero',
          escenario: 'Te llega un SMS ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“del bancoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â con un link. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡l es tu primer paso?',
          opciones: [
            'Abrir el link para ver.',
            'Entrar a la app oficial y revisar ahÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­.',
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
            'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Esperaba este SMS?',
            'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Mete urgencia o miedo?',
            'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Pide datos, dinero o link?',
            'Verifico en app o canal oficial.',
          ],
          peso: 1.0,
        }),
      ],
    });
  }

  if (cat === 'correo_redes') {
    const inbox =
      modNivel === 'basico'
        ? [
            {
              id: 'c1',
              from: 'Soporte',
              subject: 'Tu cuenta serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ suspendida',
              text: 'Necesitamos que confirmes tus datos hoy para evitar bloqueo.',
              correcto: 'estafa',
              explicacion: 'Urgencia + ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirma datosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â es phishing tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­pico.',
            },
            {
              id: 'c2',
              from: 'PaqueterÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a',
              subject: 'Estatus de envÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o',
              text: 'Revisa el estatus desde la web/app oficial con tu guÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.',
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
              text: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Tu cuenta tiene un problema, entra a verificar.ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â',
              correcto: 'estafa',
              explicacion: 'Mensaje genÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rico con presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“verificarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            },
          ]
        : modNivel === 'refuerzo'
          ? [
              {
                id: 'c1',
                from: 'AtenciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
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
                explicacion: 'Reembolso ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“pendienteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â + datos = gancho comÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºn.',
              },
              {
                id: 'c3',
                from: 'Soporte',
                subject: 'Actualiza seguridad',
                text: 'Tu contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a expira. Reingresa con tus datos.',
                correcto: 'estafa',
                explicacion: 'Te empuja a reingresar: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­pico phishing.',
              },
              {
                id: 'c4',
                from: 'Comunidad',
                subject: 'Aviso',
                text: 'No compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos. Si dudas, revisa ajustes de seguridad.',
                correcto: 'seguro',
                explicacion: 'Mensaje preventivo sin pedir acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n peligrosa.',
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
                explicacion: 'Pide comprobante/datos: seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al roja.',
              },
              {
                id: 'c3',
                from: 'PromociÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
                subject: 'Oferta exclusiva',
                text: 'Oferta limitada. Entra a ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“apartarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â hoy con depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito.',
                correcto: 'estafa',
                explicacion: 'DepÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito + urgencia es riesgo alto.',
              },
              {
                id: 'c4',
                from: 'Red social',
                subject: '',
                text: 'Alguien reportÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ tu cuenta. Verifica identidad en 1 hora.',
                correcto: 'estafa',
                explicacion: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de tiempo para evitar que verifiques.',
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
            'En correos y DMs, lo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s importante es: remitente/dominio, urgencia y peticiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de datos/pagos. ' +
            'Si no lo esperabas, no abras adjuntos ni ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“verifiquesÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â desde el mensaje: entra tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº a la app o web oficial.',
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
          titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales en un Correo',
          mensaje:
            'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Tu reembolso estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ pendiente. Para liberarlo, confirma tus datos de pago y responde este correo hoy.ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â',
          senales: [
            { id: 's1', label: 'Reembolso como gancho', correcta: true, explicacion: 'Te atrae con dinero.' },
            { id: 's2', label: 'Pide datos de pago', correcta: true, explicacion: 'Es informaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n sensible.' },
            { id: 's3', label: 'Urgencia (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“hoyÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â)', correcta: true, explicacion: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para actuar sin revisar.' },
            { id: 's4', label: 'Tiene asunto', correcta: false, explicacion: 'No es seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al.' },
          ],
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'quiz',
          titulo: 'Adjuntos Inesperados',
          escenario: 'Si recibes un adjunto que no esperabas, ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces?',
          opciones: [
            'Lo abro para ver ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“quÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© esÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
            'Pido verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por un canal oficial antes de abrir.',
            'Lo reenvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­o a alguien.',
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
            'Escribe una respuesta corta para no caer en phishing y decir que verificarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s por canales oficiales.',
          pistas: ['no dar datos', 'verificar en app/web oficial', 'no abrir adjuntos'],
          peso: 1.1,
        }),
        mk(6, {
          tipo: 'checklist',
          titulo: 'Checklist Anti-Phishing',
          intro: 'Antes de confiar:',
          items: [
            'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Lo esperaba?',
            'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Pide datos, pago o link?',
            'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Mete urgencia o amenaza?',
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
            mensaje: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Soy tu familiar. CambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero. Me urge un depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito ahorita.ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â',
            senales: [
              { id: 's1', label: 'Cambio de nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero', correcta: true, explicacion: 'TÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©cnica tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­pica de suplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
              { id: 's2', label: 'Urgencia', correcta: true, explicacion: 'Busca que no verifiques.' },
              { id: 's3', label: 'Pide dinero', correcta: true, explicacion: 'Red flag principal.' },
              { id: 's4', label: 'Saluda por tu nombre', correcta: false, explicacion: 'Pueden saberlo.' },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              mensaje: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Soy yo. Estoy en una reuniÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y no puedo hablar. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Me transfieres y te explico despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s?ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â',
              senales: [
                { id: 's1', label: 'Evita llamada', correcta: true, explicacion: 'Quiere impedir verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
                { id: 's2', label: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n a transferir', correcta: true, explicacion: 'Busca cerrar rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido.' },
                { id: 's3', label: 'Excusa creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ble', correcta: true, explicacion: 'Hace la estafa mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s realista.' },
                { id: 's4', label: 'Mensaje corto', correcta: false, explicacion: 'No es seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al por sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ sola.' },
              ],
            }
          : {
              mensaje:
                'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Soy tu familiar. Me robaron el celular y este es temporal. Necesito que me ayudes, pero no se lo digas a nadie.ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â',
              senales: [
                { id: 's1', label: 'Secreto/aislamiento', correcta: true, explicacion: 'Te aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sla para que no verifiques.' },
                { id: 's2', label: 'Historia creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ble', correcta: true, explicacion: 'Baja tus defensas.' },
                { id: 's3', label: 'Pide ayuda rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida', correcta: true, explicacion: 'Te empuja a actuar.' },
                { id: 's4', label: 'Usa buen tono', correcta: false, explicacion: 'No garantiza nada.' },
              ],
            };

    return {
      id: modId,
      titulo: 'WhatsApp: SuplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y Enlaces',
      descripcion: `Entrenamiento ${levelHint} para detectar engaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±os en WhatsApp ${toneNote}.`,
      categoria: cat,
      nivel: modNivel,
      actividades: [
        mk(1, {
          tipo: 'concepto',
          titulo: 'Regla RÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida en WhatsApp',
          contenido:
            'En WhatsApp, la estafa suele usar urgencia + dinero + evitar verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. ' +
            'La defensa es simple: pausa, verifica por otro canal (llamada al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero guardado) y no compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos.',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'signal_hunt',
          titulo: 'Detecta SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales en el Mensaje',
          ...signal,
          peso: 1.1,
        }),
        mk(3, {
          tipo: 'sim_chat',
          titulo: 'SimulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Chat (SuplantaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n)',
          escenario:
            modNivel === 'avanzado'
              ? 'Alguien finge ser alguien cercano y mezcla urgencia con una historia creÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ble.'
              : 'Alguien finge ser alguien cercano y pide dinero urgente.',
          inicio:
            modNivel === 'basico'
              ? 'Soy yo, cambiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© de nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero. Me urge un depÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³sito ahorita, por favor.'
              : modNivel === 'refuerzo'
                ? 'Estoy en una situaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n. No puedo hablar. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Me transfieres y te explico despuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©s?'
                : 'Me robaron el celular, este nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero es temporal. AyÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºdame rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido, por favor.',
          turnos_max: 6,
          peso: 1.6,
        }),
        mk(4, {
          tipo: 'quiz',
          titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© HarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as',
          escenario: 'Te piden dinero por WhatsApp y dicen que ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“no pueden hablarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces?',
          opciones: [
            'Transfiero para ayudar.',
            'Verifico llamando al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero de siempre o por otra vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a.',
            'Pido que me manden una foto.',
            'Les comparto un cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
          ],
          correcta: 1,
          explicacion: 'La verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por otro canal es la clave.',
          peso: 1.0,
        }),
        mk(5, {
          tipo: 'abierta',
          titulo: 'Tu Mensaje Seguro',
          prompt:
            'Escribe una respuesta corta que frene la urgencia y exija verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n (sin discutir).',
          pistas: ['ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Te llamo al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero de siempreÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', 'no transferir', 'pausar'],
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
            'Nunca compartas cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos o NIP.',
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
            intro: 'Simula una llamada. Elige cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo actuar en cada paso.',
            pasos: [
              {
                texto: 'Te llaman diciendo: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Soy del banco, detectamos un cargo. Necesito tu cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo SMS para cancelarloÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
                opciones: [
                  { texto: 'Dar el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo para cancelar', puntaje: 0.1, feedback: 'Riesgoso: el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo es la llave de acceso.' },
                  { texto: 'Colgar y llamar tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial', puntaje: 1, feedback: 'Correcto: verificas por canal oficial.' },
                  { texto: 'Pedir que te lo repitan', puntaje: 0.3, feedback: 'No resuelve: siguen controlando la llamada.' },
                ],
              },
              {
                texto: 'Insisten: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Si cuelgas, perderÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s tu dineroÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
                opciones: [
                  { texto: 'Seguir en la llamada', puntaje: 0.2, feedback: 'Riesgoso: la presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n es seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±al de estafa.' },
                  { texto: 'Mantenerte firme y verificar por tu app', puntaje: 1, feedback: 'Bien: no te dejas presionar.' },
                ],
              },
            ],
          }
        : modNivel === 'refuerzo'
          ? {
              intro: 'La llamada es mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s ambigua: decide con calma.',
              pasos: [
                {
                  texto: 'Te llaman: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Hay un problema con tu cuenta. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Me confirmas tu nombre completo y los 16 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­gitos?ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â',
                  opciones: [
                    { texto: 'Confirmar para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“resolver rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pidoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.2, feedback: 'Riesgoso: no des datos sensibles.' },
                    { texto: 'Colgar y revisar en app / nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial', puntaje: 1, feedback: 'Bien: verificas sin dar datos.' },
                    { texto: 'Pedir un folio y colgar', puntaje: 0.8, feedback: 'Mejor: pide folio y verifica por canal oficial.' },
                  ],
                },
                {
                  texto: 'Te ofrecen ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“pasarteÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â a otro departamento sin colgar.',
                  opciones: [
                    { texto: 'Aceptar y seguir', puntaje: 0.4, feedback: 'Puede ser parte del engaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o. Mejor corta tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº.' },
                    { texto: 'Cortar y llamar tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº al oficial', puntaje: 1, feedback: 'Correcto: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº inicias el contacto.' },
                  ],
                },
              ],
            }
          : {
              intro: 'Escenario avanzado: suena profesional pero busca controlarte.',
              pasos: [
                {
                  texto: 'Te llaman: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Detectamos fraude. Para protegerte, necesitamos que instales una app y sigas pasosÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
                  opciones: [
                    { texto: 'Instalar la app para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“asegurarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.1, feedback: 'Muy riesgoso: podrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a ser control remoto.' },
                    { texto: 'Cortar y contactar al banco por tu app', puntaje: 1, feedback: 'Correcto: verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n oficial.' },
                    { texto: 'Pedir que te manden un correo', puntaje: 0.5, feedback: 'Mejor verifica tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº: no sigas instrucciones.' },
                  ],
                },
                {
                  texto: 'Dicen: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“No cuelgues o se pierde la protecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³nÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
                  opciones: [
                    { texto: 'Ignorar presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y verificar por tu cuenta', puntaje: 1, feedback: 'Bien: la urgencia es la trampa.' },
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
          titulo: 'QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© Nunca se Comparte',
          contenido:
            'Por llamada no se comparten NIP, contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as ni cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos SMS. Si hay presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n o urgencia, cuelga. ' +
            'La regla es: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº llamas al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficial (app, tarjeta o sitio que escribes tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº).',
          peso: 0.9,
        }),
        mk(2, {
          tipo: 'scenario_flow',
          titulo: 'SimulaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n de Llamada',
          ...flow,
          peso: 1.5,
        }),
        mk(3, {
          tipo: 'signal_hunt',
          titulo: 'SeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales Durante la Llamada',
          mensaje: 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“No cuelgues, dame el cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo y lo resolvemos hoy mismo. Si no, se bloquea tu cuentaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â.',
          senales: [
            { id: 's1', label: 'PresiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por no colgar', correcta: true, explicacion: 'Buscan controlar la conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.' },
            { id: 's2', label: 'Pide cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo', correcta: true, explicacion: 'El cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo abre acceso a tu cuenta.' },
            { id: 's3', label: 'Amenaza de bloqueo', correcta: true, explicacion: 'Miedo para apresurarte.' },
            { id: 's4', label: 'Tono serio', correcta: false, explicacion: 'No garantiza legitimidad.' },
          ],
          peso: 1.1,
        }),
        mk(4, {
          tipo: 'abierta',
          titulo: 'Tu GuiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n para Colgar',
          prompt: 'Escribe una frase corta para colgar con seguridad y decir que verificarÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s por el canal oficial.',
          pistas: ['ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“Voy a llamar al nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºmero oficialÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', 'no dar datos', 'cortar la llamada'],
          peso: 1.1,
        }),
        mk(5, {
          tipo: 'checklist',
          titulo: 'Checklist de Llamadas',
          intro: 'Si te llaman ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“del banco/empresaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â:',
          items: [
            'No confirmo cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos, NIP ni contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±as.',
            'Cuelgo si hay urgencia o presiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.',
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
              texto: 'Te llega un mensaje inesperado con ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltimo avisoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â y te pide acciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pida.',
              opciones: [
                { texto: 'Actuar rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡pido para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“evitar problemasÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.2, feedback: 'Riesgoso: la prisa es el gancho.' },
                { texto: 'Pausar, respirar y verificar por canal oficial', puntaje: 1, feedback: 'Bien: reduces errores.' },
              ],
            },
            {
              texto: 'No estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s seguro si es real. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces?',
              opciones: [
                { texto: 'Pedir datos por el mismo chat', puntaje: 0.4, feedback: 'Mejor usa otro canal; el chat puede ser falso.' },
                { texto: 'Buscar el canal oficial (app/web que escribes tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº)', puntaje: 1, feedback: 'Correcto: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº controlas el canal.' },
                { texto: 'Compartir el mensaje y preguntar', puntaje: 0.6, feedback: 'Puede ayudar, pero no es verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n oficial.' },
              ],
            },
          ],
        }
      : modNivel === 'refuerzo'
        ? {
            intro: 'Ahora es mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s ambiguo: hay seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales mezcladas.',
            pasos: [
              {
                texto: 'Te escribe alguien conocido y manda un link ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“para confirmarÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â algo que no esperabas.',
                opciones: [
                  { texto: 'Abrir el link por confianza', puntaje: 0.3, feedback: 'Regular: ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“conocidoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â no garantiza; pudo ser hackeo.' },
                  { texto: 'Pedir verificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por otro canal (llamada)', puntaje: 1, feedback: 'Bien: verificas identidad antes de abrir.' },
                  { texto: 'Reenviar el link a otros', puntaje: 0.4, feedback: 'Riesgoso: amplificas el fraude.' },
                ],
              },
              {
                texto: 'La ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ofertaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â se ve buena pero no absurda. ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿CÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³mo decides?',
                opciones: [
                  { texto: 'Comprar si el sitio ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“se ve bonitoÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.4, feedback: 'Regular: el diseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±o no prueba que sea real.' },
                  { texto: 'Verificar dominio/contacto/pago con calma', puntaje: 1, feedback: 'Correcto: verificas por pasos.' },
                ],
              },
            ],
          }
        : {
            intro: 'Escenario avanzado: el mensaje suena profesional, pero puede ser fraude.',
            pasos: [
              {
                texto: 'Te llega un aviso ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“muy formalÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â y te pide que confirmes datos para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“protegerÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â tu cuenta.',
                opciones: [
                  { texto: 'Responder con mis datos ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“para cerrar el temaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â', puntaje: 0.2, feedback: 'Riesgoso: datos por mensaje = phishing.' },
                  { texto: 'Ignorar el mensaje y verificar en app/canal oficial', puntaje: 1, feedback: 'Bien: tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº controlas el canal.' },
                  { texto: 'Pedir que te lo manden por otro medio', puntaje: 0.6, feedback: 'Mejor verifica tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº: no sigas su flujo.' },
                ],
              },
              {
                texto: 'Te meten urgencia con consecuencias (ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“se cancelaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â, ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“se bloqueaÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â). ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© haces?',
                opciones: [
                  { texto: 'Acelerar y hacer lo que piden', puntaje: 0.2, feedback: 'Riesgoso: la urgencia es la trampa.' },
                  { texto: 'Pausar y validar 2 seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales clave antes de actuar', puntaje: 1, feedback: 'Correcto: verificas antes de mover dinero/datos.' },
                ],
              },
            ],
          };

  return {
    id: modId,
    titulo: 'HÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡bitos de VerificaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
    descripcion: `Construye una rutina ${levelHint} para evitar fraudes ${toneNote}.`,
    categoria: 'habitos',
    nivel: modNivel,
    actividades: [
      mk(1, {
        tipo: 'concepto',
        titulo: 'Tu Pausa de 10 Segundos',
        contenido:
          'La mayorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a de estafas funcionan por prisa. Antes de actuar: pausa, revisa seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales y verifica por un canal oficial. ' +
          'No necesitas ser experto: necesitas una rutina simple.',
        peso: 0.9,
      }),
      mk(2, {
        tipo: 'scenario_flow',
        titulo: 'Rutina en AcciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n',
        ...habitFlow,
        peso: 1.3,
      }),
      mk(3, {
        tipo: 'quiz',
        titulo: 'Prioridad Correcta',
        escenario: 'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© va primero cuando algo te mete urgencia?',
        opciones: ['Actuar', 'Pausar y verificar', 'Compartir datos', 'Pagar para ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“resolverÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â'],
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
          'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Lo esperaba?',
          'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Hay urgencia/miedo?',
          'ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿Pide datos/dinero?',
          'Verifico por canal oficial.',
        ],
        peso: 1.0,
      }),
    ],
  };
};

const buildFallbackCoursePlan = ({ answers, assessment, prefs, progress }) => {
  const priority = String(answers?.priority || '').toLowerCase();
  const topics = Array.isArray(prefs?.temas) ? prefs.temas : [];
  const wantAll = priority === 'todo' || topics.includes('todo');
  const signals = detectSignals(answers);

  const categories = chooseCourseCategories({ answers, assessment, prefs });
  const levels = computeModuleLevels(categories, { answers, assessment, prefs });
  const ruta = buildCourseRoute({ categories, levels, answers, assessment, prefs, progress });

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
    planVersion: COURSE_PLAN_VERSION,
    score_name: 'Blindaje Digital',
    score_total,
    competencias,
    ruta,
  };
};

const buildAdminCoursePlan = ({ answers, assessment, prefs, progress }) => {
  const basePlan = buildFallbackCoursePlan({ answers, assessment, prefs, progress });
  const categories = [];
  const levels = [];

  MODULE_LEVELS.forEach((level) => {
    ADMIN_REVIEW_CATEGORIES.forEach((category) => {
      categories.push(category);
      levels.push(level);
    });
  });

  return {
    ...basePlan,
    planVersion: COURSE_PLAN_VERSION,
    planScope: 'admin_full',
    adminMode: true,
    routeMode: 'review',
    ruta: buildCourseRoute({
      categories,
      levels,
      answers,
      assessment,
      prefs,
      progress,
    }),
  };
};

const enrichAssessmentPayload = (assessment, answers) => {
  const safeAssessment = assessment && typeof assessment === 'object' ? deepCopy(assessment) : {};
  const fallbackPlan = buildFallbackCoursePlan({
    answers,
    assessment: safeAssessment,
    prefs: {},
    progress: null,
  });

  if (!safeAssessment.score_name) {
    safeAssessment.score_name = fallbackPlan.score_name;
  }

  if (!Number.isFinite(Number(safeAssessment.score_total))) {
    safeAssessment.score_total = fallbackPlan.score_total;
  } else {
    safeAssessment.score_total = clampNumber(safeAssessment.score_total, 0, 100);
  }

  if (!safeAssessment.competencias || typeof safeAssessment.competencias !== 'object') {
    safeAssessment.competencias = deepCopy(fallbackPlan.competencias);
  }

  return safeAssessment;
};

const sanitizeCoursePlan = (plan, { answers, assessment, prefs, progress }) => {
  const fallback = buildFallbackCoursePlan({ answers, assessment, prefs, progress });
  const safe = {
    planVersion: COURSE_PLAN_VERSION,
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
    'call_sim',
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
      call_sim: 4,
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
    const scenarioId =
      toText(act.scenarioId) ||
      fingerprintScenarioId(
        tipo,
        act.titulo,
        act.escenario,
        act.prompt,
        act.mensaje,
        act.intro,
        act?.pagina?.dominio,
        act?.from,
        act?.subject
      );
    const titulo = toText(act.titulo) || `Actividad ${aIdx + 1}`;
    const peso = clampNumber(act.peso ?? act.puntos ?? 1, 0.5, 3);

    const base = { id, scenarioId, tipo, titulo, peso };

    if (tipo === 'concepto') {
      return {
        ...base,
        contenido: toText(act.contenido || act.texto || act.descripcion).slice(0, 900),
        bloques: buildConceptBlocks(act.bloques || act.sections || act.secciones),
      };
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
        contactName: toText(act.contactName || act.nombre || act.contacto).slice(0, 80),
        avatarLabel: toText(act.avatarLabel || act.avatar || act.iniciales).slice(0, 6),
        contactStatus: toText(act.contactStatus || act.status || act.estado).slice(0, 40),
        quickReplies: asStringArray(act.quickReplies || act.respuestas_rapidas).slice(0, 4),
        turnos_max: clampNumber(act.turnos_max, 3, 10),
      };
    }

    if (tipo === 'call_sim') {
      const raw = Array.isArray(act.steps) ? act.steps : Array.isArray(act.pasos) ? act.pasos : [];
      const steps = raw
        .map((st, idx) => {
          if (!st || typeof st !== 'object') return null;
          const texto = toText(st.texto || st.text).slice(0, 360);
          const opciones = (Array.isArray(st.opciones) ? st.opciones : Array.isArray(st.options) ? st.options : [])
            .map((opt, oIdx) => {
              if (!opt || typeof opt !== 'object') return null;
              const texto = toText(opt.texto || opt.label || opt.text).slice(0, 220);
              if (!texto) return null;
              return {
                id: toText(opt.id) || `o${oIdx + 1}`,
                texto,
                puntaje: clampNumber(opt.puntaje ?? opt.score ?? 0.6, 0, 1),
                feedback: toText(opt.feedback || opt.retro).slice(0, 260),
              };
            })
            .filter(Boolean)
            .slice(0, 5);
          if (!texto || opciones.length < 2) return null;
          return { id: toText(st.id) || `p${idx + 1}`, texto, opciones };
        })
        .filter(Boolean)
        .slice(0, 6);
      if (steps.length < 2) return null;
      return {
        ...base,
        intro: toText(act.intro).slice(0, 220),
        callerName: toText(act.callerName || act.nombre || act.caller).slice(0, 90),
        callerNumber: toText(act.callerNumber || act.numero || act.number).slice(0, 60),
        opening: toText(act.opening || act.inicio || act.escenario).slice(0, 240),
        allowVoice: Boolean(act.allowVoice ?? true),
        voiceProfile: toText(act.voiceProfile || act.voice || act.voz).slice(0, 20),
        steps,
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
      return {
        ...base,
        mensaje,
        senales,
        accion: toText(act.accion || act.safeAction || act.accion_segura).slice(0, 220),
      };
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
          const displayName = toText(m.displayName || m.nombre || m.alias).slice(0, 120);
          const from = toText(m.from || m.de || m.remitente).slice(0, 120);
          const subject = toText(m.subject || m.asunto).slice(0, 160);
          const preview = toText(m.preview || m.resumen).slice(0, 180);
          const dateLabel = toText(m.dateLabel || m.fecha).slice(0, 50);
          const warning = toText(m.warning || m.aviso).slice(0, 80);
          const text = toText(m.text || m.mensaje || m.cuerpo).slice(0, 320);
          const body = asStringArray(m.body || m.cuerpo_lineas).slice(0, 8);
          const attachments = asStringArray(m.attachments || m.adjuntos).slice(0, 4);
          const details =
            m.details && typeof m.details === 'object'
              ? {
                  from: toText(m.details.from || m.from).slice(0, 180),
                  replyTo: toText(m.details.replyTo || m.details.reply_to).slice(0, 180),
                  returnPath: toText(m.details.returnPath || m.details.return_path).slice(0, 180),
                }
              : null;
          const ctaLabel = toText(m.ctaLabel || m.boton).slice(0, 80);
          const linkPreview = toText(m.linkPreview || m.link).slice(0, 180);
          const cls = String(m.correcto || m.clasificacion || m.tipo || '').toLowerCase();
          const correcto = cls.includes('estafa') || cls.includes('fraud') || cls.includes('phish') ? 'estafa' : 'seguro';
          const explicacion = toText(m.explicacion || m.razon).slice(0, 220);
          if (!text) return null;
          return {
            id,
            displayName,
            from,
            subject,
            preview,
            dateLabel,
            warning,
            text,
            body,
            attachments,
            details,
            ctaLabel,
            linkPreview,
            correcto,
            explicacion,
          };
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
        brandMark: toText(p.brandMark || p.brand_mark).slice(0, 6),
        dominio: toText(p.dominio || p.url).slice(0, 80) || 'novatienda-mx.shop',
        browserTitle: toText(p.browserTitle || p.browser_title).slice(0, 90),
        themeVariant: toText(p.themeVariant || p.theme_variant).slice(0, 30),
        layoutVariant: toText(p.layoutVariant || p.layout_variant).slice(0, 30),
        guideMode: toText(p.guideMode || p.guide_mode).slice(0, 20),
        headerTagline: toText(p.headerTagline || p.header_tagline).slice(0, 60),
        heroTitle: toText(p.heroTitle || p.hero_title).slice(0, 120),
        heroBody: toText(p.heroBody || p.hero_body).slice(0, 180),
        sealLabel: toText(p.sealLabel || p.seal_label).slice(0, 50),
        banner: toText(p.banner || p.hero).slice(0, 90),
        sub: toText(p.sub || p.subtitulo || p.copy).slice(0, 120),
        contacto: toText(p.contacto || p.contact).slice(0, 160),
        pagos: asStringArray(p.pagos).slice(0, 5),
        shipping: toText(p.shipping || p.envio).slice(0, 160),
        reviews: toText(p.reviews || p.resenas).slice(0, 160),
        reviewsLabel: toText(p.reviewsLabel || p.reviews_label).slice(0, 60),
        policy: toText(p.policy || p.politicas).slice(0, 160),
        cartHeadline: toText(p.cartHeadline || p.cart_headline).slice(0, 120),
        cartNote: toText(p.cartNote || p.carrito).slice(0, 120),
        checkoutHeadline: toText(p.checkoutHeadline || p.checkout_headline).slice(0, 120),
        checkoutPrompt: toText(p.checkoutPrompt || p.checkout_prompt).slice(0, 160),
        liveToasts: asStringArray(p.liveToasts || p.live_toasts).slice(0, 5),
        productos: Array.isArray(p.productos)
          ? p.productos
              .map((x) => ({
                nombre: toText(x?.nombre || x?.name).slice(0, 70),
                antes: toText(x?.antes || x?.old_price).slice(0, 30),
                precio: toText(x?.precio || x?.price).slice(0, 30),
                badge: toText(x?.badge || x?.tag).slice(0, 40),
                caption: toText(x?.caption || x?.sub).slice(0, 80),
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
          const allowedTargets = ['domain', 'banner', 'contacto', 'pago', 'shipping', 'reviews', 'policy', 'search', 'cart_icon', 'order_summary', 'address_form'];
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
      return {
        ...base,
        intro,
        pagina,
        hotspots,
        decisionPrompt: toText(act.decisionPrompt || act.preguntaDecision).slice(0, 180),
        decisionOptions: asStringArray(act.decisionOptions || act.opcionesDecision).slice(0, 4),
        correctDecision: Number.isFinite(Number(act.correctDecision))
          ? clampNumber(act.correctDecision, 0, 3)
          : null,
      };
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
    const titulo = toText(mod.titulo) || `MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo ${idx + 1}`;
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
    if (cat === 'llamadas') return types.has('call_sim') && types.has('abierta');
    return types.has('scenario_flow') && types.has('checklist');
  };

  const used = new Set();
  const fallbackRoute = Array.isArray(fallback?.ruta) ? fallback.ruta : [];
  const finalRoute = Array.isArray(expectedCats) && expectedCats.length === COURSE_MODULE_COUNT
    ? expectedCats.map((cat, idx) => {
        const normalized = normalizeCourseCategory(cat);
        const found = pool.findIndex((m, mIdx) => !used.has(mIdx) && m.categoria === normalized);
        const nivel = expectedLevels[idx] || 'basico';
        let mod =
          found !== -1
            ? { ...pool[found], categoria: normalized, nivel }
            : fallbackRoute[idx] || buildModuleTemplate({ categoria: normalized, index: idx, answers, assessment, nivel, progress, occurrence: idx });
        if (found !== -1) used.add(found);

        if (!moduleMeetsRequirements(mod)) {
          mod = fallbackRoute[idx] || buildModuleTemplate({ categoria: normalized, index: idx, answers, assessment, nivel, progress, occurrence: idx });
        }
        return mod;
      })
    : fallback.ruta;

  // Avoid duplicate module titles by adding a level suffix when needed.
  const titleCounts = {};
  const categoryScenarioSeen = {};
  safe.ruta = finalRoute.map((mod, idx) => {
    const fallbackModule = fallbackRoute[idx] || mod;
    const categoryKey = normalizeCourseCategory(mod?.categoria);
    categoryScenarioSeen[categoryKey] = categoryScenarioSeen[categoryKey] || new Set();
    let safeModule = mod;

    const hasDuplicateWithinModule = (module) => {
      const seen = new Set();
      return (Array.isArray(module?.actividades) ? module.actividades : []).some((activity) => {
        const repeatKey = getActivityRepeatKey(activity);
        if (!repeatKey) return false;
        if (seen.has(repeatKey)) return true;
        seen.add(repeatKey);
        return false;
      });
    };

    const overlapsCategory = (module) =>
      (Array.isArray(module?.actividades) ? module.actividades : []).some((activity) => {
        const repeatKey = getActivityRepeatKey(activity);
        return repeatKey && categoryScenarioSeen[categoryKey].has(repeatKey);
      });

    if (hasDuplicateWithinModule(safeModule) || overlapsCategory(safeModule)) {
      safeModule = fallbackModule;
    }

    const baseTitle = String(safeModule?.titulo || `MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo ${idx + 1}`).trim();
    const key = baseTitle.toLowerCase();
    titleCounts[key] = (titleCounts[key] || 0) + 1;
    const levelLabel =
      normalizeModuleLevel(safeModule?.nivel) === 'avanzado'
        ? 'Avanzado'
        : normalizeModuleLevel(safeModule?.nivel) === 'refuerzo'
          ? 'Refuerzo'
          : 'BÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡sico';
    (Array.isArray(safeModule?.actividades) ? safeModule.actividades : []).forEach((activity) => {
      const repeatKey = getActivityRepeatKey(activity);
      if (repeatKey) categoryScenarioSeen[categoryKey].add(repeatKey);
    });
    if (titleCounts[key] === 1) return { ...safeModule, titulo: baseTitle };
    return { ...safeModule, titulo: `${baseTitle} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${levelLabel}` };
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
        moduleTitle: module.titulo || `MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo ${index + 1}`,
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
      title: module.titulo || `MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo ${index + 1}`,
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

const aggregateAnalytics = (users) => {
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
      return res.status(400).json({ error: 'Correo invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido.', status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `La contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        status: 400,
      });
    }

    await deleteExpiredSessions();
    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: 'Ese correo ya estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ registrado.', status: 409 });
    }

    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash: await createPasswordHash(password),
      role: await pickRoleForEmail(email),
      createdAt: nowIso(),
      lastAccessAt: nowIso(),
      state: createEmptyUserState(),
    };

    const createdUser = await createDbUser(user);
    const token = await createSession(createdUser.id);

    return res.json({
      token,
      user: sanitizeUserForClient(createdUser),
      state: getUserState(createdUser),
    });
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ese correo ya estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ registrado.', status: 409 });
    }
    console.error('Error /api/auth/register:', error);
    return res.status(500).json({ error: 'No se pudo crear la cuenta.', status: 500 });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    await deleteExpiredSessions();
    const user = await findUserByEmail(email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Correo o contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a incorrectos.', status: 401 });
    }

    user.lastAccessAt = nowIso();
    user.state = user.state && typeof user.state === 'object' ? user.state : createEmptyUserState();
    user.state.updatedAt = nowIso();
    const savedUser = await saveUser(user);
    const token = await createSession(user.id);

    return res.json({
      token,
      user: sanitizeUserForClient(savedUser || user),
      state: getUserState(savedUser || user),
    });
  } catch (error) {
    console.error('Error /api/auth/login:', error);
    return res.status(500).json({ error: 'No se pudo iniciar sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.', status: 500 });
  }
});

app.get('/api/auth/session', requireAuth, async (req, res) => {
  const state = await buildUserState(req.auth.user.id);
  return res.json({
    user: sanitizeUserForClient(req.auth.user),
    state,
  });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const { token } = req.auth;
    await deleteDbSession(token);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error /api/auth/logout:', error);
    return res.status(500).json({ error: 'No se pudo cerrar la sesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.', status: 500 });
  }
});

app.get('/api/user/state', requireAuth, async (req, res) => {
  const state = await buildUserState(req.auth.user.id);
  return res.json({
    user: sanitizeUserForClient(req.auth.user),
    state,
  });
});

app.post('/api/user/state', requireAuth, async (req, res) => {
  try {
    const { user } = req.auth;
    const currentState = await buildUserState(user.id);
    const mergedState = sanitizeClientStatePayload({
      ...currentState,
      ...req.body,
    });
    const savedUser = await syncUserState(user.id, mergedState);
    return res.json({
      ok: true,
      user: sanitizeUserForClient(savedUser || user),
      state: getUserState(savedUser || user),
    });
  } catch (error) {
    console.error('Error /api/user/state:', error);
    return res.status(500).json({ error: 'No se pudo guardar el progreso.', status: 500 });
  }
});

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    await deleteExpiredSessions();
    const users = await listUsers();
    return res.json(aggregateAnalytics(users));
  } catch (error) {
    console.error('Error /api/admin/analytics:', error);
    return res.status(500).json({ error: 'No se pudieron generar las mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©tricas.', status: 500 });
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
      return res.json(
        enrichAssessmentPayload(
          {
        nivel: 'Medio',
        resumen:
          'No se pudo interpretar la respuesta del modelo. Mostramos un resultado preliminar.',
        recomendaciones: fallback.recomendaciones,
        proximos_pasos: fallback.proximos_pasos,
          },
          answers
        )
      );
    }

    return res.json(enrichAssessmentPayload(sanitizeAssessment(parsed, answers), answers));
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
    const requestedAdminAccess = Boolean(req.body?.adminAccess);

    if (requestedAdminAccess) {
      const auth = await resolveOptionalAuth(req);
      if (!auth) {
        return res.status(401).json({ error: 'SesiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n no vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida para modo admin.', status: 401 });
      }
      if (auth.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso restringido.', status: 403 });
      }
      return res.json(buildAdminCoursePlan({ answers, assessment, prefs, progress }));
    }

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
    const safe = sanitizeCoursePlan(parsed, { answers, assessment, prefs, progress });
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
      'Buen intento. Revisa las seÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ales clave y vuelve a intentarlo.';

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
    let signal_detected = toText(parsed.signal_detected || parsed.signal || parsed.senal);
    let risk = toText(parsed.risk || parsed.riesgo);
    let safe_action = toText(parsed.safe_action || parsed.action || parsed.accion);
    let rating = toText(parsed.rating || parsed.clasificacion || parsed.resultado);
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
    if (!signal_detected) {
      signal_detected = 'La conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ metiendo urgencia para que actÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºes dentro del mismo chat.';
    }
    if (!risk) {
      risk = 'Si sigues el flujo del estafador, puede obtener dinero, cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digos o acceso a tu cuenta.';
    }
    if (!safe_action) {
      safe_action = 'DetÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©n la conversaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n y verifica por un canal oficial que tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âº controles.';
    }
    if (!rating) {
      rating = score >= 0.85 ? 'Buena' : score >= 0.6 ? 'Regular' : 'Riesgosa';
    }

    // Safety scrub: no links or phone numbers in the simulated scammer reply.
    reply = String(reply || '')
      .replaceAll(/https?:\/\/\S+/gi, '[link]')
      .replaceAll(/\b\d{6,}\b/g, '[numero]');
    coach_feedback = String(coach_feedback || '').slice(0, 700);
    signal_detected = String(signal_detected || '').slice(0, 220);
    risk = String(risk || '').slice(0, 260);
    safe_action = String(safe_action || '').slice(0, 260);
    rating = ['Buena', 'Regular', 'Riesgosa'].includes(rating) ? rating : 'Regular';

    return res.json({
      reply: String(reply).slice(0, 500),
      coach_feedback,
      signal_detected,
      risk,
      safe_action,
      rating,
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

await initDb();

app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
