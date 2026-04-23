import { useEffect, useRef } from 'react';

import { cn } from '../../lib/ui.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isFocusableElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.getAttribute('aria-hidden') === 'true' || element.closest('[hidden]')) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  return element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
}

function getFocusableElements(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusableElement);
}

function focusFirstAvailableElement(container) {
  const [firstFocusable] = getFocusableElements(container);
  const target = firstFocusable || container;
  target?.focus({ preventScroll: true });
}

export default function OverlayFrame({
  open = false,
  kind = 'dialog',
  labelledBy,
  describedBy,
  onClose,
  closeOnBackdrop = true,
  restoreFocus = true,
  className,
  surfaceClassName,
  children,
}) {
  const surfaceRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }

      const focusableElements = getFocusableElements(surface);
      if (focusableElements.length === 0) {
        event.preventDefault();
        surface.focus({ preventScroll: true });
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstFocusable || activeElement === surface || !surface.contains(activeElement)) {
          event.preventDefault();
          lastFocusable.focus({ preventScroll: true });
        }
        return;
      }

      if (activeElement === lastFocusable || !surface.contains(activeElement)) {
        event.preventDefault();
        firstFocusable.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event) => {
      const surface = surfaceRef.current;
      if (surface && event.target instanceof Node && !surface.contains(event.target)) {
        focusFirstAvailableElement(surface);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    focusFirstAvailableElement(surfaceRef.current);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);

      const restoreTarget = restoreFocusRef.current;
      if (restoreFocus && restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus({ preventScroll: true });
      }
      restoreFocusRef.current = null;
    };
  }, [open, restoreFocus]);

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
      <div
        className="sd-overlay-backdrop"
        aria-hidden="true"
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
