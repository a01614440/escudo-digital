import SurfaceCard from '../components/ui/SurfaceCard.jsx';
import { cn } from '../lib/ui.js';
import SectionHeader from './SectionHeader.jsx';

const VARIANT_MAP = {
  hero: 'hero',
  command: 'command',
  support: 'support',
  spotlight: 'spotlight',
  editorial: 'editorial',
};

export default function StageHero({
  tone = 'hero',
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  aside,
  footer,
  children,
  className,
}) {
  const inverse = tone === 'hero' || tone === 'command';

  return (
    <SurfaceCard
      className={cn('sd-stage-hero-shell', className)}
      variant={VARIANT_MAP[tone] || VARIANT_MAP.hero}
      padding="xl"
      data-sd-container="true"
    >
      <div className={cn('grid gap-7', aside ? 'xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] xl:items-end' : '')}>
        <div className="grid gap-6">
          <SectionHeader
            eyebrow={eyebrow}
            title={title}
            subtitle={subtitle}
            actions={actions}
            meta={meta}
            tone={inverse ? 'inverse' : 'default'}
            variant="hero"
          />
          {children ? <div className={cn('grid gap-4', inverse ? 'text-sd-text-inverse-soft' : 'text-sd-text-soft')}>{children}</div> : null}
        </div>
        {aside ? <div className="sd-stage-hero-meta">{aside}</div> : null}
      </div>
      {footer ? <div className="sd-divider" /> : null}
      {footer ? <div className={cn('grid gap-4', inverse ? 'text-sd-text-inverse-soft' : 'text-sd-text-soft')}>{footer}</div> : null}
    </SurfaceCard>
  );
}
