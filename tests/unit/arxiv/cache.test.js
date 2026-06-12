import { describe, it, expect, beforeEach, vi } from 'vitest';
import { lookup, store, clear, SCHEMA_VERSION } from '../../../lib/arxiv/cache.js';

const examplePaper = (id) => ({
  id,
  title: id,
  abstract: '',
  authors: [],
  published: '2026-04-28',
  updated: '2026-04-28',
  categories: ['cs.AI'],
  pdfUrl: '',
  fetchedCategory: 'cs.AI',
});

beforeEach(() => {
  localStorage.clear();
});

describe('cache', () => {
  it('returns null on miss', () => {
    expect(
      lookup({ set: 'cs', from: '2026-04-28', until: '2026-04-29', mode: 'auto', ttlMinutes: 60 })
    ).toBeNull();
  });

  it('round-trips a stored entry', () => {
    const records = [examplePaper('A')];
    store({ set: 'cs', from: '2026-04-28', until: '2026-04-29', mode: 'auto', records });
    const hit = lookup({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      ttlMinutes: 60,
    });
    expect(hit).not.toBeNull();
    expect(hit.records).toEqual(records);
  });

  it('returns null after TTL expires', () => {
    const records = [examplePaper('A')];
    store({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      records,
      now: 0,
    });
    const hit = lookup({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      ttlMinutes: 60,
      now: 60 * 60 * 1000 + 1,
    });
    expect(hit).toBeNull();
  });

  it('treats schemaVersion mismatch as miss and clears the entry', () => {
    const raw = JSON.stringify({
      'cs|2026-04-28|2026-04-29|auto': {
        records: [examplePaper('A')],
        schemaVersion: SCHEMA_VERSION - 99,
        cachedAt: Date.now(),
      },
    });
    localStorage.setItem('aparture-arxiv-cache', raw);
    const hit = lookup({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      ttlMinutes: 60,
    });
    expect(hit).toBeNull();
    expect(localStorage.getItem('aparture-arxiv-cache')).not.toContain(
      `schemaVersion":${SCHEMA_VERSION - 99}`
    );
  });

  it('deletes the expired entry from storage on lookup', () => {
    store({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      records: [examplePaper('A')],
      now: 0,
    });
    lookup({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      ttlMinutes: 60,
      now: 60 * 60 * 1000 + 1,
    });
    const after = JSON.parse(localStorage.getItem('aparture-arxiv-cache'));
    expect(after['cs|2026-04-28|2026-04-29|auto']).toBeUndefined();
  });

  it('windowSemantics is part of the cache key when provided', () => {
    store({
      set: 'cs:cs:GT',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      windowSemantics: 'submitted-only',
      records: [examplePaper('A')],
    });
    // Other semantics value: miss.
    expect(
      lookup({
        set: 'cs:cs:GT',
        from: '2026-04-28',
        until: '2026-04-29',
        mode: 'auto',
        windowSemantics: 'submitted-or-updated',
        ttlMinutes: 60,
      })
    ).toBeNull();
    // No semantics (broad-fetch key shape): also a miss.
    expect(
      lookup({
        set: 'cs:cs:GT',
        from: '2026-04-28',
        until: '2026-04-29',
        mode: 'auto',
        ttlMinutes: 60,
      })
    ).toBeNull();
    // Matching semantics: hit.
    expect(
      lookup({
        set: 'cs:cs:GT',
        from: '2026-04-28',
        until: '2026-04-29',
        mode: 'auto',
        windowSemantics: 'submitted-only',
        ttlMinutes: 60,
      })
    ).not.toBeNull();
  });

  it('mode is part of the cache key', () => {
    store({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      records: [examplePaper('A')],
    });
    const otherMode = lookup({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'oai-only',
      ttlMinutes: 60,
    });
    expect(otherMode).toBeNull();
  });

  it('clear() removes the entire cache', () => {
    store({
      set: 'cs',
      from: '2026-04-28',
      until: '2026-04-29',
      mode: 'auto',
      records: [examplePaper('A')],
    });
    clear();
    expect(localStorage.getItem('aparture-arxiv-cache')).toBeNull();
  });

  it('survives QuotaExceededError by evicting oldest 50% and retrying', () => {
    // Pre-populate with several entries (different cachedAt) to enable eviction.
    const seedEntries = {};
    for (let i = 0; i < 6; i++) {
      seedEntries[`set${i}|f|u|m`] = {
        records: [examplePaper(`p${i}`)],
        schemaVersion: SCHEMA_VERSION,
        cachedAt: i,
      };
    }
    localStorage.setItem('aparture-arxiv-cache', JSON.stringify(seedEntries));

    // jsdom v29's Storage is a Proxy that routes property assignments through
    // setItem(P, String(value)) — so `localStorage.setItem = fn` does NOT
    // replace the method. Patch the prototype instead, mirroring the pattern
    // already established in tests/unit/hooks/useBriefing.test.js.
    let throws = 1;
    const realSetItem = window.Storage.prototype.setItem;
    const spy = vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (throws > 0) {
        throws -= 1;
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
      return realSetItem.call(this, k, v);
    });

    expect(() =>
      store({
        set: 'newset',
        from: 'f',
        until: 'u',
        mode: 'auto',
        records: [examplePaper('Z')],
      })
    ).not.toThrow();

    spy.mockRestore();
    const after = JSON.parse(localStorage.getItem('aparture-arxiv-cache'));
    // Half the original entries should be gone.
    expect(Object.keys(after).length).toBeLessThanOrEqual(4);
  });
});
