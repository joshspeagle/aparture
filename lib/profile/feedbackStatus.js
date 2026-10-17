// Shared helpers for the feedback → profile loop: which feedback events are
// usable, and where each one stands relative to the profile.

// The only verdicts Stage 2 can produce (the /api/quick-filter schema enum).
export const FILTER_VERDICTS = Object.freeze(['YES', 'MAYBE', 'NO']);

export function isFilterVerdict(value) {
  return typeof value === 'string' && FILTER_VERDICTS.includes(value);
}

// Feedback that must never steer the profile or a real briefing:
//   - anything recorded while a Dry Run or Minimal Test was running
//     (useFeedback stamps `testMode: true` at creation): it reacts to mock
//     LLM output — random verdicts and scores, placeholder summaries — or to
//     the hard-coded test papers;
//   - legacy filter-override events whose verdicts aren't YES/MAYBE/NO. Only
//     the old dry-run mock ever produced those ("filter said 123").
export function isTestFeedback(event) {
  if (!event) return false;
  if (event.testMode === true) return true;
  if (event.type === 'filter-override') {
    return !isFilterVerdict(event.originalVerdict) || !isFilterVerdict(event.newVerdict);
  }
  return false;
}

// Where an event stands: 'test' (never sent to suggestions), 'pending' (not
// yet reflected in the profile), or 'incorporated'.
export function feedbackStatus(event, cutoff = 0) {
  if (isTestFeedback(event)) return 'test';
  return (event?.timestamp ?? 0) > cutoff ? 'pending' : 'incorporated';
}

export function isPendingFeedback(event, cutoff = 0) {
  return feedbackStatus(event, cutoff) === 'pending';
}
