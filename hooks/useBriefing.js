import { useState, useCallback, useRef, useEffect } from 'react';
import { buildIndexEntry } from '../lib/briefing/buildIndexEntry.js';
import { safeSetItem } from '../lib/persistence/safeStorage.js';

const CURRENT_KEY = 'aparture-briefing-current';
const HISTORY_KEY = 'aparture-briefing-index';
const MAX_HISTORY = 90;

// Fields that can be dropped on quota pressure without losing the briefing
// itself: expand-on-click text blobs and the full pipeline-archive payload.
// Dropping them degrades the old-briefing view (quick summaries + full
// reports show placeholders; pipeline archive panel hides) but keeps the
// briefing readable.
const HEAVY_FIELDS = ['pipelineArchive', 'quickSummariesById', 'fullReportsById'];

function stripHeavy(entry) {
  const out = { ...entry };
  for (const key of HEAVY_FIELDS) delete out[key];
  return out;
}

// Persist a newest-first array of briefings. On quota, prune oldest entries
// from the tail; if that still doesn't fit, strip heavy fields. If all
// strategies fail, log and skip — in-memory state is preserved so the live
// session isn't disrupted; next reload will see the last successful write.
//
// `onDropEntries(droppedEntries)` is invoked (once, with the array of index
// entries removed from the tail for quota) so the caller can unlink the
// corresponding cold files. Without this, a quota-prune would orphan
// `reports/briefings/<id>.json` files: invisible in the UI (gone from the
// search index) yet still on disk. The reindex effect only fires when the
// hot index is EMPTY, so a partially-pruned index never self-heals.
function persistHistory(entries, onDropEntries) {
  if (typeof window === 'undefined') return;
  let toPersist = entries;
  let dropped = [];
  while (toPersist.length > 0) {
    if (safeSetItem(HISTORY_KEY, JSON.stringify(toPersist))) {
      if (dropped.length > 0 && onDropEntries) onDropEntries(dropped);
      return;
    }
    if (toPersist.length <= 1) break;
    dropped = entries.slice(toPersist.length - 1);
    toPersist = toPersist.slice(0, -1);
    console.warn(
      `[useBriefing] localStorage quota exceeded; pruning oldest briefing (${toPersist.length}/${entries.length} entries will be persisted)`
    );
  }
  const stripped = toPersist.map(stripHeavy);
  if (stripped.length > 0 && safeSetItem(HISTORY_KEY, JSON.stringify(stripped))) {
    if (dropped.length > 0 && onDropEntries) onDropEntries(dropped);
    console.warn(
      '[useBriefing] localStorage quota exceeded; persisted briefing history without pipeline archive / full reports'
    );
    return;
  }
  console.warn(
    '[useBriefing] localStorage quota exceeded; briefing history could not be persisted (in-memory state preserved for this session)'
  );
}

function persistCurrent(entry) {
  if (typeof window === 'undefined') return;
  if (safeSetItem(CURRENT_KEY, JSON.stringify(entry))) return;
  // Quota fallback: drop heavy fields from the HOT tier, but flag the blob so
  // a later rehydrate (readStoredCurrent → loadBriefing) knows the in-memory
  // copy is incomplete and must be rehydrated from the COLD disk tier, where
  // postBriefing already wrote the full entry. Without this flag, loadBriefing's
  // fast path would return the stripped current and render placeholders for the
  // freshest briefing — the one most likely to have tripped quota.
  if (safeSetItem(CURRENT_KEY, JSON.stringify({ ...stripHeavy(entry), _strippedFromHot: true }))) {
    console.warn(
      '[useBriefing] localStorage quota exceeded; persisted current briefing without pipeline archive / full reports'
    );
    return;
  }
  console.warn(
    '[useBriefing] localStorage quota exceeded; current briefing could not be persisted (in-memory state preserved for this session)'
  );
}

function generateId() {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Backfill legacy entries that lack id / timestamp / archived. */
function migrateEntry(entry, index) {
  if (entry.id && entry.timestamp !== undefined && entry.archived !== undefined) {
    return entry;
  }
  return {
    id: entry.id ?? `legacy-${entry.date ?? index}`,
    date: entry.date ?? 'unknown',
    timestamp: entry.timestamp ?? (entry.date ? new Date(entry.date + 'T00:00:00').getTime() : 0),
    briefing: entry.briefing,
    generationMetadata: entry.generationMetadata,
    archived: entry.archived ?? false,
  };
}

function readStoredCurrent() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrateEntry(parsed, 0);
  } catch {
    return null;
  }
}

const LEGACY_HISTORY_KEY = 'aparture-briefing-history';

// Migration: move legacy single-key history entries to per-file storage +
// rebuild the index. No-op when the legacy key is absent. Failures (e.g. a
// transient 500) keep the affected entries in the legacy blob so a later
// attempt can retry — historically we removed the legacy key on partial
// failure, which silently orphaned briefings as soon as the post-migration
// disk file was missing.
async function migrateLegacyHistoryIfNeeded({ password }) {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LEGACY_HISTORY_KEY);
  if (!raw) return null;

  let legacy;
  try {
    legacy = JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
    return null;
  }
  if (!Array.isArray(legacy)) {
    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
    return null;
  }

  const succeededIndexEntries = [];
  const remainingLegacy = [];
  for (let i = 0; i < legacy.length; i++) {
    const entry = migrateEntry(legacy[i], i);
    try {
      const res = await fetch('/api/briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, entry }),
      });
      if (!res.ok) {
        console.warn(`[useBriefing migration] POST failed for ${entry.id}: HTTP ${res.status}`);
        remainingLegacy.push(legacy[i]);
        continue;
      }
      succeededIndexEntries.push(buildIndexEntry(entry));
    } catch (err) {
      console.warn(`[useBriefing migration] POST threw for ${entry.id}:`, err);
      remainingLegacy.push(legacy[i]);
    }
  }

  // Merge successes into whatever index already exists (prior successful
  // migration runs from earlier mounts) — preferring the freshly built
  // index entry on duplicate id so any schema bumps in migrateEntry/
  // buildIndexEntry land.
  const existing = readStoredHistory();
  const mergedById = new Map();
  for (const entry of existing) mergedById.set(entry.id, entry);
  for (const entry of succeededIndexEntries) mergedById.set(entry.id, entry);
  const merged = Array.from(mergedById.values()).sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );

  // safeSetItem: a quota failure here must not throw out of the migration —
  // log and carry on with in-memory state; the next attempt rewrites both keys.
  if (!safeSetItem(HISTORY_KEY, JSON.stringify(merged))) {
    console.warn(
      '[useBriefing migration] localStorage quota exceeded; merged index could not be persisted (in-memory state preserved for this session)'
    );
  }
  if (remainingLegacy.length === 0) {
    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
  } else {
    // On quota failure the legacy key keeps its previous (fuller) contents —
    // the next attempt re-POSTs already-migrated entries, which is idempotent
    // (same ids overwrite the same files on disk).
    if (!safeSetItem(LEGACY_HISTORY_KEY, JSON.stringify(remainingLegacy))) {
      console.warn(
        '[useBriefing migration] localStorage quota exceeded; trimmed legacy blob could not be persisted'
      );
    }
    console.warn(
      `[useBriefing migration] ${remainingLegacy.length}/${legacy.length} legacy entries could not be migrated; will retry later`
    );
  }
  return merged;
}

function readStoredHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    return entries.map((b, i) => buildIndexEntry(migrateEntry(b, i)));
  } catch {
    return [];
  }
}

export function useBriefing({ password = '' } = {}) {
  const [current, setCurrent] = useState(readStoredCurrent);
  const [history, setHistory] = useState(readStoredHistory);

  // Password is plumbed through a ref so async methods read the latest value
  // without forcing the callbacks to re-create on every render. The ref is
  // kept in sync via an effect (assigning during render would trip the
  // react-hooks/refs rule).
  const passwordRef = useRef(password);
  useEffect(() => {
    passwordRef.current = password;
  }, [password]);

  // Current briefing ref for loadBriefing's fast path — lets the callback
  // read the latest `current` without listing it as a dep (which would
  // force the callback to re-create on every briefing save).
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // History ref for toggleArchive so we can read the current archived flag
  // synchronously outside the setHistory updater (React 18 batches state
  // updaters so reading a closed-over variable written inside the updater
  // races the rest of the callback).
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Unlink cold files for index entries pruned by a quota-prune in
  // persistHistory. Without this, the cold `reports/briefings/<id>.json`
  // files orphan: gone from the search index (so invisible in the UI) yet
  // still on disk. Lossy-but-consistent: we drop the same briefings from
  // both tiers. Best-effort — DELETE failures just log. Declared above the
  // reindex effect so that effect can reference it without a TDZ error.
  const unlinkDroppedColdFiles = useCallback((droppedEntries) => {
    for (const entry of droppedEntries) {
      if (!entry?.id) continue;
      fetch(
        `/api/briefings/${encodeURIComponent(entry.id)}?password=${encodeURIComponent(passwordRef.current)}`,
        { method: 'DELETE' }
      ).catch((err) => {
        console.warn('[useBriefing] failed to unlink quota-pruned cold briefing', entry.id, err);
      });
    }
  }, []);

  // Migration from the legacy single-key history to filesystem + search-
  // capable index. Depends on `password` so it waits for the store-hydrated
  // value rather than firing once on mount with an empty string — the latter
  // would 401 every per-entry POST and strand the entries in the legacy blob
  // forever, repeating on every reload (same failure mode as the seen-papers
  // v2 migration, fixed in useSeenPapers). The success ref blocks re-runs once
  // the legacy key is fully drained; partial failures leave it unset so the
  // next password change gets another shot.
  const legacyMigrationSuccessRef = useRef(false);
  useEffect(() => {
    if (!password || legacyMigrationSuccessRef.current) return;
    let cancelled = false;
    migrateLegacyHistoryIfNeeded({ password })
      .then((migrated) => {
        if (cancelled) return;
        if (migrated) setHistory(migrated);
        // Only seal once the legacy key is gone (every entry POSTed, or there
        // was nothing to migrate). Entries retained for retry leave it unset.
        if (typeof window !== 'undefined' && !window.localStorage.getItem(LEGACY_HISTORY_KEY)) {
          legacyMigrationSuccessRef.current = true;
        }
      })
      .catch((err) => {
        console.warn('[useBriefing migration] failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [password]);

  // Fallback: when the local hot-tier index is empty but disk has briefings
  // (e.g. fresh machine on a Dropbox-synced repo, or localStorage was
  // cleared), rebuild the index from disk so the UI list isn't blank. The
  // tried-ref is only set on a DEFINITIVE outcome (rebuild succeeded, disk is
  // empty, or the hot index already has entries) — cancellation and transient
  // non-OK/network failures leave it unset so the password-dep retry still
  // works instead of permanently forfeiting the rebuild for the session.
  const reindexTriedRef = useRef(false);
  useEffect(() => {
    if (!password || reindexTriedRef.current) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (cancelled) return;
      // Give legacy migration a tick to land; if it produced entries we
      // don't need to refetch from disk.
      if (historyRef.current.length > 0) {
        reindexTriedRef.current = true;
        return;
      }
      try {
        const res = await fetch(`/api/briefings?index=1&password=${encodeURIComponent(password)}`);
        if (cancelled) return;
        if (!res.ok) {
          // Transient (401 pre-hydration, 5xx, ...) — leave the ref unset so a
          // later password change retries.
          console.warn(`[useBriefing reindex] HTTP ${res.status}; will retry`);
          return;
        }
        const { entries = [] } = await res.json();
        if (cancelled) return;
        if (entries.length === 0) {
          // Definitive: disk has no briefings, nothing to rebuild.
          reindexTriedRef.current = true;
          return;
        }
        const sorted = entries.slice().sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
        setHistory(sorted);
        persistHistory(sorted, unlinkDroppedColdFiles);
        reindexTriedRef.current = true;
      } catch (err) {
        console.warn('[useBriefing reindex] failed:', err);
      }
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [password, unlinkDroppedColdFiles]);

  // Fire-and-await POST to the filesystem tier. Best-effort: failures log but
  // don't throw, since hot-tier state already reflects the save.
  const postBriefing = useCallback(async (entry) => {
    try {
      const res = await fetch('/api/briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordRef.current, entry }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('[useBriefing] failed to persist briefing to disk:', err);
    }
  }, []);

  const saveBriefing = useCallback(
    async (
      date,
      briefing,
      generationMetadata,
      { quickSummariesById, fullReportsById, pipelineArchive } = {}
    ) => {
      const id = generateId();
      const entry = {
        id,
        date,
        timestamp: Date.now(),
        briefing,
        archived: false,
        ...(generationMetadata !== undefined ? { generationMetadata } : {}),
        ...(quickSummariesById ? { quickSummariesById } : {}),
        ...(fullReportsById ? { fullReportsById } : {}),
        ...(pipelineArchive ? { pipelineArchive } : {}),
      };
      setCurrent(entry);
      persistCurrent(entry);
      setHistory((prev) => {
        const full = [buildIndexEntry(entry), ...prev];
        const next = full.slice(0, MAX_HISTORY);
        // Entries rotated off the MAX_HISTORY tail must have their cold files
        // unlinked too — same lossy-but-consistent contract as the quota-prune
        // path. Without this, capped-out histories orphan one
        // reports/briefings/<id>.json per save.
        const rotatedOff = full.slice(MAX_HISTORY);
        if (rotatedOff.length > 0) unlinkDroppedColdFiles(rotatedOff);
        persistHistory(next, unlinkDroppedColdFiles);
        return next;
      });
      await postBriefing(entry);
      return id;
    },
    [postBriefing, unlinkDroppedColdFiles]
  );

  const loadBriefing = useCallback(async (id) => {
    // Fast path: the current briefing has its heavy fields in memory already.
    // Skip it when the in-memory copy was rehydrated from a quota-stripped hot
    // blob (`_strippedFromHot`) — that copy is missing pipelineArchive /
    // quickSummariesById / fullReportsById and would render placeholders. Fall
    // through to the disk GET below, which holds the full entry (postBriefing
    // always wrote it on save).
    const state = currentRef.current;
    if (state?.id === id && !state._strippedFromHot) return state;

    try {
      const res = await fetch(
        `/api/briefings/${encodeURIComponent(id)}?password=${encodeURIComponent(passwordRef.current)}`
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[useBriefing] failed to load briefing', id, err);
      return null;
    }
  }, []);

  const deleteBriefing = useCallback(
    async (id) => {
      setHistory((prev) => {
        const next = prev.filter((b) => b.id !== id);
        persistHistory(next, unlinkDroppedColdFiles);
        return next;
      });
      setCurrent((prev) => {
        if (prev?.id === id) {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(CURRENT_KEY);
          }
          return null;
        }
        return prev;
      });

      try {
        await fetch(
          `/api/briefings/${encodeURIComponent(id)}?password=${encodeURIComponent(passwordRef.current)}`,
          { method: 'DELETE' }
        );
      } catch (err) {
        console.warn('[useBriefing] delete failed for', id, err);
      }
    },
    [unlinkDroppedColdFiles]
  );

  const toggleArchive = useCallback(
    async (id) => {
      const entry = historyRef.current.find((b) => b.id === id);
      if (!entry) return;
      const nextArchived = !entry.archived;

      setHistory((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, archived: nextArchived } : b));
        persistHistory(next, unlinkDroppedColdFiles);
        return next;
      });

      // Keep the current briefing in sync when the toggled entry IS current,
      // so loadBriefing's fast path doesn't return a stale archived flag.
      setCurrent((prev) => {
        if (prev?.id !== id) return prev;
        const next = { ...prev, archived: nextArchived };
        persistCurrent(next);
        return next;
      });

      try {
        await fetch(`/api/briefings/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: passwordRef.current,
            patch: { archived: nextArchived },
          }),
        });
      } catch (err) {
        console.warn('[useBriefing] toggleArchive failed for', id, err);
      }
    },
    [unlinkDroppedColdFiles]
  );

  return { current, history, saveBriefing, deleteBriefing, toggleArchive, loadBriefing };
}
