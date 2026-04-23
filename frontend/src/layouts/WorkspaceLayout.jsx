import { cn } from '../lib/ui.js';

export default function WorkspaceLayout({
  shellFamily = 'desktop',
  command,
  main,
  insight,
  className,
  commandClassName,
  mainClassName,
  insightClassName,
}) {
  const shellLayoutClassName =
    shellFamily === 'tablet'
      ? 'md:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)]'
      : shellFamily === 'desktop'
        ? 'xl:grid-cols-[minmax(17rem,18.5rem)_minmax(0,1.18fr)_minmax(20rem,22rem)] 2xl:grid-cols-[minmax(18rem,19rem)_minmax(0,1.28fr)_minmax(21rem,23rem)]'
        : '';

  return (
    <section
      className={cn(
        'sd-workspace-layout',
        `sd-workspace-layout-${shellFamily}`,
        shellLayoutClassName,
        className
      )}
      data-layout="workspace"
      data-shell-family={shellFamily}
      data-sd-container="true"
    >
      {command ? <aside className={cn('sd-workspace-command min-w-0', commandClassName)}>{command}</aside> : null}
      {main ? <div className={cn('sd-workspace-main min-w-0', mainClassName)}>{main}</div> : null}
      {insight ? <aside className={cn('sd-workspace-insight min-w-0', insightClassName)}>{insight}</aside> : null}
    </section>
  );
}
