import { repairPossibleMojibake } from '../../../lib/course.js';

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
