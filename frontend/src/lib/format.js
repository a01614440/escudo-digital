export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const formatDate = (value) => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const formatInlineText = (value) => {
  const safe = escapeHtml(value);
  return safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
};

export const splitParagraphs = (value) =>
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
