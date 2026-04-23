import { cn } from '../../lib/ui.js';

const SIZE_STYLES = {
  compact: 'sd-control-compact',
  md: '',
  lg: 'sd-control-lg',
};

export default function Input({ className, invalid = false, size = 'md', ...props }) {
  return (
    <input
      className={cn('sd-input', SIZE_STYLES[size] || '', className)}
      aria-invalid={invalid ? 'true' : props['aria-invalid']}
      {...props}
    />
  );
}
