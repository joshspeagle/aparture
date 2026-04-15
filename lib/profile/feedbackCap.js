/**
 * Smart feedback cap for the suggest-profile prompt payload.
 *
 * Always preserves all stars and dismisses (high-signal events). Caps
 * per-paper comments and general comments at the most-recent `commentCap`
 * entries per type. Reports trimming stats for user-facing transparency.
 *
 * @param {Array<{type: string, timestamp: number}>} events
 * @param {{commentCap: number}} opts
 * @returns {{
 *   kept: Array,
 *   dropped: Array,
 *   stats: {
 *     starCount: number,
 *     dismissCount: number,
 *     paperCommentTotal: number,
 *     paperCommentKept: number,
 *     generalCommentTotal: number,
 *     generalCommentKept: number,
 *     trimmed: boolean,
 *   },
 * }}
 */
export function applyCap(events, { commentCap = 30 } = {}) {
  const stars = events.filter((e) => e.type === 'star');
  const dismisses = events.filter((e) => e.type === 'dismiss');
  const paperComments = events
    .filter((e) => e.type === 'paper-comment')
    .sort((a, b) => b.timestamp - a.timestamp);
  const generalComments = events
    .filter((e) => e.type === 'general-comment')
    .sort((a, b) => b.timestamp - a.timestamp);

  const keptPaperComments = paperComments.slice(0, commentCap);
  const droppedPaperComments = paperComments.slice(commentCap);
  const keptGeneralComments = generalComments.slice(0, commentCap);
  const droppedGeneralComments = generalComments.slice(commentCap);

  const kept = [...stars, ...dismisses, ...keptPaperComments, ...keptGeneralComments];
  const dropped = [...droppedPaperComments, ...droppedGeneralComments];

  return {
    kept,
    dropped,
    stats: {
      starCount: stars.length,
      dismissCount: dismisses.length,
      paperCommentTotal: paperComments.length,
      paperCommentKept: keptPaperComments.length,
      generalCommentTotal: generalComments.length,
      generalCommentKept: keptGeneralComments.length,
      trimmed: dropped.length > 0,
    },
  };
}
