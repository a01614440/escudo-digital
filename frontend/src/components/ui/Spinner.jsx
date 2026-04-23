import { cn } from '../../lib/ui.js';

const SIZE_STYLES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-6 w-6 border-[3px]',
};

const TONE_STYLES = {
  muted: 'text-sd-muted',
  accent: 'text-sd-accent',
  inverse: 'text-sd-text-inverse',
  current: '',
};

export default function Spinner({
  size = 'md',
  tone = 'muted',
  className,
  label = 'Cargando...',
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-2', TONE_STYLES[tone] || TONE_STYLES.muted)}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block animate-[sd-spin_0.75s_linear_infinite] rounded-full border-current border-r-transparent',
          SIZE_STYLES[size] || SIZE_STYLES.md,
          className
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
