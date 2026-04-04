import { clamp } from './format.js';

export const COURSE_PLAN_VERSION = 4;

export const CATEGORY_LABELS = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  web: 'Web',
  llamadas: 'Llamadas',
  correo_redes: 'Correo/Redes',
  habitos: 'H\u00e1bitos',
};

export const LEVEL_LABELS = {
  basico: 'B\u00e1sico',
  refuerzo: 'Refuerzo',
  avanzado: 'Avanzado',
};

export const ACTIVITY_LABELS = {
  concepto: 'Concepto',
  quiz: 'Quiz',
  simulacion: 'Simulaci\u00f3n',
  abierta: 'Respuesta abierta',
  sim_chat: 'Simulaci\u00f3n (chat)',
  checklist: 'Checklist',
  compare_domains: 'Comparaci\u00f3n',
  signal_hunt: 'Modo detective',
  inbox: 'Inbox',
  web_lab: 'Laboratorio web',
  scenario_flow: 'Escenario',
  call_sim: 'Llamada guiada',
};

export const COMP_KEYS = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];

const CP1252_UNICODE_TO_BYTE = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const MOJIBAKE_MARKERS = [
  '\u00c3',
  '\u00c2',
  '\u00c6',
  '\u00e2\u20ac',
  '\u00e2\u20ac\u2122',
  '\u00e2\u20ac\u0153',
  '\u00e2\u20ac\u009d',
  '\u00e2\u20ac\u201c',
  '\u00e2\u20ac\u201d',
  '\ufffd',
];

const BROKEN_ACCENT_PREFIXES = [
  '\u00c3\u0192\u00c6\u2019\u00c3\u2020\u2019\u00c3\u00e2\u20ac\u0161\u00c3\u201a\u00c2',
  '\u00c3\u0192\u00c6\u2019\u00c3\u201a\u00c2',
  '\u00c3\u0192\u00c2',
  '\u00c3\u00c2',
];

const BROKEN_ACCENT_SUFFIX_MAP = new Map([
  ['\u00a1', '\u00e1'],
  ['\u00a9', '\u00e9'],
  ['\u00ad', '\u00ed'],
  ['\u00b3', '\u00f3'],
  ['\u00ba', '\u00fa'],
  ['\u00b1', '\u00f1'],
  ['\u0081', '\u00c1'],
  ['\u0089', '\u00c9'],
  ['\u008d', '\u00cd'],
  ['\u0093', '\u00d3'],
  ['\u009a', '\u00da'],
  ['\u0091', '\u00d1'],
]);

const EXTREME_MOJIBAKE_REPLACEMENTS = new Map();

function decodeLatin1Utf8(value) {
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
}

function mojibakePenalty(value) {
  return (
    (value.match(/[ÃÂÆ�]/g) || []).length * 4 +
    (value.match(/â€|ðŸ|ï¿½/g) || []).length * 5 +
    (value.match(/[\u0000-\u001f]/g) || []).length * 8 +
    (value.match(/\?{2,}/g) || []).length * 3 +
    (value.match(/\bM\?dulo\b|\btodav\?a\b/gi) || []).length * 5
  );
}

function readabilityBonus(value) {
  return (
    (value.match(/[áéíóúñÁÉÍÓÚÑ¿¡]/g) || []).length * 2 +
    (
      value.match(
        /\b(señal|módulo|hábito|verificación|página|simulación|contraseña|cómo|último)\b/gi
      ) || []
    )
      .length *
      2
  );
}

function chooseBestDecoded(candidates, current) {
  const unique = [...new Set(candidates.filter(Boolean))];
  return unique.reduce(
    (best, candidate) => {
      const score = readabilityBonus(candidate) - mojibakePenalty(candidate);
      if (score > best.score) return { value: candidate, score };
      return best;
    },
    { value: current, score: readabilityBonus(current) - mojibakePenalty(current) }
  ).value;
}

function decodeRepeated(value, decoder, limit = 6) {
  let result = value;
  for (let attempt = 0; attempt < limit; attempt += 1) {
    const next = decoder(result);
    if (!next || next === result) break;
    result = next;
  }
  return result;
}

export const MODULE_TITLE_LABELS = {
  web: 'Detecta P\u00e1ginas Clonadas',
  whatsapp: 'WhatsApp: Suplantaci\u00f3n y Enlaces',
  sms: 'SMS: Detecta Mensajes Falsos',
  llamadas: 'Llamadas Fraudulentas',
  correo_redes: 'Correo/Redes: Phishing',
  habitos: 'H\u00e1bitos de Verificaci\u00f3n',
};

const MODULE_TITLE_HINTS = {
  web: /(p[a\u00e1]ginas?|dominios?|clonad|checkout|carrito|tienda)/i,
  whatsapp: /(whatsapp|suplantaci[o\u00f3]n|enlaces?)/i,
  sms: /(^|\W)sms(\W|$)|mensajes?\s+falsos/i,
  llamadas: /(llamadas?\s+fraudulentas|vishing|llamada)/i,
  correo_redes: /(correo|redes|phishing)/i,
  habitos: /(h[a\u00e1]bitos?|verificaci[o\u00f3]n|rutina)/i,
};

function looksLikeMojibake(value) {
  return MOJIBAKE_MARKERS.some((marker) => value.includes(marker)) || /\bcontrasena\b/i.test(value);
}

function decodeCp1252Utf8(value) {
  const bytes = [];
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    if (CP1252_UNICODE_TO_BYTE.has(code)) {
      bytes.push(CP1252_UNICODE_TO_BYTE.get(code));
      continue;
    }
    return value;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return value;
  }
}

function fixBrokenAccentChains(value) {
  let result = value;
  EXTREME_MOJIBAKE_REPLACEMENTS.forEach((replacement, broken) => {
    result = result.replaceAll(broken, replacement);
  });
  BROKEN_ACCENT_PREFIXES.forEach((prefix) => {
    BROKEN_ACCENT_SUFFIX_MAP.forEach((replacement, suffix) => {
      result = result.replaceAll(prefix + suffix, replacement);
    });
  });

  return result;
}

export const repairPossibleMojibake = (value) => {
  if (typeof value !== 'string') return value;
  if (!looksLikeMojibake(value)) return value;

  let result = value;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const repeatedCp1252 = decodeRepeated(result, decodeCp1252Utf8);
    const repeatedLatin1 = decodeRepeated(result, decodeLatin1Utf8);
    const candidates = [
      result,
      fixBrokenAccentChains(result),
      decodeCp1252Utf8(result),
      decodeLatin1Utf8(result),
      repeatedCp1252,
      fixBrokenAccentChains(repeatedCp1252),
      repeatedLatin1,
      fixBrokenAccentChains(repeatedLatin1),
      decodeCp1252Utf8(fixBrokenAccentChains(result)),
      decodeLatin1Utf8(fixBrokenAccentChains(result)),
      decodeLatin1Utf8(decodeCp1252Utf8(result)),
      decodeCp1252Utf8(decodeLatin1Utf8(result)),
      decodeLatin1Utf8(decodeLatin1Utf8(result)),
      decodeCp1252Utf8(decodeCp1252Utf8(result)),
    ];

    const next = chooseBestDecoded(candidates, result)
      .replaceAll('\u00e2\u20ac\u0153', '\u201c')
      .replaceAll('\u00e2\u20ac\u009d', '\u201d')
      .replaceAll('\u00e2\u20ac\u2122', '\u2019')
      .replaceAll('\u00e2\u20ac\u201c', '\u2013')
      .replaceAll('\u00e2\u20ac\u201d', '\u2014')
      .replaceAll('\u00c2\u00bf', '\u00bf')
      .replaceAll('\u00c2\u00a1', '\u00a1')
      .replaceAll('Â·', '·')
      .replaceAll('Âº', 'º')
      .replaceAll('Âª', 'ª')
      .replaceAll('Â«', '«')
      .replaceAll('Â»', '»')
      .replace(/\bcontrasena\b/gi, (match) => (match[0] === 'C' ? 'Contrase\u00f1a' : 'contrase\u00f1a'))
      .replace(/\bmodulo\b/gi, (match) => (match[0] === 'M' ? 'Módulo' : 'módulo'))
      .replace(/\btodavia\b/gi, (match) => (match[0] === 'T' ? 'Todavía' : 'todavía'))
      .replace(/\ufffd/g, '');

    if (next === result) break;
    result = next;
  }

  return result;
};

[CATEGORY_LABELS, LEVEL_LABELS, ACTIVITY_LABELS].forEach((dictionary) => {
  Object.keys(dictionary).forEach((key) => {
    dictionary[key] = repairPossibleMojibake(dictionary[key]);
  });
});

export const normalizeRiskLevel = (value) => {
  const raw = repairPossibleMojibake(String(value || '').trim());
  const lower = raw.toLowerCase();
  if (lower.startsWith('alto')) return 'Alto';
  if (lower.startsWith('medio')) return 'Medio';
  if (lower.startsWith('bajo')) return 'Bajo';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
};

export const normalizeCategory = (value) => {
  const raw = repairPossibleMojibake(String(value || '').trim()).toLowerCase();
  if (!raw) return 'habitos';
  if (raw.startsWith('web')) return 'web';
  if (raw.startsWith('whats') || raw === 'wa') return 'whatsapp';
  if (raw.startsWith('sms')) return 'sms';
  if (raw.startsWith('llam') || raw.startsWith('call')) return 'llamadas';
  if (raw.includes('correo') || raw.includes('redes')) return 'correo_redes';
  if (raw.includes('hab')) return 'habitos';
  return COMP_KEYS.includes(raw) ? raw : 'habitos';
};

export const normalizeModuleLevel = (value) => {
  const raw = repairPossibleMojibake(String(value || '').trim()).toLowerCase();
  if (raw.startsWith('ava')) return 'avanzado';
  if (raw.startsWith('ref')) return 'refuerzo';
  if (raw.startsWith('bas')) return 'basico';
  if (raw.startsWith('int') || raw.startsWith('med')) return 'refuerzo';
  return LEVEL_LABELS[raw] ? raw : 'basico';
};

export const computeTotalScore = (competencias) => {
  const values = Object.values(competencias || {}).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length);
};

export const makeScenarioFingerprint = (...parts) => {
  const raw = parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) => String(part || '').trim().toLowerCase())
    .filter(Boolean)
    .join('||');

  let hash = 0;
  for (let idx = 0; idx < raw.length; idx += 1) {
    hash = (hash * 31 + raw.charCodeAt(idx)) >>> 0;
  }
  return `sc_${hash.toString(16) || '0'}`;
};

export const isScenarioActivity = (activity) =>
  [
    'quiz',
    'simulacion',
    'abierta',
    'sim_chat',
    'compare_domains',
    'signal_hunt',
    'inbox',
    'web_lab',
    'scenario_flow',
    'call_sim',
  ].includes(String(activity?.tipo || '').toLowerCase());

export const categoryNote = (value) => {
  if (value >= 85) return 'Muy fuerte';
  if (value >= 70) return 'Fuerte';
  if (value >= 50) return 'Bien';
  if (value >= 30) return 'Por reforzar';
  return 'Prioridad alta';
};

export const computePlanSignature = (plan) => {
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  const ids = route.map((module) => String(module?.id || '')).join('|');
  const actCount = route.reduce(
    (acc, module) => acc + (Array.isArray(module?.actividades) ? module.actividades.length : 0),
    0
  );
  return `${Number(plan?.planVersion) || 0}::${String(plan?.score_name || '')}::${ids}::${actCount}`;
};

const cloneJson = (value) => JSON.parse(JSON.stringify(value ?? null));

function toCleanText(value, fallback = '') {
  const base = value ?? fallback;
  return repairPossibleMojibake(String(base || '')).trim();
}

function repairNestedStrings(value) {
  if (typeof value === 'string') return repairPossibleMojibake(value);
  if (Array.isArray(value)) return value.map((entry) => repairNestedStrings(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, repairNestedStrings(entry)]));
  }
  return value;
}

function inferModuleTitleCategory(title) {
  const clean = toCleanText(title).toLowerCase();
  if (!clean) return '';
  return Object.entries(MODULE_TITLE_HINTS).find(([, pattern]) => pattern.test(clean))?.[0] || '';
}

function normalizeModuleTitle(category, title) {
  const canonical = MODULE_TITLE_LABELS[category] || 'Módulo';
  const clean = toCleanText(title);
  if (!clean) return canonical;
  const inferred = inferModuleTitleCategory(clean);
  if (!inferred || inferred === category) return canonical;
  return canonical;
}

export function normalizeModuleTitleForDisplay(category, title) {
  return normalizeModuleTitle(normalizeCategory(category), title);
}

export const ensureCourseState = (plan) => {
  const safe = repairNestedStrings(plan && typeof plan === 'object' ? cloneJson(plan) : {});
  safe.planVersion = Number.isFinite(Number(safe.planVersion)) ? Number(safe.planVersion) : 0;
  safe.score_name = String(safe.score_name || 'Blindaje Digital').trim() || 'Blindaje Digital';
  safe.planScope = String(safe.planScope || 'standard').trim() || 'standard';
  safe.adminMode = Boolean(safe.adminMode);
  safe.routeMode = String(safe.routeMode || '').trim();
  safe.competencias =
    safe.competencias && typeof safe.competencias === 'object' ? safe.competencias : {};

  COMP_KEYS.forEach((key) => {
    const raw = Number(safe.competencias[key]);
    safe.competencias[key] = Number.isFinite(raw) ? clamp(raw, 0, 100) : 50;
  });

  const route = Array.isArray(safe.ruta) ? safe.ruta : [];
  safe.ruta = route
    .map((module, moduleIndex) => {
      if (!module || typeof module !== 'object') return null;
      const id = String(module.id || `m${moduleIndex + 1}`).trim() || `m${moduleIndex + 1}`;
      const categoria = normalizeCategory(module.categoria || module.category || 'habitos');
      const nivel = normalizeModuleLevel(module.nivel || module.level || module.dificultad || '');
      const titulo = normalizeModuleTitle(categoria, module.titulo || module.title || `Módulo ${moduleIndex + 1}`);
      const descripcion = toCleanText(module.descripcion || module.description || '');
      const acts = Array.isArray(module.actividades) ? module.actividades : [];

      const actividades = acts
        .map((activity, activityIndex) => {
          if (!activity || typeof activity !== 'object') return null;
          const actId =
            String(activity.id || `${id}-a${activityIndex + 1}`).trim() ||
            `${id}-a${activityIndex + 1}`;
          const tipo = String(activity.tipo || activity.type || 'concepto').trim().toLowerCase();
          const tituloAct = String(activity.titulo || `Actividad ${activityIndex + 1}`).trim();
          const peso = clamp(Number(activity.peso ?? activity.puntos ?? 1) || 1, 0.5, 3);
          const scenarioId = String(
            activity.scenarioId ||
              makeScenarioFingerprint(
                tipo,
                tituloAct,
                activity.escenario,
                activity.prompt,
                activity.mensaje,
                activity?.pagina?.dominio,
                activity.inicio
              )
          ).trim();

          const base = { id: actId, scenarioId, tipo, titulo: tituloAct, peso };

          if (tipo === 'checklist') {
            const items = Array.isArray(activity.items)
              ? activity.items.map((item) => String(item).trim()).filter(Boolean)
              : [];
            return {
              ...base,
              intro: String(activity.intro || '').trim(),
              items: items.slice(0, 8),
            };
          }

          if (tipo === 'simulacion' || tipo === 'quiz') {
            const opciones = Array.isArray(activity.opciones)
              ? activity.opciones.map((item) => String(item).trim()).filter(Boolean)
              : [];
            const correcta = clamp(
              Number(activity.correcta) || 0,
              0,
              Math.max(0, opciones.length - 1)
            );
            return {
              ...base,
              escenario: String(activity.escenario || '').trim(),
              opciones: opciones.slice(0, 5),
              correcta,
              explicacion: String(activity.explicacion || '').trim(),
              senal: String(activity.senal || '').trim(),
              riesgo: String(activity.riesgo || '').trim(),
              accion: String(activity.accion || '').trim(),
            };
          }

          if (tipo === 'abierta') {
            return {
              ...base,
              prompt: String(activity.prompt || activity.pregunta || '').trim(),
              pistas: Array.isArray(activity.pistas)
                ? activity.pistas
                    .map((item) => String(item).trim())
                    .filter(Boolean)
                    .slice(0, 4)
                : [],
            };
          }

          if (tipo === 'sim_chat') {
            return {
              ...base,
              escenario: String(activity.escenario || '').trim(),
              inicio: String(activity.inicio || '').trim(),
              contactName: String(
                activity.contactName || activity.nombre || activity.contacto || ''
              ).trim(),
              avatarLabel: String(
                activity.avatarLabel || activity.avatar || activity.iniciales || ''
              ).trim(),
              contactStatus: String(
                activity.contactStatus || activity.status || activity.estado || ''
              ).trim(),
              quickReplies: Array.isArray(activity.quickReplies)
                ? activity.quickReplies
                    .map((item) => String(item).trim())
                    .filter(Boolean)
                    .slice(0, 4)
                : [],
              turnos_max: clamp(Number(activity.turnos_max) || 6, 3, 10),
            };
          }

          if (tipo === 'call_sim') {
            const rawSteps = Array.isArray(activity.steps)
              ? activity.steps
              : Array.isArray(activity.pasos)
                ? activity.pasos
                : [];
            const steps = rawSteps
              .map((step, stepIndex) => {
                if (!step || typeof step !== 'object') return null;
                const texto = String(step.texto || step.text || '').trim();
                const opciones = (
                  Array.isArray(step.opciones)
                    ? step.opciones
                    : Array.isArray(step.options)
                      ? step.options
                      : []
                )
                  .map((option, optionIndex) => {
                    if (!option || typeof option !== 'object') return null;
                    const texto = String(option.texto || option.label || option.text || '').trim();
                    if (!texto) return null;
                    return {
                      id: String(option.id || `o${optionIndex + 1}`).trim() || `o${optionIndex + 1}`,
                      texto,
                      puntaje: clamp(Number(option.puntaje ?? option.score ?? 0.6) || 0.6, 0, 1),
                      feedback: String(option.feedback || option.retro || '').trim(),
                    };
                  })
                  .filter(Boolean)
                  .slice(0, 5);
                if (!texto || opciones.length < 2) return null;
                return {
                  id: String(step.id || `p${stepIndex + 1}`).trim() || `p${stepIndex + 1}`,
                  texto,
                  opciones,
                };
              })
              .filter(Boolean)
              .slice(0, 6);
            return {
              ...base,
              intro: String(activity.intro || '').trim(),
              callerName: String(
                activity.callerName || activity.nombre || activity.caller || ''
              ).trim(),
              callerNumber: String(
                activity.callerNumber || activity.numero || activity.number || ''
              ).trim(),
              opening: String(activity.opening || activity.inicio || '').trim(),
              allowVoice: activity.allowVoice !== false,
              voiceProfile: String(activity.voiceProfile || activity.voice || activity.voz || '').trim(),
              steps,
            };
          }

          if (tipo === 'compare_domains') {
            const dominios = Array.isArray(activity.dominios)
              ? activity.dominios.map((item) => String(item).trim()).filter(Boolean)
              : Array.isArray(activity.opciones)
                ? activity.opciones.map((item) => String(item).trim()).filter(Boolean)
                : [];
            const correcta = clamp(
              Number(activity.correcta) || 0,
              0,
              Math.max(0, dominios.length - 1)
            );
            return {
              ...base,
              prompt: String(activity.prompt || activity.pregunta || '').trim(),
              dominios: dominios.slice(0, 4),
              correcta,
              explicacion: String(activity.explicacion || '').trim(),
              tip: String(activity.tip || activity.consejo || '').trim(),
            };
          }

          if (tipo === 'signal_hunt') {
            const mensaje = String(
              activity.mensaje || activity.texto || activity.escenario || ''
            ).trim();
            const rawSignals = Array.isArray(activity.senales)
              ? activity.senales
              : Array.isArray(activity.opciones)
                ? activity.opciones
                : [];
            const senales = rawSignals
              .map((signal, signalIndex) => {
                if (!signal) return null;
                if (typeof signal === 'string') {
                  const label = signal.trim();
                  if (!label) return null;
                  return { id: `s${signalIndex + 1}`, label, correcta: false, explicacion: '' };
                }
                if (typeof signal !== 'object') return null;
                const label = String(signal.label || signal.texto || signal.senal || '').trim();
                if (!label) return null;
                return {
                  id: String(signal.id || `s${signalIndex + 1}`).trim() || `s${signalIndex + 1}`,
                  label,
                  correcta: Boolean(signal.correcta ?? signal.es_correcta ?? signal.correcto),
                  explicacion: String(signal.explicacion || signal.razon || '').trim(),
                };
              })
              .filter(Boolean)
              .slice(0, 10);

            return {
              ...base,
              mensaje,
              senales,
              accion: String(activity.accion || activity.safeAction || '').trim(),
            };
          }

          if (tipo === 'inbox') {
            const kindRaw = String(activity.kind || activity.canal || activity.tipo_inbox || '').toLowerCase();
            const kind = kindRaw.includes('sms') ? 'sms' : 'correo';
            const intro = String(activity.intro || '').trim();
            const rawMessages = Array.isArray(activity.mensajes)
              ? activity.mensajes
              : Array.isArray(activity.items)
                ? activity.items
                : [];
            const mensajes = rawMessages
              .map((message, messageIndex) => {
                if (!message || typeof message !== 'object') return null;
                const text = String(message.text || message.mensaje || message.cuerpo || '').trim();
                if (!text) return null;
                const details =
                  message.details && typeof message.details === 'object'
                    ? {
                        from: String(message.details.from || message.from || '').trim(),
                        replyTo: String(message.details.replyTo || message.details.reply_to || '').trim(),
                        returnPath: String(
                          message.details.returnPath || message.details.return_path || ''
                        ).trim(),
                      }
                    : null;
                const clsRaw = String(
                  message.correcto || message.clasificacion || message.tipo || message.clase || ''
                ).toLowerCase();
                return {
                  id: String(message.id || `m${messageIndex + 1}`).trim() || `m${messageIndex + 1}`,
                  displayName: String(message.displayName || message.nombre || message.alias || '').trim(),
                  from: String(message.from || message.de || message.remitente || '').trim(),
                  subject: String(message.subject || message.asunto || '').trim(),
                  preview: String(message.preview || message.resumen || '').trim(),
                  dateLabel: String(message.dateLabel || message.fecha || '').trim(),
                  warning: String(message.warning || message.aviso || '').trim(),
                  text,
                  body: Array.isArray(message.body)
                    ? message.body.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
                    : [],
                  attachments: Array.isArray(message.attachments)
                    ? message.attachments
                        .map((item) => String(item).trim())
                        .filter(Boolean)
                        .slice(0, 4)
                    : [],
                  details,
                  ctaLabel: String(message.ctaLabel || message.boton || '').trim(),
                  linkPreview: String(message.linkPreview || message.link || '').trim(),
                  correcto:
                    clsRaw.includes('estafa') || clsRaw.includes('fraud') || clsRaw.includes('phish')
                      ? 'estafa'
                      : 'seguro',
                  explicacion: String(message.explicacion || message.razon || '').trim(),
                };
              })
              .filter(Boolean)
              .slice(0, 8);

            return {
              ...base,
              kind,
              intro,
              mensajes,
            };
          }

          if (tipo === 'web_lab') {
            const intro = String(activity.intro || '').trim();
            const page =
              activity.pagina && typeof activity.pagina === 'object'
                ? activity.pagina
                : activity.page && typeof activity.page === 'object'
                  ? activity.page
                  : {};
            const rawHotspots = Array.isArray(activity.hotspots)
              ? activity.hotspots
              : Array.isArray(activity.senales)
                ? activity.senales
                : [];

            return {
              ...base,
              intro,
              pagina: {
                marca: String(page.marca || page.brand || '').trim() || 'NovaTienda',
                dominio: String(page.dominio || page.url || '').trim() || 'novatienda-mx.shop',
                browserTitle: String(page.browserTitle || page.browser_title || '').trim(),
                banner: String(page.banner || page.hero || '').trim(),
                sub: String(page.sub || page.subtitulo || page.copy || '').trim(),
                contacto: String(page.contacto || page.contact || '').trim(),
                pagos: Array.isArray(page.pagos)
                  ? page.pagos.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
                  : [],
                shipping: String(page.shipping || page.envio || '').trim(),
                reviews: String(page.reviews || page.resenas || '').trim(),
                policy: String(page.policy || page.politicas || '').trim(),
                cartNote: String(page.cartNote || page.carrito || '').trim(),
                checkoutPrompt: String(page.checkoutPrompt || page.checkout_prompt || '').trim(),
                productos: (Array.isArray(page.productos) ? page.productos : [])
                  .map((product, productIndex) => {
                    if (!product || typeof product !== 'object') return null;
                    const nombre = String(product.nombre || product.name || '').trim();
                    if (!nombre) return null;
                    return {
                      id:
                        String(product.id || `p${productIndex + 1}`).trim() ||
                        `p${productIndex + 1}`,
                      nombre,
                      precio: String(product.precio || product.price || '').trim(),
                      antes: String(product.antes || product.old_price || '').trim(),
                    };
                  })
                  .filter(Boolean)
                  .slice(0, 6),
              },
              hotspots: rawHotspots
                .map((hotspot, hotspotIndex) => {
                  if (!hotspot || typeof hotspot !== 'object') return null;
                  const label = String(
                    hotspot.label || hotspot.titulo || hotspot.senal || ''
                  ).trim();
                  if (!label) return null;
                  return {
                    id:
                      String(hotspot.id || `h${hotspotIndex + 1}`).trim() ||
                      `h${hotspotIndex + 1}`,
                    target: String(hotspot.target || hotspot.objetivo || '').trim() || `h${hotspotIndex + 1}`,
                    label,
                    correcta: Boolean(
                      hotspot.correcta ?? hotspot.es_correcta ?? hotspot.correcto
                    ),
                    explicacion: String(hotspot.explicacion || hotspot.razon || '').trim(),
                  };
                })
                .filter(Boolean)
                .slice(0, 10),
              decisionPrompt: String(activity.decisionPrompt || activity.preguntaDecision || '').trim(),
              decisionOptions: Array.isArray(activity.decisionOptions)
                ? activity.decisionOptions
                    .map((item) => String(item).trim())
                    .filter(Boolean)
                    .slice(0, 4)
                : Array.isArray(activity.opcionesDecision)
                  ? activity.opcionesDecision
                      .map((item) => String(item).trim())
                      .filter(Boolean)
                      .slice(0, 4)
                  : [],
              correctDecision: Number.isFinite(Number(activity.correctDecision))
                ? clamp(Number(activity.correctDecision), 0, 3)
                : null,
            };
          }

          if (tipo === 'scenario_flow') {
            const rawSteps = Array.isArray(activity.pasos)
              ? activity.pasos
              : Array.isArray(activity.steps)
                ? activity.steps
                : [];
            return {
              ...base,
              intro: String(activity.intro || '').trim(),
              pasos: rawSteps
                .map((step, stepIndex) => {
                  if (!step || typeof step !== 'object') return null;
                  const texto = String(step.texto || step.text || '').trim();
                  if (!texto) return null;
                  const opciones = (
                    Array.isArray(step.opciones)
                      ? step.opciones
                      : Array.isArray(step.options)
                        ? step.options
                        : []
                  )
                    .map((option, optionIndex) => {
                      if (!option || typeof option !== 'object') return null;
                      const texto = String(option.texto || option.label || option.text || '').trim();
                      if (!texto) return null;
                      const siguienteRaw = option.siguiente ?? option.next;
                      return {
                        id: String(option.id || `o${optionIndex + 1}`).trim() || `o${optionIndex + 1}`,
                        texto,
                        puntaje: clamp(Number(option.puntaje ?? option.score ?? 0.6) || 0.6, 0, 1),
                        feedback: String(option.feedback || option.retro || '').trim(),
                        siguiente: Number.isFinite(Number(siguienteRaw))
                          ? clamp(Number(siguienteRaw), 0, 50)
                          : null,
                      };
                    })
                    .filter(Boolean)
                    .slice(0, 5);
                  return {
                    id: String(step.id || `p${stepIndex + 1}`).trim() || `p${stepIndex + 1}`,
                    texto,
                    opciones,
                  };
                })
                .filter(Boolean)
                .slice(0, 8),
            };
          }

          if (tipo === 'concepto') {
            return {
              ...base,
              bloques: Array.isArray(activity.bloques)
                ? activity.bloques
                    .map((block) => {
                      if (!block || typeof block !== 'object') return null;
                      const titulo = String(block.titulo || block.label || '').trim();
                      const texto = String(block.texto || block.text || '').trim();
                      if (!titulo || !texto) return null;
                      return { titulo, texto };
                    })
                    .filter(Boolean)
                    .slice(0, 5)
                : [],
              contenido: String(activity.contenido || activity.texto || '').trim(),
            };
          }

          return {
            ...base,
            raw: cloneJson(activity),
            bloques: Array.isArray(activity.bloques)
              ? activity.bloques
                  .map((block) => {
                    if (!block || typeof block !== 'object') return null;
                    const titulo = String(block.titulo || block.label || '').trim();
                    const texto = String(block.texto || block.text || '').trim();
                    if (!titulo || !texto) return null;
                    return { titulo, texto };
                  })
                  .filter(Boolean)
                  .slice(0, 5)
              : [],
            contenido: String(activity.contenido || activity.texto || '').trim(),
          };
        })
        .filter(Boolean);

      return { id, categoria, nivel, titulo, descripcion, actividades };
    })
    .filter(Boolean);

  return safe;
};

export const ensureCourseProgress = (plan, { reset = false, seed = null } = {}) => {
  const sig = computePlanSignature(plan);
  const prev = seed && typeof seed === 'object' ? cloneJson(seed) : null;

  let next = prev;
  if (reset || !prev || prev.planSig !== sig) {
    next = {
      planSig: sig,
      completed: {},
      modules: {},
      snapshots: [],
      seenScenarioIds: {},
      lastAccessAt: new Date().toISOString(),
    };
  } else {
    next = {
      ...prev,
      planSig: sig,
      completed: prev.completed && typeof prev.completed === 'object' ? prev.completed : {},
      modules: prev.modules && typeof prev.modules === 'object' ? prev.modules : {},
      snapshots: Array.isArray(prev.snapshots) ? prev.snapshots : [],
      seenScenarioIds:
        prev.seenScenarioIds && typeof prev.seenScenarioIds === 'object'
          ? prev.seenScenarioIds
          : {},
      lastAccessAt: new Date().toISOString(),
    };
  }

  const activityIds = new Set();
  const moduleIds = new Set();
  (Array.isArray(plan?.ruta) ? plan.ruta : []).forEach((module) => {
    if (module?.id) moduleIds.add(module.id);
    (Array.isArray(module?.actividades) ? module.actividades : []).forEach((activity) =>
      activityIds.add(activity.id)
    );
  });

  Object.keys(next.completed).forEach((key) => {
    if (!activityIds.has(key)) delete next.completed[key];
  });
  Object.keys(next.modules).forEach((key) => {
    if (!moduleIds.has(key)) delete next.modules[key];
  });
  Object.keys(next.seenScenarioIds || {}).forEach((key) => {
    const list = Array.isArray(next.seenScenarioIds[key]) ? next.seenScenarioIds[key] : [];
    next.seenScenarioIds[key] = Array.from(
      new Set(list.map((item) => String(item).trim()).filter(Boolean))
    ).slice(0, 300);
    if (!next.seenScenarioIds[key].length) delete next.seenScenarioIds[key];
  });

  return next;
};

export const computeCompetenciesFromProgress = (plan, progress) => {
  const base =
    plan?.competencias && typeof plan.competencias === 'object' ? plan.competencias : {};
  const totals = {};
  COMP_KEYS.forEach((key) => {
    totals[key] = { w: 0, e: 0 };
  });

  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  route.forEach((module) => {
    const category = normalizeCategory(module?.categoria);
    const activities = Array.isArray(module?.actividades) ? module.actividades : [];
    activities.forEach((activity) => {
      const weight = clamp(Number(activity?.peso ?? activity?.puntos ?? 1) || 1, 0.5, 3);
      if (!totals[category]) totals[category] = { w: 0, e: 0 };
      totals[category].w += weight;
      const done = progress?.completed?.[activity.id];
      const score = done ? clamp(Number(done.score) || 0, 0, 1) : 0;
      totals[category].e += weight * score;
    });
  });

  const competencias = {};
  COMP_KEYS.forEach((category) => {
    const baseValue = clamp(Number(base?.[category]) || 0, 0, 100);
    const remaining = 100 - baseValue;
    const ratio = totals[category]?.w ? totals[category].e / totals[category].w : 0;
    competencias[category] = clamp(Math.round(baseValue + remaining * ratio), 0, 100);
  });

  return {
    competencias,
    score_total: computeTotalScore(competencias),
  };
};

export const getModuleAndActivity = (plan, moduleIndex, activityIndex) => {
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  const module = route[moduleIndex];
  if (!module) return null;
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  const activity = activities[activityIndex];
  return { module, activities, activity: activity || null };
};

export const pickNextActivityIndex = (plan, progress, moduleIndex) => {
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  const module = route[moduleIndex];
  if (!module) return 0;
  const activities = Array.isArray(module.actividades) ? module.actividades : [];
  if (!activities.length) return 0;

  const nextIncomplete = activities.findIndex((activity) => !progress?.completed?.[activity.id]);
  if (nextIncomplete !== -1) return nextIncomplete;

  let worst = 0;
  let worstScore = 2;
  activities.forEach((activity, index) => {
    const score = Number(progress?.completed?.[activity.id]?.score);
    const safe = Number.isFinite(score) ? score : 1;
    if (safe < worstScore) {
      worstScore = safe;
      worst = index;
    }
  });
  return worst;
};

const getModuleProgressEntry = (progress, module) => {
  if (!progress || !module?.id) return null;
  progress.modules = progress.modules || {};
  if (!progress.modules[module.id]) {
    progress.modules[module.id] = {
      startedAt: new Date().toISOString(),
      completedAt: null,
      visits: 0,
      lastActivityId: null,
      durationMs: 0,
    };
  }
  return progress.modules[module.id];
};

export const withVisitedLesson = (plan, progress, moduleIndex, activityIndex) => {
  const info = getModuleAndActivity(plan, moduleIndex, activityIndex);
  if (!info || !info.activity) return progress;
  const next = ensureCourseProgress(plan, { seed: progress });
  const entry = getModuleProgressEntry(next, info.module);
  if (!entry) return next;
  entry.visits = clamp(Number(entry.visits) || 0, 0, 999) + 1;
  entry.lastActivityId = info.activity.id;
  next.lastAccessAt = new Date().toISOString();
  return next;
};

export const withSeenScenario = (progress, module, activity) => {
  if (!progress || !module || !activity || !isScenarioActivity(activity)) return progress;
  const scenarioId = String(activity.scenarioId || '').trim();
  if (!scenarioId) return progress;

  const next = cloneJson(progress);
  next.seenScenarioIds = next.seenScenarioIds || {};
  const key = `${normalizeCategory(module.categoria)}:${normalizeModuleLevel(module.nivel)}`;
  const list = Array.isArray(next.seenScenarioIds[key]) ? next.seenScenarioIds[key] : [];
  if (!list.includes(scenarioId)) {
    list.push(scenarioId);
    next.seenScenarioIds[key] = list.slice(-120);
  }
  return next;
};

const withRecordedSnapshot = (plan, progress) => {
  const next = cloneJson(progress);
  next.snapshots = Array.isArray(next.snapshots) ? next.snapshots : [];
  const computed = computeCompetenciesFromProgress(plan, next);
  const snapshot = {
    at: new Date().toISOString(),
    scoreTotal: computed.score_total,
    competencias: computed.competencias,
    completedCount: Object.keys(next.completed || {}).length,
  };
  const last = next.snapshots[next.snapshots.length - 1];
  if (!last || last.scoreTotal !== snapshot.scoreTotal || last.completedCount !== snapshot.completedCount) {
    next.snapshots.push(snapshot);
  }
  return next;
};

export const withCompletedActivity = ({
  plan,
  progress,
  moduleIndex,
  activityIndex,
  score,
  feedback,
  details = null,
  durationMs = 0,
}) => {
  const info = getModuleAndActivity(plan, moduleIndex, activityIndex);
  if (!info || !info.activity) return progress;
  const { activity, module, activities } = info;
  const next = ensureCourseProgress(plan, { seed: progress });
  const prev = next?.completed?.[activity.id];
  const attempts = clamp(Number(prev?.attempts) || 0, 0, 999) + 1;

  next.completed = next.completed || {};
  next.completed[activity.id] = {
    score: clamp(Number(score) || 0, 0, 1),
    attempts,
    feedback: String(feedback || prev?.feedback || '').slice(0, 600),
    durationMs,
    details,
    at: new Date().toISOString(),
  };

  const moduleEntry = getModuleProgressEntry(next, module);
  if (moduleEntry) {
    moduleEntry.lastActivityId = activity.id;
    moduleEntry.durationMs =
      clamp(Number(moduleEntry.durationMs) || 0, 0, Number.MAX_SAFE_INTEGER) + durationMs;
    const moduleDone = activities.every((item) => Boolean(next?.completed?.[item.id]));
    if (moduleDone && !moduleEntry.completedAt) {
      moduleEntry.completedAt = new Date().toISOString();
    }
  }

  next.lastAccessAt = new Date().toISOString();
  return withRecordedSnapshot(plan, next);
};

export const feedbackRatingLabel = (score) => {
  const safe = clamp(Number(score) || 0, 0, 1);
  if (safe >= 0.85) return 'Buena';
  if (safe >= 0.6) return 'Regular';
  return 'Riesgosa';
};

export const feedbackToText = (payload) => {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  return [
    payload.title ? `Resultado: ${payload.title}` : '',
    payload.signal ? `Señal detectada: ${payload.signal}` : '',
    payload.risk ? `Riesgo: ${payload.risk}` : '',
    payload.action ? `Acción segura: ${payload.action}` : '',
    payload.extra ?? '',
    Array.isArray(payload.detected) && payload.detected.length
      ? `Señales detectadas: ${payload.detected.join(', ')}`
      : '',
    Array.isArray(payload.missed) && payload.missed.length
      ? `Te faltó revisar: ${payload.missed.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
};

export const summarizeProgressInsights = (plan, progress) => {
  const insights = { strengths: [], focus: [], mistakes: [] };
  if (!plan || !progress) return insights;

  const computed = computeCompetenciesFromProgress(plan, progress);
  const sortedCompetencies = Object.entries(computed.competencias || {}).sort((a, b) => b[1] - a[1]);

  insights.strengths = sortedCompetencies
    .slice(0, 2)
    .map(([key, value]) => `${CATEGORY_LABELS[key] || key}: ${value}%`);

  insights.focus = sortedCompetencies
    .slice(-2)
    .reverse()
    .map(([key, value]) => `${CATEGORY_LABELS[key] || key}: ${value}%`);

  const weakActivities = [];
  const route = Array.isArray(plan?.ruta) ? plan.ruta : [];
  route.forEach((module) => {
    (Array.isArray(module?.actividades) ? module.actividades : []).forEach((activity) => {
      const done = progress?.completed?.[activity.id];
      if (!done) return;
      const score = Number(done.score);
      if (Number.isFinite(score) && score < 0.7) {
        weakActivities.push({
          label: `${module.titulo}: ${activity.titulo}`,
          score,
          feedback: done.feedback || '',
        });
      }
    });
  });

  insights.mistakes = weakActivities
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => item.feedback || item.label);

  return insights;
};

export const defaultTopicsFromAnswers = (answers) => {
  const set = new Set();
  const priority = answers?.priority;
  if (priority === 'todo') {
    ['sms', 'whatsapp', 'web', 'llamadas', 'correo_redes', 'habitos'].forEach((topic) =>
      set.add(topic)
    );
    return Array.from(set);
  }
  if (priority) set.add(priority);

  const channels = Array.isArray(answers?.channels) ? answers.channels : [];
  channels.forEach((channel) => {
    if (channel === 'correo' || channel === 'redes') set.add('correo_redes');
    else set.add(channel);
  });

  set.add('habitos');

  if (set.size === 0) {
    ['sms', 'whatsapp', 'web', 'llamadas', 'habitos'].forEach((topic) => set.add(topic));
  }
  return Array.from(set);
};

export const normalizeCoursePrefs = (prefs, answers) => {
  const source = prefs && typeof prefs === 'object' ? prefs : {};
  const temas = Array.isArray(source.temas)
    ? source.temas.map((topic) => normalizeCategory(topic)).filter(Boolean)
    : [];

  return {
    estilo: String(source.estilo || 'mix').trim() || 'mix',
    dificultad: String(source.dificultad || 'auto').trim() || 'auto',
    duracion: String(source.duracion || '5-10').trim() || '5-10',
    temas: temas.length ? Array.from(new Set(temas)) : defaultTopicsFromAnswers(answers),
  };
};
