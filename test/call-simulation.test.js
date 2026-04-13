import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import {
  buildCallEndSummary,
  formatCallDuration,
  normalizeCallChoices,
} from '../frontend/src/components/activities/callSimulationUtils.js';

describe('call simulation hardening', () => {
  test('builds an actionable summary after a risky call', () => {
    const summary = buildCallEndSummary({
      analyses: [
        {
          score: 0.52,
          signal_detected: 'Urgencia para resolver durante la llamada',
          risk: 'Te mantuvieron demasiado tiempo en el mismo canal.',
          safe_action: 'Cuelga y llama al numero oficial.',
          coach_feedback: 'La proxima vez corta antes.',
        },
        {
          score: 0.81,
          signal_detected: 'Peticion de codigo por telefono',
          risk: 'Pedir un codigo por llamada es una alerta critica.',
          safe_action: 'Verifica desde la app oficial.',
          coach_feedback: 'Recuperaste parte del control al final.',
        },
      ],
      finalReason: 'completed',
      transcript: [
        { speaker: 'caller', text: 'Necesito tu codigo ahora.' },
        { speaker: 'user', text: 'Voy a verificar por mi cuenta.' },
      ],
    });

    assert.equal(summary.scoreText, '67%');
    assert.equal(summary.feedback.title, 'Buena');
    assert.match(summary.feedback.signal, /Urgencia para resolver/);
    assert.equal(summary.feedback.action, 'Verifica desde la app oficial.');
    assert.ok(summary.feedback.missed.includes('Salir del canal apenas notes autoridad falsa o una petición urgente de datos.'));
    assert.equal(summary.transcriptPreview.length, 2);
  });

  test('keeps the safest default summary when user hangs up immediately', () => {
    const summary = buildCallEndSummary({
      analyses: [],
      finalReason: 'hung_up',
      transcript: [],
    });

    assert.equal(summary.scoreText, '100%');
    assert.equal(summary.feedback.title, 'Buena');
    assert.equal(summary.safeTurns, 0);
    assert.match(summary.statusNote, /Colgaste a tiempo/);
  });

  test('normalizes starter choices and duration formatting', () => {
    assert.deepEqual(normalizeCallChoices([' A ', '', 'B', 'C', 'D']), ['A', 'B', 'C']);
    assert.equal(formatCallDuration(125), '02:05');
  });
});
