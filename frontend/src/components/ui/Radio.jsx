import { useId } from 'react';

import { cn } from '../../lib/ui.js';

function mergeDescribedBy(...ids) {
  return ids.filter(Boolean).join(' ') || undefined;
}

export default function Radio({
  label,
  hint,
  error,
  invalid = false,
  className,
  inputClassName,
  children,
  disabled,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const isInvalid = invalid || Boolean(error);

  return (
    <label className={cn('sd-choice', className)} data-disabled={disabled ? 'true' : undefined}>
      <input
        {...props}
        id={controlId}
        className={cn('sd-choice-input', inputClassName)}
        type="radio"
        disabled={disabled}
        aria-invalid={isInvalid ? 'true' : ariaInvalid}
        aria-describedby={mergeDescribedBy(ariaDescribedBy, errorId, hintId)}
      />
      <span className="sd-choice-control sd-choice-control-radio" aria-hidden="true">
        <span className="sd-choice-indicator" />
      </span>
      <span className="sd-choice-content">
        {label || children ? <span className="sd-choice-label">{children || label}</span> : null}
        {error ? (
          <span id={errorId} className="sd-choice-help sd-choice-error" role="alert">
            {error}
          </span>
        ) : hint ? (
          <span id={hintId} className="sd-choice-help">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
