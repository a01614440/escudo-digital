import { CATEGORY_LABELS, LEVEL_LABELS, normalizeModuleLevel } from './course.js';

export const JOURNEY_STEP_ORDER = ['encuesta', 'diagnostico', 'ruta', 'modulo'];

const MODULE_OBJECTIVES = {
  web: 'Detectar señales peligrosas antes de confiar en una página, compra o formulario.',
  whatsapp:
    'Frenar conversaciones con presión, suplantación o pedidos urgentes sin quedarte resolviendo dentro del chat.',
  sms: 'Revisar mensajes breves con criterio para no abrir enlaces ni actuar por prisa.',
  llamadas:
    'Reconocer presión por voz y cortar el canal antes de compartir datos o seguir instrucciones.',
  correo_redes:
    'Leer remitente, cuerpo y enlaces con calma para distinguir phishing de mensajes legítimos.',
  habitos:
    'Convertir decisiones seguras en una rutina corta que puedas repetir aunque cambie la estafa.',
};

const ACTIVITY_EXPECTATIONS = {
  concepto: {
    whatToDo: 'Lee con calma y quédate con una regla práctica que sí puedas repetir después.',
    scoring: 'Se registra como completada cuando terminas la lectura y pasas a la siguiente actividad.',
    quickTip: 'Quédate con una sola idea útil antes de seguir.',
  },
  quiz: {
    whatToDo: 'Lee el escenario completo y elige la decisión más segura, no la más rápida.',
    scoring:
      'Se valora mejor cuando detectas la señal principal. Un error no borra todo si tu criterio va bien encaminado.',
    quickTip: 'Si dudas entre dos opciones, elige la que te saque del canal sospechoso.',
  },
  simulacion: {
    whatToDo: 'Lee el caso y decide qué harías primero para cortar el riesgo.',
    scoring:
      'Se valora la decisión más segura, pero también se reconoce cuando detectas parte del riesgo aunque no sea perfecta.',
    quickTip: 'Primero pausa, luego verifica.',
  },
  checklist: {
    whatToDo: 'Marca todos los pasos que realmente usarías para verificar antes de actuar.',
    scoring: 'La meta es completar la rutina completa; si te falta un paso, te diremos cuál reforzar.',
    quickTip: 'Hazlo como si estuvieras frente a un mensaje real.',
  },
  abierta: {
    whatToDo: 'Explica en pocas líneas cómo pausarías, verificarías o cortarías el riesgo.',
    scoring:
      'Se valora que tu respuesta sea clara, concreta y orientada a verificar por fuera del canal sospechoso.',
    quickTip: 'No hace falta escribir mucho, sí dejar claro qué harías.',
  },
  sim_chat: {
    whatToDo: 'Responde como si fuera un chat real, pero sin ceder control ni seguir el ritmo del atacante.',
    scoring:
      'Se reconoce mejor cuando sales del canal con firmeza. Si dudas, un cierre prudente vale más que seguir respondiendo.',
    quickTip: 'No necesitas convencer al atacante; necesitas cortar el riesgo.',
  },
  compare_domains: {
    whatToDo: 'Compara dominios y quédate con el que sí escribirías tú mismo en el navegador.',
    scoring:
      'Se penaliza más abrir una dirección claramente falsa que confundirte con una muy parecida en nivel básico.',
    quickTip: 'Busca letras de más, cambios mínimos y terminaciones raras.',
  },
  signal_hunt: {
    whatToDo: 'Marca solo las señales que de verdad cambian la decisión.',
    scoring:
      'Importa más detectar las señales relevantes que marcar todo. En básico hay más tolerancia con dudas menores.',
    quickTip: 'Piensa qué parte del mensaje te quiere apurar, desviar o engañar.',
  },
  inbox: {
    whatToDo: 'Revisa remitente, asunto, cuerpo y enlaces antes de clasificar.',
    scoring:
      'Se reconoce cuando detectas el patrón general del mensaje; un detalle dudoso no debería hundir tu resultado.',
    quickTip: 'No te guíes solo por el diseño o por un sello bonito.',
  },
  web_lab: {
    whatToDo:
      'Recorre producto, carrito y checkout. Marca solo las señales más peligrosas y decide si confiarías.',
    scoring:
      'Se valora encontrar las señales críticas. En básico se toleran mejor algunas marcas extra si detectaste lo importante.',
    quickTip: 'Primero dominio, pagos, políticas y urgencia. Después decide.',
  },
  call_sim: {
    whatToDo: 'Avanza como si estuvieras en una llamada real y decide cómo cortar o verificar.',
    scoring:
      'Lo mejor es cortar el canal o verificar por fuera. Se penaliza más compartir datos que pedir tiempo.',
    quickTip: 'Una llamada urgente no merece una respuesta apresurada.',
  },
  scenario_flow: {
    whatToDo: 'Toma una decisión por paso y mantén la misma rutina segura aunque cambie el contexto.',
    scoring:
      'Cada decisión suma. Un desliz no borra lo anterior, pero sí revela dónde reforzar tu criterio.',
    quickTip: 'Haz siempre la misma secuencia: pausa, verifica y confirma por otro canal.',
  },
};

export function buildJourneyProgress({
  currentView = 'survey',
  surveyStage = 'survey',
  hasAssessment = false,
  hasCoursePlan = false,
  inLesson = false,
} = {}) {
  let activeStep = 'encuesta';

  if (currentView === 'lesson' || inLesson) activeStep = 'modulo';
  else if (currentView === 'courses' || hasCoursePlan) activeStep = 'ruta';
  else if (surveyStage === 'results' || surveyStage === 'loading' || hasAssessment) activeStep = 'diagnostico';

  const activeIndex = JOURNEY_STEP_ORDER.indexOf(activeStep);

  return [
    {
      id: 'encuesta',
      label: 'Encuesta',
      description: 'Responde preguntas breves sobre hábitos y exposición.',
    },
    {
      id: 'diagnostico',
      label: 'Diagnóstico',
      description: 'Revisamos tu nivel de riesgo y las señales que más conviene practicar.',
    },
    {
      id: 'ruta',
      label: 'Ruta',
      description: 'Te mostramos el siguiente módulo recomendado y tu progreso general.',
    },
    {
      id: 'modulo',
      label: 'Módulo actual',
      description: 'Practicas una actividad concreta y recibes retroalimentación útil.',
    },
  ].map((step, index) => ({
    ...step,
    state: index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'upcoming',
  }));
}

export function getModuleObjective(module) {
  const category = String(module?.categoria || module?.category || 'habitos');
  return MODULE_OBJECTIVES[category] || MODULE_OBJECTIVES.habitos;
}

export function getActivityInstructionMeta(activityType, module) {
  const normalizedType = String(activityType || 'concepto').toLowerCase();
  const normalizedLevel = normalizeModuleLevel(module?.nivel || module?.level);
  const base = ACTIVITY_EXPECTATIONS[normalizedType] || ACTIVITY_EXPECTATIONS.concepto;
  const categoryLabel =
    CATEGORY_LABELS[String(module?.categoria || module?.category || 'habitos')] || 'este módulo';
  const levelLabel = LEVEL_LABELS[normalizedLevel] || normalizedLevel;

  return {
    objective: getModuleObjective(module),
    whatToDo: base.whatToDo,
    scoring: base.scoring,
    quickTip: base.quickTip,
    heading: `${categoryLabel} · ${levelLabel}`,
  };
}

export function buildCourseQuickGuide({ hasProgress = false } = {}) {
  return [
    {
      title: hasProgress ? 'Retoma tu módulo' : 'Empieza por el recomendado',
      body: hasProgress
        ? 'Usa “Continuar donde me quedé” para volver al punto exacto donde pausaste.'
        : 'Abre primero el módulo recomendado para entrar por la señal más prioritaria.',
    },
    {
      title: 'Lee la guía corta',
      body: 'Cada actividad explica qué debes hacer y cómo se evalúa antes de que respondas.',
    },
    {
      title: 'Usa el feedback',
      body: 'Después de cada decisión te diremos qué viste bien, qué faltó notar y qué harías en la vida real.',
    },
  ];
}
