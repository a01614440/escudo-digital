import SurfaceCard from '../components/ui/SurfaceCard.jsx';
import { cn } from '../lib/ui.js';

export default function MetricCard({
  eyebrow,
  value,
  label,
  hint,
  tone = 'neutral',
  variant = 'insight',
  compact = false,
  className,
}) {
  const surfaceVariant =
    variant === 'hero' || variant === 'command'
      ? 'command'
      : variant === 'spotlight'
        ? 'spotlight'
        : variant === 'panel'
          ? 'panel'
          : 'insight';

  const inverse = variant === 'hero' || variant === 'command';

  return (
    <SurfaceCard
      className={cn('sd-stat-card', compact ? 'p-4' : '', className)}
      padding="none"
      variant={surfaceVariant}
    >
      <div className="grid gap-2">
        <div className="grid min-w-0 gap-2">
          {eyebrow ? <p className="sd-eyebrow m-0">{eyebrow}</p> : null}
          <strong
            className={cn(
              'text-3xl leading-none tracking-[-0.04em]',
              inverse ? 'text-sd-text-inverse' : 'text-sd-text'
            )}
          >
            {value}
          </strong>
          {label ? (
            <p
              className={cn(
                'm-0 text-sm leading-6',
                inverse ? 'text-sd-text-inverse-soft' : 'text-sd-text-soft'
              )}
            >
              {label}
            </p>
          ) : null}
        </div>
      </div>
      {hint ? (
        <p className={cn('m-0 text-sm leading-6', inverse ? 'text-sd-text-inverse-soft' : 'text-sd-muted')}>
          {hint}
        </p>
      ) : null}
    </SurfaceCard>
  );
}
