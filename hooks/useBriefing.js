import { useState, useCallback } from 'react';
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

export function useBriefing() {
  const [current, setCurrent] = useState(readStoredCurrent);
  const [history, setHistory] = useState(readStoredHistory);

  const saveBriefing = useCallback(
    (
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
      return id;
    },
    []
  );

  const deleteBriefing = useCallback((id) => {
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
  }, []);

  const toggleArchive = useCallback((id) => {
    setHistory((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, archived: !b.archived } : b));
      persistHistory(next);
      return next;
    });
  }, []);

  return { current, history, saveBriefing, deleteBriefing, toggleArchive };
}
