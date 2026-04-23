import { cn } from '../../lib/ui.js';

const PADDING_STYLES = {
  none: '',
  xs: 'p-3 sm:p-4',
  compact: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6 lg:p-7',
  lg: 'p-6 sm:p-8 lg:p-10',
  xl: 'p-7 sm:p-8 lg:p-[4.5rem]',
};

const VARIANT_STYLES = {
  panel: 'sd-panel',
  raised: 'sd-panel sd-panel-raised',
  subtle: 'sd-panel sd-panel-subtle',
  hero: 'sd-panel sd-region-hero',
  command: 'sd-panel sd-region-command',
  support: 'sd-panel sd-region-support',
  insight: 'sd-panel sd-region-insight',
  spotlight: 'sd-panel sd-region-spotlight',
  editorial: 'sd-panel sd-region-editorial',
};

const TONE_STYLES = {
  default: '',
  inverse: 'sd-surface-tone-inverse',
};

export default function SurfaceCard({
  as: Component = 'section',
  variant = 'panel',
  tone = 'default',
  padding = 'md',
  interactive = false,
  selected = false,
  className,
  children,
  ...props
}) {
  return (
    <Component
      className={cn(
        'panel',
        VARIANT_STYLES[variant] || VARIANT_STYLES.panel,
        TONE_STYLES[tone] || TONE_STYLES.default,
        PADDING_STYLES[padding] || PADDING_STYLES.md,
        interactive ? 'sd-interactive-surface' : '',
        className
      )}
      data-tone={tone !== 'default' ? tone : undefined}
      data-selected={selected ? 'true' : undefined}
      {...props}
    >
      {children}
    </Component>
  );
}
