import assert from 'node:assert/strict';
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
});
