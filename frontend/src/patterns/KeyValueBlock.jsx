import { cn } from '../lib/ui.js';

export default function KeyValueBlock({ items = [], className }) {
  return (
    <dl className={cn('sd-key-value-block', className)} data-sd-container="true">
      {items.map((item) => (
        <div key={item.key || item.label} className="sd-key-value-item">
          <dt className="sd-key-value-term">{item.label}</dt>
          <dd className="sd-key-value-value m-0">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
