// Typed error for provider *content refusals* — a safety classifier declining
// to answer, as opposed to a transport or quota failure.
//
// Why this is a separate class from ProviderError: a refusal is not an HTTP
// error. Anthropic returns HTTP 200 with `stop_reason: "refusal"` and an
// empty content array; OpenAI returns 200 with `finish_reason:
// "content_filter"` or a `message.refusal` string; Google returns 200 with a
// `promptFeedback.blockReason` or a safety `finishReason` and no text. Left
// unclassified, all three surface downstream as "Unexpected end of JSON
// input" — an opaque parse failure that the retry ladder then burns
// `maxRetries` attempts on, even though a refusal is deterministic and every
// retry returns the same refusal.
//
// Detection lives in the three parse* adapters (they see the raw provider
// response); this module owns the shared shape and the route helper.
//
// Flow, mirroring ProviderError → RateLimitError:
//   adapter parse* throws RefusalError
//     → route catch calls sendRefusalErrorResponse → HTTP 422 + code
//     → client parseRouteError throws ContentRefusalError
//     → makeRobustAPICall short-circuits (no retries)
//     → stage applies config.refusalPolicy

// Canonical categories. Providers each use their own vocabulary; adapters map
// into this set so the UI and the policy layer don't have to know which
// provider produced the refusal. `raw` always preserves the original string.
export const REFUSAL_CATEGORIES = Object.freeze({
  CYBER: 'cyber',
  BIO: 'bio',
  SAFETY: 'safety',
  PROHIBITED: 'prohibited',
  RECITATION: 'recitation',
  UNKNOWN: 'unknown',
});

// Provider vocabulary → canonical category. Anything unmapped becomes
// 'unknown' rather than throwing, so a category a provider adds tomorrow
// still produces a usable refusal instead of a crash.
const CATEGORY_MAP = {
  // Anthropic stop_details.category
  cyber: REFUSAL_CATEGORIES.CYBER,
  bio: REFUSAL_CATEGORIES.BIO,
  reasoning_extraction: REFUSAL_CATEGORIES.PROHIBITED,
  frontier_llm: REFUSAL_CATEGORIES.PROHIBITED,
  // Google blockReason / finishReason
  SAFETY: REFUSAL_CATEGORIES.SAFETY,
  BLOCKLIST: REFUSAL_CATEGORIES.PROHIBITED,
  PROHIBITED_CONTENT: REFUSAL_CATEGORIES.PROHIBITED,
  SPII: REFUSAL_CATEGORIES.PROHIBITED,
  IMAGE_SAFETY: REFUSAL_CATEGORIES.SAFETY,
  RECITATION: REFUSAL_CATEGORIES.RECITATION,
  // OpenAI
  content_filter: REFUSAL_CATEGORIES.SAFETY,
};

export function normalizeRefusalCategory(raw) {
  if (!raw) return REFUSAL_CATEGORIES.UNKNOWN;
  return CATEGORY_MAP[raw] ?? REFUSAL_CATEGORIES.UNKNOWN;
}

export class RefusalError extends Error {
  constructor({ provider, model, category, raw, explanation, message }) {
    const normalized = normalizeRefusalCategory(category ?? raw);
    super(
      message ??
        `${provider} declined this request (${normalized}${raw && raw !== normalized ? `: ${raw}` : ''})`
    );
    this.name = 'RefusalError';
    this.provider = provider;
    this.model = model ?? null;
    this.category = normalized;
    // The provider's own reason string, unmapped — kept so a category we
    // don't recognise yet is still diagnosable from logs and the UI.
    this.raw = raw ?? null;
    this.explanation = explanation ?? null;
  }
}

// Route helper. Returns true when the error was a RefusalError and an HTTP
// response was sent; callers fall through to sendProviderErrorResponse and
// then their generic 500 catch.
//
// 422 + a `code` discriminator matches the existing
// PLAYWRIGHT_UNAVAILABLE_RECAPTCHA convention: a request that was well-formed
// and authorized but cannot be fulfilled, which the client handles by
// skipping rather than retrying.
export function sendRefusalErrorResponse(res, error) {
  if (!(error instanceof RefusalError)) return false;
  res.status(422).json({
    code: 'CONTENT_REFUSAL',
    error: error.message,
    provider: error.provider,
    model: error.model,
    category: error.category,
    raw: error.raw,
    details: error.explanation ?? error.message,
  });
  return true;
}
