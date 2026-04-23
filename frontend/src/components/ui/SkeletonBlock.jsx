import { cn } from '../../lib/ui.js';

export default function SkeletonBlock({ className, tone = 'default', ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('sd-skeleton', tone === 'inverse' ? 'sd-skeleton-inverse' : '', className)}
      {...props}
    />
  );
}
