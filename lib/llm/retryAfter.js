// Provider-portable Retry-After parsing.
//
// Header form (Anthropic, OpenAI):
//   Retry-After: 30                          → 30 seconds
//   Retry-After: Wed, 21 Oct 2026 07:28:00 GMT → ms-from-now
//
// Body form (Google Gemini RESOURCE_EXHAUSTED): Google does NOT send
// Retry-After headers. The retry guidance lives in the JSON error body:
//   { error: { details: [
//       { '@type': 'type.googleapis.com/google.rpc.RetryInfo',
//         retryDelay: '23s' }   // or '1.5s', '0.250s', etc.
//   ] } }
//
// All helpers return milliseconds (number) or null when no usable signal
// is present. Callers cap the returned value (typical cap: 60s) and fall
// back to exponential backoff.

export function parseRetryAfterHeader(header) {
  if (!header) return null;
  const asSeconds = parseInt(header, 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000;
  const asDate = new Date(header);
  if (!Number.isNaN(asDate.getTime())) {
    return Math.max(0, asDate.getTime() - Date.now());
  }
  return null;
}

// Returns ms from a Google RetryInfo body, or null.
//   parseGoogleRetryDelay('{"error":{"details":[{"@type":"...RetryInfo","retryDelay":"23s"}]}}') → 23000
export function parseGoogleRetryDelay(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  const details = parsed?.error?.details;
  if (!Array.isArray(details)) return null;
  const RETRY_INFO_TYPE = 'type.googleapis.com/google.rpc.RetryInfo';
  const info = details.find((d) => d?.['@type'] === RETRY_INFO_TYPE);
  if (!info?.retryDelay) return null;
  // Format is `<seconds>s`, possibly fractional (e.g. "1.5s", "0.250s").
  const match = /^(\d+(?:\.\d+)?)s$/.exec(info.retryDelay);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
}

// Provider-aware dispatch. `response` is a Fetch Response; `rawText` is
// the already-read body (since we can't read it twice). Returns ms or null.
export function parseProviderRetryAfter(provider, response, rawText) {
  if (provider === 'google') {
    return parseGoogleRetryDelay(rawText);
  }
  // Anthropic + OpenAI both send Retry-After header on 429 (and 529 for
  // Anthropic overload). OpenAI uses delta-seconds; Anthropic uses
  // delta-seconds. Both formats handled by parseRetryAfterHeader.
  const header = response?.headers?.get?.('retry-after');
  return parseRetryAfterHeader(header);
}
