import { cn } from '../lib/ui.js';

export default function MobileShell({
  routeKey,
  routeIntent = 'focus',
  policy,
  slots,
  className,
}) {
  const { header, primary, secondary, floating, overlay } = slots;

  return (
    <div
      data-shell-family="mobile"
      data-shell-intent={routeIntent}
      data-shell-header-mode={policy.headerMode}
      data-shell-primary-mode={policy.primaryMode}
      data-shell-secondary-mode={policy.secondaryMode}
      data-shell-secondary-persistent={policy.secondaryPersistent ? 'true' : 'false'}
      data-shell-overlay-mode={policy.overlayMode}
      data-shell-floating-mode={policy.floatingMode}
      data-shell-slot-order={policy.slotOrder.join(' ')}
      className={cn('app-shell app-shell-mobile app-shell-family-mobile', `app-view-${routeKey}`, className)}
    >
      <div className="grid min-h-screen grid-rows-[auto_1fr]">
        <div className="grid gap-[var(--sd-shell-section-gap)] py-[var(--sd-shell-padding-block)]">
          {header ? (
            <div className="sd-page-shell sticky top-0 z-[20]" data-shell-slot="header">
              {header}
            </div>
          ) : null}

          <main data-shell-slot="primary" className="min-w-0">
            {primary}
          </main>

          {secondary ? (
            <div className="sd-page-shell" data-shell-slot="secondary">
              {secondary}
            </div>
          ) : null}
        </div>
      </div>

      {floating ? (
        <div
          data-shell-slot="floating"
          data-shell-floating-mode={policy.floatingMode}
          className="fixed bottom-5 right-5"
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
