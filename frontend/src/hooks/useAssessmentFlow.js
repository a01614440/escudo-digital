import { useEffect, useMemo, useState } from 'react';
import {
  coerceSurveyIndex,
  deriveSurveyStage,
  getVisibleQuestions,
  isSurveyAnswerValid,
} from '../lib/courseRules.js';
import { requestAssessment } from '../services/courseService.js';

export function useAssessmentFlow({
  initialAnswers = {},
  initialAssessment = null,
  onAssessmentReady,
  onResetJourney,
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [assessment, setAssessment] = useState(initialAssessment);
  const [surveyStage, setSurveyStage] = useState(initialAssessment ? 'results' : 'survey');
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [flowError, setFlowError] = useState('');

  const visibleQuestions = useMemo(() => getVisibleQuestions(answers), [answers]);

  useEffect(() => {
    if (surveyIndex > visibleQuestions.length - 1) {
      setSurveyIndex(Math.max(visibleQuestions.length - 1, 0));
    }
  }, [surveyIndex, visibleQuestions.length]);

  const applyRemoteSurveyState = (state = {}) => {
    const safeAnswers = state?.answers && typeof state.answers === 'object' ? state.answers : {};
    setAnswers(safeAnswers);
    setAssessment(state?.assessment || null);
    setSurveyStage(deriveSurveyStage(state));
    setSurveyIndex(coerceSurveyIndex(state?.surveyIndex, safeAnswers));
    setValidationError('');
    setFlowError('');
  };

  const resetSurveyState = () => {
    setAnswers({});
    setAssessment(null);
    setSurveyStage('survey');
    setSurveyIndex(0);
    setValidationError('');
    setFlowError('');
  };

  const handleAnswerChange = (questionId, value) => {
    setValidationError('');
    setFlowError('');
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const handleSurveyPrevious = () => {
    setValidationError('');
    setFlowError('');
    setSurveyIndex((current) => Math.max(0, current - 1));
  };

  const handleSurveyNext = async () => {
    const question = visibleQuestions[surveyIndex];
    if (!isSurveyAnswerValid(question, answers)) {
      setValidationError('Completa esta respuesta antes de avanzar.');
      return;
    }

    setValidationError('');
    setFlowError('');

    if (surveyIndex < visibleQuestions.length - 1) {
      setSurveyIndex((current) => current + 1);
      return;
    }

    setSurveyStage('loading');

    try {
      const response = await requestAssessment(answers);
      setAssessment(response);
      setSurveyStage('results');
      onAssessmentReady?.(response, answers);
    } catch (error) {
      setSurveyStage('survey');
      setFlowError(
        error.message ||
          'No pudimos generar tu diagnóstico por ahora. Puedes volver a intentarlo con "Finalizar" en unos segundos.'
      );
    }
  };

  const handleSurveyRestart = () => {
    resetSurveyState();
    onResetJourney?.();
  };

  return {
    answers,
    setAnswers,
    assessment,
    setAssessment,
    surveyStage,
    setSurveyStage,
    surveyIndex,
    setSurveyIndex,
    visibleQuestions,
    validationError,
    flowError,
    applyRemoteSurveyState,
    resetSurveyState,
    handleAnswerChange,
    handleSurveyPrevious,
    handleSurveyNext,
    handleSurveyRestart,
  };
}
