import { cn } from '../lib/ui.js';

export default function SplitHeroLayout({
  shellFamily = 'desktop',
  hero,
  primary,
  secondary,
  className,
  heroClassName,
  primaryClassName,
  secondaryClassName,
}) {
  const shellLayoutClassName =
    shellFamily === 'tablet'
      ? 'md:grid-cols-[minmax(0,1.06fr)_minmax(22.5rem,0.94fr)]'
      : shellFamily === 'desktop'
        ? 'xl:grid-cols-[minmax(0,1.22fr)_minmax(24rem,0.96fr)] 2xl:grid-cols-[minmax(0,1.32fr)_minmax(25rem,0.92fr)]'
        : '';

  return (
    <section
      className={cn(
        'sd-stage-layout',
        `sd-stage-layout-${shellFamily}`,
        shellLayoutClassName,
        className
      )}
      data-layout="split-hero"
      data-shell-family={shellFamily}
      data-sd-container="true"
    >
      {hero ? <div className={cn('sd-stage-layout-hero min-w-0', heroClassName)}>{hero}</div> : null}
      {primary ? <div className={cn('sd-stage-layout-primary min-w-0', primaryClassName)}>{primary}</div> : null}
      {secondary ? (
        <div className={cn('sd-stage-layout-secondary min-w-0', secondaryClassName)}>{secondary}</div>
      ) : null}
    </section>
  );
}
