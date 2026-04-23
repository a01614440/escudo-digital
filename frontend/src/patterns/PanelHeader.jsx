import { cn } from '../lib/ui.js';

export default function PanelHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  divider = false,
  className,
}) {
  return (
    <header className={cn('sd-panel-header', className)} data-sd-container="true">
      {eyebrow ? <p className="sd-eyebrow m-0">{eyebrow}</p> : null}
      {title ? <h3 className="sd-heading-sm m-0">{title}</h3> : null}
      {subtitle ? <p className="sd-copy-sm m-0">{subtitle}</p> : null}
      {meta || actions ? (
        <div className="sd-panel-header-meta">
          {meta ? <div className="text-sm leading-6 text-sd-muted">{meta}</div> : null}
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}
      {divider ? <div className="sd-divider" /> : null}
    </header>
  );
}
