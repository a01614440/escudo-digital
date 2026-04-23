import { cn } from '../../lib/ui.js';

const TONE_STYLES = {
  accent: 'sd-progress-bar',
  success: 'sd-progress-bar sd-progress-bar-success',
  warning: 'sd-progress-bar sd-progress-bar-warning',
};

export default function ProgressBar({
  value = 0,
  max = 100,
  tone = 'accent',
  size = 'md',
  className,
  trackClassName,
  ...props
}) {
  const safeMax = Math.max(Number(max) || 0, 1);
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), safeMax);
  const percent = Math.round((safeValue / safeMax) * 100);

  return (
    <div
      className={cn(
        'sd-progress-track',
        size === 'sm' ? 'sd-progress-track-sm' : size === 'lg' ? 'sd-progress-track-lg' : 'sd-progress-track-md',
        trackClassName
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      {...props}
    >
      <div
        className={cn(TONE_STYLES[tone] || TONE_STYLES.accent, className)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
