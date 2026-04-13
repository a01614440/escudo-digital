import { scoreHotspotDecision, inferHotspotSeverity } from '../../../lib/activityScoring.js';
import { cleanText, TARGET_LABELS } from './shared.js';

export function buildWebLabPage(activity) {
  const source = activity?.pagina && typeof activity.pagina === 'object' ? activity.pagina : {};
  const productos = Array.isArray(source?.productos)
    ? source.productos.map((product) => ({
        nombre: cleanText(product?.nombre || 'Producto'),
        precio: cleanText(product?.precio || '$0'),
        antes: cleanText(product?.antes || ''),
        badge: cleanText(product?.badge || 'Oferta'),
        caption: cleanText(product?.caption || ''),
      }))
    : [
        {
          nombre: 'Audífonos Pro',
          precio: '$3,499',
          antes: '$8,999',
          badge: '87% OFF',
          caption: 'Envío express',
        },
      ];

  return {
    dominio: cleanText(source?.dominio || 'cyberzone-ofertas.shop'),
    browserTitle: cleanText(source?.browserTitle || 'Ofertas especiales'),
    heroTitle: cleanText(source?.heroTitle || 'Oferta relámpago'),
    heroBody: cleanText(source?.heroBody || source?.sub || 'Explora producto, carrito y checkout antes de decidir.'),
    sealLabel: cleanText(source?.sealLabel || source?.banner || 'Oferta activa'),
    contacto: cleanText(source?.contacto || 'Atención solo por formulario'),
    shipping: cleanText(source?.shipping || 'Entrega asegurada con costo extra'),
    reviewsLabel: cleanText(source?.reviewsLabel || 'Reseñas del sitio'),
    reviews: cleanText(source?.reviews || 'Testimonios muy positivos y poco verificables.'),
    policy: cleanText(source?.policy || 'Devoluciones sujetas a validación interna'),
    checkoutPrompt: cleanText(source?.checkoutPrompt || 'Para mantener el descuento, termina el pago hoy.'),
    pagos: Array.isArray(source?.pagos)
      ? source.pagos.map((item) => cleanText(item)).filter(Boolean)
      : ['Transferencia bancaria', 'Pago por enlace externo'],
    productos,
  };
}

export function buildWebLabHotspots(activity) {
  return Array.isArray(activity?.hotspots)
    ? activity.hotspots.map((hotspot) => {
        const normalized = {
          target: cleanText(hotspot?.target || ''),
          label: cleanText(hotspot?.label || TARGET_LABELS[hotspot?.target] || hotspot?.target),
          explicacion: cleanText(hotspot?.explicacion || ''),
          correcta: Boolean(hotspot?.correcta),
          severity: hotspot?.severity || inferHotspotSeverity(hotspot),
        };
        return normalized;
      })
    : [];
}

export function scoreHotspots({
  hotspots,
  flagged,
  neutralTargets,
  decision,
  decisionOptions,
  correctDecision,
  module,
}) {
  return scoreHotspotDecision({
    hotspots,
    flagged,
    neutralTargets,
    module,
    decision,
    decisionOptions,
    correctDecision,
  });
}
