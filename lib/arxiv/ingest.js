// Top-level orchestrator. Initial implementation supports atom-only mode
// only; later tasks add OAI driver, modes, fill-ups, cache, semantics.
// Spec §4.

import { fetchAtom as defaultFetchAtom } from './fetchAtom.js';
import { harvestOai as defaultHarvestOai } from './harvestOai.js';
import { groupByPrefix } from './sets.js';

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

function attributeFetchedCategory(paper, selectedSubcategories) {
  // First selected subcategory that appears in this paper's categories.
  for (const sc of selectedSubcategories) {
    if (paper.categories.includes(sc)) return sc;
  }
  return null; // paper has no overlap with selected — caller drops it
}

function filterToSelected(papers, selectedSubcategories) {
  const out = [];
  for (const p of papers) {
    const fetchedCategory = attributeFetchedCategory(p, selectedSubcategories);
    if (fetchedCategory) out.push({ ...p, fetchedCategory });
  }
  return out;
}

async function harvestPrefixViaOai({
  prefix,
  window,
  password,
  abortSignal,
  statusCallback,
  harvestOaiImpl,
}) {
  const t0 = Date.now();
  const records = await harvestOaiImpl({
    set: prefix,
    from: window.from,
    until: window.until,
    password,
    abortSignal,
    statusCallback,
  });
  return {
    records,
    perPrefixEntry: {
      prefix,
      driver: 'oai',
      pages: 0,
      records: records.length,
      spentMs: Date.now() - t0,
      cached: false,
    },
  };
}

async function harvestSubcategoryViaAtom({
  subcategory,
  window,
  password,
  abortSignal,
  statusCallback,
  fetchAtomImpl,
}) {
  const t0 = Date.now();
  const records = await fetchAtomImpl({
    subcategory,
    from: window.from,
    until: window.until,
    password,
    abortSignal,
    statusCallback,
  });
  return {
    records,
    perPrefixEntry: {
      prefix: subcategory,
      driver: 'atom',
      pages: 0,
      records: records.length,
      spentMs: Date.now() - t0,
      cached: false,
    },
  };
}

/**
 * @param {import('./types.js').HarvestWindow} window
 * @param {Object} deps
 * @param {string} deps.password
 * @param {AbortSignal | {aborted: boolean}} deps.abortSignal
 * @param {(msg: string) => void} [deps.statusCallback]
 * @param {(current: number, total: number) => void} [deps.progressCallback]
 * @param {() => Promise<void>} [deps.waitForResume]
 * @param {Function} [deps.fetchAtomImpl]
 * @param {Function} [deps.harvestOaiImpl]
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
    harvestOaiImpl = defaultHarvestOai,
  } = deps;

  if (!['auto', 'oai-only', 'atom-only'].includes(window.mode)) {
    throw new Error(`ingest.harvest: unknown mode "${window.mode}"`);
  }
  // Auto mode is added in Task 15.
  if (window.mode === 'auto') {
    throw new Error(`ingest.harvest: mode "auto" not implemented yet`);
  }

  const allRecords = [];
  const perPrefix = [];

  if (window.mode === 'atom-only') {
    const total = window.selectedSubcategories.length;
    for (let i = 0; i < total; i++) {
      const subcategory = window.selectedSubcategories[i];
      if (abortSignal?.aborted) throw new Error('Operation aborted');
      if (waitForResume) await waitForResume();
      statusCallback(`Fetching ${subcategory}…`);
      const { records, perPrefixEntry } = await harvestSubcategoryViaAtom({
        subcategory,
        window,
        password,
        abortSignal,
        statusCallback,
        fetchAtomImpl,
      });
      perPrefix.push(perPrefixEntry);
      allRecords.push(...records);
      statusCallback(`✓ ${subcategory}: ${records.length} papers`);
      progressCallback(i + 1, total);
    }
  } else {
    // oai-only — broad fetch per prefix.
    const groups = groupByPrefix(window.selectedSubcategories);
    const prefixes = Object.keys(groups);
    for (let i = 0; i < prefixes.length; i++) {
      const prefix = prefixes[i];
      if (abortSignal?.aborted) throw new Error('Operation aborted');
      if (waitForResume) await waitForResume();
      statusCallback(`Fetching ${prefix}…`);
      const { records, perPrefixEntry } = await harvestPrefixViaOai({
        prefix,
        window,
        password,
        abortSignal,
        statusCallback,
        harvestOaiImpl,
      });
      perPrefix.push(perPrefixEntry);
      allRecords.push(...records);
      statusCallback(`✓ ${prefix}: ${records.length} records`);
      progressCallback(i + 1, prefixes.length);
    }
  }

  // Atom path's records already have correct fetchedCategory; OAI path needs filtering + attribution.
  const filtered =
    window.mode === 'atom-only'
      ? allRecords
      : filterToSelected(allRecords, window.selectedSubcategories);

  const deduped = dedupById(filtered);
  deduped.sort((a, b) => new Date(b.published) - new Date(a.published));

  return {
    papers: deduped,
    perPrefix,
    fillups: [],
    modeUsed: window.mode,
  };
}
