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
        'Debes evaluar el nivel de riesgo (bajo, medio, alto) y dar un resumen MUY breve, ' +
        'además de 3 recomendaciones personalizadas (máximo 7 palabras cada una). ' +
        'Responde en español. Devuelve SOLO JSON válido con las llaves: ' +
        'nivel, resumen, recomendaciones (array). No agregues texto extra.',
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
        'Sigue siempre estas reglas al responder: ' +
        '1) Empieza con una frase de empatía o validación hacia la preocupación del usuario. ' +
        '2) No empieces directamente con listas o puntos. Primero escribe 1–2 frases humanas. ' +
        '3) Explica los consejos de forma clara, usando lenguaje simple y cercano. ' +
        '4) Después de la introducción, puedes usar una lista corta de recomendaciones (3–4 puntos máximo). ' +
        '5) Nunca respondas de forma robótica o solo con viñetas. ' +
        '6) No digas que puedes revisar páginas web o investigar enlaces; solo enseña qué revisar. ' +
        '7) Termina siempre con una recomendación preventiva o señal de alerta. ' +
        '8) La respuesta debe sentirse como una persona experta ayudando, no como una lista automática. ' +
        'Si el usuario menciona un fraude en curso, sugiere medidas inmediatas y canales oficiales sin inventar números específicos. ' +
        'Ejemplo de estilo: ' +
        'Usuario: ¿Qué debo revisar antes de comprar en una página web? ' +
        'Respuesta: Es buena idea revisar algunos detalles antes de comprar en un sitio nuevo, porque hoy en día existen muchas tiendas falsas en internet. ' +
        'Tomarse unos minutos para verificar la página puede ayudarte a evitar fraudes. ' +
        'Algunas cosas que puedes revisar son: ' +
        '- Que la página empiece con https:// y tenga el candado de seguridad. ' +
        '- Buscar opiniones de otros usuarios sobre la tienda. ' +
        '- Revisar que tenga políticas claras de envío y devolución. ' +
        '- Usar métodos de pago seguros como tarjetas de crédito o plataformas reconocidas. ' +
        'Si ves precios demasiado bajos, errores en la página o poca información de contacto, es mejor tomar precaución antes de comprar.',
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

app.post('/api/assess', async (req, res) => {
  try {
    const answers = req.body?.answers || {};
    const input = buildAssessmentPrompt(answers);

    const data = await callOpenAI({
      model: OPENAI_MODEL,
      input,
      temperature: 0.3,
      max_output_tokens: 400,
    });

    const text = extractText(data);
    const parsed = extractJson(text);

    if (!parsed || !parsed.nivel) {
      return res.json({
        nivel: 'Medio',
        resumen:
          'No se pudo interpretar la respuesta del modelo. Mostramos un resultado preliminar.',
        recomendaciones: [],
      });
    }

    return res.json(parsed);
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
      temperature: 0.5,
      max_output_tokens: 600,
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
