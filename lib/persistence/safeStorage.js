// Shared localStorage quota-handling primitives. Lifted from hooks/useBriefing.js
// (introduced for the briefings tiered store, 2026-04-21) so the analyzer
// session persistence (hooks/useAnalyzerPersistence.js) can reuse the same
// fallback ladder.
//
// Pattern: try setItem → on QuotaExceededError, fall back. Callers decide what
// "fall back" means via stripHeavy + their own retry loop (see persistHistory
// / persistCurrent in useBriefing.js for the canonical example).

export function isQuotaError(err) {
  if (!err) return false;
  // Name varies across browsers; numeric codes 22 / 1014 are the legacy forms.
  const name = err.name || '';
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

// Returns true on success, false on quota failure. Re-throws non-quota errors
// so callers don't silently swallow them.
export function safeSetItem(key, value) {
  if (typeof window === 'undefined') return true;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaError(err)) return false;
    throw err;
  }
}

// Drop a list of keys from a shallow object copy. Supports dotted paths
// ("results.allPapers") so callers can target nested heavy fields without
// rebuilding the object themselves.
export function stripFields(entry, fields) {
  const out = JSON.parse(JSON.stringify(entry));
  for (const path of fields) {
    const segments = path.split('.');
    let cursor = out;
    for (let i = 0; i < segments.length - 1; i++) {
      if (cursor == null || typeof cursor !== 'object') {
        cursor = null;
        break;
      }
      cursor = cursor[segments[i]];
    }
    if (cursor && typeof cursor === 'object') {
      delete cursor[segments[segments.length - 1]];
    }
  }
  return out;
}
