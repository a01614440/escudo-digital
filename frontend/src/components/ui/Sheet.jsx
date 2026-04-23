import { useId } from 'react';

import { cn } from '../../lib/ui.js';
import ActionCluster from '../../patterns/ActionCluster.jsx';
import OverlayFrame from './OverlayFrame.jsx';

export default function Sheet({
  open = false,
  title,
  subtitle,
  footer,
  actions,
  onClose,
  closeLabel = 'Cerrar hoja',
  children,
  className,
  bodyClassName,
}) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <OverlayFrame
      open={open}
      kind="sheet"
      labelledBy={title ? titleId : undefined}
      describedBy={subtitle ? descriptionId : undefined}
      onClose={onClose}
      surfaceClassName={className}
    >
      <header className="sd-overlay-header">
        <div className="grid gap-2">
          {title ? <h2 id={titleId} className="sd-heading-sm m-0">{title}</h2> : null}
          {subtitle ? (
            <p id={descriptionId} className="sd-copy-sm m-0">
              {subtitle}
            </p>
          ) : null}
        </div>
        {onClose ? (
          <button type="button" className="sd-overlay-close sd-focus-ring" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        ) : null}
      </header>
      <div className={cn('sd-overlay-body', bodyClassName)}>{children}</div>
      {actions || footer ? (
        <footer className="sd-overlay-footer">
          {footer}
          {actions ? <ActionCluster align="end">{actions}</ActionCluster> : null}
        </footer>
      ) : null}
    </OverlayFrame>
  );
}
