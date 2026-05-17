import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSeenPapers } from '../../../hooks/useSeenPapers.js';

beforeEach(() => {
  window.localStorage.clear();
  // Default fetch mock — migration test will override per case.
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ids: [] }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSeenPapers — basic shape', () => {
  it('starts with an empty index and ready=false on first mount with no key', () => {
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    expect(result.current.index).toEqual({});
    expect(result.current.ready).toBe(false);
  });

  it('exposes index, ready, and recordRun', () => {
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    expect(typeof result.current.recordRun).toBe('function');
    expect('index' in result.current).toBe(true);
    expect('ready' in result.current).toBe(true);
  });
});

describe('useSeenPapers — recordRun', () => {
  beforeEach(() => {
    // Seed an already-migrated empty index so we don't kick off the
    // migration flow in these tests.
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({ _migratedAt: Date.now() })
    );
  });

  it('merges new arxivIds into the index with a YYYY-MM-DD date', () => {
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    const ts = Date.parse('2026-05-14T12:00:00Z');
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }, { id: '2605.14210' }], ts);
    });
    expect(result.current.index['2605.14205']).toBe('2026-05-14');
    expect(result.current.index['2605.14210']).toBe('2026-05-14');
  });

  it('keeps the EARLIEST date when an arxivId appears twice (first-wins)', () => {
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], Date.parse('2026-03-01T00:00:00Z'));
    });
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], Date.parse('2026-05-14T00:00:00Z'));
    });
    // First-wins: the initial date is preserved even when the same ID is
    // recorded again at a later timestamp.
    expect(result.current.index['2605.14205']).toBe('2026-03-01');
  });

  it('persists the merged index to localStorage', () => {
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], Date.parse('2026-05-14T00:00:00Z'));
    });
    const raw = window.localStorage.getItem('aparture-seen-papers-index');
    const parsed = JSON.parse(raw);
    expect(parsed['2605.14205']).toBe('2026-05-14');
    expect(parsed._migratedAt).toBeDefined();
  });

  it('skips paper entries without an id', () => {
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      result.current.recordRun(
        [{ id: '2605.14205' }, { title: 'no id' }],
        Date.parse('2026-05-14T00:00:00Z')
      );
    });
    expect(Object.keys(result.current.index).filter((k) => !k.startsWith('_'))).toEqual([
      '2605.14205',
    ]);
  });
});

describe('useSeenPapers — 90-day prune', () => {
  it('drops entries older than 90 days on every write', () => {
    // Seed an index with one stale + one fresh entry.
    const now = Date.parse('2026-05-14T00:00:00Z');
    const oldDate = new Date(now - 100 * 86400 * 1000).toISOString().slice(0, 10);
    const freshDate = new Date(now - 30 * 86400 * 1000).toISOString().slice(0, 10);
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({
        _migratedAt: now,
        'stale.000': oldDate,
        'fresh.000': freshDate,
      })
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], now);
    });

    expect(result.current.index['stale.000']).toBeUndefined();
    expect(result.current.index['fresh.000']).toBe(freshDate);
    expect(result.current.index['2605.14205']).toBe('2026-05-14');

    vi.useRealTimers();
  });

  it('preserves the _migratedAt metadata key during prune', () => {
    const now = Date.parse('2026-05-14T00:00:00Z');
    window.localStorage.setItem('aparture-seen-papers-index', JSON.stringify({ _migratedAt: now }));
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], now);
    });
    expect(result.current.index._migratedAt).toBeDefined();
  });
});

describe('useSeenPapers — quota fallback', () => {
  it('logs a warning when safeSetItem returns false (quota exceeded)', () => {
    // Force every localStorage.setItem to throw QuotaExceededError.
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Pre-seed an "already migrated" sentinel via a direct write that
    // bypasses the spy — we set the spy *after* this seed.
    setItemSpy.mockRestore();
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({ _migratedAt: Date.now() })
    );
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    });

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], Date.parse('2026-05-14T00:00:00Z'));
    });

    expect(warn).toHaveBeenCalled();
    // In-memory state is still updated even when persist fails.
    expect(result.current.index['2605.14205']).toBe('2026-05-14');
  });
});

describe('useSeenPapers — migration from existing sessions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates the index from /api/sessions when no _migratedAt is present', async () => {
    const sessions = {
      'sess-1': {
        results: { allPapers: [{ id: '2605.14205' }, { id: '2605.14210' }] },
        timestamp: Date.parse('2026-05-10T00:00:00Z'),
      },
      'sess-2': {
        results: { allPapers: [{ id: '2605.14210' }, { id: '2605.14211' }] },
        timestamp: Date.parse('2026-05-12T00:00:00Z'),
      },
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/sessions?') || u.endsWith('/api/sessions')) {
        return { ok: true, status: 200, json: async () => ({ ids: Object.keys(sessions) }) };
      }
      const m = u.match(/\/api\/sessions\/([^?]+)/);
      if (m && sessions[m[1]]) {
        return { ok: true, status: 200, json: async () => sessions[m[1]] };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    });

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.index['2605.14205']).toBe('2026-05-10');
    // 14210 appears in both — earliest date wins (sess-1: 2026-05-10, sess-2: 2026-05-12)
    expect(result.current.index['2605.14210']).toBe('2026-05-10');
    expect(result.current.index['2605.14211']).toBe('2026-05-12');
    expect(result.current.index._migratedAt).toBeDefined();
  });

  it('continues and marks _migratedAt even if one session GET fails', async () => {
    const sessions = {
      'sess-ok': {
        results: { allPapers: [{ id: '2605.14205' }] },
        timestamp: Date.parse('2026-05-10T00:00:00Z'),
      },
    };
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/sessions?') || u.endsWith('/api/sessions')) {
        return { ok: true, status: 200, json: async () => ({ ids: ['sess-ok', 'sess-bad'] }) };
      }
      if (u.includes('sess-ok')) {
        return { ok: true, status: 200, json: async () => sessions['sess-ok'] };
      }
      if (u.includes('sess-bad')) {
        return { ok: false, status: 500, json: async () => ({ error: 'boom' }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'nope' }) };
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.index['2605.14205']).toBe('2026-05-10');
    expect(result.current.index._migratedAt).toBeDefined();
  });

  it('skips migration when an _migratedAt sentinel is already present', async () => {
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({ _migratedAt: Date.now(), 'seeded.000': '2026-04-01' })
    );
    const fetchSpy = vi.spyOn(global, 'fetch');

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    // ready should be true synchronously since _migratedAt was present.
    expect(result.current.ready).toBe(true);
    expect(result.current.index['seeded.000']).toBe('2026-04-01');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
