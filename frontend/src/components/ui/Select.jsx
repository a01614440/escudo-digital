import { cn } from '../../lib/ui.js';

const SIZE_STYLES = {
  compact: 'sd-control-compact',
  md: '',
  lg: 'sd-control-lg',
};

export default function Select({ className, invalid = false, size = 'md', children, ...props }) {
  return (
    <select
      className={cn('sd-select', SIZE_STYLES[size] || '', className)}
      aria-invalid={invalid ? 'true' : props['aria-invalid']}
      {...props}
    >
      {children}
    </select>
  );
}
