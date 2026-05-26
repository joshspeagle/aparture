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
//   sees the bumped sentinel. Partial failures are logged and skipped — we
//   always set _migratedAt + _dedupeVersion on completion so we don't re-scan.
//
// Phase 2 seam: when state migrates to ~/aparture/, only the STORAGE_KEY +
// migration source need updating; consumer contract (index/ready/recordRun)
// stays stable.

import { useCallback, useEffect, useRef, useState } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
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
// dev server. Partial failures are logged and skipped — we always set
// _migratedAt + _dedupeVersion at the end so we don't re-scan on every mount.
const MIGRATION_CONCURRENCY = 4;

// Returns:
//   - Object (possibly empty) → migration completed; caller may set sentinels.
//   - null                    → couldn't reach disk / auth not ready / aborted;
//                                caller should NOT set sentinels and should
//                                retry on next password change or next mount.
async function migrateFromBriefings({ password, signal }) {
  if (typeof window === 'undefined') return null;
  let listRes;
  try {
    listRes = await fetch(`/api/briefings?password=${encodeURIComponent(password ?? '')}`, {
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

  const pool = new AnalysisWorkerPool({
    concurrency: MIGRATION_CONCURRENCY,
    abortSignal: signal,
  });

  await pool.run(ids, async (id) => {
    try {
      const res = await fetch(
        `/api/briefings/${encodeURIComponent(id)}?password=${encodeURIComponent(password ?? '')}`,
        { signal }
      );
      if (!res.ok) {
        console.warn(`[useSeenPapers migration] briefing ${id} returned HTTP ${res.status}`);
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
    }
  });

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
  const initial = readStored();
  const initialVersion = Number.isInteger(initial?._dedupeVersion) ? initial._dedupeVersion : 0;
  const needsMigration = !initial?._migratedAt || initialVersion < CURRENT_DEDUPE_VERSION;
  // When the stored index predates CURRENT_DEDUPE_VERSION it was built from
  // sessions (v1) and is poisoned by aborted-run papers. Start the in-memory
  // state empty so the pipeline doesn't dedupe against bad data during the
  // rebuild window — localStorage is cleared inside the migration effect.
  const isVersionUpgrade = needsMigration && Boolean(initial?._migratedAt);
  const [index, setIndex] = useState(isVersionUpgrade ? {} : (initial ?? {}));
  const [ready, setReady] = useState(!needsMigration);

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
      migrated._migratedAt = Date.now();
      migrated._dedupeVersion = CURRENT_DEDUPE_VERSION;
      const pruned = pruneOldEntries(migrated, Date.now());
      // Sentinel keys are millis/int, not ISO; prune only checks ISO strings.
      // Defensive re-set so the sentinels survive prune.
      if (!pruned._migratedAt) pruned._migratedAt = Date.now();
      if (!pruned._dedupeVersion) pruned._dedupeVersion = CURRENT_DEDUPE_VERSION;
      migrationSuccessRef.current = true;
      setIndex(pruned);
      setReady(true);
      persistIndex(pruned);
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
      if (!pruned._migratedAt) pruned._migratedAt = Date.now();
      persistIndex(pruned);
      return pruned;
    });
  }, []);

  return { index, ready, recordRun };
}
