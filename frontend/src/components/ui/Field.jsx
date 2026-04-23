import { cn } from '../../lib/ui.js';

export default function Field({
  label,
  hint,
  error,
  required = false,
  actions,
  layout = 'stacked',
  className,
  children,
}) {
  return (
    <label className={cn('sd-field', layout === 'split' ? 'md:grid-cols-[minmax(0,1fr)_auto]' : '', className)}>
      {label || actions ? (
        <span className="sd-field-header">
          <span className="sd-label">
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
          </span>
          {actions ? <span>{actions}</span> : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="sd-caption sd-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="sd-caption">{hint}</span>
      ) : null}
    </label>
  );
}
