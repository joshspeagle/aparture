// When the editor proposes profile changes on its own, after a briefing.
//
// A proposal needs a pattern, not a count: two stars in an area the profile
// doesn't name, three dismissals inside one it does, or one explicit
// statement. Those minimums don't change with briefing size; briefing size
// only changes how fast evidence piles up. So the gate weighs evidence and
// the cadence separately:
//   - pending feedback scores points by how much it says (an answer to an
//     editor's question was asked precisely to settle a fork, so it counts
//     enough on its own);
//   - the points must come from at least two briefings, so one unusual day
//     can't drive an edit (an answer skips this);
//   - no new round while earlier proposals still wait for a decision, and
//     each event is weighed by one round only, so a "no change" result isn't
//     repeated every morning.
// The model may still find no pattern; the round then shows nothing.

export const PROPOSAL_POINTS = {
  star: 1,
  dismiss: 1,
  'filter-override': 1,
  'paper-comment': 2,
  'general-comment': 2,
  'scoped-feedback': 2,
  answer: 4,
};
export const PROPOSAL_THRESHOLD = 4;
export const PROPOSAL_MIN_BRIEFINGS = 2;

// Evaluated-event memory is bounded; older ids are long incorporated or
// stale.
export const MAX_EVALUATED_IDS = 1000;

/**
 * @param {object[]} pendingEvents  pending, non-test feedback (feedbackStatus)
 * @param {{evaluatedIds?: Iterable<string>, hasPendingProposal?: boolean}} state
 * @returns {{run: boolean, reason: string, points: number, briefings: number, events: object[]}}
 */
export function proposalGate(
  pendingEvents,
  { evaluatedIds = [], hasPendingProposal = false } = {}
) {
  const seen = new Set(evaluatedIds);
  const events = (pendingEvents ?? []).filter(
    (e) => e?.id && !seen.has(e.id) && PROPOSAL_POINTS[e.type]
  );
  const points = events.reduce((sum, e) => sum + PROPOSAL_POINTS[e.type], 0);
  const briefings = new Set(events.map((e) => e.briefingDate ?? e.date).filter(Boolean)).size;
  const hasAnswer = events.some((e) => e.type === 'answer');
  const result = (run, reason) => ({ run, reason, points, briefings, events });
  if (hasPendingProposal) return result(false, 'earlier proposals are waiting for a decision');
  if (hasAnswer) return result(true, "an answer to an editor's question");
  if (points < PROPOSAL_THRESHOLD)
    return result(false, `${points} of ${PROPOSAL_THRESHOLD} points`);
  if (briefings < PROPOSAL_MIN_BRIEFINGS) {
    return result(false, `feedback from ${briefings} of ${PROPOSAL_MIN_BRIEFINGS} briefings`);
  }
  return result(true, `${points} points across ${briefings} briefings`);
}

/** Merge newly evaluated ids into the bounded memory, newest last. */
export function rememberEvaluated(previous, ids) {
  const merged = [...(previous ?? []).filter((id) => !ids.includes(id)), ...ids];
  return merged.slice(-MAX_EVALUATED_IDS);
}
