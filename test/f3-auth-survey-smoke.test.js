import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('F3 Auth + Survey closeout guards', () => {
  test('AuthView uses foundation inverse tone instead of local inverse hacks', () => {
    const source = readFileSync(new URL('../frontend/src/components/AuthView.jsx', import.meta.url), 'utf8');

    assert.match(source, /<SurfaceCard[\s\S]*variant="command"[\s\S]*tone="inverse"/);
    assert.match(source, /<strong className="sd-heading-sm m-0">/);
    assert.match(source, /<p className="sd-copy-sm m-0">/);
    assert.doesNotMatch(source, /text-white/);
    assert.doesNotMatch(source, /shadow-\[0_28px_80px/);
    assert.doesNotMatch(source, /\[&_\.text-sd-text\]:text-white/);
  });

  test('AuthView avoids the duplicate shell page wrapper outside mobile padding', () => {
    const source = readFileSync(new URL('../frontend/src/components/AuthView.jsx', import.meta.url), 'utf8');

    assert.match(source, /id="authView"/);
    assert.match(source, /className=\{shellFamily === 'mobile' \? 'sd-page-shell' : undefined\}/);
    assert.doesNotMatch(source, /className="sd-page-shell py-\[var\(--sd-shell-padding-block\)\]"/);
    assert.doesNotMatch(source, /data-sd-container="true"[\s\S]*<SplitHeroLayout/);
    assert.doesNotMatch(source, /md:grid-cols-\[minmax\(0,1\.08fr\)_minmax\(23rem,0\.92fr\)\]/);
  });

  test('SurveyView uses foundation choice primitives instead of improvised choice cards', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
    const questionPage = readFileSync(new URL('../frontend/src/patterns/QuestionPage.jsx', import.meta.url), 'utf8');

    assert.match(source, /QuestionPage,/);
    assert.match(source, /<QuestionPage[\s\S]*type=\{question\.type\}[\s\S]*onValueChange=\{\(nextValue\) => onAnswerChange\(question\.id, nextValue\)\}/);
    assert.match(questionPage, /Checkbox,/);
    assert.match(questionPage, /Radio,/);
    assert.match(questionPage, /buildNextMultiValue\(options, selectedValues, option\.value, event\.target\.checked\)/);
    assert.doesNotMatch(source, /function SurveyChoiceCard/);
    assert.doesNotMatch(source, /function renderInput/);
    assert.doesNotMatch(source, /function buildNextMultiAnswer/);
    assert.doesNotMatch(source, /<input className="sr-only"/);
    assert.doesNotMatch(source, /shadow-\[0_24px_50px/);
  });

  test('SurveyView wires question controls to accessible descriptions and errors', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
    const questionPage = readFileSync(new URL('../frontend/src/patterns/QuestionPage.jsx', import.meta.url), 'utf8');

    assert.match(questionPage, /function mergeDescribedBy/);
    assert.match(questionPage, /aria-describedby=\{describedBy\}/);
    assert.match(questionPage, /aria-invalid=\{error \? 'true' : undefined\}/);
    assert.match(questionPage, /aria-required=\{required \? 'true' : undefined\}/);
    assert.match(questionPage, /<legend className="sr-only">\{questionTitle\}<\/legend>/);
    assert.match(questionPage, /<Select[\s\S]*required=\{required\}[\s\S]*invalid=\{Boolean\(error\)\}[\s\S]*aria-describedby=\{describedBy\}/);
    assert.match(questionPage, /<TextArea[\s\S]*required=\{required\}[\s\S]*invalid=\{Boolean\(error\)\}[\s\S]*aria-describedby=\{describedBy\}/);
    assert.match(source, /errorId=\{validationErrorId\}/);
    assert.match(source, /errorTitle="Falta completar esta pregunta\."/);
    assert.match(source, /aria-describedby=\{flowErrorId\}/);
    assert.match(source, /id=\{flowErrorId\} tone="danger"/);
  });

  test('SurveyView adopts F1 domain layout patterns for the active question scene', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
    const infoPanel = readFileSync(new URL('../frontend/src/patterns/InfoPanel.jsx', import.meta.url), 'utf8');
    const stageScene = source.slice(
      source.indexOf('function SurveyStageScene'),
      source.indexOf('function LoadingPrimaryPanel')
    );

    assert.match(source, /AssessmentLayout/);
    assert.match(source, /InfoPanel,/);
    assert.match(stageScene, /<AssessmentLayout/);
    assert.match(stageScene, /progress=\{[\s\S]*<SurveyCommandDeck/);
    assert.match(stageScene, /question=\{[\s\S]*<QuestionBoard/);
    assert.match(stageScene, /insight=\{<SurveyInsightDeck/);
    assert.match(source, /<InfoPanel[\s\S]*tone="coach"[\s\S]*items=\{items\}/);
    assert.match(infoPanel, /as = 'aside'/);
    assert.match(infoPanel, /as=\{as\}/);
    assert.doesNotMatch(stageScene, /<WorkspaceLayout/);
    assert.doesNotMatch(stageScene, /xl:grid-cols-\[minmax\(16\.5rem,17\.5rem\)_minmax\(0,1\.28fr\)_minmax\(18\.5rem,19\.5rem\)\]/);
  });

  test('SurveyView hardens intro reset and renders one survey scene at a time', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');

    assert.match(source, /function shouldShowSurveyIntro\(\{ assessment, surveyStage, surveyIndex, hasAnswers \}\)/);
    assert.match(source, /function getSurveyScene\(\{ surveyStage, showIntro \}\)/);
    assert.match(source, /const introResetPendingRef = useRef\(false\)/);
    assert.match(source, /if \(surveyStage !== 'survey' \|\| assessment\) \{[\s\S]*introResetPendingRef\.current = true/);
    assert.match(source, /if \(canShowIntro && introResetPendingRef\.current\) \{[\s\S]*setShowIntro\(true\)/);
    assert.match(source, /if \(!canShowIntro\) \{[\s\S]*introResetPendingRef\.current = false[\s\S]*setShowIntro\(false\)/);
    assert.match(source, /const activeSurveyScene = getSurveyScene\(\{/);
    assert.match(source, /activeSurveyScene === 'intro'/);
    assert.match(source, /activeSurveyScene === 'survey'/);
    assert.match(source, /activeSurveyScene === 'loading'/);
    assert.match(source, /activeSurveyScene === 'results'/);
    assert.doesNotMatch(source, /\{showIntro \? \(/);
    assert.doesNotMatch(source, /surveyStage === 'survey' && !showIntro/);
  });

  test('SurveyView announces loading as a busy live status without local inverse hacks', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');

    assert.match(source, /<SurfaceCard[\s\S]*variant="command"[\s\S]*tone="inverse"[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-busy="true"/);
    assert.match(source, /<strong className="sd-heading-sm m-0">Analizando respuestas<\/strong>/);
    assert.match(source, /<p className="sd-copy-sm m-0">/);
    assert.doesNotMatch(source, /shadow-\[0_30px_80px/);
    assert.doesNotMatch(source, /\[&_\.text-sd-text\]:text-white/);
    assert.doesNotMatch(source, /text-white\/76/);
  });

  test('SurveyView closes results profile and CTA using domain layout without local grid hacks', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
    const resultsScene = source.slice(
      source.indexOf('function ResultsScene'),
      source.indexOf('export default function SurveyView')
    );

    assert.doesNotMatch(source, /WorkspaceLayout/);
    assert.match(resultsScene, /<AssessmentLayout/);
    assert.match(resultsScene, /progress=\{[\s\S]*<ResultsCommandDeck/);
    assert.match(resultsScene, /question=\{<ResultsMainDeck/);
    assert.match(resultsScene, /insight=\{[\s\S]*<ResultsRouteRail/);
    assert.match(source, /const resultLevel = normalizeRiskLevel/);
    assert.match(source, /<strong className="sd-title m-0">/);
    assert.match(source, /<ol className="m-0 grid list-none gap-3 p-0">/);
    assert.doesNotMatch(source, /tracking-\[-0\.06em\]/);
    assert.doesNotMatch(resultsScene, /xl:grid-cols-\[minmax\(16\.5rem,17\.5rem\)_minmax\(0,1\.22fr\)_minmax\(19rem,20rem\)\]/);
    assert.doesNotMatch(source, /className=\{shellFamily === 'tablet' \? '!grid-cols-1' : ''\}/);
  });

  test('SurveyView keeps Ver mi ruta as the primary handoff with an error retry fallback', () => {
    const source = readFileSync(new URL('../frontend/src/components/SurveyView.jsx', import.meta.url), 'utf8');
    const routeContainer = readFileSync(new URL('../frontend/src/route-containers/resolveActiveRoute.jsx', import.meta.url), 'utf8');

    assert.match(source, /const routeSummaryId = 'survey-results-route-summary'/);
    assert.match(source, /const routeErrorId = courseError \? 'survey-results-route-error' : undefined/);
    assert.match(source, /<InlineMessage id=\{routeErrorId\} tone="danger" title="No pudimos abrir tu ruta todavia\.">/);
    assert.match(source, /<Button[\s\S]*variant="primary"[\s\S]*size="lg"[\s\S]*onClick=\{onTakeCourses\}[\s\S]*aria-describedby=\{ctaDescription\}/);
    assert.match(source, /courseError \? 'Intentar abrir mi ruta de nuevo' : 'Ver mi ruta'/);
    assert.match(source, /Perfil listo; abre tu ruta\./);
    assert.match(routeContainer, /onTakeCourses: \(\) =>[\s\S]*course\.openCourses\(\{[\s\S]*answers: assessment\.answers,[\s\S]*assessment: assessment\.assessment,[\s\S]*authToken: auth\.authToken/);
  });
});
