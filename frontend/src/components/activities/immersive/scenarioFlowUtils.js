export function resolveScenarioNextStepIndex({
  steps,
  stepIndex,
  requestedNext,
  answeredIndexes,
}) {
  if (!steps.length) return 0;

  const answeredSet = new Set(answeredIndexes);
  const numericNext = Number(requestedNext);
  if (
    Number.isInteger(numericNext) &&
    numericNext >= 0 &&
    numericNext < steps.length &&
    !answeredSet.has(numericNext)
  ) {
    return numericNext;
  }

  for (let index = stepIndex + 1; index < steps.length; index += 1) {
    if (!answeredSet.has(index)) return index;
  }

  for (let index = 0; index < steps.length; index += 1) {
    if (!answeredSet.has(index)) return index;
  }

  return steps.length;
}

export function countSafeChoices(scores) {
  return scores.filter((value) => value >= 0.8).length;
}
