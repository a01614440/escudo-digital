export const apiRequest = async (
  path,
  { method = 'POST', payload, includeAuth = true, authToken = '' } = {}
) => {
  const headers = {};
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (includeAuth && authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(path, {
    method,
    headers,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error || 'Error al conectar con el servidor.';
    const status = error.status ? ` (status ${error.status})` : '';
    throw new Error(`${message}${status}`);
  }

  return response.json().catch(() => ({}));
};

export const postJson = (path, payload, options = {}) =>
  apiRequest(path, { ...options, method: 'POST', payload });
