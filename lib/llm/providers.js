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
    // Gemini uses per-model URLs; callModel constructs the final URL
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKeyQueryParam: 'key',
  },
};

export function getProviderConfig(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Unknown provider: ${provider}`);
  return cfg;
}
