import { cn } from '../../lib/ui.js';

const PADDING_STYLES = {
  none: '',
  compact: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6 lg:p-7',
  lg: 'p-6 sm:p-8 lg:p-10',
};

export default function SurfaceCard({
  as: Component = 'section',
  padding = 'md',
  className,
  children,
  ...props
}) {
  return (
    <Component
      className={cn('panel sd-panel', PADDING_STYLES[padding] || PADDING_STYLES.md, className)}
      {...props}
    >
      {children}
    </Component>
  );
}
