import { useEffect, useRef } from 'react';
import { saveUserState } from '../services/progressService.js';

export function useRemoteProgressSync({ currentUser, authToken, statePayload, onUserRefresh }) {
  const suspendSyncRef = useRef(true);
  const syncTimerRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const latestPayloadRef = useRef(statePayload);

  latestPayloadRef.current = statePayload;

  const pauseSync = () => {
    suspendSyncRef.current = true;
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  const resumeSync = () => {
    window.setTimeout(() => {
      suspendSyncRef.current = false;
    }, 0);
  };

  const runRemoteSync = async () => {
    if (!currentUser || !authToken || suspendSyncRef.current) return;

    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    try {
      const response = await saveUserState(latestPayloadRef.current, authToken);
      if (response?.user) onUserRefresh?.(response.user);
    } catch (error) {
      console.warn('No se pudo sincronizar el progreso:', error.message);
    } finally {
      syncInFlightRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        runRemoteSync();
      }
    }
  };

  useEffect(() => {
    if (!currentUser || !authToken || suspendSyncRef.current) return undefined;

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(() => {
      runRemoteSync();
    }, 350);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [authToken, currentUser, statePayload]);

  return {
    pauseSync,
    resumeSync,
  };
}
