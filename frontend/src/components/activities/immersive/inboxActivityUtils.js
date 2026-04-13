import { getDecisionRatingLabel, scoreSelectionAccuracy } from '../../../lib/activityScoring.js';
import { buildActivityFeedbackPayload } from '../../../lib/activityFeedback.js';
import { cleanText } from './shared.js';

export function normalizeInboxMessages(activity) {
  const source = Array.isArray(activity?.mensajes) ? activity.mensajes : [];
  return source.map((message, index) => ({
    ...message,
    id: String(message?.id || `msg-${index + 1}`),
    displayName: cleanText(message?.displayName || message?.from || `Mensaje ${index + 1}`),
    from: cleanText(message?.from || ''),
    subject: cleanText(message?.subject || message?.text || `Mensaje ${index + 1}`),
    preview: cleanText(message?.preview || message?.text || ''),
    warning: cleanText(message?.warning || ''),
    linkPreview: cleanText(message?.linkPreview || ''),
    dateLabel: cleanText(message?.dateLabel || 'Hoy'),
    correcto: message?.correcto === 'estafa' ? 'estafa' : 'seguro',
    explicacion: cleanText(
      message?.explicacion ||
        message?.signal ||
        (message?.correcto === 'estafa'
          ? 'Había señales de urgencia o identidad dudosa.'
          : 'No aparecían indicios claros de fraude.')
    ),
    details: message?.details || {},
    attachments: Array.isArray(message?.attachments)
      ? message.attachments.map((item) => cleanText(item)).filter(Boolean)
      : [],
    body: (Array.isArray(message?.body) ? message.body : [message?.text])
      .map((line) => cleanText(line))
      .filter(Boolean),
  }));
}

export function classifyInbox(messages, selections, kind, module) {
  const total = Math.max(messages.length, 1);
  const review = messages.map((message) => {
    const picked = selections[message.id] || null;
    const status = !picked ? 'missed' : picked === message.correcto ? 'correct' : 'wrong';
    return {
      id: message.id,
      label: message.subject,
      picked,
      correctChoice: message.correcto,
      status,
      reason: message.explicacion,
    };
  });

  const correct = review.filter((item) => item.status === 'correct').length;
  const wrong = review.filter((item) => item.status === 'wrong');
  const missed = review.filter((item) => item.status === 'missed');
  const score = scoreSelectionAccuracy({
    correctCount: correct,
    falsePositives: wrong.length,
    falseNegatives: missed.length,
    module,
    minimumFloor: 0.32,
  });

  return {
    score,
    total,
    correct,
    review,
    feedback: buildActivityFeedbackPayload({
      title: getDecisionRatingLabel(score),
      score,
      signal: `Clasificaste correctamente ${correct} de ${total} mensajes y mantuviste el foco en la señal general.`,
      risk:
        kind === 'sms'
          ? 'En SMS lo más peligroso suele ser la mezcla de urgencia, premio o enlace directo.'
          : 'En correo lo más delicado suele estar en remitente, cuerpo y enlace, no solo en el diseño.',
      action:
        'En la vida real, si dudas, no respondas ni abras el enlace desde el mismo canal. Verifica por una ruta oficial.',
      detected: review.filter((item) => item.status === 'correct').map((item) => item.label),
      missed: missed.map((item) => item.label),
      extra: wrong.length
        ? `Te faltó ajustar estas decisiones: ${wrong
            .map((item) => `${item.label} → marcaste ${item.picked === 'estafa' ? 'Sospechoso' : 'Seguro'}`)
            .join(' | ')}`
        : 'Buen balance entre precisión y criterio.',
    }),
  };
}

export function getInboxStatus(selected, reviewItem) {
  if (reviewItem?.status === 'correct') return { label: 'Acierto', tone: 'correct' };
  if (reviewItem?.status === 'wrong') return { label: 'Revisar', tone: 'wrong' };
  if (selected === 'estafa') return { label: 'Sospechoso', tone: 'flagged' };
  if (selected === 'seguro') return { label: 'Seguro', tone: 'safe' };
  return { label: 'Sin clasificar', tone: 'idle' };
}

export function getAvatarLabel(message) {
  const source = cleanText(message?.displayName || message?.from || 'SMS');
  const initials = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return initials || source.slice(0, 2).toUpperCase();
}
