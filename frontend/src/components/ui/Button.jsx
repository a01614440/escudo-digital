import { cn } from '../../lib/ui.js';

const VARIANT_STYLES = {
  primary: 'sd-button sd-button-primary',
  ghost: 'sd-button sd-button-ghost',
};

const SIZE_STYLES = {
  md: '',
  compact: 'sd-button-compact',
};

export default function Button({
  variant = 'ghost',
  size = 'md',
  active = false,
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
        active ? 'ring-2 ring-sd-accent/20' : '',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
