import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import {
  classifyInbox,
  normalizeInboxMessages,
} from '../frontend/src/components/activities/immersive/inboxActivityUtils.js';
import {
  countSafeChoices,
  resolveScenarioNextStepIndex,
} from '../frontend/src/components/activities/immersive/scenarioFlowUtils.js';
import { scoreHotspots } from '../frontend/src/components/activities/immersive/webLabActivityUtils.js';

describe('immersive activity utilities', () => {
  test('normalizes inbox messages and preserves readable metadata', () => {
    const messages = normalizeInboxMessages({
      mensajes: [
        {
          from: 'soporte@banco.com',
          subject: 'Verifica tu cuenta',
          correcto: 'estafa',
          text: 'Ingresa hoy mismo',
        },
      ],
    });

    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, 'msg-1');
    assert.equal(messages[0].displayName, 'soporte@banco.com');
    assert.equal(messages[0].correcto, 'estafa');
    assert.deepEqual(messages[0].body, ['Ingresa hoy mismo']);
  });

  test('scores inbox classification with correct and missed decisions', () => {
    const messages = normalizeInboxMessages({
      mensajes: [
        {
          id: 'safe-mail',
          subject: 'Tu estado de cuenta',
          correcto: 'seguro',
          text: 'Consulta tu PDF',
        },
        {
          id: 'fraud-mail',
          subject: 'Bloqueo inmediato',
          correcto: 'estafa',
          text: 'Valida tu acceso ahora',
        },
      ],
    });

    const result = classifyInbox(
      messages,
      {
        'safe-mail': 'seguro',
      },
      'correo'
    );

    assert.equal(result.correct, 1);
    assert.equal(result.total, 2);
    assert.equal(result.score, 0.5);
    assert.equal(result.review[1].status, 'missed');
    assert.match(result.feedback.signal, /1 de 2/);
  });

  test('weights hotspot and decision accuracy together', () => {
    const score = scoreHotspots({
      hotspots: [
        { target: 'domain', correcta: true },
        { target: 'policy', correcta: true },
      ],
      flagged: new Set(['domain']),
      neutralTargets: new Set(['product_0']),
      decision: 1,
      decisionOptions: ['Confiar', 'Salir del sitio'],
      correctDecision: 1,
    });

    assert.ok(score > 0.5 && score < 1);
  });

  test('resolves next scenario step without looping answered nodes', () => {
    const steps = [{}, {}, {}];
    const next = resolveScenarioNextStepIndex({
      steps,
      stepIndex: 0,
      requestedNext: 2,
      answeredIndexes: [0],
    });
    const fallback = resolveScenarioNextStepIndex({
      steps,
      stepIndex: 1,
      requestedNext: 1,
      answeredIndexes: [0, 1],
    });

    assert.equal(next, 2);
    assert.equal(fallback, 2);
    assert.equal(countSafeChoices([1, 0.8, 0.7, 0.95]), 3);
  });
});
