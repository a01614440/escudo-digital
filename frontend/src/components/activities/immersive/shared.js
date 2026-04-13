import { repairPossibleMojibake } from '../../../lib/course.js';

export const PANEL_CLASS =
  'rounded-[26px] border border-sd-border bg-white/75 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] backdrop-blur md:p-5';

export const SOFT_PANEL_CLASS =
  'rounded-[24px] border border-sd-border bg-white/60 p-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.4)] backdrop-blur';

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
