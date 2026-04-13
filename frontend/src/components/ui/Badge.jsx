import { cn } from '../../lib/ui.js';

const TONE_STYLES = {
  accent: 'sd-badge sd-badge-accent',
  neutral: 'sd-badge sd-badge-neutral',
  soft: 'sd-badge sd-badge-soft',
};

export default function Badge({ tone = 'neutral', className, children, ...props }) {
  return (
    <span className={cn('badge', TONE_STYLES[tone] || TONE_STYLES.neutral, className)} {...props}>
      {children}
    </span>
  );
}
