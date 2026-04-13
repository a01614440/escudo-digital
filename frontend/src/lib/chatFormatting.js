import { repairPossibleMojibake } from './course.js';
import { formatInlineText } from './format.js';

export const DEFAULT_CHAT_SUGGESTIONS = [
  'Como verifico un mensaje de WhatsApp sospechoso?',
  'Que hago si me piden un codigo por SMS?',
  'Como detectar una pagina clonada antes de pagar?',
];

export function formatChatMessage(text) {
  const raw = repairPossibleMojibake(String(text || '')).trim();
  if (!raw) return '';

  const safe = formatInlineText(raw);
  const lines = safe
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines.filter((line) => line.startsWith('- ') || line.startsWith('• '));
  if (bulletLines.length >= 2) {
    const hasIntro =
      lines[0] && !lines[0].startsWith('- ') && !lines[0].startsWith('• ');
    const intro = hasIntro
      ? `<p class="mb-3 text-sm leading-6">${lines[0]}</p>`
      : '<p class="mb-3 text-sm leading-6">Vamos paso a paso.</p>';
    const items = bulletLines
      .map((line) => `<li>${line.replace(/^(-|•)\s*/, '')}</li>`)
      .join('');
    return `${intro}<ul class="grid gap-2 pl-5 text-sm leading-6 list-disc">${items}</ul>`;
  }

  const numbered = lines.filter((line) => /^\d+\.\s/.test(line));
  if (numbered.length >= 2) {
    const items = numbered
      .map((line) => `<li>${line.replace(/^\d+\.\s*/, '')}</li>`)
      .join('');
    return `<ol class="grid gap-2 pl-5 text-sm leading-6 list-decimal">${items}</ol>`;
  }

  return lines
    .map((line) => `<p class="text-sm leading-6">${line}</p>`)
    .join('');
}
