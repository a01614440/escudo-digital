import { cn } from '../lib/ui.js';

export default function AssessmentLayout({
  shellFamily = 'mobile',
  hero,
  progress,
  question,
  insight,
  footer,
  className,
  heroClassName,
  progressClassName,
  questionClassName,
  insightClassName,
  footerClassName,
}) {
  return (
    <section
      className={cn('sd-assessment-layout', `sd-assessment-layout-${shellFamily}`, className)}
      data-layout="assessment"
      data-shell-family={shellFamily}
      data-sd-container="true"
    >
      {hero ? <div className={cn('sd-assessment-hero', heroClassName)}>{hero}</div> : null}
      {progress ? <div className={cn('sd-assessment-progress', progressClassName)}>{progress}</div> : null}
      {question ? <div className={cn('sd-assessment-question', questionClassName)}>{question}</div> : null}
      {insight ? <aside className={cn('sd-assessment-insight', insightClassName)}>{insight}</aside> : null}
      {footer ? <div className={cn('sd-assessment-footer', footerClassName)}>{footer}</div> : null}
    </section>
  );
}
