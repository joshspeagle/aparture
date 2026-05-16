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

// One-time migration: scan existing reports/sessions/*.json via the API
// and seed the index. Concurrency-capped to avoid hammering the dev server.
// Partial failure is acceptable — we always set _migratedAt at the end so
// we don't re-scan on every mount.
const MIGRATION_CONCURRENCY = 4;

async function migrateFromSessions({ password }) {
  if (typeof window === 'undefined') return null;
  let listRes;
  try {
    listRes = await fetch(`/api/sessions?password=${encodeURIComponent(password ?? '')}`);
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

  // Concurrency-capped worker pool over ids.
  const queue = ids.slice();
  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(id)}?password=${encodeURIComponent(password ?? '')}`
        );
        if (!res.ok) {
          console.warn(`[useSeenPapers migration] session ${id} returned HTTP ${res.status}`);
          continue;
        }
        const entry = await res.json();
        const ts = entry?.timestamp ?? Date.now();
        const iso = new Date(ts).toISOString().slice(0, 10);
        const papers = entry?.results?.allPapers ?? [];
        for (const paper of papers) {
          const arxivId = paper?.id;
          if (!arxivId || arxivId.startsWith('_')) continue;
          const existing = merged[arxivId];
          if (!existing || iso > existing) merged[arxivId] = iso;
        }
      } catch (err) {
        console.warn(`[useSeenPapers migration] session ${id} fetch threw:`, err);
      }
    }
  }
  const workers = Array.from({ length: Math.min(MIGRATION_CONCURRENCY, ids.length || 1) }, () =>
    worker()
  );
  await Promise.all(workers);
  return merged;
}

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
    let cancelled = false;
    (async () => {
      const migrated = (await migrateFromSessions({ password: passwordRef.current })) ?? {};
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
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordRun = useCallback((papers, runTimestamp) => {
    const ts = Number.isFinite(runTimestamp) ? runTimestamp : Date.now();
    const stampIso = isoDateUTC(ts);
    setIndex((prev) => {
      const next = { ...prev };
      for (const paper of papers ?? []) {
        const id = paper?.id;
        if (!id || id.startsWith('_')) continue;
        const existing = next[id];
        if (!existing || stampIso > existing) next[id] = stampIso;
      }
      const pruned = pruneOldEntries(next, Date.now());
      if (!pruned._migratedAt) pruned._migratedAt = Date.now();
      persistIndex(pruned);
      return pruned;
    });
  }, []);

  return { index, ready, recordRun };
}
