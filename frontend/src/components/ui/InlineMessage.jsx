import { cn } from '../../lib/ui.js';

const TONE_STYLES = {
  info: 'sd-inline-message sd-inline-message-info',
  success: 'sd-inline-message sd-inline-message-success',
  warning: 'sd-inline-message sd-inline-message-warning',
  danger: 'sd-inline-message sd-inline-message-danger',
};

export default function InlineMessage({ tone = 'info', title, className, children, ...props }) {
  return (
    <div className={cn(TONE_STYLES[tone] || TONE_STYLES.info, className)} {...props}>
      {title ? <strong className="text-sm font-semibold tracking-[-0.01em]">{title}</strong> : null}
      {children ? <div className="text-sm leading-6">{children}</div> : null}
    </div>
  );
}
