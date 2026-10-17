// Syntactic plausibility of a client-supplied provider API key.
//
// The shared route auth (lib/llm/resolveRouteAuth.js) lets ANY non-empty
// `apiKey` skip the ACCESS_PASSWORD gate — that is the BYOK path, and the
// provider rejects a bogus key on the first LLM call. That is fine for routes
// whose only side effect IS the LLM call, but not for routes that do local
// work first: /api/analyze-pdf downloads an arXiv PDF through the shared
// throttle and may launch headless Chromium before the key is ever used. Such
// routes require either the valid password or a key that at least has the
// provider's published shape. (A shape check is not authentication; binding
// the dev server to 127.0.0.1 is what keeps the LAN out.)

const KEY_SHAPES = {
  // sk-ant-api03-… (Console keys)
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  // sk-proj-…, sk-svcacct-…, and legacy sk-…
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  // Google AI Studio keys: "AIza" + 35 chars
  google: /^AIza[0-9A-Za-z_-]{30,}$/,
};

export function isPlausibleApiKey(provider, apiKey) {
  const shape = KEY_SHAPES[String(provider ?? '').toLowerCase()];
  return Boolean(shape) && typeof apiKey === 'string' && shape.test(apiKey.trim());
}
