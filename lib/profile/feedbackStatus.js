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
//
// Incorporation is tracked per event: `incorporatedAt` is set when the event
// motivated a suggested change the user ACCEPTED (lib/profile/
// suggestOutcome.js) and cleared again if that revision is reverted.
// `cutoff` is the legacy profile.lastFeedbackCutoff: before per-event
// tracking, one timestamp marked everything up to the newest selected event
// as incorporated. It is no longer advanced; events at or before it keep the
// label they already had. An edit (editedAt) re-opens an event, since the
// new wording has not been considered.
export function feedbackStatus(event, cutoff = 0) {
  if (isTestFeedback(event)) return 'test';
  if (event?.incorporatedAt) return 'incorporated';
  const lastTouched = Math.max(event?.timestamp ?? 0, event?.editedAt ?? 0);
  return lastTouched > cutoff ? 'pending' : 'incorporated';
}

export function isPendingFeedback(event, cutoff = 0) {
  return feedbackStatus(event, cutoff) === 'pending';
}
