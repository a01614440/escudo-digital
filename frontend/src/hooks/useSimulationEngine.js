import { useEffect, useRef } from 'react';

export function useSimulationEngine({ moduleId, activityId }) {
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activityId, moduleId]);

  return { startedAtRef };
}
