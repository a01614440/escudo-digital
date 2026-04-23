import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const REPO = 'C:/Users/emili/OneDrive/Documentos/GitHub/escudo-digital';
const OUT_DIR = path.join(REPO, '.codex-temp', 'phase6a-validation');
const PROFILE_DIR = path.join(OUT_DIR, `edge-profile-closeout-${Date.now()}`);
const APP_URL = 'http://127.0.0.1:3000/dist/';
const API_URL = 'http://127.0.0.1:3000';
const CDP_PORT = 9335;
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
  return fetchJson(url, { method: 'PUT' });
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
      captureBeyondViewport: false,
      fromSurface: true,
    });
    await fs.writeFile(filePath, Buffer.from(data, 'base64'));
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(PROFILE_DIR);

  const baseEvidence = await readJson(path.join(OUT_DIR, 'evidence-manifest.json'));
  const email = baseEvidence.email;
  const password = 'Codex123!';
  const login = await fetchJson(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const token = login.token;
  const seedState = login.state;
  const route = Array.isArray(seedState.coursePlan?.ruta) ? seedState.coursePlan.ruta : [];
  const chatModuleIndex = route.findIndex((module) =>
    (Array.isArray(module?.actividades) ? module.actividades : []).some((activity) => activity?.tipo === 'sim_chat')
  );
  if (chatModuleIndex < 0) throw new Error('La ruta seed no tiene ninguna actividad sim_chat.');

  const chatActivityIndex = route[chatModuleIndex].actividades.findIndex((activity) => activity?.tipo === 'sim_chat');
  const currentLesson = { moduleIndex: chatModuleIndex, activityIndex: chatActivityIndex };
  const progress = {
    ...seedState.courseProgress,
    lastAccessAt: new Date().toISOString(),
  };

  const evidence = [];

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
      evidence.push({ name, file: filePath.replaceAll('\\', '/'), ...meta });
    }

    async function bootAt(state, viewport, waitForSelector = '.sd-chat-sim') {
      await updateState(state);
      await page.setViewport(viewport);
      await page.navigate(`${APP_URL}?closeout=${Date.now()}`);
      await page.waitFor("document.readyState === 'complete'", { label: 'documento listo' });
      const expression = `Boolean(document.querySelector(${JSON.stringify(waitForSelector)}))`;
      try {
        await page.waitFor(expression, { label: waitForSelector });
      } catch (error) {
        const marker = await page.evaluate(`
          (() => ({
            auth: Boolean(document.querySelector('#authView')),
            survey: Boolean(document.querySelector('#surveyView')),
            courses: Boolean(document.querySelector('#coursesView')),
            lesson: Boolean(document.querySelector('#lessonView')),
            text: document.body?.innerText?.slice(0, 500) || ''
          }))()
        `);
        throw new Error(`${error.message}\nEstado visible: ${JSON.stringify(marker)}`);
      }
      await page.evaluate('window.scrollTo(0, 0); true;');
      await sleep(1200);
    }

    await page.setViewport({ width: 1440, height: 1100, mobile: false, deviceScaleFactor: 1 });
    await page.navigate(`${APP_URL}?boot=${Date.now()}`);
    await page.waitFor("document.readyState === 'complete'", { label: 'documento listo' });
    await page.evaluate(`localStorage.setItem('escudo_session_v1', ${JSON.stringify(token)}); true;`);
    await page.reload();
    await page.waitFor("Boolean(document.body)", { label: 'body' });
    await sleep(1000);

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson,
      },
      { width: 1024, height: 1180, mobile: false, deviceScaleFactor: 1 }
    );

    await page.evaluate(`
      (() => {
        const quick = document.querySelector('.sd-chat-suggestions button');
        if (!quick) return false;
        quick.click();
        return true;
      })()
    `);
    await page.waitFor("Boolean(document.querySelector('.sd-chat-inline-feedback, .sd-chat-feedback-card'))", {
      timeout: 30000,
      label: 'feedback tablet',
    });
    await page.evaluate(`
      (() => {
        const node = document.querySelector('.sd-chat-inline-feedback, .sd-chat-feedback-card');
        if (!node) return false;
        node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        return true;
      })()
    `);
    await sleep(800);
    await capture('chat-feedback-tablet-closeout', {
      activity: 'sim_chat',
      shell: 'tablet',
      state: 'feedback',
    });

    await bootAt(
      {
        currentView: 'lesson',
        currentLesson,
      },
      { width: 1440, height: 1100, mobile: false, deviceScaleFactor: 1 }
    );

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
      label: 'feedback desktop previo a cierre',
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

    await page.waitFor("Boolean(document.querySelector('.sd-chat-complete-note'))", {
      timeout: 30000,
      label: 'completion note',
    });
    await page.waitFor(`
      (() => [...document.querySelectorAll('.sd-chat-feedback-card button')].some((node) =>
        /Continuar/i.test(node.innerText || '')
      ))()
    `, {
      timeout: 30000,
      label: 'boton continuar en cierre',
    });
    await page.evaluate(`
      (() => {
        const node = document.querySelector('.sd-chat-complete-note');
        if (!node) return false;
        node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        return true;
      })()
    `);
    await sleep(800);
    await capture('chat-completion-closeout-desktop', {
      activity: 'sim_chat',
      shell: 'desktop',
      state: 'completion',
    });

    await writeJson(path.join(OUT_DIR, 'closeout-manifest.json'), {
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
