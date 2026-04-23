import { cn } from '../lib/ui.js';

export default function DesktopShell({
  routeKey,
  routeIntent = 'workspace',
  policy,
  slots,
  className,
}) {
  const { header, primary, secondary, floating, overlay } = slots;
  const focusedPrimary = routeIntent === 'focus';

  return (
    <div
      data-shell-family="desktop"
      data-shell-intent={routeIntent}
      data-shell-primary-mode={policy.primaryMode}
      data-shell-secondary-mode={policy.secondaryMode}
      data-shell-overlay-mode={policy.overlayMode}
      className={cn('app-shell app-shell-desktop app-shell-family-desktop', `app-view-${routeKey}`, className)}
    >
      <div className="grid gap-[var(--sd-shell-section-gap)] py-[var(--sd-shell-padding-block)]">
        {header ? (
          <div className="sd-page-shell" data-shell-slot="header">
            {header}
          </div>
        ) : null}

        <div className="sd-page-shell" data-shell-slot="body">
          {secondary ? (
            <div className="grid items-start gap-[var(--sd-shell-pane-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,var(--sd-shell-detail-width))]">
              <main
                data-shell-slot="primary"
                className={cn('min-w-0', focusedPrimary ? 'mx-auto w-full max-w-[72rem]' : '')}
              >
                {primary}
              </main>
              <aside data-shell-slot="secondary" className="sd-shell-rail sd-rail-sticky min-w-0">
                {secondary}
              </aside>
            </div>
          ) : (
            <main
              data-shell-slot="primary"
              className={cn('min-w-0', focusedPrimary ? 'mx-auto w-full max-w-[72rem]' : '')}
            >
              {primary}
            </main>
          )}
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
