import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeRiskLevel } from '../lib/course.js';
import { buildJourneyProgress } from '../lib/journeyGuidance.js';
import { getShellFamily } from '../hooks/useResponsiveLayout.js';
import { AssessmentLayout, SplitHeroLayout } from '../layouts/index.js';
import {
  ActionCluster,
  EmptyState,
  InfoPanel,
  JourneyStepper,
  KeyValueBlock,
  PanelHeader,
  ProgressSummary,
  QuestionPage,
  StageHero,
  StatStrip,
  SupportRail,
} from '../patterns/index.js';
import {
  Badge,
  Button,
  InlineMessage,
  ProgressBar,
  Spinner,
  SurfaceCard,
} from './ui/index.js';

const TRAINING_CHANNELS = ['WhatsApp', 'SMS', 'Paginas clonadas', 'Llamadas', 'Correo'];

const SURVEY_RULES = [
  'Responde segun tu comportamiento real.',
  'Si dudas, elige lo que harias en una situacion cotidiana.',
];

const LOADING_PIPELINE = [
  'Leemos tus respuestas.',
  'Calculamos tu perfil.',
  'Preparamos tu ruta.',
];

function shouldShowSurveyIntro({ assessment, surveyStage, surveyIndex, hasAnswers }) {
  return !assessment && surveyStage === 'survey' && surveyIndex === 0 && !hasAnswers;
}

function getSurveyScene({ surveyStage, showIntro }) {
  if (showIntro && surveyStage === 'survey') return 'intro';
  if (surveyStage === 'loading') return 'loading';
  if (surveyStage === 'results') return 'results';
  return 'survey';
}

function getStageHeroModel({ showIntro, surveyStage, surveyIndex, total, assessment, progress }) {
  if (showIntro) {
    return {
      tone: 'editorial',
      eyebrow: 'Diagnostico inicial',
      title: 'Primero entiendes el recorrido.',
      subtitle:
        'Ves que vas a contestar, que recibes al final y como se abre tu ruta.',
      meta: 'Encuesta breve, perfil claro, handoff directo a ruta',
      stripItems: [
        {
          key: 'duration',
          eyebrow: 'Duracion',
          value: '2-3 min',
          label: 'Breve y directa',
          hint: 'Una tarea principal a la vez.',
          tone: 'accent',
        },
        {
          key: 'handoff',
          eyebrow: 'Salida',
          value: 'Ruta',
          label: 'Perfil + siguiente paso',
          hint: 'No hay corte brusco al terminar.',
          tone: 'neutral',
        },
      ],
    };
  }

  if (surveyStage === 'loading') {
    return {
      tone: 'editorial',
      eyebrow: 'Procesando',
      title: 'Tus respuestas ya se convierten en perfil.',
      subtitle:
        'Esta transicion deja claro que despues viene tu perfil y la apertura de tu ruta.',
      meta: 'Analisis visible con continuidad intacta',
      stripItems: [
        {
          key: 'read',
          eyebrow: 'Lectura',
          value: 'Activa',
          label: 'Procesando respuestas',
          hint: 'Sin perder el hilo del recorrido.',
          tone: 'accent',
        },
        {
          key: 'next',
          eyebrow: 'Siguiente',
          value: 'Perfil',
          label: 'Despues se abre tu ruta',
          hint: 'La salida ya esta preparada.',
          tone: 'neutral',
        },
      ],
    };
  }

  if (surveyStage === 'results') {
    return {
      tone: 'spotlight',
      eyebrow: 'Perfil listo',
      title: 'Tu diagnostico ya tiene lectura clara.',
      subtitle:
        'El resultado se siente como puente hacia la ruta, no como cierre aislado.',
      meta: 'Perfil visible, recomendaciones claras y CTA fuerte',
      stripItems: [
        {
          key: 'level',
          eyebrow: 'Nivel',
          value: normalizeRiskLevel(assessment?.nivel || 'Medio'),
          label: 'Lectura actual',
          hint: 'Perfil directo y entendible.',
          tone: 'accent',
        },
        {
          key: 'next',
          eyebrow: 'Salida',
          value: 'Ruta',
          label: 'Siguiente paso visible',
          hint: 'Tu handoff ya no queda escondido.',
          tone: 'neutral',
        },
      ],
    };
  }

  return {
    tone: 'spotlight',
    eyebrow: `Paso ${surveyIndex + 1} de ${total}`,
    title: 'Una pregunta clara. Un siguiente paso.',
    subtitle:
      'Responde, avanza y sigue sin ruido ni bloques compitiendo.',
    meta: `${progress}% completado`,
    stripItems: [
      {
        key: 'step',
        eyebrow: 'Paso',
        value: String(surveyIndex + 1).padStart(2, '0'),
        label: `De ${total}`,
        hint: 'Una sola pregunta protagonista.',
        tone: 'accent',
      },
      {
        key: 'progress',
        eyebrow: 'Avance',
        value: `${progress}%`,
        label: 'Progreso visible',
        hint: 'El siguiente hito siempre esta claro.',
        tone: 'neutral',
      },
    ],
  };
}

function SurveyStageHero({
  shellFamily,
  showIntro,
  surveyStage,
  surveyIndex,
  total,
  progress,
  assessment,
  journeySteps,
  showJourney = false,
}) {
  const model = getStageHeroModel({
    showIntro,
    surveyStage,
    surveyIndex,
    total,
    assessment,
    progress,
  });

  const badgeText =
    surveyStage === 'loading'
      ? 'Analizando'
      : surveyStage === 'results'
        ? 'Perfil accionable'
        : showIntro
          ? 'Inicio guiado'
          : 'Encuesta guiada';

  const aside =
    surveyStage === 'results' ? (
      <div className="grid gap-2 rounded-[var(--sd-radius-lg)] border border-sd-border/70 bg-white/84 px-5 py-5">
        <p className="sd-eyebrow m-0">Nivel estimado</p>
        <strong className="sd-title m-0">
          {normalizeRiskLevel(assessment?.nivel || 'Medio')}
        </strong>
      </div>
    ) : null;

  return (
    <StageHero
      tone={model.tone}
      eyebrow={model.eyebrow}
      title={model.title}
      subtitle={model.subtitle}
      actions={<Badge tone={model.tone === 'command' ? 'soft' : 'accent'}>{badgeText}</Badge>}
      meta={model.meta}
      aside={aside}
      footer={
        <StatStrip
          items={model.stripItems}
          compact={shellFamily === 'mobile'}
          variant={model.tone === 'command' ? 'support' : 'insight'}
        />
      }
    >
      {showJourney ? <JourneyStepper steps={journeySteps} compact={shellFamily === 'mobile'} /> : null}
    </StageHero>
  );
}

function IntroActionPanel({ shellFamily, onStart }) {
  return (
    <SurfaceCard padding="lg" variant="raised" className="border-sd-border-strong">
      <div className="grid gap-6">
        <PanelHeader
          eyebrow="Antes de empezar"
          title="Sabes que va a pasar y hacia donde te va a llevar"
          subtitle="El diagnostico se usa para ordenar la ruta, no para dejarte con una conclusion suelta."
          divider
        />

        <KeyValueBlock
          items={[
            { key: 'questions', label: 'Preguntas', value: 'Breves, centradas en habitos y exposicion' },
            { key: 'result', label: 'Resultado', value: 'Perfil legible con recomendaciones claras' },
            { key: 'route', label: 'Despues', value: 'CTA directo hacia tu ruta' },
          ]}
        />

        <ActionCluster collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
          <Button variant="primary" size="lg" type="button" onClick={onStart}>
            Comenzar diagnostico
          </Button>
          <Button variant="secondary" type="button" onClick={onStart}>
            Ir a la primera pregunta
          </Button>
        </ActionCluster>
      </div>
    </SurfaceCard>
  );
}

function IntroSupportBand() {
  return (
    <SupportRail
      tone="editorial"
      eyebrow="Que vas a cubrir"
      title="Canales y riesgos que despues se traducen en tu ruta"
      subtitle="Mostramos solo el contexto necesario para empezar con criterio."
    >
      <div className="flex flex-wrap items-center gap-2">
        {TRAINING_CHANNELS.slice(0, 3).map((item) => (
          <Badge key={item} tone="neutral">
            {item}
          </Badge>
        ))}
        <span className="text-sm text-sd-text-soft">y otros escenarios cotidianos</span>
      </div>
    </SupportRail>
  );
}

function IntroScene({ shellFamily, journeySteps, onStart }) {
  return (
    <SplitHeroLayout
      shellFamily={shellFamily}
      className={
        shellFamily === 'tablet'
          ? 'md:grid-cols-[minmax(0,1.08fr)_minmax(23rem,0.92fr)]'
          : shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1.18fr)_minmax(26rem,0.88fr)] 2xl:grid-cols-[minmax(0,1.26fr)_minmax(27rem,0.84fr)]'
            : ''
      }
      hero={
        <SurveyStageHero
          shellFamily={shellFamily}
          showIntro
          surveyStage="survey"
          surveyIndex={0}
          total={journeySteps.length}
          progress={0}
          assessment={null}
          journeySteps={journeySteps}
          showJourney
        />
      }
      primary={<IntroActionPanel shellFamily={shellFamily} onStart={onStart} />}
      secondary={<IntroSupportBand />}
    />
  );
}

function SurveyCommandDeck({ shellFamily, surveyIndex, total, progress, journeySteps }) {
  return (
    <SupportRail
      tone={shellFamily === 'desktop' ? 'editorial' : 'support'}
      eyebrow="Control"
      title="Progreso claro"
      subtitle="Ves donde vas y cuanto falta, sin ruido extra."
      footer={
        <InlineMessage tone="info" title="Continuidad">
          Puedes volver atras sin perder respuestas.
        </InlineMessage>
      }
    >
      <div className="grid gap-4">
        <ProgressSummary
          eyebrow="Paso actual"
          title={`Pregunta ${surveyIndex + 1} de ${total}`}
          value={`${progress}%`}
          hint="El progreso acompana, no compite."
          progressValue={progress}
        />
        <JourneyStepper steps={journeySteps} compact />
      </div>
    </SupportRail>
  );
}

function SurveyInsightDeck({ shellFamily, question }) {
  const items = SURVEY_RULES.map((item, index) => ({
    label: `Guia ${index + 1}`,
    body: item,
  }));

  const content = (
    <InfoPanel
      as="div"
      tone="coach"
      eyebrow="Ayuda"
      title="Responde con criterio"
      subtitle="Esta guia acompana la pregunta sin invadirla."
      items={items}
      footer={
        <KeyValueBlock items={[{ key: 'format', label: 'Formato actual', value: question?.type || 'single' }]} />
      }
    />
  );

  if (shellFamily === 'mobile') {
    return (
      <details className="rounded-[24px] border border-sd-border bg-white/88 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-sd-text">
          Ver ayuda de esta pregunta
        </summary>
        <div className="mt-4">{content}</div>
      </details>
    );
  }

  return content;
}

function QuestionBoard({
  question,
  answers,
  surveyIndex,
  total,
  flowError,
  validationError,
  onAnswerChange,
  onPrev,
  onNext,
  onRestart,
}) {
  if (!question) {
    return (
      <EmptyState
        eyebrow="Encuesta"
        title="No encontramos la pregunta actual"
        body="Puedes reiniciar la encuesta y volver a tomar el flujo desde el principio."
        primaryActionLabel="Reiniciar encuesta"
        onPrimaryAction={onRestart}
      />
    );
  }

  const questionDomId = `survey-question-${question.id || surveyIndex}`;
  const flowErrorId = flowError ? `${questionDomId}-flow-error` : undefined;
  const validationErrorId = validationError ? `${questionDomId}-validation-error` : undefined;
  const questionValue =
    answers[question.id] ?? (question.type === 'multi' ? [] : '');
  const questionOptions = (question.options || []).map((option) => ({
    ...option,
    hint: option.hint || option.helper,
  }));

  return (
    <div className="grid gap-4">
      {flowError ? (
        <InlineMessage id={flowErrorId} tone="danger" title="Hay un problema en el flujo actual.">
          {flowError}
        </InlineMessage>
      ) : null}

      <QuestionPage
        id={questionDomId}
        eyebrow={`Pregunta ${String(surveyIndex + 1).padStart(2, '0')}`}
        title={question.title}
        description={question.helper}
        type={question.type}
        name={question.id || questionDomId}
        options={questionOptions}
        value={questionValue}
        onValueChange={(nextValue) => onAnswerChange(question.id, nextValue)}
        placeholder="Selecciona una opcion"
        textPlaceholder={question.placeholder || 'Escribe aqui...'}
        error={validationError}
        errorId={validationErrorId}
        errorTitle="Falta completar esta pregunta."
        required
        aria-describedby={flowErrorId}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-sd-border-soft pt-5">
            <Button
              variant="secondary"
              type="button"
              onClick={onPrev}
              disabled={surveyIndex === 0}
            >
              Atras
            </Button>
            <Button variant="primary" type="button" onClick={onNext}>
              {surveyIndex === total - 1 ? 'Finalizar y ver perfil' : 'Guardar y seguir'}
            </Button>
          </div>
        }
      />
    </div>
  );
}

function SurveyStageScene({
  shellFamily,
  answers,
  visibleQuestions,
  surveyIndex,
  progress,
  flowError,
  validationError,
  journeySteps,
  onAnswerChange,
  onPrev,
  onNext,
  onRestart,
}) {
  const question = visibleQuestions[surveyIndex];
  const total = visibleQuestions.length || 1;

  return (
    <AssessmentLayout
      shellFamily={shellFamily}
      hero={
        <SurveyStageHero
          shellFamily={shellFamily}
          showIntro={false}
          surveyStage="survey"
          surveyIndex={surveyIndex}
          total={total}
          progress={progress}
          assessment={null}
          journeySteps={journeySteps}
        />
      }
      progress={
        <SurveyCommandDeck
          shellFamily={shellFamily}
          surveyIndex={surveyIndex}
          total={total}
          progress={progress}
          journeySteps={journeySteps}
        />
      }
      question={
        <QuestionBoard
          question={question}
          answers={answers}
          surveyIndex={surveyIndex}
          total={total}
          flowError={flowError}
          validationError={validationError}
          onAnswerChange={onAnswerChange}
          onPrev={onPrev}
          onNext={onNext}
          onRestart={onRestart}
        />
      }
      insight={<SurveyInsightDeck shellFamily={shellFamily} question={question} />}
    />
  );
}

function LoadingPrimaryPanel() {
  return (
    <SurfaceCard padding="lg" variant="raised" className="border-sd-border-strong">
      <div className="grid gap-6">
        <PanelHeader
          eyebrow="Procesamiento visible"
          title="El sistema esta convirtiendo respuestas en perfil y ruta"
          subtitle="Mostramos el paso para que la espera se sienta intencional y clara."
          divider
        />

        <SurfaceCard
          padding="md"
          variant="command"
          tone="inverse"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-start gap-4">
            <Spinner size="lg" />
            <div className="grid gap-2">
              <strong className="sd-heading-sm m-0">Analizando respuestas</strong>
              <p className="sd-copy-sm m-0">
                Conectamos habitos, exposicion y prioridad para abrir tu perfil.
              </p>
            </div>
          </div>
          <ProgressBar value={72} className="mt-5" />
        </SurfaceCard>

        <div className="grid gap-3">
          {LOADING_PIPELINE.map((step, index) => (
            <div key={step} className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-[22px] border border-sd-border bg-sd-surface-subtle px-4 py-4">
              <span className="text-sm font-semibold text-sd-text-soft">{String(index + 1).padStart(2, '0')}</span>
              <p className="m-0 text-sm leading-6 text-sd-text">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}

function LoadingSupportBand() {
  return (
    <SupportRail
      tone="support"
      eyebrow="Continuidad"
      title="Nada de esto rompe el recorrido"
      subtitle="Tus respuestas ya estan dentro del flujo y el siguiente paso sigue siendo tu ruta."
    >
      <KeyValueBlock
        items={[
          { key: 'answers', label: 'Respuestas', value: 'Ya quedaron registradas en este flujo' },
          { key: 'profile', label: 'Perfil', value: 'Se esta armando ahora mismo' },
          { key: 'route', label: 'Despues', value: 'Veras tu CTA a ruta en cuanto termine' },
        ]}
      />
    </SupportRail>
  );
}

function LoadingScene({ shellFamily, journeySteps }) {
  return (
    <SplitHeroLayout
      shellFamily={shellFamily}
      className={
        shellFamily === 'tablet'
          ? 'md:grid-cols-[minmax(0,1.08fr)_minmax(23rem,0.92fr)]'
          : shellFamily === 'desktop'
            ? 'xl:grid-cols-[minmax(0,1.18fr)_minmax(26rem,0.88fr)] 2xl:grid-cols-[minmax(0,1.26fr)_minmax(27rem,0.84fr)]'
            : ''
      }
      hero={
        <SurveyStageHero
          shellFamily={shellFamily}
          showIntro={false}
          surveyStage="loading"
          surveyIndex={0}
          total={journeySteps.length}
          progress={72}
          assessment={null}
          journeySteps={journeySteps}
          showJourney={false}
        />
      }
      primary={<LoadingPrimaryPanel />}
      secondary={<LoadingSupportBand />}
    />
  );
}

function ResultsCommandDeck({ shellFamily, assessment, resultLead }) {
  const resultLevel = normalizeRiskLevel(assessment?.nivel || 'Medio');
  const resultSummary = assessment?.resumen || resultLead;

  return (
    <SupportRail
      tone={shellFamily === 'desktop' ? 'support' : 'editorial'}
      sticky={shellFamily === 'desktop'}
      eyebrow="Perfil actual"
      title={resultLevel}
      subtitle={resultSummary}
    >
      <div className="grid gap-4">
        <ProgressSummary
          eyebrow="Resultado"
          title="Perfil accionable"
          value={resultLevel}
          hint="Ya no es un cierre ambiguo: ahora empuja a la ruta."
          progressValue={100}
          variant="support"
          tone="accent"
        />
        <KeyValueBlock
          items={[
            {
              key: 'perfil',
              label: 'Perfil',
              value: resultLevel,
            },
            {
              key: 'salida',
              label: 'Siguiente paso',
              value: 'Abrir tu ruta personalizada.',
            },
          ]}
        />
      </div>
    </SupportRail>
  );
}

function ResultsMainDeck({ assessment, resultLead }) {
  const recommendations = Array.isArray(assessment?.recomendaciones) ? assessment.recomendaciones : [];

  return (
    <SurfaceCard padding="lg" variant="raised" className="border-sd-border-strong">
      <div className="grid gap-6">
        <PanelHeader
          eyebrow="Diagnostico"
          title="Lo que vimos en tus respuestas"
          subtitle={resultLead}
          divider
        />

        {recommendations.length ? (
          <ol className="m-0 grid list-none gap-3 p-0">
            {recommendations.map((item, index) => (
              <li key={`${item}-${index}`} className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-[22px] border border-sd-border bg-sd-surface-subtle px-4 py-4">
                <span className="text-sm font-semibold text-sd-text-soft">{String(index + 1).padStart(2, '0')}</span>
                <p className="m-0 text-sm leading-6 text-sd-text">{item}</p>
              </li>
            ))}
          </ol>
        ) : (
          <InlineMessage tone="info" title="Todavia no hay recomendaciones visibles.">
            El perfil sigue listo para continuar a la ruta.
          </InlineMessage>
        )}
      </div>
    </SurfaceCard>
  );
}

function ResultsRouteRail({ shellFamily, assessment, courseError, onTakeCourses, onRestart }) {
  const nextSteps = Array.isArray(assessment?.proximos_pasos) ? assessment.proximos_pasos : [];
  const routeSummaryId = 'survey-results-route-summary';
  const routeErrorId = courseError ? 'survey-results-route-error' : undefined;
  const ctaDescription = courseError
    ? `${routeSummaryId} ${routeErrorId}`
    : routeSummaryId;

  return (
    <SupportRail
      tone={shellFamily === 'desktop' ? 'support' : 'editorial'}
      sticky={shellFamily === 'desktop'}
      eyebrow="Siguiente paso"
      title="Tu ruta ya esta lista para abrirse"
      subtitle="El handoff final vive aqui con claridad y prioridad."
    >
      {courseError ? (
        <InlineMessage id={routeErrorId} tone="danger" title="No pudimos abrir tu ruta todavia.">
          {courseError}
        </InlineMessage>
      ) : null}

      <div className="grid gap-4">
        <p id={routeSummaryId} className="sd-copy-sm m-0">
          Mantienes tu perfil y respuestas; el siguiente paso abre la pantalla de cursos con este contexto.
        </p>
        <ActionCluster collapse={shellFamily === 'mobile' ? 'stack' : 'wrap'}>
          <Button
            variant="primary"
            size="lg"
            type="button"
            onClick={onTakeCourses}
            aria-describedby={ctaDescription}
          >
            {courseError ? 'Intentar abrir mi ruta de nuevo' : 'Ver mi ruta'}
          </Button>
          <Button variant="secondary" type="button" onClick={onRestart}>
            Reiniciar encuesta
          </Button>
        </ActionCluster>
      </div>

      {nextSteps.length ? (
        <div className="grid gap-3">
          {nextSteps.slice(0, 2).map((step, index) => (
            <SurfaceCard key={`${step.titulo || step.title || 'step'}-${index}`} padding="compact" variant="subtle">
              <strong className="block text-sm text-sd-text">
                {step.titulo || step.title || `Paso ${index + 1}`}
              </strong>
              <p className="mt-2 mb-0 text-sm leading-6 text-sd-muted">
                {step.descripcion || step.description || 'Seguimos con el siguiente bloque recomendado.'}
              </p>
            </SurfaceCard>
          ))}
        </div>
      ) : (
        <InlineMessage tone="info" title="La ruta sigue lista para abrirse.">
          Puedes continuar al modulo recomendado sin perder contexto.
        </InlineMessage>
      )}
    </SupportRail>
  );
}

function ResultsScene({
  shellFamily,
  assessment,
  resultLead,
  courseError,
  journeySteps,
  onTakeCourses,
  onRestart,
}) {
  return (
    <AssessmentLayout
      shellFamily={shellFamily}
      hero={
        <SurveyStageHero
          shellFamily={shellFamily}
          showIntro={false}
          surveyStage="results"
          surveyIndex={0}
          total={journeySteps.length}
          progress={100}
          assessment={assessment}
          journeySteps={journeySteps}
          showJourney={false}
        />
      }
      progress={
        <ResultsCommandDeck
          shellFamily={shellFamily}
          assessment={assessment}
          resultLead={resultLead}
        />
      }
      question={<ResultsMainDeck assessment={assessment} resultLead={resultLead} />}
      insight={
        <ResultsRouteRail
          shellFamily={shellFamily}
          assessment={assessment}
          courseError={courseError}
          onTakeCourses={onTakeCourses}
          onRestart={onRestart}
        />
      }
    />
  );
}

export default function SurveyView({
  viewport = 'desktop',
  currentView = 'survey',
  answers,
  visibleQuestions,
  surveyIndex,
  surveyStage,
  assessment,
  courseError,
  resultLead,
  validationError,
  flowError,
  onAnswerChange,
  onPrev,
  onNext,
  onRestart,
  onTakeCourses,
}) {
  const shellFamily = getShellFamily(viewport);
  const total = visibleQuestions.length || 1;
  const progress = Math.round(((surveyIndex + 1) / total) * 100);
  const hasAnswers = useMemo(
    () =>
      Object.values(answers || {}).some((value) =>
        Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim())
      ),
    [answers]
  );
  const canShowIntro = shouldShowSurveyIntro({
    assessment,
    surveyStage,
    surveyIndex,
    hasAnswers,
  });
  const introResetPendingRef = useRef(false);

  const [showIntro, setShowIntro] = useState(() => canShowIntro);

  const journeySteps = useMemo(
    () =>
      buildJourneyProgress({
        currentView,
        surveyStage,
        hasAssessment: Boolean(assessment),
        hasCoursePlan: false,
      }),
    [assessment, currentView, surveyStage]
  );

  useEffect(() => {
    if (surveyStage !== 'survey' || assessment) {
      introResetPendingRef.current = true;
      setShowIntro(false);
      return;
    }

    if (canShowIntro && introResetPendingRef.current) {
      introResetPendingRef.current = false;
      setShowIntro(true);
      return;
    }

    if (!canShowIntro) {
      introResetPendingRef.current = false;
      setShowIntro(false);
    }
  }, [assessment, canShowIntro, surveyStage]);

  const activeSurveyScene = getSurveyScene({
    surveyStage,
    showIntro: canShowIntro && showIntro,
  });
  const handleStartSurvey = () => setShowIntro(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [showIntro, surveyIndex, surveyStage]);

  return (
    <section
      id="surveyView"
      className="sd-page-shell py-[var(--sd-shell-padding-block)]"
      data-sd-container="true"
    >
      {activeSurveyScene === 'intro' ? (
        <IntroScene shellFamily={shellFamily} journeySteps={journeySteps} onStart={handleStartSurvey} />
      ) : null}

      {activeSurveyScene === 'survey' ? (
        <SurveyStageScene
          shellFamily={shellFamily}
          answers={answers}
          visibleQuestions={visibleQuestions}
          surveyIndex={surveyIndex}
          progress={progress}
          flowError={flowError}
          validationError={validationError}
          journeySteps={journeySteps}
          onAnswerChange={onAnswerChange}
          onPrev={onPrev}
          onNext={onNext}
          onRestart={onRestart}
        />
      ) : null}

      {activeSurveyScene === 'loading' ? (
        <LoadingScene shellFamily={shellFamily} journeySteps={journeySteps} />
      ) : null}

      {activeSurveyScene === 'results' ? (
        <ResultsScene
          shellFamily={shellFamily}
          assessment={assessment}
          resultLead={resultLead}
          courseError={courseError}
          journeySteps={journeySteps}
          onTakeCourses={onTakeCourses}
          onRestart={onRestart}
        />
      ) : null}
    </section>
  );
}
