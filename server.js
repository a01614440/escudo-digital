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
