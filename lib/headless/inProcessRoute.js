// Invoke a Next.js API route handler in-process, without an HTTP server.
//
// The headless runner (bin/aparture.mjs) and the agent skill reuse the exact
// route code the web app talks to — same auth gate, same upstream politeness
// (User-Agent, From header, timeouts, 5xx→429 rewrite) — by calling the
// handler directly with a minimal req/res pair.

export async function invokeRoute(handler, { method = 'POST', body = {}, query = {} } = {}) {
  let status = 200;
  let payload;
  const headers = {};
  const res = {
    status(code) {
      status = code;
      return res;
    },
    json(obj) {
      payload = obj;
      return res;
    },
    send(obj) {
      payload = obj;
      return res;
    },
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    end() {
      return res;
    },
  };
  await handler({ method, body, query, headers: {} }, res);
  return { status, body: payload, headers };
}

// A fetch()-shaped wrapper over invokeRoute, for library code that takes a
// `fetchImpl` and POSTs JSON to a route path (lib/arxiv's drivers do).
export function createRouteFetch(routes) {
  return async function routeFetch(path, init = {}) {
    const handler = routes[path];
    if (!handler) throw new Error(`headless: no in-process route for ${path}`);
    const body = init.body ? JSON.parse(init.body) : {};
    const out = await invokeRoute(handler, { method: init.method ?? 'GET', body });
    return {
      ok: out.status >= 200 && out.status < 300,
      status: out.status,
      headers: { get: (name) => out.headers[name.toLowerCase()] ?? null },
      json: async () => out.body,
      text: async () => (typeof out.body === 'string' ? out.body : JSON.stringify(out.body)),
    };
  };
}
