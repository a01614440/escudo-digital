import { cn } from '../lib/ui.js';

export default function TabletShell({
  routeKey,
  routeIntent = 'focus',
  policy,
  slots,
  className,
}) {
  const { header, primary, secondary, floating, overlay } = slots;
  const allowSplit = Boolean(secondary) && routeIntent !== 'focus';

  return (
    <div
      data-shell-family="tablet"
      data-shell-intent={routeIntent}
      data-shell-primary-mode={policy.primaryMode}
      data-shell-secondary-mode={policy.secondaryMode}
      data-shell-overlay-mode={policy.overlayMode}
      className={cn('app-shell app-shell-tablet app-shell-family-tablet', `app-view-${routeKey}`, className)}
    >
      <div className="grid gap-[var(--sd-shell-section-gap)] py-[var(--sd-shell-padding-block)]">
        {header ? (
          <div className="sd-page-shell" data-shell-slot="header">
            {header}
          </div>
        ) : null}

        <div
          className={cn(
            'sd-page-shell grid items-start gap-[var(--sd-shell-pane-gap)]',
            allowSplit ? 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]' : ''
          )}
          data-shell-slot="body"
        >
          <main data-shell-slot="primary" className="min-w-0">
            {primary}
          </main>
          {secondary ? (
            <aside
              data-shell-slot="secondary"
              className={cn('min-w-0', allowSplit ? '' : 'grid gap-[var(--sd-shell-rail-gap)]')}
            >
              {secondary}
            </aside>
          ) : null}
        </div>
      </div>

      {floating ? (
        <div
          data-shell-slot="floating"
          data-shell-floating-mode={policy.floatingMode}
          className="fixed bottom-6 right-6"
          style={{ zIndex: 'var(--sd-z-drawer)' }}
        >
          {floating}
        </div>
      ) : null}

      {overlay ? (
        <div data-shell-slot="overlay" style={{ zIndex: 'var(--sd-z-overlay)' }}>
          {overlay}
        </div>
      ) : null}
    </div>
  );
}
