import Button from '../components/ui/Button.jsx';
import SurfaceCard from '../components/ui/SurfaceCard.jsx';
import { cn } from '../lib/ui.js';
import SectionHeader from './SectionHeader.jsx';

export default function EmptyState({
  eyebrow,
  title,
  body,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  aside,
  variant = 'spotlight',
  className,
}) {
  const surfaceVariant =
    variant === 'editorial' ? 'editorial' : variant === 'support' ? 'support' : variant === 'panel' ? 'panel' : 'spotlight';

  return (
    <SurfaceCard
      className={cn('mx-auto grid max-w-4xl gap-6 text-center', className)}
      variant={surfaceVariant}
      padding="lg"
    >
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={body}
        variant={variant === 'editorial' ? 'editorial' : 'hero'}
        tone={surfaceVariant === 'command' || surfaceVariant === 'hero' ? 'inverse' : 'default'}
        className="justify-items-center"
      />
      {aside ? <div className="mt-5">{aside}</div> : null}
      {primaryActionLabel || secondaryActionLabel ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {primaryActionLabel ? (
            <Button type="button" variant="primary" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel ? (
            <Button type="button" variant="secondary" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </SurfaceCard>
  );
}
