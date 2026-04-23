import { cn } from '../lib/ui.js';
import MetricCard from './MetricCard.jsx';

export default function StatStrip({
  items = [],
  compact = false,
  variant = 'insight',
  className,
}) {
  return (
    <div
      className={cn('sd-stat-strip', compact ? 'sd-stat-strip-compact' : '', className)}
      data-sd-container="true"
    >
      {items.map((item) => (
        <MetricCard
          key={item.key || `${item.eyebrow || item.label}-${item.value}`}
          eyebrow={item.eyebrow}
          value={item.value}
          label={item.label}
          hint={item.hint}
          tone={item.tone}
          variant={item.variant || variant}
          compact={compact}
        />
      ))}
    </div>
  );
}
