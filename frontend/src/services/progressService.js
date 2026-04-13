import { apiRequest } from '../lib/api.js';

export function saveUserState(payload, authToken) {
  return apiRequest('/api/user/state', {
    method: 'POST',
    payload,
    authToken,
  });
}

export function fetchAdminAnalytics(authToken) {
  return apiRequest('/api/admin/analytics', {
    method: 'GET',
    authToken,
  });
}

export function downloadAnalyticsSnapshot(analytics) {
  if (!analytics) return;

  const blob = new Blob([JSON.stringify(analytics, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `escudo-analytics-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
