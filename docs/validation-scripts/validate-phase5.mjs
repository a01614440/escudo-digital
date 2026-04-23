import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const REPO = 'C:/Users/emili/OneDrive/Documentos/GitHub/escudo-digital';
const OUT_DIR = path.join(REPO, '.codex-temp', 'phase5-validation');
const PROFILE_DIR = path.join(OUT_DIR, 'edge-profile');
const APP_URL = 'http://127.0.0.1:3000/dist/';
const API_URL = 'http://127.0.0.1:3000';
const CDP_PORT = 9333;
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${data.error || text}`);
  }
  return data;
}

async function putJson(url) {
  const response = await fetch(url, { method: 'PUT' });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${data.error || text}`);
  }
  return data;
}

async function waitForCdp() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const version = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (version.webSocketDebuggerUrl) return version;
    } catch {
      // keep waiting
    }
    await sleep(250);
  }
  throw new Error('No se pudo levantar el puerto CDP del navegador.');
}

class CdpPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.ws = null;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });

    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || 'CDP error'));
        else resolve(message.result || {});
      }
    });

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  async close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  async send(method, params = {}) {
    const id = ++this.id;
    const payload = JSON.stringify({ id, method, params });
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(payload);
    return promise;
  }

  async evaluate(expression, { returnByValue = true, awaitPromise = true } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue,
      awaitPromise,
    });
    return result?.result?.value;
  }

  async waitFor(testExpression, { timeout = 20000, interval = 200, label = 'condición' } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        const value = await this.evaluate(testExpression);
        if (value) return value;
      } catch {
        // retry
      }
      await sleep(interval);
    }
    throw new Error(`Timeout esperando ${label}`);
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(1200);
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: true });
    await sleep(1200);
  }

  async setViewport({ width, height, mobile = false, deviceScaleFactor = 1 }) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      mobile,
      deviceScaleFactor,
      screenWidth: width,
      screenHeight: height,
      positionX: 0,
      positionY: 0,
      dontSetVisibleSize: false,
    });
  }

  async screenshot(filePath) {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      fromSurface: true,
    });
    await fs.writeFile(filePath, Buffer.from(data, 'base64'));
  }
}

function buildCompletedMap(module) {
  const completed = {};
  const activities = Array.isArray(module?.actividades) ? module.actividades : [];
  activities.forEach((activity, index) => {
    completed[activity.id] = {
      score: index % 2 === 0 ? 0.94 : 0.82,
      attempts: 1,
      feedback: 'Validación visual del cierre del módulo.',
      durationMs: 45000 + index * 7000,
      details: null,
      at: new Date().toISOString(),
    };
  });
  return completed;
}

async function main() {
  await ensureDir(OUT_DIR);
  await fs.rm(PROFILE_DIR, { recursive: true, force: true });
  await ensureDir(PROFILE_DIR);

  const db = await readJson(path.join(REPO, 'data', 'dev-db.json'));
  const seedUser = Object.values(db.users).find((user) => Array.isArray(user?.state?.coursePlan?.ruta) && user.state.coursePlan.ruta.length);
  if (!seedUser) throw new Error('No encontré un usuario local con route real para validar.');

  const seedState = seedUser.state;
  const moduleZero = seedState.coursePlan.ruta[0];
  const evidence = [];

  const email = `phase5-validate-${Date.now()}@example.com`;
  const password = 'Codex123!';

  const register = await fetchJson(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const token = register.token;

  async function updateState(overrides) {
    const payload = {
      answers: seedState.answers,
      assessment: seedState.assessment,
      coursePlan: seedState.coursePlan,
      courseProgress: seedState.courseProgress,
      currentView: 'courses',
      surveyIndex: seedState.surveyIndex,
      surveyStage: 'results',
      currentLesson: { moduleIndex: 0, activityIndex: 0 },
      ...overrides,
    };

    await fetchJson(`${API_URL}/api/user/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  }

  const edge = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: false }
  );

  try {
    await waitForCdp();
    const target = await putJson(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`);
    const page = new CdpPage(target.webSocketDebuggerUrl);
    await page.connect();

    async function capture(name, meta) {
      const filePath = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot(filePath);
      evidence.push({
        name,
        file: filePath.replaceAll('\\', '/'),
        ...meta,
      });
    }

    const desktop = { width: 1440, height: 1400, mobile: false, deviceScaleFactor: 1 };
    const tablet = { width: 1024, height: 1366, mobile: false, deviceScaleFactor: 1 };
    const mobile = { width: 430, height: 932, mobile: true, deviceScaleFactor: 2 };

    await page.setViewport(desktop);
    await page.navigate(`${APP_URL}?boot=${Date.now()}`);
    await page.waitFor("document.readyState === 'complete'", { label: 'documento listo' });
    await page.evaluate(
      `localStorage.setItem('escudo_session_v1', ${JSON.stringify(token)}); true;`
    );
    await page.reload();
    await page.waitFor("Boolean(document.body)", { label: 'body' });
    await sleep(1200);

    async function bootAt(state, viewport, waitForSelector = '#coursesView, #lessonView') {
      await updateState(state);
      await page.setViewport(viewport);
      await page.navigate(`${APP_URL}?state=${Date.now()}`);
      await page.waitFor("document.readyState === 'complete'", { label: 'documento listo' });
      const expression = waitForSelector.startsWith('js:')
        ? waitForSelector.slice(3)
        : `Boolean(document.querySelector(${JSON.stringify(waitForSelector)}))`;
      await page.waitFor(
        expression,
        { label: waitForSelector }
      );
      await page.evaluate('window.scrollTo(0, 0); true;');
      await sleep(1200);
    }

    await bootAt(
      {
        currentView: 'courses',
        currentLesson: { moduleIndex: 0, activityIndex: 0 },
      },
      desktop,
      '#coursesView'
    );
    await capture('route-entry-desktop', {
      activity: 'entry',
      shell: 'desktop',
      state: 'entrada-desde-ruta',
    });

    await page.evaluate(`
      (() => {
        const button = [...document.querySelectorAll('button')].find((node) =>
          /Abrir modulo recomendado|Continuar donde me quede/i.test(node.innerText || '')
        );
        if (!button) return false;
        button.click();
        return true;
      })()
    `);
    await page.waitFor("Boolean(document.querySelector('#lessonView'))", { label: 'lesson view' });
    await sleep(1400);
    await capture('lesson-concept-desktop', {
      activity: 'concepto',
      shell: 'desktop',
      state: 'actividad',
    });

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson: { moduleIndex: 0, activityIndex: 3 },
      },
      tablet,
      '#lessonView'
    );
    await capture('lesson-quiz-tablet', {
      activity: 'quiz',
      shell: 'tablet',
      state: 'actividad',
    });

    await page.evaluate(`
      (() => {
        const options = document.querySelectorAll('.option-grid button');
        if (!options.length) return false;
        options[1]?.click();
        return true;
      })()
    `);
    await page.waitFor(
      `Boolean([...document.querySelectorAll('*')].find((node) => /Retroalimentaci[oó]n/i.test(node.textContent || '')))`,
      { label: 'feedback quiz' }
    );
    await sleep(900);
    await capture('lesson-quiz-feedback-tablet', {
      activity: 'quiz',
      shell: 'tablet',
      state: 'feedback',
    });

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson: { moduleIndex: 0, activityIndex: 4 },
      },
      mobile,
      '#lessonView'
    );
    await capture('lesson-checklist-mobile', {
      activity: 'checklist',
      shell: 'mobile',
      state: 'actividad',
    });

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson: { moduleIndex: 0, activityIndex: 5 },
      },
      desktop,
      '#lessonView'
    );
    await capture('lesson-openanswer-desktop', {
      activity: 'respuesta-abierta',
      shell: 'desktop',
      state: 'actividad',
    });

    await page.evaluate(`
      (() => {
        const area = document.querySelector('textarea');
        if (!area) return false;
        area.value = 'Pauso, reviso el dominio, busco reseñas fuera del sitio y pago solo con un método con protección.';
        area.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);
    await page.evaluate(`
      (() => {
        const button = [...document.querySelectorAll('button')].find((node) =>
          /^Enviar$/i.test((node.innerText || '').trim())
        );
        if (!button) return false;
        button.click();
        return true;
      })()
    `);
    await page.waitFor(
      `Boolean([...document.querySelectorAll('*')].find((node) => /Retroalimentaci[oó]n/i.test(node.textContent || '')))`,
      { timeout: 30000, label: 'feedback respuesta abierta' }
    );
    await sleep(1200);
    await capture('lesson-openanswer-feedback-desktop', {
      activity: 'respuesta-abierta',
      shell: 'desktop',
      state: 'feedback',
    });

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson: { moduleIndex: 0, activityIndex: 6 },
        courseProgress: {
          ...seedState.courseProgress,
          completed: buildCompletedMap(moduleZero),
          modules: {
            [moduleZero.id]: {
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              visits: 6,
              lastActivityId: moduleZero.actividades[moduleZero.actividades.length - 1].id,
              durationMs: 318000,
            },
          },
          snapshots: [],
          seenScenarioIds: {},
          lastAccessAt: new Date().toISOString(),
        },
      },
      desktop,
      "js:Boolean([...document.querySelectorAll('*')].find((node) => /M[oó]dulo completado/i.test(node.textContent || '')))"
    );
    await capture('lesson-completion-desktop', {
      activity: 'completion',
      shell: 'desktop',
      state: 'completion',
    });

    await writeJson(path.join(OUT_DIR, 'evidence-manifest.json'), {
      generatedAt: new Date().toISOString(),
      email,
      evidence,
    });

    await page.close();
  } finally {
    edge.kill('SIGKILL');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
