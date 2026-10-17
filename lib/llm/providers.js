export const PROVIDERS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    apiKeyHeader: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
  },
  google: {
    // Gemini uses per-model URLs; the adapter builds the final URL. The key
    // travels in a header rather than the `?key=` query parameter so it
    // stays out of URLs, proxy logs and error messages.
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKeyHeader: 'x-goog-api-key',
  },
};

export function getProviderConfig(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);
  return cfg;
}
