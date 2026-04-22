import { useState, useCallback, useRef, useEffect } from 'react';
import { buildIndexEntry } from '../lib/briefing/buildIndexEntry.js';

const CURRENT_KEY = 'aparture-briefing-current';
const HISTORY_KEY = 'aparture-briefing-index';
const MAX_HISTORY = 90;

// Fields that can be dropped on quota pressure without losing the briefing
// itself: expand-on-click text blobs and the full pipeline-archive payload.
// Dropping them degrades the old-briefing view (quick summaries + full
// reports show placeholders; pipeline archive panel hides) but keeps the
// briefing readable.
const HEAVY_FIELDS = ['pipelineArchive', 'quickSummariesById', 'fullReportsById'];

function isQuotaError(err) {
  if (!err) return false;
  // Name varies across browsers; numeric codes 22 / 1014 are the legacy forms.
  const name = err.name || '';
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

function stripHeavy(entry) {
  const out = { ...entry };
  for (const key of HEAVY_FIELDS) delete out[key];
  return out;
}

function safeSetItem(key, value) {
  if (typeof window === 'undefined') return true;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaError(err)) return false;
    throw err;
  }
}

// Persist a newest-first array of briefings. On quota, prune oldest entries
// from the tail; if that still doesn't fit, strip heavy fields. If all
// strategies fail, log and skip — in-memory state is preserved so the live
// session isn't disrupted; next reload will see the last successful write.
function persistHistory(entries) {
  if (typeof window === 'undefined') return;
  let toPersist = entries;
  while (toPersist.length > 0) {
    if (safeSetItem(HISTORY_KEY, JSON.stringify(toPersist))) return;
    if (toPersist.length <= 1) break;
    toPersist = toPersist.slice(0, -1);
    console.warn(
      `[useBriefing] localStorage quota exceeded; pruning oldest briefing (${toPersist.length}/${entries.length} entries will be persisted)`
    );
  }
  const stripped = toPersist.map(stripHeavy);
  if (stripped.length > 0 && safeSetItem(HISTORY_KEY, JSON.stringify(stripped))) {
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
  if (safeSetItem(CURRENT_KEY, JSON.stringify(stripHeavy(entry)))) {
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

// One-shot migration: move legacy single-key history entries to per-file
// storage + rebuild the index. Runs on every mount; no-op when the legacy
// key is absent. Per spec: skip-and-log on per-entry failures, then remove
// the legacy key regardless of per-entry success so we don't retry forever.
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

  const newIndex = [];
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
        continue;
      }
      newIndex.push(buildIndexEntry(entry));
    } catch (err) {
      console.warn(`[useBriefing migration] POST threw for ${entry.id}:`, err);
    }
  }

  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(newIndex));
  window.localStorage.removeItem(LEGACY_HISTORY_KEY);
  return newIndex;
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

  // One-shot migration from the legacy single-key history to filesystem +
  // search-capable index. No-op when the legacy key is absent; the ref-in-
  // empty-deps pattern keeps this from firing on every render.
  useEffect(() => {
    migrateLegacyHistoryIfNeeded({ password: passwordRef.current }).then((migrated) => {
      if (migrated) setHistory(migrated);
    });
  }, []);

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
        const next = [buildIndexEntry(entry), ...prev].slice(0, MAX_HISTORY);
        persistHistory(next);
        return next;
      });
      await postBriefing(entry);
      return id;
    },
    [postBriefing]
  );

  const loadBriefing = useCallback(async (id) => {
    // Fast path: the current briefing has heavy fields in memory already.
    const state = currentRef.current;
    if (state?.id === id) return state;

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

  const deleteBriefing = useCallback(async (id) => {
    setHistory((prev) => {
      const next = prev.filter((b) => b.id !== id);
      persistHistory(next);
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
  }, []);

  const toggleArchive = useCallback(async (id) => {
    const entry = historyRef.current.find((b) => b.id === id);
    if (!entry) return;
    const nextArchived = !entry.archived;

    setHistory((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, archived: nextArchived } : b));
      persistHistory(next);
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
  }, []);

  return { current, history, saveBriefing, deleteBriefing, toggleArchive, loadBriefing };
}
