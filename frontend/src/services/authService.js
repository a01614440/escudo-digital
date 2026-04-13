import { apiRequest } from '../lib/api.js';

export function loginUser({ email, password }) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    payload: { email, password },
    includeAuth: false,
  });
}

export function registerUser({ email, password }) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    payload: { email, password },
    includeAuth: false,
  });
}

export function restoreSession(authToken) {
  return apiRequest('/api/auth/session', {
    method: 'GET',
    authToken,
  });
}

export function logoutSession(authToken) {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
    payload: {},
    authToken,
  });
}
