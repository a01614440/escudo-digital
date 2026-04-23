import { cn } from '../../lib/ui.js';

const TONE_STYLES = {
  info: 'sd-inline-message sd-inline-message-info',
  success: 'sd-inline-message sd-inline-message-success',
  warning: 'sd-inline-message sd-inline-message-warning',
  danger: 'sd-inline-message sd-inline-message-danger',
};

export const INLINE_MESSAGE_A11Y = {
  info: { role: 'status', 'aria-live': 'polite' },
  success: { role: 'status', 'aria-live': 'polite' },
  warning: { role: 'alert', 'aria-live': 'assertive' },
  danger: { role: 'alert', 'aria-live': 'assertive' },
};

export default function InlineMessage({
  tone = 'info',
  title,
  className,
  children,
  role,
  'aria-live': ariaLive,
  'aria-atomic': ariaAtomic,
  ...props
}) {
  const resolvedTone = TONE_STYLES[tone] ? tone : 'info';
  const a11y = INLINE_MESSAGE_A11Y[resolvedTone];

  return (
    <div
      className={cn(TONE_STYLES[resolvedTone], className)}
      role={role ?? a11y.role}
      aria-live={ariaLive ?? a11y['aria-live']}
      aria-atomic={ariaAtomic ?? 'true'}
      {...props}
    >
      {title ? <strong className="text-sm font-semibold tracking-[var(--sd-type-tracking-label)]">{title}</strong> : null}
      {children ? <div className="text-sm leading-6">{children}</div> : null}
    </div>
  );
}
