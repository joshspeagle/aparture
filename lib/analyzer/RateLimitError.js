// Client-side typed error for rate-limit (HTTP 429) and overloaded (503)
// responses from the LLM-backed API routes. Carries the provider's
// Retry-After hint (ms) so makeRobustAPICall can sleep for the right
// duration AND signal the per-provider LLMRateLimitBarrier so concurrent
// workers pause too.

export class RateLimitError extends Error {
  constructor({ provider, status, retryAfterMs, message }) {
    super(message ?? `${provider}: rate limited (${status})`);
    this.name = 'RateLimitError';
    this.provider = provider;
    this.status = status;
    this.retryAfterMs = retryAfterMs ?? null;
  }
}

// Read a non-OK route response and throw a typed error. Used by every
// pipeline stage's `if (!response.ok)` branch so error surfacing is uniform.
//
// 429/503 → RateLimitError (carries provider + retryAfterMs from the route's
// structured body, populated by sendProviderErrorResponse upstream).
// All other statuses → plain Error with the route's `details` string —
// which now contains the actual provider message ("google: invalid argument",
// "anthropic: prompt too long") instead of the bare "Failed to filter papers"
// from the legacy generic 500 catch.
export async function parseRouteError(response, fallbackProvider) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — keep the empty object; status code below provides context.
  }

  const provider = body.provider ?? fallbackProvider ?? 'llm';

  if (response.status === 429 || response.status === 503) {
    const retryAfterMs = body.retryAfterMs ?? null;
    const suffix = retryAfterMs
      ? ` — retry in ${Math.max(1, Math.round(retryAfterMs / 1000))}s`
      : '';
    throw new RateLimitError({
      provider,
      status: response.status,
      retryAfterMs,
      message: `${provider}: rate limited (${response.status})${suffix}`,
    });
  }

  // Prefer details (the actual provider message) over the route's `error`
  // (which is a generic "Failed to filter papers" string for legacy callers).
  const message = body.details || body.error || `${provider} request failed (${response.status})`;
  throw new Error(message);
}
