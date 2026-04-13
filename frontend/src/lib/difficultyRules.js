import { normalizeModuleLevel } from './course.js';

export const LEVEL_ORDER = ['basico', 'refuerzo', 'avanzado'];
export const TOPIC_ORDER = ['web', 'whatsapp', 'sms', 'llamadas', 'correo_redes', 'habitos'];

export const LEVEL_COPY = {
  basico: {
    eyebrow: 'Base',
    title: 'Nivel básico',
    description: 'Empieza con señales claras y decisiones simples para construir criterio.',
  },
  refuerzo: {
    eyebrow: 'Refuerzo',
    title: 'Nivel intermedio',
    description: 'Practica casos más retadores cuando ya dominaste la base.',
  },
  avanzado: {
    eyebrow: 'Avanzado',
    title: 'Nivel avanzado',
    description: 'Se desbloquea cuando completas los bloques anteriores.',
  },
};

export function getLevelCopy(level) {
  return LEVEL_COPY[normalizeModuleLevel(level)] || LEVEL_COPY.basico;
}
