// Top-level orchestrator. Initial implementation supports atom-only mode
// only; later tasks add OAI driver, modes, fill-ups, cache, semantics.
// Spec §4.

import { fetchAtom as defaultFetchAtom } from './fetchAtom.js';
import { harvestOai as defaultHarvestOai } from './harvestOai.js';
import { groupByPrefix } from './sets.js';
import { applyFillups } from './fillups.js';
import { lookup as cacheLookup, store as cacheStore } from './cache.js';
import { arxivSpacingMs as defaultSpacingMs, arxivSleep as defaultSleep } from './spacing.js';

// arXiv announces papers on a daily schedule (~20:00 ET, after a 14:00 ET
// submission cutoff). A paper submitted on day N typically gets an OAI
// datestamp of day N or N+1 — and weekend/holiday gaps push that further.
// The orchestrator widens the OAI fetch window backward by this many days
// past the user's intended target so the anchor calculation has a complete
// picture before slicing to the user's daysBack.
const ANNOUNCE_LAG_BUFFER_DAYS = 7;

function shiftIsoDate(yyyymmdd, deltaDays) {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

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

// Re-applies windowSemantics to the merged broad+fill-up paper set. Broad-fetch
// records were already filtered with the inner [from, until]; fill-ups extend
// the window backward, so the union range we accept is
// [from - max(fillupSchedule), until]. Without this re-filter, OAI's
// last-modified dating leaks v2-of-old papers through fill-up steps even when
// the user asked for `submitted-only`.
function applyWindowSemanticsToFilled(papers, window) {
  if (window.windowSemantics !== 'submitted-only') return papers;
  if (!Array.isArray(window.fillupSchedule) || window.fillupSchedule.length === 0) {
    return papers;
  }
  const maxExtraDays = Math.max(...window.fillupSchedule);
  const expandedFromDate = (() => {
    const d = new Date(`${window.from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - maxExtraDays);
    return d.toISOString().split('T')[0];
  })();
  return papers.filter((p) => {
    const pubDate = (p.published ?? '').slice(0, 10);
    return pubDate >= expandedFromDate && pubDate <= window.until;
  });
}

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
 * @param {() => number} [deps.spacingMsImpl]   jittered inter-request spacing (ms)
 * @param {(ms: number) => Promise<void>} [deps.sleepImpl]
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
    // Injectable so unit tests don't actually sleep 3–5 s between requests.
    spacingMsImpl = defaultSpacingMs,
    sleepImpl = defaultSleep,
  } = deps;

  // Run-wide "has any network request fired yet" flag. Shared across the broad
  // fetch AND the fill-up steps so spacing precedes every request except the
  // very first of the entire run — and so we never double-space across the
  // broad→fill-up boundary. Mutated by spaceIfNotFirst() below.
  const requestState = { firstRequestMade: false };

  // Jittered spacing between consecutive arXiv requests (3000–5000 ms). NOT
  // applied before the very first request of the run — only between them — so a
  // single-request fetch isn't needlessly delayed. See lib/arxiv/spacing.js.
  // Returns immediately (no sleep) for the first request, then sleeps the
  // jittered interval before every subsequent one.
  const spaceIfNotFirst = async () => {
    if (requestState.firstRequestMade) await sleepImpl(spacingMsImpl());
    requestState.firstRequestMade = true;
  };

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
      // Jittered spacing BETWEEN consecutive Atom requests (not before the first).
      await spaceIfNotFirst();
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
    // Jittered spacing applies BETWEEN consecutive requests in this branch.
    // Requests here interleave OAI-prefix and Atom-subcategory calls, so we
    // rely on the run-wide spaceIfNotFirst() flag rather than the loop index —
    // spacing must precede every request except the very first of the run.

    for (let i = 0; i < prefixes.length; i++) {
      const prefix = prefixes[i];
      const subcatsInPrefix = groups[prefix];
      if (abortSignal?.aborted) throw new Error('Operation aborted');
      if (waitForResume) await waitForResume();

      const useOai = !oaiTripped;
      if (useOai) {
        try {
          await spaceIfNotFirst();
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
        await spaceIfNotFirst();
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

  // Determine the v1 target window. Two cases:
  //   - `targetDaysBack` is set (production path): widen-and-anchor mode.
  //     The caller fetched a window wider than the user's intended daysBack
  //     to absorb arXiv's announcement lag (papers submitted on day N often
  //     surface in OAI on day N+1, more on weekends). We anchor on the most
  //     recent v1 day that has at least one paper across the selected subs,
  //     then slice the v1 target to [anchor - (targetDaysBack-1), anchor].
  //   - `targetDaysBack` absent (legacy/test path): use [window.from, until]
  //     as the v1 target window directly.
  // For 'submitted-or-updated' we keep all papers regardless of v1 — that
  // toggle exists exactly because the user *wants* re-announcements through.
  let targetFrom = window.from;
  let targetUntil = window.until;
  if (
    window.windowSemantics === 'submitted-only' &&
    typeof window.targetDaysBack === 'number' &&
    window.targetDaysBack >= 1
  ) {
    const v1Days = filtered
      .map((p) => (p.published ?? '').slice(0, 10))
      .filter(Boolean)
      .sort();
    const anchorDate = v1Days.length > 0 ? v1Days[v1Days.length - 1] : window.until;
    targetUntil = anchorDate;
    targetFrom = shiftIsoDate(anchorDate, -(window.targetDaysBack - 1));
  }

  const passesSemantics = (p) => {
    if (window.windowSemantics === 'submitted-or-updated') return true;
    const pubDate = (p.published ?? '').slice(0, 10);
    return pubDate >= targetFrom && pubDate <= targetUntil;
  };
  const semanticsFiltered = filtered.filter(passesSemantics);

  // Fill-ups: narrow fetch per under-served subcategory. Auto mode with breaker
  // tripped (or atom-only mode) uses Atom narrow per subcategory; otherwise OAI
  // with the narrow set. Cached separately under the narrow-set key.
  //
  // The `from`/`until` passed in are V1 TARGET dates for this fill-up step.
  // OAI fetches need to widen by ANNOUNCE_LAG_BUFFER_DAYS so we don't miss
  // papers submitted on the target window's edges that announce a day or
  // two later; after fetch we re-filter to the requested v1 window. Atom's
  // `submittedDate:[…]` already filters on v1, so it uses the window as-is.
  const fillupFetchFn = async ({ narrowSet, from, until, subcategory }) => {
    // Jittered spacing BETWEEN consecutive arXiv requests, shared with the
    // broad fetch via the run-wide spaceIfNotFirst() flag. This covers both
    // the broad→first-fill-up boundary (the broad fetch already fired a
    // request, so the first fill-up IS spaced) and consecutive fill-up steps,
    // while never adding a leading delay when fill-ups are the only requests
    // in the run (no broad request fired → the very first fill-up isn't
    // spaced). Mirrors the broad path: spacing precedes the cache lookup, so a
    // cache hit consumes a slot just as harvestPrefixViaOai does.
    await spaceIfNotFirst();

    const ttlMinutes = window.cacheTtlMinutes ?? 0;
    const useAtom = window.mode === 'atom-only' || (window.mode === 'auto' && oaiTripped);
    const cacheKeySet = useAtom ? subcategory : narrowSet;
    const isSubmittedOnly = window.windowSemantics === 'submitted-only';

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
    if (useAtom) {
      // Atom's `submittedDate:[…]` filters on v1 server-side, so the window passes through as-is.
      records = await fetchAtomImpl({
        subcategory,
        from,
        until,
        password,
        abortSignal,
        statusCallback,
      });
    } else if (isSubmittedOnly) {
      // OAI: widen the announcement window forward by lag buffer to catch
      // boundary papers (v1 inside the step's target window but announced a
      // day or two later), then post-filter to v1 in the requested window.
      // The widened until is clamped to `window.until` because OAI rejects
      // future dates with `badArgument: until date too late` (which would
      // otherwise return zero records and silently skip the whole step).
      const widenedUntil = shiftIsoDate(until, ANNOUNCE_LAG_BUFFER_DAYS);
      const oaiUntil = widenedUntil <= window.until ? widenedUntil : window.until;
      const fetched = await harvestOaiImpl({
        set: narrowSet,
        from,
        until: oaiUntil,
        password,
        abortSignal,
        statusCallback,
      });
      records = fetched.filter((p) => {
        const pubDate = (p.published ?? '').slice(0, 10);
        return pubDate >= from && pubDate <= until;
      });
    } else {
      // submitted-or-updated: take the OAI announcement window as-is.
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
    papers: semanticsFiltered,
    selectedSubcategories: window.selectedSubcategories,
    schedule: window.fillupSchedule ?? [],
    threshold: window.minPapersPerSubcategory ?? 0,
    from: targetFrom,
    until: targetUntil,
    fetchFn: fillupFetchFn,
  });

  const filledFinal = applyWindowSemanticsToFilled(filledPapers, {
    ...window,
    from: targetFrom,
    until: targetUntil,
  });
  const deduped = dedupById(filledFinal);
  deduped.sort((a, b) => new Date(b.published) - new Date(a.published));

  return {
    papers: deduped,
    perPrefix,
    fillups,
    modeUsed,
  };
}
