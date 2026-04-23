import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const REPO = 'C:/Users/emili/OneDrive/Documentos/GitHub/escudo-digital';
const OUT_DIR = path.join(REPO, '.codex-temp', 'phase6a-validation');
const PROFILE_DIR = path.join(OUT_DIR, 'edge-profile');
const APP_URL = 'http://127.0.0.1:3000/dist/';
const API_URL = 'http://127.0.0.1:3000';
const CDP_PORT = 9334;
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

  async waitFor(testExpression, { timeout = 20000, interval = 200, label = 'condicion' } = {}) {
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

function buildCompletionRecord(score, atOffset = 0) {
  return {
    score,
    attempts: 1,
    feedback: 'Validacion visual de sim_chat.',
    durationMs: 32000 + atOffset * 5000,
    details: null,
    at: new Date(Date.now() - atOffset * 60000).toISOString(),
  };
}

function buildProgressForChat(route, moduleIndex, activityIndex) {
  const completed = {};
  const modules = {};

  route.forEach((module, currentModuleIndex) => {
    const activities = Array.isArray(module?.actividades) ? module.actividades : [];
    const shouldCompleteWholeModule = currentModuleIndex < moduleIndex;
    const shouldCompletePartialModule = currentModuleIndex === moduleIndex;

    if (!shouldCompleteWholeModule && !shouldCompletePartialModule) return;

    const completedActivities = shouldCompleteWholeModule
      ? activities
      : activities.slice(0, Math.max(0, activityIndex));

    completedActivities.forEach((activity, index) => {
      completed[activity.id] = buildCompletionRecord(index % 2 === 0 ? 0.92 : 0.81, index);
    });

    if (!completedActivities.length) return;

    modules[module.id] = {
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: shouldCompleteWholeModule ? new Date(Date.now() - 1800000).toISOString() : null,
      visits: shouldCompleteWholeModule ? 3 : 1,
      lastActivityId: completedActivities[completedActivities.length - 1]?.id || activities[0]?.id,
      durationMs: 180000 + currentModuleIndex * 12000,
    };
  });

  return {
    completed,
    modules,
    snapshots: [],
    seenScenarioIds: {},
    lastAccessAt: new Date().toISOString(),
  };
}

async function main() {
  await ensureDir(OUT_DIR);
  await fs.rm(PROFILE_DIR, { recursive: true, force: true });
  await ensureDir(PROFILE_DIR);

  const db = await readJson(path.join(REPO, 'data', 'dev-db.json'));
  const seedUser = Object.values(db.users).find(
    (user) =>
      !/^phase\d/i.test(user?.email || '') &&
      Array.isArray(user?.state?.coursePlan?.ruta) &&
      user.state.coursePlan.ruta.some((module) =>
        (Array.isArray(module?.actividades) ? module.actividades : []).some((activity) => activity?.tipo === 'sim_chat')
      )
  );
  if (!seedUser) throw new Error('No encontre un usuario local con una actividad sim_chat para validar.');

  const seedState = seedUser.state;
  const route = Array.isArray(seedState.coursePlan?.ruta) ? seedState.coursePlan.ruta : [];
  const chatModuleIndex = route.findIndex((module) =>
    (Array.isArray(module?.actividades) ? module.actividades : []).some((activity) => activity?.tipo === 'sim_chat')
  );
  if (chatModuleIndex < 0) throw new Error('La ruta seed no tiene ninguna actividad sim_chat.');

  const chatActivityIndex = route[chatModuleIndex].actividades.findIndex((activity) => activity?.tipo === 'sim_chat');
  const chatModuleTitle = route[chatModuleIndex]?.titulo || 'WhatsApp';
  const progress = {
    ...seedState.courseProgress,
    lastAccessAt: new Date().toISOString(),
  };
  const currentLesson = { moduleIndex: chatModuleIndex, activityIndex: chatActivityIndex };
  const evidence = [];

  const email = `phase6a-validate-${Date.now()}@example.com`;
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
      courseProgress: progress,
      currentView: 'lesson',
      surveyIndex: seedState.surveyIndex,
      surveyStage: 'results',
      currentLesson,
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
    await page.evaluate(`localStorage.setItem('escudo_session_v1', ${JSON.stringify(token)}); true;`);
    await page.reload();
    await page.waitFor("Boolean(document.body)", { label: 'body' });
    await sleep(1200);

    async function bootAt(state, viewport, waitForSelector = '#lessonView') {
      await updateState(state);
      await page.setViewport(viewport);
      await page.navigate(`${APP_URL}?state=${Date.now()}`);
      await page.waitFor("document.readyState === 'complete'", { label: 'documento listo' });
      const expression = waitForSelector.startsWith('js:')
        ? waitForSelector.slice(3)
        : `Boolean(document.querySelector(${JSON.stringify(waitForSelector)}))`;
      try {
        await page.waitFor(expression, { label: waitForSelector });
      } catch (error) {
        const marker = await page.evaluate(`
          (() => ({
            currentView: document.body?.innerText?.slice(0, 600) || '',
            auth: Boolean(document.querySelector('#authView')),
            survey: Boolean(document.querySelector('#surveyView')),
            courses: Boolean(document.querySelector('#coursesView')),
            lesson: Boolean(document.querySelector('#lessonView'))
          }))()
        `);
        throw new Error(`${error.message}\nEstado visible: ${JSON.stringify(marker)}`);
      }
      await page.evaluate('window.scrollTo(0, 0); true;');
      await sleep(1200);
    }

    await bootAt(
      {
        currentView: 'courses',
        currentLesson,
      },
      desktop,
      '#coursesView'
    );
    await capture('chat-route-entry-desktop', {
      activity: 'sim_chat',
      shell: 'desktop',
      state: 'entrada-desde-ruta',
    });

    const routeOpenResult = await page.evaluate(`
      (() => {
        const title = ${JSON.stringify(chatModuleTitle)};
        const exactButton = [...document.querySelectorAll('button')].find((node) => {
          const scopeText = node.closest('section, article, div, li')?.textContent || '';
          return scopeText.includes(title) && /Abrir|Continuar|Retomar|Detalle/i.test(node.innerText || '');
        });
        if (exactButton) {
          exactButton.click();
          return 'route-open';
        }

        const genericButton = [...document.querySelectorAll('button')].find((node) =>
          /Abrir modulo recomendado|Continuar donde me quede|Abrir detalle/i.test(node.innerText || '')
        );
        if (genericButton) {
          genericButton.click();
          return 'generic-open';
        }

        return false;
      })()
    `);

    if (routeOpenResult) {
      await page.waitFor("Boolean(document.querySelector('#lessonView'))", { label: 'lesson view desde ruta' });
      await sleep(1400);
    }

    const routeLandedOnChat = await page.evaluate("Boolean(document.querySelector('.sd-chat-sim'))");
    if (!routeLandedOnChat) {
      await bootAt(
        {
          currentView: 'lesson',
          currentLesson,
        },
        desktop,
        "js:Boolean(document.querySelector('.sd-chat-sim'))"
      );
    }

    await capture('chat-lesson-desktop', {
      activity: 'sim_chat',
      shell: 'desktop',
      state: 'actividad',
    });

    await page.evaluate(`
      (() => {
        const quick = document.querySelector('.sd-chat-suggestions button');
        if (!quick) return false;
        quick.click();
        return true;
      })()
    `);
    await page.waitFor("Boolean(document.querySelector('.sd-chat-feedback-card'))", {
      timeout: 30000,
      label: 'feedback chat desktop',
    });
    await sleep(1200);
    await capture('chat-feedback-desktop', {
      activity: 'sim_chat',
      shell: 'desktop',
      state: 'feedback',
    });

    await page.evaluate(`
      (() => {
        const button = [...document.querySelectorAll('button')].find((node) =>
          /Cerrar y verificar por fuera/i.test(node.innerText || '')
        );
        if (!button) return false;
        button.click();
        return true;
      })()
    `);
    await sleep(1800);
    await capture('chat-completion-desktop', {
      activity: 'sim_chat',
      shell: 'desktop',
      state: 'completion',
    });

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson,
      },
      tablet,
      "js:Boolean(document.querySelector('.sd-chat-sim'))"
    );
    await capture('chat-lesson-tablet', {
      activity: 'sim_chat',
      shell: 'tablet',
      state: 'actividad',
    });

    await page.evaluate(`
      (() => {
        const quick = document.querySelector('.sd-chat-suggestions button');
        if (!quick) return false;
        quick.click();
        return true;
      })()
    `);
    await page.waitFor("Boolean(document.querySelector('.sd-chat-feedback-card'))", {
      timeout: 30000,
      label: 'feedback chat tablet',
    });
    await sleep(1000);
    await capture('chat-feedback-tablet', {
      activity: 'sim_chat',
      shell: 'tablet',
      state: 'feedback',
    });

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson,
      },
      mobile,
      "js:Boolean(document.querySelector('.sd-chat-sim'))"
    );
    await capture('chat-lesson-mobile', {
      activity: 'sim_chat',
      shell: 'mobile',
      state: 'actividad',
    });

    await page.evaluate(`
      (() => {
        const quick = document.querySelector('.sd-chat-suggestions button');
        if (!quick) return false;
        quick.click();
        return true;
      })()
    `);
    await page.waitFor("Boolean(document.querySelector('.sd-chat-feedback-card'))", {
      timeout: 30000,
      label: 'feedback chat mobile',
    });
    await sleep(1000);
    await capture('chat-feedback-mobile', {
      activity: 'sim_chat',
      shell: 'mobile',
      state: 'feedback',
    });

    await writeJson(path.join(OUT_DIR, 'evidence-manifest.json'), {
      generatedAt: new Date().toISOString(),
      email,
      moduleIndex: chatModuleIndex,
      activityIndex: chatActivityIndex,
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
