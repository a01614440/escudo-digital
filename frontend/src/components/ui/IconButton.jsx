import { cn } from '../../lib/ui.js';

const VARIANT_STYLES = {
  primary: 'sd-button-primary',
  secondary: 'sd-button-secondary',
  ghost: 'sd-button-ghost',
  quiet: 'sd-button-quiet',
  soft: 'sd-button-soft',
  hero: 'sd-button-hero',
  danger: 'sd-button-danger',
};

const SIZE_STYLES = {
  sm: 'sd-icon-button-sm',
  md: 'sd-icon-button-md',
  lg: 'sd-icon-button-lg',
};

export default function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  loading = false,
  className,
  children,
  disabled,
  title,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
  ...props
}) {
  const accessibleLabel = ariaLabel || label;

  return (
    <button
      {...props}
      className={cn(
        'sd-button sd-icon-button',
        VARIANT_STYLES[variant] || VARIANT_STYLES.ghost,
        SIZE_STYLES[size] || SIZE_STYLES.md,
        className
      )}
      type={props.type || 'button'}
      title={title || label}
      data-active={active ? 'true' : undefined}
      data-loading={loading ? 'true' : undefined}
      data-sd-interaction="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-busy={loading ? 'true' : undefined}
      disabled={disabled || loading}
    >
      {loading ? <span aria-hidden="true" className="sd-button-spinner" /> : null}
      {!loading ? (
        <span className="sd-icon-button-glyph" aria-hidden={accessibleLabel ? 'true' : undefined}>
          {children}
        </span>
      ) : null}
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}
