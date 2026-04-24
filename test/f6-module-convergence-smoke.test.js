import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const source = readFileSync(
  new URL('../frontend/src/components/CoursesView.jsx', import.meta.url),
  'utf8'
);

function functionBlock(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);

  const end = nextName
    ? source.indexOf(`function ${nextName}`, start + 1)
    : source.indexOf('export default function CoursesView', start + 1);

  assert.notEqual(end, -1, `${name} should have a readable boundary`);
  return source.slice(start, end);
}

describe('F6.R4 Cursos / modulos convergence guards', () => {
  test('RouteNavigatorRail stays secondary while module detail becomes the command surface', () => {
    const rail = functionBlock('RouteNavigatorRail', 'ModuleActivityList');
    const board = functionBlock('ModuleMissionBoard', 'ProgressScene');

    assert.match(rail, /data-sd-route-rail="module-list"/);
    assert.match(rail, /title="Explora tu ruta"/);
    assert.match(rail, /subtitle="Toca un modulo para ver acciones aqui mismo\."/);
    assert.match(rail, /data-sd-route-module-list="single-column"/);
    assert.doesNotMatch(rail, /sm:grid-cols-2 xl:grid-cols-3/);
    assert.match(board, /data-sd-module-flow="converged"/);
    assert.match(board, /<ProgressBar value=\{stats\.pct\} tone="accent" size="lg" \/>/);
    assert.match(board, /const supportFacts = \[/);
    assert.match(board, /sd-module-support-facts/);
  });

  test('Module detail now groups category, gap and unlock facts before a single CTA', () => {
    const board = functionBlock('ModuleMissionBoard', 'ProgressScene');

    assert.match(board, /const categoryLabel = CATEGORY_LABELS\[module\.categoria\] \|\| 'Ruta'/);
    assert.match(board, /label: 'Categoria'/);
    assert.match(board, /label: 'Gap visible'/);
    assert.match(board, /label: 'Siguiente desbloqueo'/);
    assert.match(board, /<ActionCluster align="start"/);
    assert.match(board, /data-sd-module-cta="courses-detail"/);
    assert.doesNotMatch(board, /<ProgressSummary/);
    assert.doesNotMatch(board, /<KeyValueBlock/);
  });

  test('ModuleActivityList uses readable rows instead of a rigid admin grid', () => {
    const block = functionBlock('ModuleActivityList', 'ModuleMissionBoard');

    assert.match(block, /sd-module-activity-row/);
    assert.match(block, /sd-module-activity-title block text-sm leading-6 text-sd-text/);
    assert.doesNotMatch(block, /break-words text-sm leading-6 text-sd-text/);
    assert.match(block, /<Badge tone=\{stateTone\}>\{stateLabel\}<\/Badge>/);
    assert.match(block, /aria-current=\{isNext \? 'step' : undefined\}/);
    assert.doesNotMatch(block, /grid-cols-\[auto_1fr_auto\]/);
    assert.doesNotMatch(block, /truncate/);
  });
});
