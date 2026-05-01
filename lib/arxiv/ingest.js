// Top-level orchestrator. Initial implementation supports atom-only mode
// only; later tasks add OAI driver, modes, fill-ups, cache, semantics.
// Spec §4.

import { fetchAtom as defaultFetchAtom } from './fetchAtom.js';
import { harvestOai as defaultHarvestOai } from './harvestOai.js';
import { groupByPrefix } from './sets.js';
import { applyFillups } from './fillups.js';
import { lookup as cacheLookup, store as cacheStore } from './cache.js';

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
  const ttlMinutes = window.cacheTtlMinutes ?? 0;

  if (ttlMinutes > 0) {
    const hit = cacheLookup({
      set: prefix,
      from: window.from,
      until: window.until,
      mode: window.mode,
      ttlMinutes,
    });
    if (hit) {
      const ageMin = Math.round((Date.now() - hit.cachedAt) / 60_000);
      statusCallback(`${prefix} (cached, ${ageMin} min ago)`);
      return {
        records: hit.records,
        perPrefixEntry: {
          prefix,
          driver: 'cache',
          pages: 0,
          records: hit.records.length,
          spentMs: 0,
          cached: true,
        },
      };
    }
  }

  const t0 = Date.now();
  const records = await harvestOaiImpl({
    set: prefix,
    from: window.from,
    until: window.until,
    password,
    abortSignal,
    statusCallback,
  });

  if (ttlMinutes > 0 && !abortSignal?.aborted) {
    cacheStore({
      set: prefix,
      from: window.from,
      until: window.until,
      mode: window.mode,
      records,
    });
  }

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

  const allRecords = [];
  const perPrefix = [];
  let modeUsed = window.mode;
  let oaiTripped = false;

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
    // auto or oai-only — broad fetch per prefix, with optional Atom fallback in auto mode.
    const groups = groupByPrefix(window.selectedSubcategories);
    const prefixes = Object.keys(groups);
    let oaiUsed = false;
    let atomUsedAfterAuto = false;

    for (let i = 0; i < prefixes.length; i++) {
      const prefix = prefixes[i];
      const subcatsInPrefix = groups[prefix];
      if (abortSignal?.aborted) throw new Error('Operation aborted');
      if (waitForResume) await waitForResume();

      const useOai = !oaiTripped;
      if (useOai) {
        try {
          statusCallback(`Fetching ${prefix} (OAI)…`);
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
          oaiUsed = true;
          continue;
        } catch (err) {
          if (window.mode === 'oai-only') throw err;
          // auto: trip breaker; this prefix retries via Atom.
          oaiTripped = true;
          statusCallback(`${prefix}: OAI failed (${err.name}), falling back to Atom`);
          console.warn(`[arxiv] OAI failed for "${prefix}"; switching this run to Atom`);
        }
      }

      // Atom fallback: one call per subcategory in this prefix.
      for (const subcategory of subcatsInPrefix) {
        if (abortSignal?.aborted) throw new Error('Operation aborted');
        if (waitForResume) await waitForResume();
        statusCallback(`Fetching ${subcategory} (Atom)…`);
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
        atomUsedAfterAuto = window.mode === 'auto';
      }
      progressCallback(i + 1, prefixes.length);
    }

    // Compute modeUsed for auto mode based on what actually happened.
    if (window.mode === 'auto') {
      if (oaiUsed && atomUsedAfterAuto) modeUsed = 'auto-mixed';
      else if (oaiUsed) modeUsed = 'auto-oai';
      else modeUsed = 'auto-atom';
    }
  }

  // Atom path's records already have correct fetchedCategory; OAI path needs filtering + attribution.
  const filtered =
    window.mode === 'atom-only'
      ? allRecords
      : filterToSelected(allRecords, window.selectedSubcategories);

  // Fill-ups: narrow fetch per under-served subcategory. Auto mode with breaker
  // tripped (or atom-only mode) uses Atom narrow per subcategory; otherwise OAI
  // with the narrow set. Cached separately under the narrow-set key.
  const fillupFetchFn = async ({ narrowSet, from, until, subcategory }) => {
    const ttlMinutes = window.cacheTtlMinutes ?? 0;
    const cacheKeySet =
      window.mode === 'atom-only' || (window.mode === 'auto' && oaiTripped)
        ? subcategory
        : narrowSet;

    if (ttlMinutes > 0) {
      const hit = cacheLookup({
        set: cacheKeySet,
        from,
        until,
        mode: window.mode,
        ttlMinutes,
      });
      if (hit) return hit.records;
    }

    let records;
    if (window.mode === 'atom-only' || (window.mode === 'auto' && oaiTripped)) {
      records = await fetchAtomImpl({
        subcategory,
        from,
        until,
        password,
        abortSignal,
        statusCallback,
      });
    } else {
      records = await harvestOaiImpl({
        set: narrowSet,
        from,
        until,
        password,
        abortSignal,
        statusCallback,
      });
    }

    if (ttlMinutes > 0 && !abortSignal?.aborted) {
      cacheStore({ set: cacheKeySet, from, until, mode: window.mode, records });
    }

    return records;
  };

  const { papers: filledPapers, fillups } = await applyFillups({
    papers: filtered,
    selectedSubcategories: window.selectedSubcategories,
    schedule: window.fillupSchedule ?? [],
    threshold: window.minPapersPerSubcategory ?? 0,
    from: window.from,
    until: window.until,
    fetchFn: fillupFetchFn,
  });

  const deduped = dedupById(filledPapers);
  deduped.sort((a, b) => new Date(b.published) - new Date(a.published));

  return {
    papers: deduped,
    perPrefix,
    fillups,
    modeUsed,
  };
}
