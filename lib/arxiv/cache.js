// localStorage-backed cache of harvest results. Spec §7.

const STORAGE_KEY = 'aparture-arxiv-cache';
export const SCHEMA_VERSION = 1;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}

function writeAll(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// windowSemantics is optional: only fill-up entries carry it (their records
// are post-filtered per semantics, so the toggle changes the payload). When
// absent the key shape is unchanged, keeping pre-existing broad-fetch
// entries readable.
function buildKey({ set, from, until, mode, windowSemantics }) {
  const base = `${set}|${from}|${until}|${mode}`;
  return windowSemantics ? `${base}|${windowSemantics}` : base;
}

export function lookup({ set, from, until, mode, windowSemantics, ttlMinutes, now = Date.now() }) {
  const entries = readAll();
  const key = buildKey({ set, from, until, mode, windowSemantics });
  const entry = entries[key];
  if (!entry) return null;
  if (entry.schemaVersion !== SCHEMA_VERSION) {
    // Stale schema: drop the entry so we don't keep hitting it on lookup.
    delete entries[key];
    try {
      writeAll(entries);
    } catch {
      // Cleanup is best-effort; if writing fails (e.g. quota), the stale
      // entry will simply be revisited on the next lookup.
    }
    return null;
  }
  if (ttlMinutes > 0 && now - entry.cachedAt > ttlMinutes * 60 * 1000) {
    // Expired: drop the entry so dead payloads don't pile up until quota
    // eviction. Same best-effort pattern as the schema-mismatch branch.
    delete entries[key];
    try {
      writeAll(entries);
    } catch {
      // Best-effort; revisited on the next lookup.
    }
    return null;
  }
  return { records: entry.records, cachedAt: entry.cachedAt };
}

export function store({ set, from, until, mode, windowSemantics, records, now = Date.now() }) {
  const entries = readAll();
  const key = buildKey({ set, from, until, mode, windowSemantics });
  entries[key] = { records, schemaVersion: SCHEMA_VERSION, cachedAt: now };

  try {
    writeAll(entries);
  } catch (err) {
    if (err?.name !== 'QuotaExceededError') throw err;
    // Evict oldest 50% of OTHER entries by cachedAt, preserving the new write.
    const sortedKeys = Object.keys(entries)
      .filter((k) => k !== key)
      .sort((a, b) => entries[a].cachedAt - entries[b].cachedAt);
    const evictCount = Math.ceil(sortedKeys.length / 2);
    for (let i = 0; i < evictCount; i++) delete entries[sortedKeys[i]];
    try {
      writeAll(entries);
    } catch (e2) {
      console.warn('arxiv cache: still over quota after eviction; skipping store', e2);
    }
  }
}

export function clear() {
  localStorage.removeItem(STORAGE_KEY);
}
