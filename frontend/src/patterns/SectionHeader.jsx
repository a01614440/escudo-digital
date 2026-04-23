import { cn } from '../lib/ui.js';

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  tone = 'default',
  variant = 'default',
  divider = false,
  className,
}) {
  const isHero = variant === 'hero';
  const titleClassName =
    isHero
      ? 'sd-title-display'
      : variant === 'compact'
        ? 'sd-heading-sm'
        : variant === 'editorial'
          ? 'sd-title'
          : 'sd-heading-md';

  const subtitleClassName = tone === 'inverse' ? 'sd-copy-inverse' : 'sd-subtitle';
  const metaClassName = tone === 'inverse' ? 'text-sm leading-6 text-sd-text-inverse-soft' : 'text-sm leading-6 text-sd-muted';

  return (
    <header
      className={cn(
        'sd-section-header',
        variant === 'compact' ? 'sd-section-header-compact' : '',
        isHero ? 'sd-section-header-hero md:grid-cols-[minmax(0,1fr)] md:items-start' : '',
        className
      )}
    >
      <div className="grid gap-3">
        {eyebrow ? <p className="sd-eyebrow m-0">{eyebrow}</p> : null}
        {title ? <h2 className={cn(titleClassName, 'm-0')}>{title}</h2> : null}
        {subtitle ? <p className={cn(subtitleClassName, 'm-0')}>{subtitle}</p> : null}
      </div>
      {actions || meta ? (
        <div className={cn('grid gap-3', isHero ? 'md:justify-items-start' : 'md:justify-items-end')}>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          {meta ? <div className={metaClassName}>{meta}</div> : null}
        </div>
      ) : null}
      {divider ? <div className={cn('sd-divider', isHero ? '' : 'md:col-span-2')} /> : null}
    </header>
  );
}
