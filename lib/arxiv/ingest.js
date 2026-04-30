// Top-level orchestrator. Initial implementation supports atom-only mode
// only; later tasks add OAI driver, modes, fill-ups, cache, semantics.
// Spec §4.

import { fetchAtom as defaultFetchAtom } from './fetchAtom.js';
// Future tasks import harvestOai (Phase 2).

// First-wins dedup: a paper cross-listed under multiple selected subcategories keeps
// the fetchedCategory from whichever subcategory we hit first in iteration order.
// Tasks 13/15 onward need to consider whether that's the right tiebreak (e.g. prefer
// the user's primary category over a cross-listing) or fine to leave as-is.
const dedupById = (papers) => {
  const seen = new Set();
  const out = [];
  for (const p of papers) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
};

/**
 * Top-level orchestrator: drives the chosen ingestion path for each
 * selected subcategory, dedupes, and sorts.
 *
 * @param {import('./types.js').HarvestWindow} window
 * @param {Object} deps
 * @param {string} deps.password
 * @param {AbortSignal | {aborted: boolean}} deps.abortSignal
 * @param {(msg: string) => void} [deps.statusCallback]
 * @param {(current: number, total: number) => void} [deps.progressCallback]
 *   Invoked after each subcategory completes so the pipeline progress bar
 *   advances during a multi-category fetch instead of jumping 0→total at the end.
 * @param {() => Promise<void>} [deps.waitForResume]
 *   Awaited between subcategories so a paused run halts mid-fetch instead of
 *   continuing through every remaining subcategory before noticing pause.
 * @param {Function} [deps.fetchAtomImpl]      For test injection.
 * @param {Function} [deps.harvestOaiImpl]     For test injection (Phase 2).
 * @returns {Promise<import('./types.js').HarvestResult>}
 */
export async function harvest(window, deps) {
  const {
    password,
    abortSignal,
    statusCallback = () => {},
    progressCallback = () => {},
    waitForResume,
    fetchAtomImpl = defaultFetchAtom,
  } = deps;

  if (window.mode !== 'atom-only') {
    throw new Error(`ingest.harvest: mode "${window.mode}" not implemented yet`);
  }

  const allPapers = [];
  const perPrefix = [];
  const total = window.selectedSubcategories.length;

  for (let i = 0; i < total; i++) {
    const subcategory = window.selectedSubcategories[i];
    if (abortSignal?.aborted) throw new Error('Operation aborted');
    if (waitForResume) await waitForResume();
    const t0 = Date.now();
    statusCallback(`Fetching ${subcategory}…`);
    const papers = await fetchAtomImpl({
      subcategory,
      from: window.from,
      until: window.until,
      password,
      abortSignal,
      statusCallback,
    });
    const spentMs = Date.now() - t0;
    perPrefix.push({
      prefix: subcategory, // pre-OAI: per-subcategory rather than per-prefix
      driver: 'atom',
      pages: 0,
      records: papers.length,
      spentMs,
      cached: false,
    });
    allPapers.push(...papers);
    statusCallback(`✓ ${subcategory}: ${papers.length} papers`);
    progressCallback(i + 1, total);
  }

  const deduped = dedupById(allPapers);
  deduped.sort((a, b) => new Date(b.published) - new Date(a.published));

  return {
    papers: deduped,
    perPrefix,
    fillups: [],
    modeUsed: 'atom-only',
  };
}
