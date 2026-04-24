import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';

const coursesSource = readFileSync('frontend/src/components/CoursesView.jsx', 'utf8');
const tailwindSource = readFileSync('frontend/src/styles/tailwind.css', 'utf8');

function functionBlock(name, nextName) {
  const start = coursesSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextName
    ? coursesSource.indexOf(`function ${nextName}`, start + 1)
    : coursesSource.indexOf('export default function CoursesView', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return coursesSource.slice(start, end);
}

function coursesViewBlock() {
  const start = coursesSource.indexOf('export default function CoursesView');
  assert.notEqual(start, -1, 'CoursesView should exist');
  return coursesSource.slice(start);
}

describe('Fase X.2 expandable route modules', () => {
  test('RouteModulePill is a semantic disclosure, not a nested-button card', () => {
    const block = functionBlock('RouteModulePill', 'RouteNavigatorRail');

    assert.match(block, /as="article"/);
    assert.match(block, /className="sd-route-pill-trigger"/);
    assert.match(block, /aria-expanded=\{expanded \? 'true' : 'false'\}/);
    assert.match(block, /aria-controls=\{expanded \? disclosureId : undefined\}/);
    assert.match(block, /role="region"/);
    assert.match(block, /aria-labelledby=\{triggerId\}/);
    assert.match(block, /data-sd-route-module-disclosure="true"/);
    assert.doesNotMatch(block, /as="button"/);
  });

  test('expanded module shows local context and CTA where the user clicked', () => {
    const block = functionBlock('RouteModulePill', 'RouteNavigatorRail');

    assert.match(block, /Siguiente actividad/);
    assert.match(block, /Progreso/);
    assert.match(block, /data-sd-route-module-inline-cta="true"/);
    assert.match(block, /getModuleCtaLabel\(\{ locked, adminAccess, stats \}\)/);
    assert.match(block, /onOpenModule\(entry\.index, \{ restart: adminAccess && stats\.pct >= 100 \}\)/);
  });

  test('CoursesView keeps module selection and expansion as separate state', () => {
    const block = coursesViewBlock();

    assert.match(block, /const \[expandedModuleId, setExpandedModuleId\] = useState\(null\)/);
    assert.match(block, /const handleRouteModuleToggle = \(moduleId\) => \{/);
    assert.match(block, /setExpandedModuleId\(\(current\) => \(current === moduleId \? null : moduleId\)\)/);
    assert.match(block, /expandedModuleId=\{expandedModuleId\}/);
    assert.match(block, /onToggleModule=\{handleRouteModuleToggle\}/);
    assert.match(block, /onOpenModule=\{onOpenModule\}/);
  });

  test('route disclosure has visible focus and selected-expanded styling', () => {
    assert.match(tailwindSource, /\.sd-route-pill-trigger:focus-visible/);
    assert.match(tailwindSource, /\.sd-route-pill\[data-route-module-expanded='true'\]/);
    assert.match(tailwindSource, /\.sd-route-pill-disclosure/);
    assert.match(tailwindSource, /@keyframes sd-disclosure-enter/);
  });
});
