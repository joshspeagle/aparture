// Hook owning the cross-run paper-dedupe index. Mirrors hooks/useBriefing.js:
// read on mount, in-memory state, persist via safeSetItem, prune to a 90-day
// rolling window on every write.
//
// Index shape: { [arxivId]: 'YYYY-MM-DD', _migratedAt: <ms-ts>, _dedupeVersion: <int> }
//   - Keys starting with '_' are reserved metadata (skipped by prune + dedupe lookups).
//   - Values are ISO `YYYY-MM-DD` strings (UTC) so lexicographic compare = date compare.
//
// First-mount migration (v2 — briefing-anchored):
//   When _dedupeVersion < CURRENT_DEDUPE_VERSION, scan reports/briefings/*.json
//   via the existing /api/briefings endpoints (concurrency cap 4) to seed the
//   index from briefings only — sessions are no longer a data source. This
//   anchors "seen" to "appeared in a run that reached briefing-save" and
//   prevents aborted runs (Stage 1 fetch → no briefing) from poisoning the
//   index. Existing v1 indexes get rebuilt cleanly on the first mount that
//   sees the bumped sentinel. Per-briefing GET failures abort the seal: the
//   migration returns null and is retried later, so we never stamp
//   _migratedAt + _dedupeVersion over an incomplete scan.
//   Completion MERGES (earliest-date-wins) onto the live in-memory index
//   rather than overwriting it, so any arxivIds recorded by recordRun during
//   the migration window survive. The migration effect is the sole writer of
//   the (_migratedAt, _dedupeVersion) sentinel pair — recordRun never stamps
//   either, so the two can never desync into the version=0 + _migratedAt state
//   that would force a spurious clearing rebuild.
//
// Phase 2 seam: when state migrates to ~/aparture/, only the STORAGE_KEY +
// migration source need updating; consumer contract (index/ready/recordRun)
// stays stable.

import { useCallback, useEffect, useRef, useState } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import { encodePasswordHeader } from '../lib/auth/passwordHeader.js';
import { AnalysisWorkerPool } from '../lib/analyzer/rateLimit.js';
import { papersFromBriefing } from '../lib/seenPapers/papersFromBriefing.js';

const STORAGE_KEY = 'aparture-seen-papers-index';
const HORIZON_DAYS = 90;
// Bump when the migration semantics change so existing indexes get rebuilt.
// v1: from sessions (poisoned by aborted runs).
// v2: from briefings (only completed runs).
// v3: v2 migration could fire before `password` hydrated → 401 list fetch
//     → sentinels set with empty index → permanently stuck. v3 makes the
//     effect password-aware and skips sentinel-set on auth failure.
const CURRENT_DEDUPE_VERSION = 3;

function isoDateUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function readStored() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

// Earliest-date-wins merge of two index maps. Skips `_`-prefixed sentinel keys
// (callers own sentinel handling — see migration completion + recordRun). For a
// shared arxivId, the lexicographically-smaller ISO date (= older sighting) is
// kept, preserving the "first seen on YYYY-MM-DD" signal. Used both when
// migration completion lands on top of any IDs recorded during the migration
// window and could be reused by any future second writer.
function mergeEarliestWins(base, incoming) {
  const out = { ...base };
  for (const key of Object.keys(incoming)) {
    if (key.startsWith('_')) continue;
    const existing = out[key];
    const candidate = incoming[key];
    if (!existing || candidate < existing) out[key] = candidate;
  }
  return out;
}

function pruneOldEntries(index, nowMs) {
  const cutoff = isoDateUTC(nowMs - HORIZON_DAYS * 86400 * 1000);
  const next = {};
  for (const key of Object.keys(index)) {
    if (key.startsWith('_')) {
      next[key] = index[key];
      continue;
    }
    if (index[key] >= cutoff) next[key] = index[key];
  }
  return next;
}

function persistIndex(index) {
  if (typeof window === 'undefined') return;
  const ok = safeSetItem(STORAGE_KEY, JSON.stringify(index));
  if (!ok) {
    console.warn(
      '[useSeenPapers] localStorage quota exceeded; seen-papers index could not be persisted (in-memory state preserved for this session)'
    );
  }
}

// One-time migration: scan existing reports/briefings/*.json via the API and
// seed the index from each briefing's papersFromBriefing union (briefed +
// pipelineArchive filter buckets). Concurrency-capped to avoid hammering the
// dev server. Per-briefing failures are NOT silently skipped: any failed GET
// makes the whole migration return null so the caller does NOT seal it —
// otherwise the dropped briefings' papers would be treated as never-seen for
// the entire 90-day window. The next password change / mount retries.
const MIGRATION_CONCURRENCY = 4;

// Returns:
//   - Object (possibly empty) → migration completed cleanly (every listed
//                                briefing GET succeeded); caller may set sentinels.
//   - null                    → couldn't reach disk / auth not ready / aborted /
//                                ANY per-briefing GET failed; caller must NOT set
//                                sentinels and should retry on next password
//                                change or next mount.
async function migrateFromBriefings({ password, signal }) {
  if (typeof window === 'undefined') return null;
  let listRes;
  try {
    listRes = await fetch('/api/briefings', {
      headers: { 'x-aparture-password': encodePasswordHeader(password) },
      signal,
    });
  } catch (err) {
    // AbortError is the React 18 StrictMode double-mount cleanup; not worth
    // logging (noisy and benign). Anything else is a transient network glitch
    // — both are "retry later" signals.
    if (err?.name !== 'AbortError') {
      console.warn('[useSeenPapers migration] /api/briefings list fetch threw:', err);
    }
    return null;
  }
  if (!listRes.ok) {
    console.warn(`[useSeenPapers migration] /api/briefings list returned HTTP ${listRes.status}`);
    return null;
  }
  const { ids = [] } = await listRes.json();

  const merged = {};
  // If ANY listed briefing's GET fails (non-OK or threw), the merged set is
  // incomplete — those briefings' papers would be treated as never-seen. We
  // must NOT let the caller seal the migration (stamp _dedupeVersion) on a
  // partial result, or the dropped papers stay "unseen" forever. Mirror the
  // list-fetch-failure path: return null so the caller retries on the next
  // password change / mount.
  let anyFailed = false;

  const pool = new AnalysisWorkerPool({
    concurrency: MIGRATION_CONCURRENCY,
    abortSignal: signal,
  });

  await pool.run(ids, async (id) => {
    try {
      const res = await fetch(`/api/briefings/${encodeURIComponent(id)}`, {
        headers: { 'x-aparture-password': encodePasswordHeader(password) },
        signal,
      });
      if (!res.ok) {
        console.warn(`[useSeenPapers migration] briefing ${id} returned HTTP ${res.status}`);
        anyFailed = true;
        return;
      }
      const entry = await res.json();
      const ts = entry?.timestamp ?? Date.now();
      const iso = new Date(ts).toISOString().slice(0, 10);
      const papers = papersFromBriefing(entry);
      for (const paper of papers) {
        const arxivId = paper?.id;
        if (!arxivId || arxivId.startsWith('_')) continue;
        const existing = merged[arxivId];
        // Earliest-date-wins: keep the oldest known sighting across briefings.
        if (!existing || iso < existing) merged[arxivId] = iso;
      }
    } catch (err) {
      console.warn(`[useSeenPapers migration] briefing ${id} fetch threw:`, err);
      anyFailed = true;
    }
  });

  // A signal abort surfaces as a per-briefing throw above and flips anyFailed;
  // that's the correct "don't seal, retry later" outcome too.
  if (anyFailed) return null;

  return merged;
}

/**
 * Cross-run paper-dedupe index hook.
 *
 * @param {{ password?: string }} [opts]
 *   `password` is forwarded to the migration's /api/briefings calls.
 * @returns {{
 *   index: Record<string, string>,
 *   ready: boolean,
 *   recordRun: (papers: Array<{id?: string}>, runTimestamp: number) => void,
 * }}
 *   `index` is the live `{arxivId → ISO date}` map plus `_migratedAt` and
 *   `_dedupeVersion` metadata keys. `ready` flips true once the one-time
 *   migration completes. `recordRun` merges fresh IDs from a just-saved
 *   briefing into the index (first-date-wins) and prunes >90-day entries;
 *   fired after a successful briefing-save (NOT on every cold session save,
 *   which historically poisoned the index with aborted-run papers).
 */
export function useSeenPapers({ password = '' } = {}) {
  // One-time bootstrap read, computed lazily at mount. readStored does a
  // localStorage.getItem + JSON.parse of an index that can reach ~1.25 MB —
  // running that in the hook body on every App render was pure waste: the
  // value is only needed to seed state, and this hook owns all writes, so
  // post-mount renders never need a fresh read.
  const [bootstrap] = useState(() => {
    const initial = readStored();
    const initialVersion = Number.isInteger(initial?._dedupeVersion) ? initial._dedupeVersion : 0;
    const needsMigration = !initial?._migratedAt || initialVersion < CURRENT_DEDUPE_VERSION;
    // When the stored index predates CURRENT_DEDUPE_VERSION it was built from
    // sessions (v1) and is poisoned by aborted-run papers. Start the in-memory
    // state empty so the pipeline doesn't dedupe against bad data during the
    // rebuild window — localStorage is cleared inside the migration effect.
    const isVersionUpgrade = needsMigration && Boolean(initial?._migratedAt);
    return { initial, needsMigration, isVersionUpgrade };
  });
  const { needsMigration, isVersionUpgrade } = bootstrap;
  const [index, setIndex] = useState(() =>
    bootstrap.isVersionUpgrade ? {} : (bootstrap.initial ?? {})
  );
  const [ready, setReady] = useState(!bootstrap.needsMigration);

  // Migration from briefings on disk. Runs when either (a) we've never
  // migrated, or (b) the stored index predates CURRENT_DEDUPE_VERSION.
  // Depends on `password` so it waits for the store-hydrated value rather
  // than firing once on mount with an empty string — the latter would 401
  // against /api/briefings and historically marked the migration "complete"
  // with an empty index, leaving the user permanently stuck. The success
  // ref blocks re-runs once a real migration completes; failed attempts
  // (auth not ready, fetch threw, signal aborted) leave the ref unset so
  // the next effect run gets another shot.
  const migrationSuccessRef = useRef(false);
  useEffect(() => {
    if (!needsMigration || migrationSuccessRef.current) return;
    const controller = new AbortController();
    let cancelled = false;
    // Clear the polluted v1 index from localStorage immediately so a refresh
    // mid-migration doesn't restore the poisoned state. Safe because the
    // in-memory `index` was already initialized to {} when isVersionUpgrade.
    if (isVersionUpgrade && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Best-effort.
      }
    }
    (async () => {
      const migrated = await migrateFromBriefings({
        password,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (migrated === null) {
        // Auth not ready / fetch threw / aborted — don't mark sentinels.
        // The effect will re-fire when `password` next changes (e.g. after
        // hydration) or on next mount, and we'll try again.
        return;
      }
      migrationSuccessRef.current = true;
      // Merge — NOT overwrite — against the live in-memory index. Any arxivIds
      // recorded by recordRun between mount and now (recordRun is not gated on
      // `ready`) must survive migration completion; a wholesale setIndex(pruned)
      // would silently drop them, losing first-seen dates and forcing needless
      // re-analysis next run. mergeEarliestWins keeps the older of the two dates
      // for shared IDs and ignores `_`-prefixed sentinels (re-stamped below).
      setIndex((prev) => {
        const merged = mergeEarliestWins(prev, migrated);
        merged._migratedAt = Date.now();
        merged._dedupeVersion = CURRENT_DEDUPE_VERSION;
        const pruned = pruneOldEntries(merged, Date.now());
        // Sentinel keys are millis/int, not ISO; prune only checks ISO strings.
        // Defensive re-set so the sentinels survive prune.
        if (!pruned._migratedAt) pruned._migratedAt = Date.now();
        if (!pruned._dedupeVersion) pruned._dedupeVersion = CURRENT_DEDUPE_VERSION;
        persistIndex(pruned);
        return pruned;
      });
      setReady(true);
    })();
    return () => {
      controller.abort();
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  // recordRun: merge fresh paper IDs from a just-completed run into the
  // index. First-date-wins — once an arxivId has a recorded date, it is
  // never overwritten. This preserves the "first seen on YYYY-MM-DD" signal
  // shown in the badge tooltip. Prunes >90-day entries on every call.
  // Short-circuits (returns same state reference) when no new IDs are found,
  // so React skips re-renders and persist round-trips on overlapping runs.
  // Persists via safeSetItem; quota failures log but preserve in-memory
  // state for the session.
  const recordRun = useCallback((papers, runTimestamp) => {
    const ts = Number.isFinite(runTimestamp) ? runTimestamp : Date.now();
    const stampIso = isoDateUTC(ts);
    setIndex((prev) => {
      const next = { ...prev };
      let anyChange = false;
      for (const paper of papers ?? []) {
        const id = paper?.id;
        if (!id || id.startsWith('_')) continue;
        // First-wins: only record if this arxivId hasn't been seen before.
        if (!next[id]) {
          next[id] = stampIso;
          anyChange = true;
        }
      }
      // If no new IDs were added, return the same reference so React skips
      // re-renders and we avoid an unnecessary persist round-trip.
      if (!anyChange) return prev;
      const pruned = pruneOldEntries(next, Date.now());
      // Do NOT stamp _migratedAt here. The migration effect is the sole owner
      // of the (_migratedAt, _dedupeVersion) sentinel pair, and it always sets
      // both together. A recordRun firing during the migration window (before
      // the effect resolves) used to stamp _migratedAt alone — leaving
      // _dedupeVersion absent → initialVersion=0 + _migratedAt present on next
      // mount → isVersionUpgrade=true → a full localStorage-clearing rebuild
      // that erased these very entries. Omitting the stamp keeps the two
      // sentinels from ever desyncing; pruneOldEntries already carries forward
      // any sentinels already present in `prev`.
      persistIndex(pruned);
      return pruned;
    });
  }, []);

  return { index, ready, recordRun };
}
