import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

  it('keeps the most recent date when an arxivId appears twice', () => {
    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], Date.parse('2026-03-01T00:00:00Z'));
    });
    act(() => {
      result.current.recordRun([{ id: '2605.14205' }], Date.parse('2026-05-14T00:00:00Z'));
    });
    expect(result.current.index['2605.14205']).toBe('2026-05-14');
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
