const DEFAULT_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type, x-environment',
  'content-type': 'application/json'
};

export function jsonResponse(body, init = {}) {
  const headers = new Headers(DEFAULT_HEADERS);
  if (init.headers) {
    const overrides = new Headers(init.headers);
    overrides.forEach((value, key) => headers.set(key, value));
  }
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), { ...init, status, headers });
}

export function methodNotAllowed(method) {
  return jsonResponse({ error: `Method ${method} is not allowed` }, { status: 405 });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: DEFAULT_HEADERS
  });
}

export function internalError(message, details) {
  return jsonResponse({ error: message, details }, { status: 500 });
}

export function badRequest(message, details) {
  return jsonResponse({ error: message, details }, { status: 400 });
}
