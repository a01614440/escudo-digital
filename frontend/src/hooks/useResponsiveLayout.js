import { useEffect, useMemo, useState } from 'react';
import { readThemePreference, writeThemePreference } from '../lib/storage.js';

export const TOUCH_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact', 'tablet']);
export const COMPACT_VIEWPORTS = new Set(['phone-small', 'phone', 'tablet-compact']);

export const VIEWPORT_TO_SHELL = {
  'phone-small': 'mobile',
  phone: 'mobile',
  'tablet-compact': 'tablet',
  tablet: 'tablet',
  laptop: 'desktop',
  desktop: 'desktop',
};

export function getViewportProfile(width) {
  const safeWidth = Number(width) || 0;
  if (safeWidth <= 420) return 'phone-small';
  if (safeWidth <= 640) return 'phone';
  if (safeWidth <= 820) return 'tablet-compact';
  if (safeWidth <= 1024) return 'tablet';
  if (safeWidth <= 1280) return 'laptop';
  return 'desktop';
}

export function getShellFamily(viewport) {
  return VIEWPORT_TO_SHELL[String(viewport || '').toLowerCase()] || 'desktop';
}

export function getInputMode(viewport) {
  return TOUCH_VIEWPORTS.has(viewport) ? 'touch' : 'pointer';
}

export function buildResponsiveProfile(width) {
  const viewport = getViewportProfile(width);
  const shellFamily = getShellFamily(viewport);
  const inputMode = getInputMode(viewport);

  return {
    viewport,
    shellFamily,
    inputMode,
    isTouchViewport: TOUCH_VIEWPORTS.has(viewport),
    isCompactViewport: COMPACT_VIEWPORTS.has(viewport),
    isMobileShell: shellFamily === 'mobile',
    isTabletShell: shellFamily === 'tablet',
    isDesktopShell: shellFamily === 'desktop',
  };
}

function writeBodyLayoutDatasets(profile) {
  document.body.dataset.viewport = profile.viewport;
  document.body.dataset.shell = profile.shellFamily;
  document.body.dataset.inputMode = profile.inputMode;
}

function clearBodyLayoutDatasets() {
  delete document.body.dataset.viewport;
  delete document.body.dataset.shell;
  delete document.body.dataset.inputMode;
}

export function useResponsiveLayout() {
  const [theme, setTheme] = useState(readThemePreference());
  const [profile, setProfile] = useState(() =>
    typeof window === 'undefined' ? buildResponsiveProfile(1440) : buildResponsiveProfile(window.innerWidth)
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    writeThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const applyViewportProfile = () => {
      const nextProfile = buildResponsiveProfile(window.innerWidth);
      setProfile(nextProfile);
      writeBodyLayoutDatasets(nextProfile);
    };

    applyViewportProfile();
    window.addEventListener('resize', applyViewportProfile, { passive: true });

    return () => {
      window.removeEventListener('resize', applyViewportProfile);
      clearBodyLayoutDatasets();
    };
  }, []);

  return useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme() {
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
      },
      ...profile,
      compatViewport: profile.viewport,
      compatViewportDataset: 'body[data-viewport]',
      macroLayoutSource: 'shellFamily',
      legacyLayoutCompatSource: 'viewport',
    }),
    [profile, theme]
  );
}
