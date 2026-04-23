import SurfaceCard from '../components/ui/SurfaceCard.jsx';
import { cn } from '../lib/ui.js';
import SectionHeader from './SectionHeader.jsx';

const VARIANT_MAP = {
  support: 'support',
  insight: 'insight',
  command: 'command',
  editorial: 'editorial',
};

export default function SupportRail({
  tone = 'support',
  eyebrow,
  title,
  subtitle,
  actions,
  sticky = false,
  footer,
  children,
  className,
}) {
  const inverse = tone === 'command';

  return (
    <SurfaceCard
      variant={VARIANT_MAP[tone] || VARIANT_MAP.support}
      padding="compact"
      className={cn('sd-support-rail-shell', sticky ? 'sd-rail-sticky' : '', className)}
      data-sd-container="true"
    >
      {eyebrow || title || subtitle || actions ? (
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={actions}
          variant="compact"
          tone={inverse ? 'inverse' : 'default'}
          divider={Boolean(children)}
        />
      ) : null}
      {children}
      {footer ? (
        <>
          <div className="sd-divider" />
          {footer}
        </>
      ) : null}
    </SurfaceCard>
  );
}
