import { cn } from '../lib/ui.js';

export default function JourneyStepper({ steps = [], compact = false, className }) {
  return (
    <div
      className={cn(
        'grid gap-2',
        compact ? 'grid-cols-2 sm:grid-cols-4' : 'md:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]',
        className
      )}
      data-sd-container="true"
    >
      {steps.map((step, index) => {
        const state = step.state || 'upcoming';
        const stateLabel =
          state === 'current' ? 'Actual' : state === 'done' ? 'Listo' : null;

        return (
          <article
            key={step.id}
            className={cn(
              'min-w-0 rounded-[20px] border px-3 py-3 transition',
              state === 'current'
                ? 'border-sd-accent bg-sd-accent-soft shadow-[0_16px_34px_-26px_rgba(47,99,255,0.34)]'
                : state === 'done'
                  ? 'border-sd-border-strong bg-white/92'
                  : 'border-sd-border bg-white/72'
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  state === 'current'
                    ? 'border-sd-accent bg-sd-accent text-sd-accent-contrast'
                    : state === 'done'
                      ? 'border-sd-border-strong bg-sd-surface-subtle text-sd-text'
                      : 'border-sd-border bg-white text-sd-text-soft'
                )}
              >
                {state === 'done' ? 'OK' : String(index + 1).padStart(2, '0')}
              </span>

              <div className="grid min-w-0 gap-1">
                <strong className="text-sm leading-5 text-sd-text">{step.label}</strong>
                {stateLabel ? (
                  <p className="m-0 text-xs font-medium leading-5 text-sd-text-soft">{stateLabel}</p>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
