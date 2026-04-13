import { cn } from '../../../lib/ui.js';
import { PANEL_CLASS, SOFT_PANEL_CLASS } from './shared.js';

export function ImmersivePanel({ as: Component = 'section', className, children, ...props }) {
  return (
    <Component className={cn(PANEL_CLASS, className)} {...props}>
      {children}
    </Component>
  );
}

export function ImmersiveAsidePanel({
  as: Component = 'section',
  eyebrow,
  title,
  body,
  className,
  children,
  ...props
}) {
  return (
    <Component className={cn(SOFT_PANEL_CLASS, className)} {...props}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {title ? <strong className="mt-2 block text-base text-sd-text">{title}</strong> : null}
      {body ? <p className="mt-3 text-sm leading-6 text-sd-muted">{body}</p> : null}
      {children ? <div className={cn(title || body ? 'mt-3' : '')}>{children}</div> : null}
    </Component>
  );
}

export function ImmersiveProgressPill({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-sd-border bg-white/76 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sd-muted">
        {label}
      </span>
      <strong className="text-sm text-sd-text">{value}</strong>
    </div>
  );
}
