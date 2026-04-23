import { repairPossibleMojibake } from '../../../lib/course.js';

export const SIMULATION_CATEGORY_META = {
  chat: {
    label: 'Mensajeria',
    channel: 'whatsapp',
  },
  sms: {
    label: 'SMS',
    channel: 'sms',
  },
  email: {
    label: 'Correo',
    channel: 'email',
  },
  web: {
    label: 'WebLab',
    channel: 'web',
  },
  call: {
    label: 'Llamada',
    channel: 'call',
  },
  scenario: {
    label: 'ScenarioFlow',
    channel: 'scenario',
  },
  analysis: {
    label: 'Analisis',
    channel: 'analysis',
  },
};

export function getSimulationCategory(activity) {
  const type = String(activity?.tipo || '').toLowerCase();
  if (type === 'sim_chat') return 'chat';
  if (type === 'inbox') return activity?.kind === 'sms' ? 'sms' : 'email';
  if (type === 'web_lab') return 'web';
  if (type === 'call_sim') return 'call';
  if (type === 'scenario_flow') return 'scenario';
  if (type === 'compare_domains' || type === 'signal_hunt') return 'analysis';
  return SIMULATION_CATEGORY_META[type] ? type : 'analysis';
}

export function getSimulationCategoryClass(category) {
  const safeCategory = SIMULATION_CATEGORY_META[category] ? category : 'analysis';
  return `sd-simulation-category sd-simulation-category-${safeCategory}`;
}

export const PANEL_CLASS =
  'sd-immersive-panel rounded-[26px] border border-sd-border-strong bg-sd-surface-raised p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] md:p-5';

export const SOFT_PANEL_CLASS =
  'sd-immersive-aside-panel rounded-[24px] border border-sd-border-strong bg-sd-surface p-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.4)]';

export const TARGET_LABELS = {
  domain: 'Dominio visible',
  banner: 'Banner principal',
  search: 'Buscador',
  reviews: 'Reseñas del sitio',
  shipping: 'Envío y protección',
  contacto: 'Atención al cliente',
  policy: 'Políticas y devoluciones',
  pago: 'Métodos de pago',
  cart_icon: 'Carrito',
  order_summary: 'Resumen de compra',
  address_form: 'Formulario de envío',
};

export function cleanText(value, fallback = '') {
  return repairPossibleMojibake(String(value || fallback || '')).trim();
}
