import { useEffect, useState } from 'react';
import { readThemePreference, writeThemePreference } from '../lib/storage.js';

const TOUCH_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact', 'tablet']);
const COMPACT_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact']);

export function getViewportProfile(width) {
  const safeWidth = Number(width) || 0;
  if (safeWidth <= 420) return 'phone-small';
  if (safeWidth <= 640) return 'phone';
  if (safeWidth <= 820) return 'tablet-compact';
  if (safeWidth <= 1024) return 'tablet';
  if (safeWidth <= 1280) return 'laptop';
  return 'desktop';
}

export function useResponsiveLayout() {
  const [theme, setTheme] = useState(readThemePreference());
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? 'desktop' : getViewportProfile(window.innerWidth)
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const applyViewportProfile = () => {
      const nextViewport = getViewportProfile(window.innerWidth);
      setViewport(nextViewport);
      document.body.dataset.viewport = nextViewport;
      document.body.dataset.inputMode = TOUCH_VIEWPORTS.has(nextViewport) ? 'touch' : 'pointer';
    };

    applyViewportProfile();
    window.addEventListener('resize', applyViewportProfile, { passive: true });

    return () => {
      window.removeEventListener('resize', applyViewportProfile);
      delete document.body.dataset.viewport;
      delete document.body.dataset.inputMode;
    };
  }, []);

  return {
    theme,
    setTheme,
    toggleTheme() {
      setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    },
    viewport,
    isTouchViewport: TOUCH_VIEWPORTS.has(viewport),
    isCompactViewport: COMPACT_VIEWPORTS.has(viewport),
  };
}
