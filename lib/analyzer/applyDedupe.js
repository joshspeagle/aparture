// Pure helper: intersect a paper list with a "seen-papers" index and either
// filter out matches (Remove mode) or decorate them in place (Flag mode).
// No I/O, no side effects on the input. Used by lib/analyzer/pipeline.js's
// fetchPapers stage after harvest() returns.

/**
 * @typedef {Object} DedupeResult
 * @property {Array<Object>} kept    Post-dedupe paper list.
 * @property {number} matched        Count of papers that intersected the index.
 * @property {'remove' | 'flag'} mode  Which branch ran.
 */

/**
 * @param {Array<Object>} papers           Papers returned by harvest().
 * @param {Record<string, string>} seenIndex  arxivId → ISO date (YYYY-MM-DD).
 *                                            Keys starting with "_" are reserved
 *                                            metadata and ignored.
 * @param {boolean} removeDuplicates       true = drop matches; false = tag in place.
 * @returns {DedupeResult}
 */
export function applyDedupe(papers, seenIndex, removeDuplicates) {
  const mode = removeDuplicates ? 'remove' : 'flag';
  const safeIndex = seenIndex ?? {};
  let matched = 0;

  const decorated = papers.map((paper) => {
    const id = paper?.id;
    if (!id || id.startsWith('_')) return paper;
    const firstSeenDate = safeIndex[id];
    if (!firstSeenDate) return paper;
    matched += 1;
    return { ...paper, isDuplicate: true, firstSeenDate };
  });

  const kept = removeDuplicates ? decorated.filter((p) => !p.isDuplicate) : decorated;

  return { kept, matched, mode };
}
