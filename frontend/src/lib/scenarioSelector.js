import { repairPossibleMojibake } from './course.js';

export const SIMULATION_GUIDES = {
  quiz: [
    'Lee el escenario completo antes de responder.',
    'Elige la opción más segura, no la más rápida.',
    'Usa el feedback para identificar qué señal cambió la decisión.',
  ],
  simulacion: [
    'Lee el escenario completo antes de responder.',
    'Elige la opción más segura, no la más rápida.',
    'Usa el feedback para identificar qué señal cambió la decisión.',
  ],
  sim_chat: [
    'Responde como si fuera una conversación real.',
    'La meta es detectar el riesgo, no agradar al contacto.',
    'Si dudas, pausa y verifica por fuera del chat.',
  ],
  compare_domains: [
    'Busca cambios mínimos en letras, terminaciones o estructura.',
    'El dominio más confiable suele ser el más simple y coherente.',
    'Si sigues dudando, escríbelo tú mismo en el navegador.',
  ],
  signal_hunt: [
    'Marca solo las señales que realmente cambian la decisión.',
    'No necesitas marcar todo: importa más la precisión.',
    'Piensa qué parte del mensaje te quiere apurar, engañar o desviar.',
  ],
  inbox: [
    'Abre el mensaje y revísalo completo antes de clasificarlo.',
    'Fíjate en remitente, asunto, cuerpo y enlaces visibles.',
    'No te guíes solo por el diseño: busca incoherencias concretas.',
  ],
  web_lab: [
    'Recorre producto, carrito y checkout como si fueras a comprar.',
    'Marca solo las señales más peligrosas y evita castigar detalles menores.',
    'Al final decide si seguirías o saldrías del sitio.',
  ],
  call_sim: [
    'Lee cada paso como si estuvieras en una llamada real.',
    'Prioriza cortar, pausar o verificar por fuera de la llamada.',
    'No compartas datos ni resuelvas bajo presión.',
  ],
  scenario_flow: [
    'Cada decisión cambia el escenario siguiente.',
    'Piensa en la rutina segura antes de responder.',
    'La meta es reducir riesgo, no terminar rápido.',
  ],
  abierta: [
    'Explica qué harías con tus propias palabras.',
    'Incluye cómo pausarías, verificarías o cortarías el riesgo.',
    'No hace falta escribir mucho, pero sí ser claro.',
  ],
  checklist: [
    'Marca cada paso solo si realmente lo revisarías.',
    'Úsalo como una rutina mínima de verificación.',
    'La idea es convertirlo en hábito, no avanzar por avanzar.',
  ],
};

export function getSimulationGuide(activityType) {
  return SIMULATION_GUIDES[activityType] || [];
}

export function sanitizeScenarioContent(value) {
  if (typeof value === 'string') return repairPossibleMojibake(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeScenarioContent(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeScenarioContent(entry)])
    );
  }
  return value;
}

export function moduleThemeMeta(module) {
  const category = String(module?.categoria || module?.category || 'habitos');
  const level = String(module?.nivel || module?.level || 'basico');

  const byCategory = {
    whatsapp: {
      eyebrow: 'Simulación conversacional',
      blurb:
        'Entrena respuestas firmes frente a suplantación, cobros urgentes y enlaces sospechosos dentro de un chat que se siente real.',
      badge: 'WhatsApp',
      heroClass: 'from-emerald-50 via-white to-emerald-100/80',
      accentClass: 'bg-emerald-100 text-emerald-800',
    },
    sms: {
      eyebrow: 'Bandeja móvil',
      blurb:
        'Lee SMS como lo harías en tu teléfono: detecta premios falsos, bloqueos, cobros y enlaces que quieren apurarte.',
      badge: 'SMS',
      heroClass: 'from-sky-50 via-white to-cyan-100/80',
      accentClass: 'bg-sky-100 text-sky-800',
    },
    correo_redes: {
      eyebrow: 'Inbox y phishing',
      blurb:
        'Analiza remitentes, asuntos, adjuntos y enlaces como si revisaras una bandeja real de correo o notificaciones sociales.',
      badge: 'Correo / Redes',
      heroClass: 'from-violet-50 via-white to-fuchsia-100/70',
      accentClass: 'bg-violet-100 text-violet-800',
    },
    llamadas: {
      eyebrow: 'Vishing y voz',
      blurb:
        'Practica llamadas convincentes donde lo importante es cortar el canal, no seguirle el juego al supuesto agente.',
      badge: 'Llamadas',
      heroClass: 'from-amber-50 via-white to-orange-100/75',
      accentClass: 'bg-amber-100 text-amber-800',
    },
    web: {
      eyebrow: 'Sitios y páginas clonadas',
      blurb:
        'Recorre páginas como si fueras a comprar o iniciar sesión, pero con atención a dominio, pagos y políticas.',
      badge: 'Web',
      heroClass: 'from-slate-50 via-white to-rose-100/60',
      accentClass: 'bg-rose-100 text-rose-800',
    },
    habitos: {
      eyebrow: 'Rutina de verificación',
      blurb:
        'Convierte decisiones seguras en una rutina corta, repetible y útil aunque el fraude cambie de canal o de tono.',
      badge: 'Hábitos',
      heroClass: 'from-slate-50 via-white to-slate-100/80',
      accentClass: 'bg-slate-200 text-slate-700',
    },
  };

  const byLevel = {
    basico: { label: 'Básico', brief: 'Señales claras y decisiones directas.' },
    refuerzo: { label: 'Refuerzo', brief: 'Casos mixtos con más ambigüedad.' },
    avanzado: { label: 'Avanzado', brief: 'Escenarios finos con pocas pistas visibles.' },
  };

  return {
    category,
    level,
    ...(byCategory[category] || byCategory.habitos),
    ...(byLevel[level] || byLevel.basico),
  };
}
