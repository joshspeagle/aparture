// Shared helpers for the feedback → profile loop: which feedback events are
// usable, and where each one stands relative to the profile.

// The only verdicts Stage 2 can produce (the /api/quick-filter schema enum).
export const FILTER_VERDICTS = Object.freeze(['YES', 'MAYBE', 'NO']);

export function isFilterVerdict(value) {
  return typeof value === 'string' && FILTER_VERDICTS.includes(value);
}
