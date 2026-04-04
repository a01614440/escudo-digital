import { escapeHtml, formatInlineText } from '../lib/format.js';

function formatChatMessage(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const safe = formatInlineText(escapeHtml(raw));
  const lines = safe
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines.filter((line) => line.startsWith('- ') || line.startsWith('• '));
  if (bulletLines.length >= 2) {
    const hasIntro = lines[0] && !lines[0].startsWith('- ') && !lines[0].startsWith('• ');
    const intro = hasIntro
      ? `<p class="chat-intro">${lines[0]}</p>`
      : '<p class="chat-intro">Vamos paso a paso.</p>';
    const items = bulletLines
      .map((line) => `<li>${line.replace(/^(-|•)\s*/, '')}</li>`)
      .join('');
    return `${intro}<ul>${items}</ul>`;
  }

  const numbered = lines.filter((line) => /^\d+\.\s/.test(line));
  if (numbered.length >= 2) {
    const items = numbered
      .map((line) => `<li>${line.replace(/^\d+\.\s*/, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  }

  return lines.map((line) => `<p>${line}</p>`).join('');
}

export default function ChatDrawer({
  open,
  messages,
  input,
  busy,
  onInputChange,
  onClose,
  onSubmit,
}) {
  return (
    <>
      <div className={`chat-backdrop ${open ? '' : 'hidden'}`} onClick={onClose} />
      <aside className={`chat-drawer ${open ? '' : 'hidden'}`}>
        <div className="chat-header">
          <div>
            <p className="eyebrow">Asistente</p>
            <h3>Seguridad digital</h3>
          </div>
          <div className="chat-header-actions">
            <button className="btn ghost" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length ? (
            messages.map((message, index) => (
              <div className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
                <div dangerouslySetInnerHTML={{ __html: formatChatMessage(message.content) }} />
              </div>
            ))
          ) : (
            <div className="chat-bubble bot">
              <p>
                Preguntame sobre phishing, WhatsApp, SMS sospechosos, llamadas fraudulentas o
                paginas falsas.
              </p>
            </div>
          )}
        </div>

        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Escribe tu duda sobre estafas digitales..."
            rows={3}
          />
          <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
            {busy ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </aside>
    </>
  );
}
