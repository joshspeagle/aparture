// Hook owning the cross-run paper-dedupe index. Mirrors hooks/useBriefing.js:
// read on mount, in-memory state, persist via safeSetItem, prune to a 90-day
// rolling window on every write.
//
// Index shape: { [arxivId]: 'YYYY-MM-DD', _migratedAt: <ms-ts> }
//   - Keys starting with '_' are reserved metadata (skipped by prune + dedupe lookups).
//   - Values are ISO `YYYY-MM-DD` strings (UTC) so lexicographic compare = date compare.
//
// First-mount migration:
//   When _migratedAt is absent, scan reports/sessions/*.json via the existing
//   /api/sessions endpoints (concurrency cap 4) to seed the index. Non-blocking;
//   callers see `ready: false` and an empty index until done. Partial failures
//   (a single 500ing session) are logged and skipped — we still set _migratedAt
//   on completion so we don't re-scan on every mount.
//
// Phase 2 seam: when state migrates to ~/aparture/, only the STORAGE_KEY +
// migration source need updating; consumer contract (index/ready/recordRun)
// stays stable.

import { useCallback, useEffect, useRef, useState } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';
import { AnalysisWorkerPool } from '../lib/analyzer/rateLimit.js';

const STORAGE_KEY = 'aparture-seen-papers-index';
const HORIZON_DAYS = 90;

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

// One-time migration: scan existing reports/sessions/*.json via the API
// and seed the index. Concurrency-capped to avoid hammering the dev server.
// Partial failure is acceptable — we always set _migratedAt at the end so
// we don't re-scan on every mount.
const MIGRATION_CONCURRENCY = 4;

async function migrateFromSessions({ password, signal }) {
  if (typeof window === 'undefined') return null;
  let listRes;
  try {
    listRes = await fetch(`/api/sessions?password=${encodeURIComponent(password ?? '')}`, {
      signal,
    });
  } catch (err) {
    console.warn('[useSeenPapers migration] /api/sessions list fetch threw:', err);
    return {};
  }
  if (!listRes.ok) {
    console.warn(`[useSeenPapers migration] /api/sessions list returned HTTP ${listRes.status}`);
    return {};
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
        `/api/sessions/${encodeURIComponent(id)}?password=${encodeURIComponent(password ?? '')}`,
        { signal }
      );
      if (!res.ok) {
        console.warn(`[useSeenPapers migration] session ${id} returned HTTP ${res.status}`);
        return;
      }
      const entry = await res.json();
      const ts = entry?.timestamp ?? Date.now();
      const iso = new Date(ts).toISOString().slice(0, 10);
      const papers = entry?.results?.allPapers ?? [];
      for (const paper of papers) {
        const arxivId = paper?.id;
        if (!arxivId || arxivId.startsWith('_')) continue;
        const existing = merged[arxivId];
        // Earliest-date-wins: keep the oldest known sighting across sessions.
        if (!existing || iso < existing) merged[arxivId] = iso;
      }
    } catch (err) {
      console.warn(`[useSeenPapers migration] session ${id} fetch threw:`, err);
    }
  });

  return merged;
}

/**
 * Cross-run paper-dedupe index hook.
 *
 * @param {{ password?: string }} [opts]
 *   `password` is forwarded to the migration's /api/sessions calls.
 * @returns {{
 *   index: Record<string, string>,
 *   ready: boolean,
 *   recordRun: (papers: Array<{id?: string}>, runTimestamp: number) => void,
 * }}
 *   `index` is the live `{arxivId → ISO date}` map plus a `_migratedAt`
 *   metadata key. `ready` flips true once the one-time migration completes.
 *   `recordRun` merges fresh IDs from a just-saved session into the index
 *   (first-date-wins) and prunes >90-day entries; usually called from
 *   the `onColdSessionSaved` callback of useAnalyzerPersistence.
 */
export function useSeenPapers({ password = '' } = {}) {
  const initial = readStored();
  const [index, setIndex] = useState(initial ?? {});
  const [ready, setReady] = useState(Boolean(initial?._migratedAt));

  const passwordRef = useRef(password);
  useEffect(() => {
    passwordRef.current = password;
  }, [password]);

  // One-time migration from sessions on disk. Runs only when no _migratedAt
  // sentinel is present. Non-blocking — the hook returns ready=false until
  // migration completes; callers must tolerate an empty index in the
  // meantime (the pipeline does, in applyDedupe).
  useEffect(() => {
    if (initial?._migratedAt) return;
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      const migrated =
        (await migrateFromSessions({
          password: passwordRef.current,
          signal: controller.signal,
        })) ?? {};
      if (cancelled) return;
      migrated._migratedAt = Date.now();
      const pruned = pruneOldEntries(migrated, Date.now());
      // _migratedAt may have been pruned out (it's a millis number, the prune
      // only checks ISO strings) — defensive re-set.
      if (!pruned._migratedAt) pruned._migratedAt = Date.now();
      setIndex(pruned);
      setReady(true);
      persistIndex(pruned);
    })();
    return () => {
      controller.abort();
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
