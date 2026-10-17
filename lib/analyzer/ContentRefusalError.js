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

const STAGE_LABELS = {
  filter: 'filter',
  scoring: 'scoring',
  postProcessing: 'score post-processing',
  pdf: 'PDF analysis',
};

// Thrown by a stage under refusalPolicy 'fail' once it has recorded the
// refusal. `fatal: true` is the AnalysisWorkerPool's halt signal: the pool
// stops dispatching and rejects with this error, the stage unwinds, and
// startProcessing reports the message as the run's error. Deliberately NOT a
// CONTENT_REFUSAL (different code, no sentinel in the message), so no outer
// catch records the same refusal twice or mistakes the halt for a skip.
export class RefusalHaltError extends Error {
  constructor({ refusal, stage, scope }) {
    const provider = refusal?.provider ?? 'The provider';
    const category = refusal?.category ?? 'unknown';
    const where = `${STAGE_LABELS[stage] ?? stage}${scope ? ` (${scope})` : ''}`;
    super(
      `Run halted: ${provider} declined ${where} on content grounds (${category}), and refusalPolicy is 'fail'. ` +
        `Set refusalPolicy to 'skip' to drop refused items and continue, or to 'fallback' with a refusalFallbackModel to retry them on another model.`
    );
    this.name = 'RefusalHaltError';
    this.code = 'REFUSAL_HALT';
    this.fatal = true;
    this.stage = stage;
    this.scope = scope ?? '';
    this.refusal = refusal ?? null;
  }
}
