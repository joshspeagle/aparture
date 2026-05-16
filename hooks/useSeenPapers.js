// Hook owning the "papers we've seen in past runs" index. Mirrors the
// pattern in hooks/useBriefing.js: read on mount, in-memory state, persist
// via safeSetItem, prune to a 90-day rolling window on every write.
//
// Index shape: { [arxivId]: 'YYYY-MM-DD', _migratedAt: <ms-ts> }
// Keys starting with '_' are reserved metadata.

import { useCallback, useEffect, useRef, useState } from 'react';
import { safeSetItem } from '../lib/persistence/safeStorage.js';

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

export function useSeenPapers({ password = '' } = {}) {
  const initial = readStored();
  const [index, setIndex] = useState(initial ?? {});
  const [ready, setReady] = useState(Boolean(initial?._migratedAt));

  // Keep password fresh in a ref for future async work (Task 3 migration).
  const passwordRef = useRef(password);
  useEffect(() => {
    passwordRef.current = password;
  }, [password]);

  const recordRun = useCallback((papers, runTimestamp) => {
    const ts = Number.isFinite(runTimestamp) ? runTimestamp : Date.now();
    const stampIso = isoDateUTC(ts);
    setIndex((prev) => {
      const next = { ...prev };
      for (const paper of papers ?? []) {
        const id = paper?.id;
        if (!id || id.startsWith('_')) continue;
        // Latest-wins: keep the more recent date.
        const existing = next[id];
        if (!existing || stampIso > existing) next[id] = stampIso;
      }
      const pruned = pruneOldEntries(next, Date.now());
      // Always carry a _migratedAt — set it now if it was missing.
      if (!pruned._migratedAt) pruned._migratedAt = Date.now();
      persistIndex(pruned);
      return pruned;
    });
  }, []);

  return { index, ready, recordRun, setReady, setIndex };
}
