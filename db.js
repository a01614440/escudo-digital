import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const LEGACY_STORE_PATH = path.join(process.cwd(), 'data', 'escudo-store.json');

const nowIso = () => new Date().toISOString();

const safeClone = (value) => JSON.parse(JSON.stringify(value ?? null));

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const parseJsonField = (value, fallback) => {
  if (value == null) return safeClone(fallback);
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return safeClone(fallback);
    }
  }
  return safeClone(value);
};

const toIso = (value, fallback = null) => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const toInt = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : fallback;
};

const toNullableNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const firstText = (...values) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const firstNullableText = (...values) => {
  const text = firstText(...values);
  return text || null;
};

const toBooleanLike = (value) => {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (['si', 'sí', 'yes', 'true', '1', 'y'].includes(raw)) return true;
  if (['no', 'false', '0', 'n'].includes(raw)) return false;
  return null;
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const stableJson = (value) => JSON.stringify(canonicalize(value ?? null));

const normalizeCategory = (value) => {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!raw) return 'habitos';
  if (raw.includes('whatsapp')) return 'whatsapp';
  if (raw.includes('sms') || raw.includes('texto')) return 'sms';
  if (raw.includes('llamada') || raw.includes('vishing') || raw.includes('call')) return 'llamadas';
  if (raw.includes('correo') || raw.includes('email') || raw.includes('social') || raw.includes('red')) {
    return 'correo_redes';
  }
  if (raw.includes('web') || raw.includes('pagina') || raw.includes('sitio') || raw.includes('domain')) {
    return 'web';
  }
  return 'habitos';
};

const normalizeModuleLevel = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw.startsWith('ava')) return 'avanzado';
  if (raw.startsWith('ref')) return 'refuerzo';
  return 'basico';
};

const computePlanSignature = (plan) => {
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  const ids = route.map((module) => String(module?.id || '')).join('|');
  const activityCount = route.reduce(
    (acc, module) => acc + (Array.isArray(module?.actividades) ? module.actividades.length : 0),
    0
  );
  return `${Number(plan?.planVersion) || 0}::${String(plan?.score_name || '')}::${ids}::${activityCount}`;
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

const normalizeActivity = (rawActivity, moduleId, index) => {
  const safe = asObject(rawActivity);
  const id =
    firstNullableText(safe.id, safe.activityId, safe.activity_id) || `${moduleId}:a${index + 1}`;
  const scenarioId = firstNullableText(safe.scenarioId, safe.scenario_id);
  const type = firstNullableText(safe.tipo, safe.type) || 'quiz';
  const title =
    firstNullableText(safe.titulo, safe.title, safe.enunciado, safe.label) || `Actividad ${index + 1}`;

  return {
    ...safeClone(safe),
    id,
    scenarioId,
    tipo: type,
    titulo: title,
  };
};

const normalizeCoursePlan = (rawPlan) => {
  const safe = asObject(rawPlan);
  const route = Array.isArray(safe.ruta) ? safe.ruta : Array.isArray(safe.route) ? safe.route : [];
  const normalizedRoute = route.map((rawModule, moduleIndex) => {
    const safeModule = asObject(rawModule);
    const id =
      firstNullableText(safeModule.id, safeModule.moduleId, safeModule.module_id) ||
      `m${moduleIndex + 1}`;
    const categoria = normalizeCategory(safeModule.categoria ?? safeModule.category);
    const nivel = normalizeModuleLevel(safeModule.nivel ?? safeModule.level ?? safeModule.dificultad);
    const titulo =
      firstNullableText(safeModule.titulo, safeModule.title) || `Modulo ${moduleIndex + 1}`;
    const descripcion = firstText(safeModule.descripcion, safeModule.description);
    const activities = Array.isArray(safeModule.actividades)
      ? safeModule.actividades
      : Array.isArray(safeModule.activities)
        ? safeModule.activities
        : [];

    return {
      ...safeClone(safeModule),
      id,
      categoria,
      nivel,
      titulo,
      descripcion,
      actividades: activities.map((activity, activityIndex) =>
        normalizeActivity(activity, id, activityIndex)
      ),
    };
  });

  const plan = {
    ...safeClone(safe),
    planVersion: toInt(safe.planVersion, 0),
    score_name: firstNullableText(safe.score_name, safe.scoreName) || 'Blindaje Digital',
    score_total: toNullableNumber(safe.score_total ?? safe.scoreTotal),
    competencias: safeClone(asObject(safe.competencias ?? safe.competencies)),
    ruta: normalizedRoute,
  };

  plan.plan_signature =
    firstNullableText(safe.plan_signature, safe.planSignature) || computePlanSignature(plan);

  return plan;
};

const normalizeAssessment = (rawAssessment, coursePlan = null) => {
  const safe = asObject(rawAssessment);
  const recommendations = Array.isArray(safe.recomendaciones)
    ? safeClone(safe.recomendaciones)
    : Array.isArray(safe.recommendations)
      ? safeClone(safe.recommendations)
      : [];
  const nextSteps = Array.isArray(safe.proximos_pasos)
    ? safeClone(safe.proximos_pasos)
    : Array.isArray(safe.next_steps)
      ? safeClone(safe.next_steps)
      : [];
  const competencies = asObject(safe.competencias ?? safe.competencies ?? coursePlan?.competencias);
  const scoreName = firstNullableText(safe.score_name, safe.scoreName, coursePlan?.score_name);
  const scoreTotal = toNullableNumber(safe.score_total ?? safe.scoreTotal ?? coursePlan?.score_total);

  const raw = {
    ...safeClone(safe),
    nivel: firstNullableText(safe.nivel, safe.level),
    resumen: firstText(safe.resumen, safe.summary),
    recomendaciones: recommendations,
    proximos_pasos: nextSteps,
  };

  if (scoreName) raw.score_name = scoreName;
  if (scoreTotal != null) raw.score_total = scoreTotal;
  if (Object.keys(competencies).length) raw.competencias = safeClone(competencies);

  return {
    raw,
    level: raw.nivel || null,
    summary: raw.resumen || null,
    recommendations,
    nextSteps,
    competencies: safeClone(competencies),
    scoreName,
    scoreTotal,
  };
};

const normalizeCourseProgress = (rawProgress) => {
  const safe = asObject(rawProgress);
  const completed = {};
  Object.entries(asObject(safe.completed)).forEach(([activityId, rawEntry]) => {
    const entry = asObject(rawEntry);
    completed[String(activityId)] = {
      score: toNullableNumber(entry.score),
      attempts: Math.max(0, toInt(entry.attempts, 0)),
      feedback: firstNullableText(entry.feedback),
      durationMs: Math.max(0, toInt(entry.durationMs, 0)),
      details: safeClone(entry.details ?? null),
      at: toIso(entry.at, null),
    };
  });

  const modules = {};
  Object.entries(asObject(safe.modules)).forEach(([moduleId, rawEntry]) => {
    const entry = asObject(rawEntry);
    modules[String(moduleId)] = {
      startedAt: toIso(entry.startedAt, null),
      completedAt: toIso(entry.completedAt, null),
      visits: Math.max(0, toInt(entry.visits, 0)),
      lastActivityId: firstNullableText(entry.lastActivityId),
      durationMs: Math.max(0, toInt(entry.durationMs, 0)),
    };
  });

  const snapshots = (Array.isArray(safe.snapshots) ? safe.snapshots : [])
    .map((rawSnapshot) => {
      const snapshot = asObject(rawSnapshot);
      return {
        at: toIso(snapshot.at, nowIso()),
        scoreTotal: Math.max(0, toInt(snapshot.scoreTotal, 0)),
        competencias: safeClone(asObject(snapshot.competencias)),
        completedCount: Math.max(0, toInt(snapshot.completedCount, 0)),
      };
    })
    .filter(Boolean);

  const seenScenarioIds = {};
  Object.entries(asObject(safe.seenScenarioIds)).forEach(([key, rawList]) => {
    const list = Array.isArray(rawList) ? rawList : [];
    const normalizedList = Array.from(
      new Set(
        list
          .map((value) => String(value ?? '').trim())
          .filter(Boolean)
      )
    );
    if (normalizedList.length) seenScenarioIds[String(key)] = normalizedList;
  });

  return {
    planSig: firstNullableText(safe.planSig),
    completed,
    modules,
    snapshots,
    seenScenarioIds,
    lastAccessAt: toIso(safe.lastAccessAt, nowIso()),
  };
};

const normalizeClientState = (rawState) => {
  const empty = createEmptyUserState();
  const safe = asObject(rawState);
  const coursePlan = safe.coursePlan ? normalizeCoursePlan(safe.coursePlan) : null;
  const courseProgress = coursePlan && safe.courseProgress ? normalizeCourseProgress(safe.courseProgress) : null;
  const assessment = safe.assessment ? normalizeAssessment(safe.assessment, coursePlan).raw : null;

  if (coursePlan && courseProgress && !courseProgress.planSig) {
    courseProgress.planSig = computePlanSignature(coursePlan);
  }

  return {
    answers: safeClone(asObject(safe.answers)),
    assessment,
    coursePlan,
    courseProgress,
    currentView: ['survey', 'courses', 'lesson', 'admin'].includes(String(safe.currentView))
      ? String(safe.currentView)
      : empty.currentView,
    surveyIndex: Math.max(0, toInt(safe.surveyIndex, 0)),
    surveyStage: ['survey', 'loading', 'results'].includes(String(safe.surveyStage))
      ? String(safe.surveyStage)
      : empty.surveyStage,
    currentLesson: {
      moduleIndex: Math.max(0, toInt(safe.currentLesson?.moduleIndex, 0)),
      activityIndex: Math.max(0, toInt(safe.currentLesson?.activityIndex, 0)),
    },
    updatedAt: toIso(safe.updatedAt, nowIso()),
  };
};

const extractSurveyMetadata = (answers) => ({
  ageBucket: firstNullableText(answers.edad, answers.age, answers.ageRange, answers.rangoEdad),
  stateCode: firstNullableText(answers.estado, answers.state, answers.estadoMexico),
  knowledgeLevel: firstNullableText(
    answers.knowledge,
    answers.conocimiento,
    answers.knowledgeLevel,
    answers.nivelConocimiento
  ),
  priority: firstNullableText(answers.priority, answers.prioridad, answers.interes, answers.focus),
  previousVictim: toBooleanLike(
    answers.scammed ?? answers.fueVictima ?? answers.victima ?? answers.previouslyScammed
  ),
});

const hashSessionToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

const shouldUseSsl = (() => {
  if (!DATABASE_URL) return false;
  const flag = String(process.env.PGSSL ?? process.env.PGSSLMODE ?? '').trim().toLowerCase();
  if (['disable', 'false', '0', 'off'].includes(flag)) return false;
  if (['require', 'true', '1', 'on'].includes(flag)) return true;
  return /railway|rlwy|supabase|render|amazonaws/i.test(DATABASE_URL);
})();

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_access_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_state_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS survey_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers_json JSONB NOT NULL,
  age_bucket TEXT,
  state_code TEXT,
  knowledge_level TEXT,
  priority TEXT,
  previous_victim BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_user_id ON survey_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_age_bucket ON survey_submissions(age_bucket);
CREATE UNIQUE INDEX IF NOT EXISTS uq_survey_submissions_current
  ON survey_submissions(user_id) WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  survey_submission_id TEXT REFERENCES survey_submissions(id) ON DELETE SET NULL,
  level TEXT,
  score_name TEXT,
  score_total DOUBLE PRECISION,
  summary TEXT,
  recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  competencies_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_current BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_level ON assessments(level);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessments_current
  ON assessments(user_id) WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS course_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
  plan_version INTEGER NOT NULL DEFAULT 0,
  score_name TEXT,
  score_total DOUBLE PRECISION,
  competencies_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  route_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  plan_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_course_plans_user_id ON course_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_course_plans_assessment_id ON course_plans(assessment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_plans_active
  ON course_plans(user_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS course_plan_modules (
  id TEXT PRIMARY KEY,
  course_plan_id TEXT NOT NULL REFERENCES course_plans(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  category TEXT,
  level TEXT,
  title TEXT,
  description TEXT,
  module_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (course_plan_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_course_plan_modules_plan_position
  ON course_plan_modules(course_plan_id, position);
CREATE INDEX IF NOT EXISTS idx_course_plan_modules_category_level
  ON course_plan_modules(category, level);

CREATE TABLE IF NOT EXISTS course_plan_activities (
  id TEXT PRIMARY KEY,
  course_plan_id TEXT NOT NULL REFERENCES course_plans(id) ON DELETE CASCADE,
  course_plan_module_id TEXT NOT NULL REFERENCES course_plan_modules(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  scenario_id TEXT,
  activity_type TEXT,
  title TEXT,
  weight DOUBLE PRECISION,
  activity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (course_plan_id, activity_id)
);
CREATE INDEX IF NOT EXISTS idx_course_plan_activities_plan_position
  ON course_plan_activities(course_plan_id, position);
CREATE INDEX IF NOT EXISTS idx_course_plan_activities_scenario
  ON course_plan_activities(scenario_id);

CREATE TABLE IF NOT EXISTS module_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_plan_id TEXT NOT NULL REFERENCES course_plans(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  category TEXT,
  level TEXT,
  title TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  visits INTEGER NOT NULL DEFAULT 0,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  last_activity_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_plan_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_module_progress_user_plan
  ON module_progress(user_id, course_plan_id);

CREATE TABLE IF NOT EXISTS activity_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_plan_id TEXT NOT NULL REFERENCES course_plans(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  scenario_id TEXT,
  activity_type TEXT,
  category TEXT,
  level TEXT,
  title TEXT,
  score DOUBLE PRECISION,
  attempts INTEGER NOT NULL DEFAULT 0,
  feedback TEXT,
  details_json JSONB,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_plan_id, activity_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_progress_user_plan
  ON activity_progress(user_id, course_plan_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_category_level
  ON activity_progress(category, level);

CREATE TABLE IF NOT EXISTS activity_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_plan_id TEXT REFERENCES course_plans(id) ON DELETE SET NULL,
  module_id TEXT,
  activity_id TEXT NOT NULL,
  scenario_id TEXT,
  activity_type TEXT,
  score DOUBLE PRECISION,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  feedback TEXT,
  details_json JSONB,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'state_sync',
  UNIQUE (user_id, course_plan_id, activity_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_activity_attempts_user_created
  ON activity_attempts(user_id, created_at);

CREATE TABLE IF NOT EXISTS learning_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
  course_plan_id TEXT REFERENCES course_plans(id) ON DELETE SET NULL,
  score_total DOUBLE PRECISION,
  competencies_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_snapshots_user_created
  ON learning_snapshots(user_id, created_at);

CREATE TABLE IF NOT EXISTS seen_scenarios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_plan_id TEXT REFERENCES course_plans(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  times_seen INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, category, level, scenario_id)
);
CREATE INDEX IF NOT EXISTS idx_seen_scenarios_user_category_level
  ON seen_scenarios(user_id, category, level);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_type TEXT NOT NULL DEFAULT 'manual_import',
  source_label TEXT,
  generated_at TIMESTAMPTZ,
  total_users INTEGER,
  active_users_7d INTEGER,
  average_shield DOUBLE PRECISION,
  average_improvement DOUBLE PRECISION,
  activity_completion_rate DOUBLE PRECISION,
  module_completion_rate DOUBLE PRECISION,
  avg_days_to_improve DOUBLE PRECISION,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_generated_at
  ON analytics_snapshots(generated_at DESC);

CREATE TABLE IF NOT EXISTS legacy_user_metrics (
  id TEXT PRIMARY KEY,
  analytics_snapshot_id TEXT NOT NULL REFERENCES analytics_snapshots(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  age_bucket TEXT,
  initial_level TEXT,
  current_shield DOUBLE PRECISION,
  improvement DOUBLE PRECISION,
  progress_percent DOUBLE PRECISION,
  last_access_at TIMESTAMPTZ,
  source_generated_at TIMESTAMPTZ,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (analytics_snapshot_id, email)
);
CREATE INDEX IF NOT EXISTS idx_legacy_user_metrics_email
  ON legacy_user_metrics(email);
CREATE INDEX IF NOT EXISTS idx_legacy_user_metrics_age_bucket
  ON legacy_user_metrics(age_bucket);
`;

let initPromise = null;
const DEV_FILE_STORE_PATH = path.join(process.cwd(), 'data', 'dev-db.json');
const isDevFileFallbackAllowed = (() => {
  const flag = String(process.env.DEV_FILE_DB_FALLBACK ?? process.env.ALLOW_LOCAL_DB_FALLBACK ?? '')
    .trim()
    .toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(flag)) return false;
  if (['1', 'true', 'on', 'yes'].includes(flag)) return true;
  return process.env.NODE_ENV !== 'production';
})();

let activeDbMode = 'postgres';
let fileFallbackReason = null;
let fileStore = null;
let fileStoreInitPromise = null;
let fileStoreWritePromise = Promise.resolve();

const createEmptyFileStore = () => ({
  meta: {
    mode: 'file-fallback',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  users: {},
  sessions: {},
  analyticsSnapshots: [],
});

const normalizeFileUserRecord = (rawUser) => {
  const safe = asObject(rawUser);
  const createdAt = toIso(safe.createdAt ?? safe.created_at, nowIso());
  return {
    id: firstNullableText(safe.id) || crypto.randomUUID(),
    email: String(safe.email || '').trim().toLowerCase(),
    passwordHash: firstText(safe.passwordHash, safe.password_hash),
    role: firstNullableText(safe.role) || 'user',
    createdAt,
    updatedAt: toIso(safe.updatedAt ?? safe.updated_at, createdAt),
    lastAccessAt: toIso(safe.lastAccessAt ?? safe.last_access_at, createdAt),
    state: normalizeClientState(safe.state ?? safe.client_state_json),
  };
};

const normalizeFileSessionRecord = (rawSession) => {
  const safe = asObject(rawSession);
  const createdAt = toIso(safe.createdAt ?? safe.created_at, nowIso());
  return {
    id: firstNullableText(safe.id) || crypto.randomUUID(),
    userId: firstNullableText(safe.userId, safe.user_id),
    tokenHash: firstNullableText(safe.tokenHash, safe.token_hash),
    createdAt,
    lastSeenAt: toIso(safe.lastSeenAt ?? safe.last_seen_at, createdAt),
    expiresAt: toIso(safe.expiresAt ?? safe.expires_at, createdAt),
    userAgent: firstNullableText(safe.userAgent, safe.user_agent),
    ip: firstNullableText(safe.ip),
  };
};

const normalizeFileStore = (rawStore) => {
  const safe = asObject(rawStore);
  const normalized = createEmptyFileStore();

  const meta = asObject(safe.meta);
  normalized.meta.createdAt = toIso(meta.createdAt ?? meta.created_at, normalized.meta.createdAt);
  normalized.meta.updatedAt = toIso(meta.updatedAt ?? meta.updated_at, normalized.meta.updatedAt);

  for (const [key, rawUser] of Object.entries(asObject(safe.users))) {
    const user = normalizeFileUserRecord(rawUser);
    if (!user.id || !user.email) continue;
    normalized.users[String(key || user.id)] = user;
  }

  for (const [key, rawSession] of Object.entries(asObject(safe.sessions))) {
    const session = normalizeFileSessionRecord(rawSession);
    if (!session.userId || !session.tokenHash) continue;
    normalized.sessions[String(key || session.tokenHash)] = session;
  }

  normalized.analyticsSnapshots = Array.isArray(safe.analyticsSnapshots)
    ? safe.analyticsSnapshots.map((snapshot) => safeClone(snapshot)).filter(Boolean)
    : [];

  return normalized;
};

const queueFileStoreWrite = async () => {
  if (!fileStore) return;
  fileStore.meta.updatedAt = nowIso();
  const payload = JSON.stringify(fileStore, null, 2);
  fileStoreWritePromise = fileStoreWritePromise.then(async () => {
    await fs.mkdir(path.dirname(DEV_FILE_STORE_PATH), { recursive: true });
    await fs.writeFile(DEV_FILE_STORE_PATH, payload, 'utf8');
  });
  return fileStoreWritePromise;
};

const ensureFileStore = async () => {
  if (fileStore) return fileStore;
  if (!fileStoreInitPromise) {
    fileStoreInitPromise = (async () => {
      try {
        const raw = await fs.readFile(DEV_FILE_STORE_PATH, 'utf8');
        fileStore = normalizeFileStore(JSON.parse(raw));
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        fileStore = createEmptyFileStore();
        await queueFileStoreWrite();
      }
      return fileStore;
    })();
  }
  return fileStoreInitPromise;
};

const shouldUseDevFileFallback = (error = null) => {
  if (!isDevFileFallbackAllowed || activeDbMode === 'file') return false;
  if (!DATABASE_URL) return true;

  const code = String(error?.code || '').trim().toUpperCase();
  if (['28P01', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '57P03'].includes(code)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return [
    'password authentication failed',
    'connect econnrefused',
    'connection terminated unexpectedly',
    'getaddrinfo',
    'timeout expired',
    'the database system is starting up',
  ].some((token) => message.includes(token));
};

const activateDevFileFallback = async (reason = null) => {
  await ensureFileStore();
  activeDbMode = 'file';
  fileFallbackReason = reason?.message || (reason ? String(reason) : 'fallback local activado');
  console.warn(
    `Postgres no disponible; activando fallback local en ${DEV_FILE_STORE_PATH}. Razón: ${fileFallbackReason}`
  );
  return true;
};

const findFileUserRecordByEmail = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return Object.values(fileStore?.users || {}).find((user) => user.email === normalizedEmail) || null;
};

const findFileUserRecordById = (userId) => {
  if (!fileStore) return null;
  return fileStore.users[String(userId)] || null;
};

const mapFileUserRecord = (record) => ({
  id: record.id,
  email: record.email,
  passwordHash: record.passwordHash,
  role: record.role,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  lastAccessAt: record.lastAccessAt,
  state: normalizeClientState(record.state),
});

const mapFileSessionRecord = (record) => ({
  id: record.id,
  userId: record.userId,
  tokenHash: record.tokenHash,
  createdAt: record.createdAt,
  lastSeenAt: record.lastSeenAt,
  expiresAt: record.expiresAt,
  userAgent: record.userAgent,
  ip: record.ip,
});

export const getDbRuntimeStatus = () => ({
  mode: activeDbMode,
  usingFileFallback: activeDbMode === 'file',
  fallbackReason: fileFallbackReason,
});

const migrateLegacyTables = async (client) => {
  await client.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
  );
  await client.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS client_state_json JSONB NOT NULL DEFAULT '{}'::jsonb"
  );

  const columnResult = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'"
  );
  const columns = new Set(columnResult.rows.map((row) => row.column_name));

  if (columns.has('state')) {
    await client.query(
      `UPDATE users
         SET client_state_json =
           CASE
             WHEN client_state_json = '{}'::jsonb AND state IS NOT NULL THEN state
             ELSE client_state_json
           END`
    );
  }
};

const mapUserRow = (row) => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
  createdAt: toIso(row.created_at, nowIso()),
  updatedAt: toIso(row.updated_at, nowIso()),
  lastAccessAt: toIso(row.last_access_at, toIso(row.created_at, nowIso())),
  state: normalizeClientState(parseJsonField(row.client_state_json, createEmptyUserState())),
});

const mapSessionRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  createdAt: toIso(row.created_at, nowIso()),
  lastSeenAt: toIso(row.last_seen_at, nowIso()),
  expiresAt: toIso(row.expires_at, nowIso()),
  userAgent: firstNullableText(row.user_agent),
  ip: firstNullableText(row.ip),
});

const assessmentRowToClient = (row) => {
  if (!row) return null;
  const payload = {
    nivel: firstNullableText(row.level),
    resumen: firstText(row.summary),
    recomendaciones: parseJsonField(row.recommendations_json, []),
    proximos_pasos: parseJsonField(row.next_steps_json, []),
  };
  if (row.score_name) payload.score_name = row.score_name;
  if (row.score_total != null) payload.score_total = Number(row.score_total);
  const competencies = parseJsonField(row.competencies_json, {});
  if (Object.keys(competencies).length) payload.competencias = competencies;
  return payload;
};

const planRowToClient = (row, route) => ({
  planVersion: toInt(row.plan_version, 0),
  score_name: row.score_name || 'Blindaje Digital',
  score_total: row.score_total != null ? Number(row.score_total) : null,
  competencias: parseJsonField(row.competencies_json, {}),
  ruta: safeClone(route),
});

const getUserRowById = async (client, userId) => {
  const result = await client.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
  return result.rows[0] || null;
};

const getCurrentSurveyRow = async (client, userId) => {
  const result = await client.query(
    'SELECT * FROM survey_submissions WHERE user_id = $1 AND is_current = TRUE LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
};

const getCurrentAssessmentRow = async (client, userId) => {
  const result = await client.query(
    'SELECT * FROM assessments WHERE user_id = $1 AND is_current = TRUE LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
};

const getActivePlanRow = async (client, userId) => {
  const result = await client.query(
    'SELECT * FROM course_plans WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
};

const loadPlanRoute = async (client, coursePlanId) => {
  const [modulesResult, activitiesResult] = await Promise.all([
    client.query(
      'SELECT * FROM course_plan_modules WHERE course_plan_id = $1 ORDER BY position ASC, module_id ASC',
      [coursePlanId]
    ),
    client.query(
      'SELECT * FROM course_plan_activities WHERE course_plan_id = $1 ORDER BY module_id ASC, position ASC, activity_id ASC',
      [coursePlanId]
    ),
  ]);

  const activitiesByModule = new Map();
  activitiesResult.rows.forEach((row) => {
    const list = activitiesByModule.get(row.module_id) || [];
    const base = asObject(parseJsonField(row.activity_json, {}));
    list.push({
      ...base,
      id: row.activity_id,
      scenarioId: firstNullableText(row.scenario_id, base.scenarioId, base.scenario_id),
      tipo: firstNullableText(row.activity_type, base.tipo, base.type) || 'quiz',
      titulo:
        firstNullableText(row.title, base.titulo, base.title, base.enunciado, base.label) ||
        row.activity_id,
    });
    activitiesByModule.set(row.module_id, list);
  });

  return modulesResult.rows.map((row) => {
    const base = asObject(parseJsonField(row.module_json, {}));
    return {
      ...base,
      id: row.module_id,
      categoria: firstNullableText(row.category, base.categoria, base.category) || 'habitos',
      nivel: firstNullableText(row.level, base.nivel, base.level) || 'basico',
      titulo: firstNullableText(row.title, base.titulo, base.title) || row.module_id,
      descripcion: firstText(row.description, base.descripcion, base.description),
      actividades: safeClone(activitiesByModule.get(row.module_id) || []),
    };
  });
};

const buildCourseProgressWithClient = async (client, user, planRow, cachedState) => {
  const planId = planRow.id;
  const cachedProgress = cachedState?.courseProgress
    ? normalizeCourseProgress(cachedState.courseProgress)
    : null;
  const activePlanSignature = firstNullableText(planRow.plan_signature);
  const cachedPlanSignature = firstNullableText(
    cachedState?.coursePlan?.plan_signature,
    cachedState?.coursePlan?.planSignature
  );
  const canUseCachedProgress =
    Boolean(cachedProgress) &&
    (!activePlanSignature ||
      !cachedProgress?.planSig ||
      cachedProgress.planSig === activePlanSignature ||
      cachedPlanSignature === activePlanSignature);
  const [modulesResult, activitiesResult, snapshotsResult, seenResult] = await Promise.all([
    client.query(
      'SELECT * FROM module_progress WHERE user_id = $1 AND course_plan_id = $2 ORDER BY module_id ASC',
      [user.id, planId]
    ),
    client.query(
      'SELECT * FROM activity_progress WHERE user_id = $1 AND course_plan_id = $2 ORDER BY activity_id ASC',
      [user.id, planId]
    ),
    client.query(
      'SELECT * FROM learning_snapshots WHERE user_id = $1 AND course_plan_id = $2 ORDER BY created_at ASC',
      [user.id, planId]
    ),
    client.query(
      'SELECT * FROM seen_scenarios WHERE user_id = $1 AND course_plan_id = $2 ORDER BY category ASC, level ASC, scenario_id ASC',
      [user.id, planId]
    ),
  ]);

  const modules = canUseCachedProgress ? safeClone(cachedProgress.modules) : {};
  modulesResult.rows.forEach((row) => {
    modules[row.module_id] = {
      startedAt: toIso(row.started_at, null),
      completedAt: toIso(row.completed_at, null),
      visits: Math.max(0, toInt(row.visits, 0)),
      lastActivityId: firstNullableText(row.last_activity_id),
      durationMs: Math.max(0, toInt(row.duration_ms, 0)),
    };
  });

  const completed = canUseCachedProgress ? safeClone(cachedProgress.completed) : {};
  activitiesResult.rows.forEach((row) => {
    completed[row.activity_id] = {
      score: row.score != null ? Number(row.score) : null,
      attempts: Math.max(0, toInt(row.attempts, 0)),
      feedback: firstNullableText(row.feedback),
      durationMs: Math.max(0, toInt(row.duration_ms, 0)),
      details: parseJsonField(row.details_json, null),
      at: toIso(row.completed_at, toIso(row.updated_at, null)),
    };
  });

  const snapshots = snapshotsResult.rows.length
    ? snapshotsResult.rows.map((row) => ({
        at: toIso(row.created_at, nowIso()),
        scoreTotal: row.score_total != null ? Number(row.score_total) : 0,
        competencias: parseJsonField(row.competencies_json, {}),
        completedCount: Math.max(0, toInt(row.completed_count, 0)),
      }))
    : canUseCachedProgress
      ? safeClone(cachedProgress.snapshots)
      : [];

  const seenScenarioIds = canUseCachedProgress ? safeClone(cachedProgress.seenScenarioIds) : {};
  seenResult.rows.forEach((row) => {
    const key = `${row.category}:${row.level}`;
    const list = seenScenarioIds[key] || [];
    list.push(row.scenario_id);
    seenScenarioIds[key] = list;
  });

  return {
    planSig:
      firstNullableText(planRow.plan_signature, cachedProgress?.planSig, cachedState?.courseProgress?.planSig) ||
      computePlanSignature(planRowToClient(planRow, [])),
    completed,
    modules,
    snapshots,
    seenScenarioIds,
    lastAccessAt:
      firstNullableText(cachedProgress?.lastAccessAt, cachedState?.courseProgress?.lastAccessAt, user.lastAccessAt) ||
      nowIso(),
  };
};

const buildUserStateWithClient = async (client, userOrRow) => {
  const row = typeof userOrRow === 'string' ? await getUserRowById(client, userOrRow) : userOrRow;
  if (!row) return createEmptyUserState();
  const user = mapUserRow(row);
  if (!user.id) return createEmptyUserState();

  const state = normalizeClientState(user.state);
  const surveyRow = await getCurrentSurveyRow(client, user.id);
  state.answers = surveyRow ? parseJsonField(surveyRow.answers_json, {}) : {};

  const assessmentRow = await getCurrentAssessmentRow(client, user.id);
  state.assessment = assessmentRow ? assessmentRowToClient(assessmentRow) : null;

  const planRow = await getActivePlanRow(client, user.id);
  if (!planRow) {
    state.coursePlan = null;
    state.courseProgress = null;
    return state;
  }

  const route = await loadPlanRoute(client, planRow.id);
  state.coursePlan = planRowToClient(planRow, route);
  state.courseProgress = await buildCourseProgressWithClient(client, user, planRow, state);
  return state;
};

const syncSurveySubmission = async (client, userId, answers) => {
  const payload = safeClone(asObject(answers));
  if (!Object.keys(payload).length) {
    await client.query('UPDATE survey_submissions SET is_current = FALSE WHERE user_id = $1 AND is_current = TRUE', [userId]);
    return null;
  }

  const current = await getCurrentSurveyRow(client, userId);
  if (current && stableJson(parseJsonField(current.answers_json, {})) === stableJson(payload)) {
    return current.id;
  }

  await client.query('UPDATE survey_submissions SET is_current = FALSE WHERE user_id = $1 AND is_current = TRUE', [userId]);
  const meta = extractSurveyMetadata(payload);
  const id = crypto.randomUUID();
  await client.query(
    `INSERT INTO survey_submissions (
      id, user_id, answers_json, age_bucket, state_code, knowledge_level, priority, previous_victim, created_at, is_current
    ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::timestamptz, TRUE)`,
    [
      id,
      userId,
      JSON.stringify(payload),
      meta.ageBucket,
      meta.stateCode,
      meta.knowledgeLevel,
      meta.priority,
      meta.previousVictim,
      nowIso(),
    ]
  );
  return id;
};

const syncAssessment = async (client, userId, surveySubmissionId, rawAssessment, coursePlan) => {
  if (!rawAssessment) {
    await client.query('UPDATE assessments SET is_current = FALSE WHERE user_id = $1 AND is_current = TRUE', [userId]);
    return null;
  }

  const normalized = normalizeAssessment(rawAssessment, coursePlan);
  const comparable = stableJson(normalized.raw);
  const current = await getCurrentAssessmentRow(client, userId);
  if (current && stableJson(assessmentRowToClient(current)) === comparable) {
    return current.id;
  }

  await client.query('UPDATE assessments SET is_current = FALSE WHERE user_id = $1 AND is_current = TRUE', [userId]);
  const id = crypto.randomUUID();
  await client.query(
    `INSERT INTO assessments (
      id, user_id, survey_submission_id, level, score_name, score_total, summary,
      recommendations_json, next_steps_json, competencies_json, created_at, is_current
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::timestamptz, TRUE
    )`,
    [
      id,
      userId,
      surveySubmissionId,
      normalized.level,
      normalized.scoreName,
      normalized.scoreTotal,
      normalized.summary,
      JSON.stringify(normalized.recommendations),
      JSON.stringify(normalized.nextSteps),
      JSON.stringify(normalized.competencies),
      nowIso(),
    ]
  );
  return id;
};

const insertPlanModulesAndActivities = async (client, coursePlanId, route) => {
  for (let moduleIndex = 0; moduleIndex < route.length; moduleIndex += 1) {
    const module = route[moduleIndex];
    const modulePk = crypto.randomUUID();
    await client.query(
      `INSERT INTO course_plan_modules (
        id, course_plan_id, module_id, position, category, level, title, description, module_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        modulePk,
        coursePlanId,
        module.id,
        moduleIndex,
        module.categoria,
        module.nivel,
        module.titulo,
        firstText(module.descripcion),
        JSON.stringify(module),
      ]
    );

    const activities = Array.isArray(module.actividades) ? module.actividades : [];
    for (let activityIndex = 0; activityIndex < activities.length; activityIndex += 1) {
      const activity = activities[activityIndex];
      await client.query(
        `INSERT INTO course_plan_activities (
          id, course_plan_id, course_plan_module_id, module_id, activity_id, position,
          scenario_id, activity_type, title, weight, activity_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
        [
          crypto.randomUUID(),
          coursePlanId,
          modulePk,
          module.id,
          activity.id,
          activityIndex,
          firstNullableText(activity.scenarioId, activity.scenario_id),
          firstNullableText(activity.tipo, activity.type) || 'quiz',
          firstNullableText(activity.titulo, activity.title, activity.enunciado, activity.label) ||
            activity.id,
          toNullableNumber(activity.weight ?? activity.peso),
          JSON.stringify(activity),
        ]
      );
    }
  }
};

const syncCoursePlan = async (client, userId, assessmentId, rawPlan) => {
  if (!rawPlan) {
    await client.query('UPDATE course_plans SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE', [userId]);
    return null;
  }

  const normalized = normalizeCoursePlan(rawPlan);
  const comparable = stableJson({
    planVersion: normalized.planVersion,
    score_name: normalized.score_name,
    score_total: normalized.score_total,
    competencias: normalized.competencias,
    ruta: normalized.ruta,
    plan_signature: normalized.plan_signature,
  });
  const current = await getActivePlanRow(client, userId);
  if (
    current &&
    stableJson({
      planVersion: toInt(current.plan_version, 0),
      score_name: current.score_name,
      score_total: current.score_total != null ? Number(current.score_total) : null,
      competencias: parseJsonField(current.competencies_json, {}),
      ruta: parseJsonField(current.route_json, []),
      plan_signature: current.plan_signature,
    }) === comparable
  ) {
    return current.id;
  }

  await client.query('UPDATE course_plans SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE', [userId]);
  const id = crypto.randomUUID();
  await client.query(
    `INSERT INTO course_plans (
      id, user_id, assessment_id, plan_version, score_name, score_total,
      competencies_json, route_json, plan_signature, created_at, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10::timestamptz, TRUE)`,
    [
      id,
      userId,
      assessmentId,
      normalized.planVersion,
      normalized.score_name,
      normalized.score_total,
      JSON.stringify(normalized.competencias),
      JSON.stringify(normalized.ruta),
      normalized.plan_signature,
      nowIso(),
    ]
  );
  await insertPlanModulesAndActivities(client, id, normalized.ruta);
  return id;
};

const syncCourseProgress = async (client, userId, coursePlanId, state) => {
  if (!coursePlanId) return;

  await client.query('DELETE FROM module_progress WHERE user_id = $1 AND course_plan_id = $2', [
    userId,
    coursePlanId,
  ]);
  await client.query('DELETE FROM activity_progress WHERE user_id = $1 AND course_plan_id = $2', [
    userId,
    coursePlanId,
  ]);
  await client.query('DELETE FROM learning_snapshots WHERE user_id = $1 AND course_plan_id = $2', [
    userId,
    coursePlanId,
  ]);
  await client.query('DELETE FROM seen_scenarios WHERE user_id = $1 AND course_plan_id = $2', [
    userId,
    coursePlanId,
  ]);

  if (!state.courseProgress || !state.coursePlan) return;

  const progress = normalizeCourseProgress(state.courseProgress);
  const plan = normalizeCoursePlan(state.coursePlan);
  const moduleLookup = new Map();
  const activityLookup = new Map();

  plan.ruta.forEach((module) => {
    moduleLookup.set(module.id, module);
    (Array.isArray(module.actividades) ? module.actividades : []).forEach((activity) => {
      activityLookup.set(activity.id, {
        moduleId: module.id,
        category: module.categoria,
        level: module.nivel,
        title: firstNullableText(activity.titulo, activity.title, activity.enunciado) || activity.id,
        scenarioId: firstNullableText(activity.scenarioId, activity.scenario_id),
        activityType: firstNullableText(activity.tipo, activity.type) || 'quiz',
      });
    });
  });

  const moduleIds = new Set([...Object.keys(progress.modules), ...plan.ruta.map((module) => module.id)]);
  for (const moduleId of moduleIds) {
    const moduleState = asObject(progress.modules[moduleId]);
    const modulePlan = moduleLookup.get(moduleId) || {};
    await client.query(
      `INSERT INTO module_progress (
        id, user_id, course_plan_id, module_id, category, level, title,
        started_at, completed_at, visits, duration_ms, last_activity_id, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10, $11, $12, NOW())
      ON CONFLICT (user_id, course_plan_id, module_id) DO UPDATE SET
        category = EXCLUDED.category,
        level = EXCLUDED.level,
        title = EXCLUDED.title,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at,
        visits = EXCLUDED.visits,
        duration_ms = EXCLUDED.duration_ms,
        last_activity_id = EXCLUDED.last_activity_id,
        updated_at = NOW()`,
      [
        crypto.randomUUID(),
        userId,
        coursePlanId,
        moduleId,
        firstNullableText(modulePlan.categoria),
        firstNullableText(modulePlan.nivel),
        firstNullableText(modulePlan.titulo) || moduleId,
        toIso(moduleState.startedAt, null),
        toIso(moduleState.completedAt, null),
        Math.max(0, toInt(moduleState.visits, 0)),
        Math.max(0, toInt(moduleState.durationMs, 0)),
        firstNullableText(moduleState.lastActivityId),
      ]
    );
  }

  for (const [activityId, completion] of Object.entries(progress.completed)) {
    const meta = activityLookup.get(activityId) || {};
    const completedAt = toIso(completion.at, progress.lastAccessAt || nowIso());
    await client.query(
      `INSERT INTO activity_progress (
        id, user_id, course_plan_id, module_id, activity_id, scenario_id, activity_type,
        category, level, title, score, attempts, feedback, details_json, duration_ms,
        completed_at, last_seen_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14::jsonb, $15,
        $16::timestamptz, $17::timestamptz, NOW()
      )
      ON CONFLICT (user_id, course_plan_id, activity_id) DO UPDATE SET
        module_id = EXCLUDED.module_id,
        scenario_id = EXCLUDED.scenario_id,
        activity_type = EXCLUDED.activity_type,
        category = EXCLUDED.category,
        level = EXCLUDED.level,
        title = EXCLUDED.title,
        score = EXCLUDED.score,
        attempts = EXCLUDED.attempts,
        feedback = EXCLUDED.feedback,
        details_json = EXCLUDED.details_json,
        duration_ms = EXCLUDED.duration_ms,
        completed_at = EXCLUDED.completed_at,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = NOW()`,
      [
        crypto.randomUUID(),
        userId,
        coursePlanId,
        firstNullableText(meta.moduleId),
        activityId,
        firstNullableText(meta.scenarioId),
        firstNullableText(meta.activityType) || 'quiz',
        firstNullableText(meta.category),
        firstNullableText(meta.level),
        firstNullableText(meta.title) || activityId,
        completion.score,
        Math.max(0, toInt(completion.attempts, 0)),
        completion.feedback,
        JSON.stringify(completion.details ?? null),
        Math.max(0, toInt(completion.durationMs, 0)),
        completedAt,
        progress.lastAccessAt || completedAt,
      ]
    );

    if (Math.max(0, toInt(completion.attempts, 0)) > 0) {
      await client.query(
        `INSERT INTO activity_attempts (
          id, user_id, course_plan_id, module_id, activity_id, scenario_id, activity_type,
          score, attempt_number, feedback, details_json, duration_ms, created_at, source
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11::jsonb, $12, $13::timestamptz, 'state_sync'
        )
        ON CONFLICT (user_id, course_plan_id, activity_id, attempt_number) DO UPDATE SET
          score = EXCLUDED.score,
          feedback = EXCLUDED.feedback,
          details_json = EXCLUDED.details_json,
          duration_ms = EXCLUDED.duration_ms,
          created_at = EXCLUDED.created_at`,
        [
          crypto.randomUUID(),
          userId,
          coursePlanId,
          firstNullableText(meta.moduleId),
          activityId,
          firstNullableText(meta.scenarioId),
          firstNullableText(meta.activityType) || 'quiz',
          completion.score,
          Math.max(1, toInt(completion.attempts, 1)),
          completion.feedback,
          JSON.stringify(completion.details ?? null),
          Math.max(0, toInt(completion.durationMs, 0)),
          completedAt,
        ]
      );
    }
  }

  for (const snapshot of progress.snapshots) {
    await client.query(
      `INSERT INTO learning_snapshots (
        id, user_id, assessment_id, course_plan_id, score_total, competencies_json, completed_count, created_at
      ) VALUES ($1, $2, NULL, $3, $4, $5::jsonb, $6, $7::timestamptz)`,
      [
        crypto.randomUUID(),
        userId,
        coursePlanId,
        snapshot.scoreTotal,
        JSON.stringify(snapshot.competencias),
        Math.max(0, toInt(snapshot.completedCount, 0)),
        snapshot.at,
      ]
    );
  }

  for (const [key, scenarioIds] of Object.entries(progress.seenScenarioIds)) {
    const [categoryPart, levelPart] = String(key).split(':');
    const category = normalizeCategory(categoryPart);
    const level = normalizeModuleLevel(levelPart);
    for (const scenarioId of scenarioIds) {
      await client.query(
        `INSERT INTO seen_scenarios (
          id, user_id, course_plan_id, category, level, scenario_id, first_seen_at, last_seen_at, times_seen
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, 1)
        ON CONFLICT (user_id, category, level, scenario_id) DO UPDATE SET
          course_plan_id = EXCLUDED.course_plan_id,
          last_seen_at = EXCLUDED.last_seen_at,
          times_seen = GREATEST(seen_scenarios.times_seen, 1)`,
        [
          crypto.randomUUID(),
          userId,
          coursePlanId,
          category,
          level,
          scenarioId,
          progress.lastAccessAt || nowIso(),
          progress.lastAccessAt || nowIso(),
        ]
      );
    }
  }
};

const syncUserStateWithClient = async (client, userId, rawState) => {
  const state = normalizeClientState(rawState);
  await client.query(
    `UPDATE users
       SET client_state_json = $2::jsonb,
           updated_at = NOW(),
           last_access_at = COALESCE($3::timestamptz, last_access_at)
     WHERE id = $1`,
    [userId, JSON.stringify(state), state.courseProgress?.lastAccessAt || nowIso()]
  );

  const surveySubmissionId = await syncSurveySubmission(client, userId, state.answers);
  const assessmentId = await syncAssessment(client, userId, surveySubmissionId, state.assessment, state.coursePlan);
  const coursePlanId = await syncCoursePlan(client, userId, assessmentId, state.coursePlan);
  await syncCourseProgress(client, userId, coursePlanId, state);
  return state;
};

const maybeImportLegacyStore = async () => {
  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if ((countResult.rows[0]?.count ?? 0) > 0) return;

  let parsed;
  try {
    const raw = await fs.readFile(LEGACY_STORE_PATH, 'utf8');
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  const usersMap = asObject(parsed?.users);
  const sessionsMap = asObject(parsed?.sessions);
  if (!Object.keys(usersMap).length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const legacyUser of Object.values(usersMap)) {
      const user = asObject(legacyUser);
      const state = normalizeClientState(user.state);
      await client.query(
        `INSERT INTO users (
          id, email, password_hash, role, created_at, updated_at, last_access_at, client_state_json
        ) VALUES ($1, $2, $3, $4, $5::timestamptz, NOW(), $6::timestamptz, $7::jsonb)`,
        [
          user.id || crypto.randomUUID(),
          String(user.email || '').trim().toLowerCase(),
          user.passwordHash || '',
          firstNullableText(user.role) || 'user',
          toIso(user.createdAt, nowIso()),
          toIso(user.lastAccessAt, toIso(user.createdAt, nowIso())),
          JSON.stringify(state),
        ]
      );
      await syncUserStateWithClient(client, user.id, state);
    }

    for (const [tokenOrHash, sessionValue] of Object.entries(sessionsMap)) {
      const session = asObject(sessionValue);
      const tokenHash =
        typeof tokenOrHash === 'string' && tokenOrHash.length === 64
          ? tokenOrHash
          : hashSessionToken(tokenOrHash);
      await client.query(
        `INSERT INTO auth_sessions (
          id, user_id, token_hash, created_at, expires_at, last_seen_at
        ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::timestamptz)
        ON CONFLICT (token_hash) DO NOTHING`,
        [
          crypto.randomUUID(),
          session.userId,
          tokenHash,
          toIso(session.createdAt, nowIso()),
          toIso(session.expiresAt, nowIso()),
          toIso(session.lastSeenAt, toIso(session.createdAt, nowIso())),
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const normalizeLegacyUserMetric = (rawUser) => {
  const safe = asObject(rawUser);
  return {
    email: String(safe.email || '').trim().toLowerCase(),
    ageBucket: firstNullableText(safe.age, safe.ageBucket, safe.age_range),
    initialLevel: firstNullableText(safe.initialLevel, safe.initial_level, safe.level),
    currentShield: toNullableNumber(safe.currentShield ?? safe.current_shield),
    improvement: toNullableNumber(safe.improvement),
    progressPercent: toNullableNumber(safe.progressPercent ?? safe.progress_percent),
    lastAccessAt: toIso(safe.lastAccessAt, null),
    raw: safeClone(safe),
  };
};

const normalizeAnalyticsSnapshotInput = (rawSnapshot) => {
  const safe = asObject(rawSnapshot);
  const overview = asObject(safe.overview);
  const users = (Array.isArray(safe.users) ? safe.users : [])
    .map(normalizeLegacyUserMetric)
    .filter((user) => user.email);

  return {
    generatedAt: toIso(safe.generatedAt, nowIso()),
    overview: {
      totalUsers: toInt(overview.totalUsers, users.length),
      activeUsers7d: toInt(overview.activeUsers7d, 0),
      averageShield: toNullableNumber(overview.averageShield),
      averageImprovement: toNullableNumber(overview.averageImprovement),
      activityCompletionRate: toNullableNumber(overview.activityCompletionRate),
      moduleCompletionRate: toNullableNumber(overview.moduleCompletionRate),
      avgDaysToImprove: toNullableNumber(overview.avgDaysToImprove),
    },
    payload: safeClone(safe),
    users,
  };
};

export const initDb = async () => {
  if (!DATABASE_URL) {
    if (shouldUseDevFileFallback()) {
      return activateDevFileFallback(new Error('Falta DATABASE_URL en el entorno.'));
    }
    throw new Error('Falta DATABASE_URL en el entorno.');
  }

  if (!initPromise) {
    initPromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query(SCHEMA_SQL);
        await migrateLegacyTables(client);
      } finally {
        client.release();
      }
      await maybeImportLegacyStore();
      activeDbMode = 'postgres';
      fileFallbackReason = null;
      return true;
    })().catch(async (error) => {
      initPromise = null;
      if (shouldUseDevFileFallback(error)) {
        return activateDevFileFallback(error);
      }
      throw error;
    });
  }

  return initPromise;
};

export const createUser = async (user) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const normalizedEmail = String(user?.email || '').trim().toLowerCase();
    if (findFileUserRecordByEmail(normalizedEmail)) {
      const error = new Error('Ese correo ya está registrado.');
      error.code = '23505';
      throw error;
    }
    const record = normalizeFileUserRecord({
      ...safeClone(asObject(user)),
      email: normalizedEmail,
    });
    fileStore.users[record.id] = record;
    await queueFileStoreWrite();
    return mapFileUserRecord(record);
  }

  const state = normalizeClientState(user?.state);
  const result = await pool.query(
    `INSERT INTO users (
      id, email, password_hash, role, created_at, updated_at, last_access_at, client_state_json
    ) VALUES ($1, $2, $3, $4, $5::timestamptz, NOW(), $6::timestamptz, $7::jsonb)
    RETURNING *`,
    [
      user.id,
      String(user.email || '').trim().toLowerCase(),
      user.passwordHash,
      user.role || 'user',
      toIso(user.createdAt, nowIso()),
      toIso(user.lastAccessAt, toIso(user.createdAt, nowIso())),
      JSON.stringify(state),
    ]
  );
  return mapUserRow(result.rows[0]);
};

export const saveUser = async (user) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const existing = findFileUserRecordById(user?.id);
    if (!existing) return null;
    const normalizedEmail = String(user?.email || existing.email || '').trim().toLowerCase();
    const duplicate = findFileUserRecordByEmail(normalizedEmail);
    if (duplicate && duplicate.id !== existing.id) {
      const error = new Error('Ese correo ya está registrado.');
      error.code = '23505';
      throw error;
    }
    const record = normalizeFileUserRecord({
      ...existing,
      ...safeClone(asObject(user)),
      email: normalizedEmail,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    });
    fileStore.users[record.id] = record;
    await queueFileStoreWrite();
    return mapFileUserRecord(record);
  }

  const state = normalizeClientState(user?.state);
  const result = await pool.query(
    `UPDATE users
       SET email = $2,
           password_hash = $3,
           role = $4,
           last_access_at = $5::timestamptz,
           updated_at = NOW(),
           client_state_json = $6::jsonb
     WHERE id = $1
     RETURNING *`,
    [
      user.id,
      String(user.email || '').trim().toLowerCase(),
      user.passwordHash,
      user.role || 'user',
      toIso(user.lastAccessAt, nowIso()),
      JSON.stringify(state),
    ]
  );
  return result.rows[0] ? mapUserRow(result.rows[0]) : null;
};

export const findUserByEmail = async (email) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const record = findFileUserRecordByEmail(email);
    return record ? mapFileUserRecord(record) : null;
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [
      String(email || '').trim().toLowerCase(),
    ]);
    const row = result.rows[0];
    if (!row) return null;
    const user = mapUserRow(row);
    user.state = await buildUserStateWithClient(client, row);
    return user;
  } finally {
    client.release();
  }
};

export const getAdminCount = async () => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    return Object.values(fileStore.users).filter((user) => user.role === 'admin').length;
  }

  const result = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
  return result.rows[0]?.count ?? 0;
};

export const createSession = async (session) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const tokenHash = hashSessionToken(session.token);
    const record = normalizeFileSessionRecord({
      id: crypto.randomUUID(),
      userId: session.userId,
      tokenHash,
      createdAt: toIso(session.createdAt, nowIso()),
      expiresAt: toIso(session.expiresAt, nowIso()),
      lastSeenAt: toIso(session.lastSeenAt, toIso(session.createdAt, nowIso())),
      userAgent: firstNullableText(session.userAgent),
      ip: firstNullableText(session.ip),
    });
    fileStore.sessions[record.tokenHash] = record;
    await queueFileStoreWrite();
    return mapFileSessionRecord(record);
  }

  const tokenHash = hashSessionToken(session.token);
  const result = await pool.query(
    `INSERT INTO auth_sessions (
      id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip
    ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::timestamptz, $7, $8)
    RETURNING *`,
    [
      crypto.randomUUID(),
      session.userId,
      tokenHash,
      toIso(session.createdAt, nowIso()),
      toIso(session.expiresAt, nowIso()),
      toIso(session.lastSeenAt, toIso(session.createdAt, nowIso())),
      firstNullableText(session.userAgent),
      firstNullableText(session.ip),
    ]
  );
  return mapSessionRow(result.rows[0]);
};

export const saveSession = async (session) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const existing =
      Object.values(fileStore.sessions).find((entry) => entry.id === session.id) || null;
    if (!existing) return null;
    const record = normalizeFileSessionRecord({
      ...existing,
      ...safeClone(asObject(session)),
      tokenHash: existing.tokenHash,
      userId: existing.userId,
    });
    fileStore.sessions[record.tokenHash] = record;
    await queueFileStoreWrite();
    return mapFileSessionRecord(record);
  }

  const result = await pool.query(
    `UPDATE auth_sessions
       SET expires_at = $2::timestamptz,
           last_seen_at = $3::timestamptz,
           user_agent = $4,
           ip = $5
     WHERE id = $1
     RETURNING *`,
    [
      session.id,
      toIso(session.expiresAt, nowIso()),
      toIso(session.lastSeenAt, nowIso()),
      firstNullableText(session.userAgent),
      firstNullableText(session.ip),
    ]
  );
  return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
};

export const deleteSession = async (token) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    delete fileStore.sessions[hashSessionToken(token)];
    await queueFileStoreWrite();
    return;
  }

  await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashSessionToken(token)]);
};

export const deleteExpiredSessions = async () => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const now = Date.now();
    let changed = false;
    for (const [tokenHash, session] of Object.entries(fileStore.sessions)) {
      if (Date.parse(session.expiresAt) <= now) {
        delete fileStore.sessions[tokenHash];
        changed = true;
      }
    }
    if (changed) await queueFileStoreWrite();
    return;
  }

  await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
};

export const getSessionWithUser = async (token) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const tokenHash = hashSessionToken(token);
    const session = fileStore.sessions[tokenHash];
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      delete fileStore.sessions[tokenHash];
      await queueFileStoreWrite();
      return null;
    }
    const user = findFileUserRecordById(session.userId);
    if (!user) return null;
    return {
      session: mapFileSessionRecord(session),
      user: mapFileUserRecord(user),
    };
  }

  const client = await pool.connect();
  try {
    const sessionResult = await client.query(
      'SELECT * FROM auth_sessions WHERE token_hash = $1 LIMIT 1',
      [hashSessionToken(token)]
    );
    const sessionRow = sessionResult.rows[0];
    if (!sessionRow) return null;
    const userRow = await getUserRowById(client, sessionRow.user_id);
    if (!userRow) return null;
    const user = mapUserRow(userRow);
    user.state = await buildUserStateWithClient(client, userRow);
    return {
      session: mapSessionRow(sessionRow),
      user,
    };
  } finally {
    client.release();
  }
};

export const syncUserState = async (userId, rawState) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const record = findFileUserRecordById(userId);
    if (!record) return null;
    const state = normalizeClientState(rawState);
    record.state = state;
    record.updatedAt = nowIso();
    record.lastAccessAt = state.courseProgress?.lastAccessAt || nowIso();
    fileStore.users[record.id] = record;
    await queueFileStoreWrite();
    return mapFileUserRecord(record);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await syncUserStateWithClient(client, userId, rawState);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const state = await buildUserState(userId);
  const userResult = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
  const row = userResult.rows[0];
  if (!row) return null;
  const user = mapUserRow(row);
  user.state = state;
  return user;
};

export const buildUserState = async (userId) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const record = findFileUserRecordById(userId);
    return record ? normalizeClientState(record.state) : createEmptyUserState();
  }

  const client = await pool.connect();
  try {
    return await buildUserStateWithClient(client, userId);
  } finally {
    client.release();
  }
};

export const listUsers = async () => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    return Object.values(fileStore.users)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .map((record) => mapFileUserRecord(record));
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users ORDER BY created_at ASC');
    const users = [];
    for (const row of result.rows) {
      const user = mapUserRow(row);
      user.state = await buildUserStateWithClient(client, row);
      users.push(user);
    }
    return users;
  } finally {
    client.release();
  }
};

export const importAnalyticsSnapshot = async (
  rawSnapshot,
  { snapshotType = 'manual_import', sourceLabel = null } = {}
) => {
  if (activeDbMode === 'file') {
    await ensureFileStore();
    const normalized = normalizeAnalyticsSnapshotInput(rawSnapshot);
    const snapshot = {
      id: crypto.randomUUID(),
      snapshotType,
      sourceLabel,
      createdAt: nowIso(),
      payload: normalized,
    };
    fileStore.analyticsSnapshots.push(snapshot);
    await queueFileStoreWrite();
    return {
      snapshotId: snapshot.id,
      linkedUsers: 0,
      totalUsers: normalized.overview.totalUsers,
    };
  }

  const normalized = normalizeAnalyticsSnapshotInput(rawSnapshot);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const snapshotId = crypto.randomUUID();
    let linkedUsers = 0;
    await client.query(
      `INSERT INTO analytics_snapshots (
        id, snapshot_type, source_label, generated_at, total_users, active_users_7d,
        average_shield, average_improvement, activity_completion_rate,
        module_completion_rate, avg_days_to_improve, payload_json, created_at
      ) VALUES (
        $1, $2, $3, $4::timestamptz, $5, $6,
        $7, $8, $9,
        $10, $11, $12::jsonb, NOW()
      )`,
      [
        snapshotId,
        snapshotType,
        sourceLabel,
        normalized.generatedAt,
        normalized.overview.totalUsers,
        normalized.overview.activeUsers7d,
        normalized.overview.averageShield,
        normalized.overview.averageImprovement,
        normalized.overview.activityCompletionRate,
        normalized.overview.moduleCompletionRate,
        normalized.overview.avgDaysToImprove,
        JSON.stringify(normalized.payload),
      ]
    );

    for (const userMetric of normalized.users) {
      const userLookup = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [
        userMetric.email,
      ]);
      const linkedUserId = userLookup.rows[0]?.id ?? null;
      if (linkedUserId) linkedUsers += 1;

      await client.query(
        `INSERT INTO legacy_user_metrics (
          id, analytics_snapshot_id, user_id, email, age_bucket, initial_level,
          current_shield, improvement, progress_percent, last_access_at,
          source_generated_at, raw_json, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10::timestamptz,
          $11::timestamptz, $12::jsonb, NOW()
        )
        ON CONFLICT (analytics_snapshot_id, email) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          age_bucket = EXCLUDED.age_bucket,
          initial_level = EXCLUDED.initial_level,
          current_shield = EXCLUDED.current_shield,
          improvement = EXCLUDED.improvement,
          progress_percent = EXCLUDED.progress_percent,
          last_access_at = EXCLUDED.last_access_at,
          source_generated_at = EXCLUDED.source_generated_at,
          raw_json = EXCLUDED.raw_json`,
        [
          crypto.randomUUID(),
          snapshotId,
          linkedUserId,
          userMetric.email,
          userMetric.ageBucket,
          userMetric.initialLevel,
          userMetric.currentShield,
          userMetric.improvement,
          userMetric.progressPercent,
          userMetric.lastAccessAt,
          normalized.generatedAt,
          JSON.stringify(userMetric.raw),
        ]
      );
    }

    await client.query('COMMIT');
    return {
      snapshotId,
      generatedAt: normalized.generatedAt,
      userCount: normalized.users.length,
      linkedUsers,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
