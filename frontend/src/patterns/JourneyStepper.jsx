import { cn } from '../lib/ui.js';

function normalizeStepState(state) {
  if (state === 'done' || state === 'complete' || state === 'completed') {
    return 'done';
  }

  if (state === 'current' || state === 'active') {
    return 'current';
  }

  return 'upcoming';
}

export default function JourneyStepper({ steps = [], compact = false, label = 'Progreso del recorrido', className }) {
  return (
    <div className="sd-journey-stepper-shell" data-sd-container="true">
      <ol
        className={cn('sd-journey-stepper', compact ? 'sd-journey-stepper-compact' : '', className)}
        aria-label={label}
      >
        {steps.map((step, index) => {
          const state = normalizeStepState(step.state);
          const stateLabel =
            state === 'current' ? 'Actual' : state === 'done' ? 'Listo' : 'Pendiente';

          return (
            <li key={step.id || `${step.label}-${index}`} className="sd-journey-step" data-state={state}>
              <div className="sd-journey-step-card" aria-current={state === 'current' ? 'step' : undefined}>
                <span
                  className="sd-journey-step-marker"
                  aria-label={state === 'done' ? `Paso ${index + 1} listo` : `Paso ${index + 1}`}
                >
                  {state === 'done' ? 'OK' : String(index + 1).padStart(2, '0')}
                </span>

                <div className="sd-journey-step-content">
                  <strong className="sd-journey-step-label">{step.label}</strong>
                  <p className="sd-journey-step-state">{stateLabel}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
