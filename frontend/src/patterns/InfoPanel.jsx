import SurfaceCard from '../components/ui/SurfaceCard.jsx';
import { cn } from '../lib/ui.js';
import SectionHeader from './SectionHeader.jsx';

const TONE_VARIANTS = {
  info: 'insight',
  evidence: 'insight',
  coach: 'support',
  safeAction: 'support',
  warning: 'spotlight',
};

export default function InfoPanel({
  tone = 'info',
  eyebrow,
  title,
  subtitle,
  items = [],
  actions,
  footer,
  className,
  children,
}) {
  const resolvedTone = TONE_VARIANTS[tone] ? tone : 'info';

  return (
    <SurfaceCard
      as="aside"
      variant={TONE_VARIANTS[resolvedTone]}
      padding="compact"
      className={cn('sd-info-panel', `sd-info-panel-${resolvedTone}`, className)}
      data-tone={resolvedTone}
      data-sd-container="true"
    >
      {eyebrow || title || subtitle || actions ? (
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          actions={actions}
          variant="compact"
          divider={Boolean(children || items.length)}
        />
      ) : null}

      {children ? <div className="sd-info-panel-content">{children}</div> : null}

      {items.length ? (
        <ul className="sd-info-panel-list">
          {items.map((item, index) => (
            <li key={item.id || item.label || index} className="sd-info-panel-item">
              {item.label ? <span className="sd-info-panel-item-label">{item.label}</span> : null}
              {item.body ? <span className="sd-info-panel-item-body">{item.body}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {footer ? (
        <>
          <div className="sd-divider" />
          <div className="sd-info-panel-footer">{footer}</div>
        </>
      ) : null}
    </SurfaceCard>
  );
}
