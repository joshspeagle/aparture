import { ContentRefusalError } from './ContentRefusalError.js';

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

// Client-side typed error for deterministic route failures: a bad or missing
// key (401/403), an unknown model or malformed request (400/404), an
// oversized request (413), or a 422 other than the two typed sentinels
// (CONTENT_REFUSAL here, PLAYWRIGHT_UNAVAILABLE_RECAPTCHA in analyzePDFs).
// Re-sending the identical request gets the identical answer, so
// makeRobustAPICall fails fast on `retryable === false` instead of spending
// maxRetries+1 attempts (with backoff) proving the point.
export class NonRetryableRouteError extends Error {
  constructor({ provider, status, message }) {
    super(message ?? `${provider} request failed (${status})`);
    this.name = 'NonRetryableRouteError';
    this.provider = provider;
    this.status = status;
    this.retryable = false;
  }
}

export const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 413, 422]);

// 429 (rate limited), 503 (unavailable) and Anthropic's 529 (overloaded) all
// mean "back off and try again": typed as RateLimitError so the per-provider
// barrier pauses every sibling worker and Retry-After is honored.
export const RATE_LIMIT_STATUSES = new Set([429, 503, 529]);

export function isNonRetryableError(error) {
  return error?.retryable === false;
}

// Providers return their error as a JSON body ({error: {message}} for
// Anthropic, OpenAI and Google alike), which routes forward verbatim as
// `details`. Surface the human message rather than the raw JSON blob.
function providerMessageFrom(details, provider) {
  if (typeof details !== 'string') return null;
  const trimmed = details.trim();
  if (!trimmed.startsWith('{')) return details;
  try {
    const parsed = JSON.parse(trimmed);
    const inner = parsed?.error?.message ?? parsed?.message;
    if (typeof inner === 'string' && inner.trim()) return `${provider}: ${inner.trim()}`;
  } catch {
    // Not JSON after all — fall through to the raw string.
  }
  return details;
}

// Read a non-OK route response and throw a typed error. Used by every
// pipeline stage's `if (!response.ok)` branch so error surfacing is uniform.
//
// 422 + code CONTENT_REFUSAL → ContentRefusalError (a safety classifier
// declined; deterministic, so callers must skip rather than retry).
// 429/503/529 → RateLimitError (carries provider + retryAfterMs from the
// route's structured body, populated by sendProviderErrorResponse upstream).
// 400/401/403/404/413/other 422 → NonRetryableRouteError (fail fast).
// All other statuses → plain Error (retried) with the route's `details`
// string — which contains the actual provider message ("google: invalid
// argument", "anthropic: prompt too long") instead of the bare "Failed to
// filter papers" from the legacy generic 500 catch.
export async function parseRouteError(response, fallbackProvider) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON body — keep the empty object; status code below provides context.
  }

  const provider = body.provider ?? fallbackProvider ?? 'llm';

  // Content refusal: HTTP 422 + a code discriminator (the 422 status is
  // shared with PLAYWRIGHT_UNAVAILABLE_RECAPTCHA, so the code is what
  // distinguishes them). Typed separately from RateLimitError because the
  // handling is opposite: rate limits want a backoff-and-retry, refusals are
  // deterministic and must not be retried at all.
  if (response.status === 422 && body.code === 'CONTENT_REFUSAL') {
    throw new ContentRefusalError({
      provider,
      model: body.model ?? null,
      category: body.category ?? null,
      raw: body.raw ?? null,
      details: body.details ?? null,
      message: body.error || `${provider} declined this request`,
    });
  }

  if (RATE_LIMIT_STATUSES.has(response.status)) {
    const retryAfterMs = body.retryAfterMs ?? null;
    const suffix = retryAfterMs
      ? ` — retry in ${Math.max(1, Math.round(retryAfterMs / 1000))}s`
      : '';
    const what = response.status === 529 ? 'overloaded' : 'rate limited';
    throw new RateLimitError({
      provider,
      status: response.status,
      retryAfterMs,
      message: `${provider}: ${what} (${response.status})${suffix}`,
    });
  }

  // Prefer details (the actual provider message) over the route's `error`
  // (which is a generic "Failed to filter papers" string for legacy callers).
  const message =
    providerMessageFrom(body.details, provider) ||
    body.error ||
    `${provider} request failed (${response.status})`;

  if (NON_RETRYABLE_STATUSES.has(response.status)) {
    throw new NonRetryableRouteError({ provider, status: response.status, message });
  }

  const err = new Error(message);
  err.status = response.status;
  throw err;
}
