import { cn } from '../../lib/ui.js';

const VARIANT_STYLES = {
  primary: 'sd-button sd-button-primary',
  secondary: 'sd-button sd-button-secondary',
  ghost: 'sd-button sd-button-ghost',
  quiet: 'sd-button sd-button-quiet',
  soft: 'sd-button sd-button-soft',
  hero: 'sd-button sd-button-hero',
  danger: 'sd-button sd-button-danger',
};

const SIZE_STYLES = {
  sm: 'sd-button-sm',
  md: '',
  lg: 'sd-button-lg',
  compact: 'sd-button-compact',
  icon: 'sd-button-icon',
};

export default function Button({
  variant = 'ghost',
  size = 'md',
  active = false,
  loading = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        'btn',
        VARIANT_STYLES[variant] || VARIANT_STYLES.ghost,
        SIZE_STYLES[size] || '',
        className
      )}
      data-active={active ? 'true' : undefined}
      data-loading={loading ? 'true' : undefined}
      data-sd-interaction="button"
      aria-busy={loading ? 'true' : undefined}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <span aria-hidden="true" className="sd-button-spinner" /> : null}
      {children}
    </button>
  );
}
