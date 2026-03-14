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
        'Si la prioridad es "todo", cubre varios canales (web, WhatsApp/SMS y llamadas) en los módulos. ' +
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
        'Tu objetivo es educar, tranquilizar y guiar a los usuarios para evitar fraudes en línea. ' +
        'Reglas obligatorias: ' +
        '1) Empieza con empatía o validación en 1–2 frases humanas. ' +
        '2) No empieces con listas. ' +
        '3) Usa lenguaje simple y cercano, nada técnico. ' +
        '4) Luego usa una lista corta con viñetas "• " (3–4 puntos). ' +
        '5) No digas que puedes revisar sitios ni investigar enlaces; enseña qué revisar. ' +
        '6) Termina con una señal de alerta o recomendación preventiva. ' +
        '7) Nunca respondas solo con viñetas. ' +
        'Si el usuario menciona un fraude en curso, sugiere medidas inmediatas y canales oficiales sin inventar números.',
    },
    {
      role: 'user',
      content: '¿Cómo puedo saber si una tienda en línea es confiable antes de comprar?',
    },
    {
      role: 'assistant',
      content:
        'Es buena idea revisar algunos detalles antes de comprar en una tienda en línea, especialmente si es una página que no conoces. ' +
        'Hoy en día existen muchas tiendas falsas en internet, así que vale la pena tomar unos minutos para verificar.\n\n' +
        'Algunas cosas que puedes revisar son:\n' +
        '• Que la página empiece con https:// y tenga el candado de seguridad.\n' +
        '• Buscar opiniones o reseñas de otros compradores.\n' +
        '• Revisar que tenga políticas claras de envío y devolución.\n' +
        '• Usar métodos de pago seguros como tarjetas de crédito o plataformas reconocidas.\n\n' +
        'Si notas precios demasiado bajos o poca información de contacto, es mejor tomar precaución antes de comprar.',
    },
    ...messages,
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

const looksGeneric = (text) => {
  const lower = String(text || '').toLowerCase();
  return BANNED_GENERIC_PHRASES.some((phrase) => lower.includes(phrase));
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

const sanitizeAssessment = (parsed, answers) => {
  const safe = {
    nivel: normalizeNivel(parsed?.nivel),
    resumen: String(parsed?.resumen || '').trim(),
    recomendaciones: asStringArray(parsed?.recomendaciones),
    proximos_pasos: Array.isArray(parsed?.proximos_pasos) ? parsed.proximos_pasos : [],
  };

  // Normalize next steps into { titulo, descripcion } objects for consistent UI.
  safe.proximos_pasos = safe.proximos_pasos
    .map((step) => {
      if (!step) return null;
      if (typeof step === 'string') return { titulo: step.trim(), descripcion: '' };
      if (typeof step === 'object') {
        const titulo = toText(step.titulo || step.title || step.tema || step.modulo);
        const descripcion = toText(step.descripcion || step.aprenderas || step.desc || step.detalle);
        return titulo ? { titulo, descripcion } : null;
      }
      return null;
    })
    .filter(Boolean);

  // Ensure recommendations are present and not generic placeholders.
  const recsTooGeneric =
    safe.recomendaciones.length < 3 || safe.recomendaciones.every(looksGeneric);

  // Ensure next steps are present and not generic placeholders.
  const stepsTooGeneric =
    safe.proximos_pasos.length < 2 ||
    safe.proximos_pasos.some((step) => looksGeneric(step?.titulo || step?.descripcion));

  if (recsTooGeneric || stepsTooGeneric) {
    const fallback = buildFallbackAssessment(answers);
    if (recsTooGeneric) safe.recomendaciones = fallback.recomendaciones;
    if (stepsTooGeneric) safe.proximos_pasos = fallback.proximos_pasos;
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
