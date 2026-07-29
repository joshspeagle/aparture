// Client-side typed error for provider content refusals (HTTP 422 +
// `code: 'CONTENT_REFUSAL'` from any LLM-backed route). The server-side
// counterpart is RefusalError in lib/llm/RefusalError.js.
//
// Mirrors the ProviderError → RateLimitError split: routes speak HTTP, the
// pipeline speaks typed errors.
//
// The load-bearing property is that a refusal is **deterministic**. Unlike a
// 429 or a malformed-JSON response, re-sending the identical prompt to the
// identical classifier returns the identical refusal, so makeRobustAPICall
// short-circuits on this error rather than spending `maxRetries` attempts
// (and the tokens for each) proving the point. That mirrors the existing
// PLAYWRIGHT_UNAVAILABLE_RECAPTCHA short-circuit.

export class ContentRefusalError extends Error {
  constructor({ provider, model, category, raw, details, message }) {
    super(message ?? `${provider} declined this request (${category ?? 'unknown'})`);
    this.name = 'ContentRefusalError';
    // Sentinel used by makeRobustAPICall's short-circuit and by the stage
    // catches. Matches the `error.code` convention the reCAPTCHA skip uses,
    // so both survive being re-wrapped in a generic Error by intermediate
    // layers (the code is also embedded in the message for that case).
    this.code = 'CONTENT_REFUSAL';
    this.provider = provider ?? 'llm';
    this.model = model ?? null;
    this.category = category ?? 'unknown';
    this.raw = raw ?? null;
    this.details = details ?? null;
  }
}

// True for both a real ContentRefusalError and a generic Error that wrapped
// one (makeRobustAPICall stringifies the last error after exhausting its
// ladder, and some stages re-throw with added context).
export function isContentRefusal(error) {
  if (!error) return false;
  if (error.code === 'CONTENT_REFUSAL') return true;
  return typeof error.message === 'string' && error.message.includes('CONTENT_REFUSAL');
}
