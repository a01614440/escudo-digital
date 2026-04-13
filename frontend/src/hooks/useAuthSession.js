import { useEffect, useRef, useState } from 'react';
import { readSessionToken, writeSessionToken } from '../lib/storage.js';
import {
  loginUser,
  logoutSession,
  registerUser,
  restoreSession,
} from '../services/authService.js';

export function useAuthSession({ onAuthenticated, onResetAfterLogout }) {
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(Boolean(readSessionToken()));
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(readSessionToken());
  const skipNextRestoreRef = useRef(false);
  const authenticatedRef = useRef(onAuthenticated);
  const resetRef = useRef(onResetAfterLogout);

  useEffect(() => {
    authenticatedRef.current = onAuthenticated;
    resetRef.current = onResetAfterLogout;
  }, [onAuthenticated, onResetAfterLogout]);

  const setSession = (token, user) => {
    setAuthToken(token || '');
    setCurrentUser(user || null);
    writeSessionToken(token || '');
  };

  const handleAuthSuccess = (data) => {
    skipNextRestoreRef.current = true;
    setSession(data.token, data.user);
    setAuthPassword('');
    setAuthError('');
    authenticatedRef.current?.(data.user, data.state || {});
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!authEmail.trim() || !authPassword) return;

    setAuthSubmitting(true);
    setAuthError('');

    try {
      const response =
        authMode === 'login'
          ? await loginUser({ email: authEmail.trim(), password: authPassword })
          : await registerUser({ email: authEmail.trim(), password: authPassword });
      handleAuthSuccess(response);
    } catch (error) {
      setAuthError(error.message || 'No se pudo iniciar sesión.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (authToken) {
        await logoutSession(authToken);
      }
    } catch {
      // ignore
    }

    setSession('', null);
    setAuthMode('login');
    resetRef.current?.();
  };

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      if (!authToken) {
        setSessionLoading(false);
        return;
      }

      if (skipNextRestoreRef.current) {
        skipNextRestoreRef.current = false;
        setSessionLoading(false);
        return;
      }

      try {
        const response = await restoreSession(authToken);
        if (cancelled) return;
        setCurrentUser(response.user);
        authenticatedRef.current?.(response.user, response.state || {}, { restored: true });
      } catch (error) {
        if (cancelled) return;
        console.warn('Sesión previa no disponible:', error.message);
        setSession('', null);
        setAuthMode('login');
        resetRef.current?.();
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  return {
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authError,
    authSubmitting,
    sessionLoading,
    currentUser,
    setCurrentUser,
    authToken,
    handleAuthSubmit,
    handleLogout,
  };
}
