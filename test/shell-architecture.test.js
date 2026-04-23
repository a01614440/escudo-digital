import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { describe } from 'node:test';

import {
  buildResponsiveProfile,
  getInputMode,
  getShellFamily,
} from '../frontend/src/hooks/useResponsiveLayout.js';
import {
  buildNavigationModel,
  getRouteMeta,
  normalizeRequestedView,
} from '../frontend/src/shells/navigationPolicy.js';
import { getShellLayoutPolicy } from '../frontend/src/shells/shellPolicies.js';

describe('shell architecture contracts', () => {
  test('buildResponsiveProfile exposes macro and compatibility data together', () => {
    const mobileProfile = buildResponsiveProfile(390);
    const desktopProfile = buildResponsiveProfile(1366);

    assert.equal(mobileProfile.viewport, 'phone-small');
    assert.equal(mobileProfile.shellFamily, 'mobile');
    assert.equal(mobileProfile.inputMode, 'touch');
    assert.equal(mobileProfile.isCompactViewport, true);

    assert.equal(desktopProfile.viewport, 'desktop');
    assert.equal(desktopProfile.shellFamily, 'desktop');
    assert.equal(desktopProfile.inputMode, 'pointer');
    assert.equal(desktopProfile.isCompactViewport, false);
  });

  test('exposes expected input mode and shell family boundaries', () => {
    assert.equal(getShellFamily('tablet-compact'), 'tablet');
    assert.equal(getShellFamily('laptop'), 'desktop');
    assert.equal(getInputMode('phone'), 'touch');
    assert.equal(getInputMode('desktop'), 'pointer');
  });

  test('normalizes route requests and derives macro route metadata', () => {
    assert.equal(normalizeRequestedView('lesson'), 'courses');
    assert.equal(normalizeRequestedView('admin', { isAdmin: false }), null);
    assert.equal(getRouteMeta('lesson').shellIntent, 'immersive');
    assert.equal(getRouteMeta('admin', { isAdmin: false }).id, 'survey');
  });

  test('buildNavigationModel keeps lesson inside the courses macro destination', () => {
    const model = buildNavigationModel({
      currentView: 'lesson',
      isAdmin: true,
      currentUser: { email: 'admin@example.com' },
    });

    assert.equal(model.currentRouteKey, 'lesson');
    assert.equal(model.activeNavigationTarget, 'courses');
    assert.equal(model.activeViewLabel, 'Curso en progreso');
    assert.equal(model.showNavigation, false);
    assert.equal(model.items.find((item) => item.id === 'courses')?.active, true);
    assert.equal(model.items.find((item) => item.id === 'admin')?.active, false);
  });

  test('shell layout policies differentiate macro responsibilities by family', () => {
    const mobile = getShellLayoutPolicy('mobile');
    const tablet = getShellLayoutPolicy('tablet');
    const desktop = getShellLayoutPolicy('desktop');

    assert.equal(mobile.primaryMode, 'single-task');
    assert.equal(mobile.secondaryPersistent, false);
    assert.equal(tablet.secondaryMode, 'contextual-split');
    assert.equal(desktop.secondaryMode, 'aside');
    assert.equal(desktop.secondaryPersistent, true);
    assert.deepEqual(desktop.slotOrder, ['header', 'primary', 'secondary', 'floating', 'overlay']);
  });

  test('DeviceShell renders shell components through JSX dispatcher', () => {
    const source = readFileSync(new URL('../frontend/src/shells/DeviceShell.jsx', import.meta.url), 'utf8');

    assert.match(source, /const Shell = SHELL_RENDERERS\[shellFamily\] \|\| SHELL_RENDERERS\.desktop/);
    assert.match(source, /<Shell\s+[\s\S]*routeKey=\{routeKey\}/);
    assert.match(source, /slots=\{\{\s*header,[\s\S]*overlay,[\s\S]*\}\}/);
    assert.doesNotMatch(source, /return\s+renderShell\(/);
  });

  test('shells expose the declared shell policy as stable data attributes', () => {
    for (const shellName of ['MobileShell', 'TabletShell', 'DesktopShell']) {
      const source = readFileSync(new URL(`../frontend/src/shells/${shellName}.jsx`, import.meta.url), 'utf8');

      assert.match(source, /data-shell-family=/);
      assert.match(source, /data-shell-intent=\{routeIntent\}/);
      assert.match(source, /data-shell-header-mode=\{policy\.headerMode\}/);
      assert.match(source, /data-shell-primary-mode=\{policy\.primaryMode\}/);
      assert.match(source, /data-shell-secondary-mode=\{policy\.secondaryMode\}/);
      assert.match(source, /data-shell-secondary-persistent=\{policy\.secondaryPersistent \? 'true' : 'false'\}/);
      assert.match(source, /data-shell-overlay-mode=\{policy\.overlayMode\}/);
      assert.match(source, /data-shell-floating-mode=\{policy\.floatingMode\}/);
      assert.match(source, /data-shell-slot-order=\{policy\.slotOrder\.join\(' '\)\}/);
    }
  });

  test('shell slot semantics keep a single primary main and stable secondary regions', () => {
    const mobile = readFileSync(new URL('../frontend/src/shells/MobileShell.jsx', import.meta.url), 'utf8');
    const tablet = readFileSync(new URL('../frontend/src/shells/TabletShell.jsx', import.meta.url), 'utf8');
    const desktop = readFileSync(new URL('../frontend/src/shells/DesktopShell.jsx', import.meta.url), 'utf8');

    for (const source of [mobile, tablet, desktop]) {
      assert.match(source, /<main[\s\S]*data-shell-slot="primary"/);
      assert.match(source, /data-shell-slot="header"/);
      assert.match(source, /data-shell-slot="floating"/);
      assert.match(source, /data-shell-slot="overlay"/);
    }

    assert.match(mobile, /<div className="sd-page-shell" data-shell-slot="secondary">/);
    assert.match(tablet, /<aside[\s\S]*data-shell-slot="secondary"/);
    assert.match(desktop, /<aside data-shell-slot="secondary"/);
  });

  test('loading route avoids nested main landmarks and legacy page wrapper', () => {
    const source = readFileSync(new URL('../frontend/src/route-containers/SessionLoadingRouteContainer.jsx', import.meta.url), 'utf8');

    assert.match(source, /<RouteContainer[\s\S]*routeKey="loading"/);
    assert.match(source, /<div className="sd-page-shell">/);
    assert.doesNotMatch(source, /<main/);
    assert.doesNotMatch(source, /className="page/);
  });
});
