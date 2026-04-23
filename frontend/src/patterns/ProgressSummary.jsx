import ProgressBar from '../components/ui/ProgressBar.jsx';
import SurfaceCard from '../components/ui/SurfaceCard.jsx';
import { cn } from '../lib/ui.js';

export default function ProgressSummary({
  eyebrow,
  title,
  value,
  hint,
  progressValue = 0,
  progressMax = 100,
  tone = 'accent',
  variant = 'support',
  aside,
  footer,
  className,
}) {
  return (
    <SurfaceCard
      className={cn('sd-progress-summary', className)}
      variant={variant}
      padding="compact"
      data-sd-container="true"
    >
      <div className="sd-progress-summary-layout">
        <div className="sd-progress-summary-main">
          <div className="sd-progress-summary-head">
            <div className="sd-progress-summary-meta">
              {eyebrow ? <p className="sd-eyebrow m-0">{eyebrow}</p> : null}
              {title ? <h3 className="sd-heading-sm m-0">{title}</h3> : null}
              {hint ? <p className="sd-copy-sm m-0">{hint}</p> : null}
            </div>
            {value ? <strong className="sd-progress-summary-value">{value}</strong> : null}
          </div>
          <ProgressBar value={progressValue} max={progressMax} tone={tone} size="lg" />
        </div>
        {aside ? <div className="sd-progress-summary-aside">{aside}</div> : null}
      </div>
      {footer ? <div className="sd-divider" /> : null}
      {footer ? <div>{footer}</div> : null}
    </SurfaceCard>
  );
}
