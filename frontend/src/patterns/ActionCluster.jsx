import { cn } from '../lib/ui.js';

export default function ActionCluster({
  align = 'start',
  collapse = 'wrap',
  className,
  children,
}) {
  return (
    <div
      className={cn(
        'sd-action-cluster',
        align === 'end' ? 'sd-action-cluster-end' : '',
        align === 'between' ? 'sd-action-cluster-between' : '',
        className
      )}
      data-sd-container="true"
      data-collapse={collapse}
    >
      {children}
    </div>
  );
}
