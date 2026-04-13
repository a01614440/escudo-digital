import { useEffect, useMemo, useRef } from 'react';
import { repairPossibleMojibake } from '../lib/course.js';
import { DEFAULT_CHAT_SUGGESTIONS, formatChatMessage } from '../lib/chatFormatting.js';
import { cn } from '../lib/ui.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import SurfaceCard from './ui/SurfaceCard.jsx';

const COMPACT_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact']);

const DRAWER_LAYOUTS = {
  'phone-small': 'inset-x-2 bottom-2 top-auto h-[min(82vh,42rem)] rounded-[26px]',
  phone: 'inset-x-3 bottom-3 top-auto h-[min(82vh,44rem)] rounded-[28px]',
  'tablet-compact': 'inset-x-5 bottom-5 top-auto h-[min(84vh,48rem)] rounded-[30px]',
  tablet: 'bottom-5 right-5 top-5 w-[min(34rem,calc(100vw-2.5rem))] rounded-[32px]',
  laptop: 'bottom-6 right-6 top-6 w-[min(31rem,calc(100vw-3rem))] rounded-[34px]',
  desktop: 'bottom-8 right-8 top-8 w-[min(33rem,calc(100vw-4rem))] rounded-[36px]',
};

function EmptyConversation({ onSuggestionClick }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] border border-sd-border bg-white/70 p-5">
        <p className="eyebrow">Asistente antiestafas</p>
        <h3 className="mt-3 font-display text-2xl tracking-[-0.04em] text-sd-text">
          Pregunta antes de actuar
        </h3>
        <p className="mt-3 text-sm leading-7 text-sd-muted">
          Te ayudo a frenar mensajes urgentes, enlaces dudosos, llamadas fraudulentas y paginas
          clonadas sin salirte de la experiencia.
        </p>
      </div>

      <div className="grid gap-3">
        {DEFAULT_CHAT_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-[22px] border border-sd-border bg-white/75 px-4 py-4 text-left text-sm font-medium text-sd-text transition hover:-translate-y-0.5 hover:bg-white"
            onClick={() => onSuggestionClick(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <article
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
      aria-label={isUser ? 'Mensaje del usuario' : 'Mensaje del asistente'}
    >
      <div
        className={cn(
          'max-w-[88%] rounded-[24px] px-4 py-3 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]',
          isUser
            ? 'rounded-br-[10px] border border-sd-accent bg-sd-accent text-white'
            : 'rounded-bl-[10px] border border-sd-border bg-white/86 text-sd-text'
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
              isUser ? 'bg-white/16 text-white' : 'bg-sd-accent-soft text-sd-accent'
            )}
          >
            {isUser ? 'Tu' : 'Escudo'}
          </span>
        </div>
        <div
          className={cn('grid gap-3', isUser ? '[&_p]:text-white/96' : '[&_strong]:text-sd-text')}
          dangerouslySetInnerHTML={{ __html: formatChatMessage(message.content) }}
        />
      </div>
    </article>
  );
}

export default function ChatDrawer({
  viewport = 'desktop',
  open,
  messages,
  input,
  busy,
  onInputChange,
  onClose,
  onSubmit,
}) {
  const compact = COMPACT_VIEWPORTS.has(viewport);
  const inputRef = useRef(null);
  const messageListRef = useRef(null);
  const drawerLayout = DRAWER_LAYOUTS[viewport] || DRAWER_LAYOUTS.desktop;
  const conversation = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);
  const messageCount = conversation.length;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const node = messageListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [conversation, open]);

  const submit = (event) => {
    event.preventDefault();
    onSubmit();
  };

  const setSuggestion = (value) => {
    onInputChange(repairPossibleMojibake(value));
    inputRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar asistente"
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/36 transition',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      <SurfaceCard
        as="aside"
        padding="none"
        role="dialog"
        aria-modal="true"
        aria-label="Asistente de seguridad digital"
        className={cn(
          'fixed z-50 flex border border-sd-border/80 bg-sd-panel/96 shadow-[0_30px_80px_-34px_rgba(15,23,42,0.55)] transition-all duration-300',
          drawerLayout,
          open
            ? 'translate-y-0 opacity-100'
            : compact
              ? 'pointer-events-none translate-y-6 opacity-0'
              : 'pointer-events-none translate-x-8 opacity-0'
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-sd-border/80 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Asistente</p>
                  <h3 className="mt-2 font-display text-2xl tracking-[-0.04em] text-sd-text">
                    Seguridad digital
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-sd-muted">
                    Resuelve dudas sin improvisar: pausa, verifica y decide con criterio.
                  </p>
                </div>
                <Button variant="ghost" size="compact" type="button" onClick={onClose}>
                  Cerrar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{messageCount ? `${messageCount} mensajes` : 'Listo para ayudarte'}</Badge>
                <Badge tone="soft">{compact ? 'Modo movil guiado' : 'Panel lateral persistente'}</Badge>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5" ref={messageListRef}>
            {conversation.length ? (
              <div className="grid gap-4">
                {conversation.map((message, index) => (
                  <MessageBubble key={`${message.role}-${index}`} message={message} />
                ))}
              </div>
            ) : (
              <EmptyConversation onSuggestionClick={setSuggestion} />
            )}
          </div>

          <footer className="border-t border-sd-border/80 px-4 py-4 sm:px-5 sm:py-5">
            <form className="grid gap-3" onSubmit={submit}>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sd-muted">
                  Tu pregunta
                </span>
                <textarea
                  ref={inputRef}
                  className="sd-input min-h-[112px] resize-none rounded-[24px]"
                  value={input}
                  onChange={(event) => onInputChange(event.target.value)}
                  placeholder="Escribe tu duda sobre mensajes, enlaces, llamadas o paginas sospechosas..."
                  rows={compact ? 4 : 5}
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-sd-muted">
                  No compartas contrasenas ni codigos. Usa este espacio para pensar la decision
                  segura antes de responder.
                </p>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={busy || !String(input || '').trim()}
                  className="sm:min-w-[10rem]"
                >
                  {busy ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </form>
          </footer>
        </div>
      </SurfaceCard>
    </>
  );
}
