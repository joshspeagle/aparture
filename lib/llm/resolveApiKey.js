// Resolve an API key for a Phase 1/1.5 API route.
// Accepts either a client-supplied key (BYOK path) or a password that is
// validated against ACCESS_PASSWORD and swapped for the server-side env-var
// key for the requested provider.
//
// Returns { apiKey } on success, or { error, status } on auth failure.

const PROVIDER_ENV_KEYS = {
  anthropic: 'CLAUDE_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
  openai: 'OPENAI_API_KEY',
};

export function resolveApiKey({ clientApiKey, password, provider }) {
  if (clientApiKey) {
    return { apiKey: clientApiKey };
  }
  if (!password) {
    return { apiKey: null };
  }
  if (password !== process.env.ACCESS_PASSWORD) {
    return { error: 'invalid password', status: 401 };
  }
  const envKey = PROVIDER_ENV_KEYS[provider];
  const apiKey = envKey ? process.env[envKey] : null;
  return { apiKey: apiKey ?? null };
}
