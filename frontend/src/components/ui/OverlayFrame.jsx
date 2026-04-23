import { useEffect, useRef } from 'react';

import { cn } from '../../lib/ui.js';

export default function OverlayFrame({
  open = false,
  kind = 'dialog',
  labelledBy,
  describedBy,
  onClose,
  closeOnBackdrop = true,
  className,
  surfaceClassName,
  children,
}) {
  const surfaceRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    surfaceRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose?.();
    }
  };

  return (
    <div className={cn('sd-overlay-frame', className)} data-overlay-kind={kind}>
      <button
        type="button"
        className="sd-overlay-backdrop"
        aria-label="Cerrar capa superpuesta"
        onClick={handleBackdropClick}
      />
      <div className="sd-overlay-shell">
        <div
          ref={surfaceRef}
          className={cn('sd-overlay-surface', surfaceClassName)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          data-sd-container="true"
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
