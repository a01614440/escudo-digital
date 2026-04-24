import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const storageSource = readFileSync(new URL('../frontend/src/lib/storage.js', import.meta.url), 'utf8');
const responsiveSource = readFileSync(new URL('../frontend/src/hooks/useResponsiveLayout.js', import.meta.url), 'utf8');
const sessionBarSource = readFileSync(new URL('../frontend/src/components/SessionBar.jsx', import.meta.url), 'utf8');
const shellSlotsSource = readFileSync(new URL('../frontend/src/shells/buildShellSlots.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../frontend/src/App.jsx', import.meta.url), 'utf8');

describe('Fase X.0 light mode lock guards', () => {
  test('storage normalizes any saved dark preference to the presentation light theme', () => {
    assert.match(storageSource, /export const PRESENTATION_THEME = 'light'/);
    assert.match(storageSource, /localStorage\.getItem\(STORAGE_KEYS\.theme\) === 'dark'/);
    assert.match(storageSource, /localStorage\.setItem\(STORAGE_KEYS\.theme, PRESENTATION_THEME\)/);
    assert.doesNotMatch(storageSource, /return value === 'dark' \? 'dark' : 'light'/);
  });

  test('responsive layout applies only the light presentation theme to the DOM', () => {
    assert.match(responsiveSource, /const theme = PRESENTATION_THEME/);
    assert.match(responsiveSource, /document\.body\.dataset\.theme = PRESENTATION_THEME/);
    assert.match(responsiveSource, /document\.documentElement\.style\.colorScheme = PRESENTATION_THEME/);
    assert.doesNotMatch(responsiveSource, /setTheme\(\(current\) => \(current === 'dark' \? 'light' : 'dark'\)\)/);
  });

  test('session shell no longer exposes a visible dark mode toggle', () => {
    assert.doesNotMatch(sessionBarSource, /Modo oscuro|Modo claro/);
    assert.doesNotMatch(sessionBarSource, /onThemeToggle/);
    assert.doesNotMatch(shellSlotsSource, /onThemeToggle/);
    assert.doesNotMatch(appSource, /onThemeToggle: device\.toggleTheme/);
  });
});
