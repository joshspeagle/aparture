/**
 * Compute the additive PDF-analysis set for the MS gate.
 *
 * finalPDFSet = (availablePapers.slice(0, maxDeepAnalysis)) ∪ starredIds − dismissedIds
 *
 * Returns the resolved set in score-ranked order (preserving the input order,
 * which is assumed to be score-descending). Promoted starred papers are
 * appended after the top-N slice in their original relative order.
 *
 * Caller is responsible for guarding empty-set scenarios (e.g. showing a
 * warning when the set is empty before launching Stage 4).
 *
 * @param {object} opts
 * @param {Array}  opts.availablePapers   Score-ranked paper list (Stage 3.5 output).
 * @param {number} opts.maxDeepAnalysis   Top-N window size (config.maxDeepAnalysis).
 * @param {Set}    opts.starredIds        arxivIds the user starred via the MS gate.
 * @param {Set}    opts.dismissedIds      arxivIds the user dismissed via the MS gate.
 * @returns {Array} Resolved set in score order.
 */
export function resolveAdditiveSet({ availablePapers, maxDeepAnalysis, starredIds, dismissedIds }) {
  if (!availablePapers || availablePapers.length === 0) return [];

  const topN = availablePapers.slice(0, maxDeepAnalysis);
  const topNIds = new Set(topN.map((p) => p.id ?? p.arxivId));

  // Papers outside top-N that the user explicitly starred
  const promoted = availablePapers.filter((p) => {
    const id = p.id ?? p.arxivId;
    return starredIds.has(id) && !topNIds.has(id);
  });

  // Combine and strip dismissals
  const combined = [...topN, ...promoted];
  return combined.filter((p) => {
    const id = p.id ?? p.arxivId;
    return !dismissedIds.has(id);
  });
}
