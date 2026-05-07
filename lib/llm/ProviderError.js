// Typed error thrown by lib/llm/callModel.js when an LLM provider returns
// a non-2xx response. Preserves HTTP status, the raw provider error body,
// and a parsed retryAfterMs (when the provider tells us how long to wait)
// end-to-end through the API route catch + client error handler — so users
// see "google: RESOURCE_EXHAUSTED" instead of the bare "Failed to filter
// papers", and so the rate-limit barrier can pause the whole worker pool
// for the right duration.
//
// Pattern: route's catch checks `error instanceof ProviderError`, returns
// `res.status(error.status).json({error, retryAfterMs, details, provider})`.
// Client's `if (!response.ok)` branch reads `data.retryAfterMs` and throws
// a RateLimitError when status is 429 or 503.

export class ProviderError extends Error {
  constructor({ provider, status, providerErrorBody, retryAfterMs, message }) {
    super(message ?? `${provider} request failed (${status})`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
    this.providerErrorBody = providerErrorBody;
    this.retryAfterMs = retryAfterMs ?? null;
  }
}

// Route-helper: returns true if the error was a ProviderError and was
// translated into an HTTP response. Callers fall through to their generic
// 500 catch when this returns false.
export function sendProviderErrorResponse(res, error) {
  if (!(error instanceof ProviderError)) return false;
  res.status(error.status).json({
    error: error.message,
    retryAfterMs: error.retryAfterMs ?? null,
    details: error.providerErrorBody ?? error.message,
    provider: error.provider,
  });
  return true;
}
