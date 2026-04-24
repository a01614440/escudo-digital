import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('F6.R2 Survey refine guards', () => {
  test('Survey intro and loading no longer use split hero scaffolds', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /SplitHeroLayout/);
    assert.match(source, /data-sd-survey-scene="intro"/);
    assert.match(source, /data-sd-survey-scene="loading"/);
    assert.doesNotMatch(source, /function IntroSupportBand/);
    assert.doesNotMatch(source, /function LoadingSupportBand/);
    assert.doesNotMatch(source, /Ir a la primera pregunta/);
  });

  test('Survey question scene stacks the main card before progress and help', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
    const stageScene = source.slice(
      source.indexOf('function SurveyStageScene'),
      source.indexOf('function LoadingPrimaryPanel')
    );

    assert.match(stageScene, /<AssessmentLayout/);
    assert.match(stageScene, /className="md:grid-cols-1"/);
    assert.match(stageScene, /progressClassName="order-3"/);
    assert.match(stageScene, /questionClassName="order-2"/);
    assert.match(stageScene, /insightClassName="order-4"/);
    assert.match(source, /data-sd-survey-journey="collapsed"/);
    assert.match(source, /data-sd-survey-help="collapsed"/);
  });

  test('Survey results use a strong inverse handoff card for route continuation', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
    const resultsScene = source.slice(
      source.indexOf('function ResultsCommandDeck'),
      source.indexOf('export default function SurveyView')
    );

    assert.match(resultsScene, /data-sd-survey-results-profile="true"/);
    assert.match(resultsScene, /data-sd-survey-handoff="ready"/);
    assert.match(resultsScene, /<SurfaceCard[\s\S]*variant="command"[\s\S]*tone="inverse"/);
    assert.match(resultsScene, /subtitle="Abre el modulo recomendado\."/
    );
    assert.match(resultsScene, /className="md:grid-cols-1"/);
    assert.match(resultsScene, /progressClassName="order-2"/);
    assert.match(resultsScene, /insightClassName="order-3"/);
    assert.match(resultsScene, /questionClassName="order-4"/);
  });
});
