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
    // Seed an already-migrated empty v3 index so we don't kick off the
    // migration flow in these tests.
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({ _migratedAt: Date.now(), _dedupeVersion: 3 })
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
    // Pin the clock so the first (2026-03-01) recording stays inside the 90-day
    // prune window relative to "now" — otherwise this test silently flakes as
    // wall-clock time advances past 90 days from the hardcoded fixture date.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.parse('2026-05-20T00:00:00Z')));
    try {
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
    } finally {
      vi.useRealTimers();
    }
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
        _dedupeVersion: 3,
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
    // Seed a fully-migrated v3 index so the migration effect is a no-op and we
    // isolate pruneOldEntries' carry-through of the `_`-prefixed sentinel. (A
    // lone _migratedAt with no _dedupeVersion would trip the version-upgrade
    // rebuild — see the migration-window regression block — so it isn't a valid
    // standalone fixture for testing prune.)
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({ _migratedAt: now, _dedupeVersion: 3 })
    );
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

describe('useSeenPapers — migration from existing briefings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates the index from /api/briefings using briefed + filterResults union', async () => {
    const briefings = {
      'brief-1': {
        timestamp: Date.parse('2026-05-10T00:00:00Z'),
        briefing: { papers: [{ arxivId: '2605.14205' }] },
        pipelineArchive: {
          filterResults: {
            yes: [{ id: '2605.14205' }],
            maybe: [{ id: '2605.14210' }],
            no: [{ id: '2605.14299' }],
          },
        },
      },
      'brief-2': {
        timestamp: Date.parse('2026-05-12T00:00:00Z'),
        briefing: { papers: [{ arxivId: '2605.14211' }] },
        pipelineArchive: {
          filterResults: { yes: [], maybe: [{ id: '2605.14210' }], no: [] },
        },
      },
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/briefings?') || u.endsWith('/api/briefings')) {
        return { ok: true, status: 200, json: async () => ({ ids: Object.keys(briefings) }) };
      }
      const m = u.match(/\/api\/briefings\/([^?]+)/);
      if (m && briefings[m[1]]) {
        return { ok: true, status: 200, json: async () => briefings[m[1]] };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    });

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Briefed paper from brief-1
    expect(result.current.index['2605.14205']).toBe('2026-05-10');
    // 14210 (maybe-bucket) appears in both — earliest-date-wins (brief-1: 2026-05-10)
    expect(result.current.index['2605.14210']).toBe('2026-05-10');
    // 14299 (no-bucket) from brief-1 — filterResults union covers all buckets
    expect(result.current.index['2605.14299']).toBe('2026-05-10');
    // Briefed paper from brief-2
    expect(result.current.index['2605.14211']).toBe('2026-05-12');
    expect(result.current.index._migratedAt).toBeDefined();
    expect(result.current.index._dedupeVersion).toBe(3);
  });

  it('continues and marks sentinels even if one briefing GET fails', async () => {
    const briefings = {
      'brief-ok': {
        timestamp: Date.parse('2026-05-10T00:00:00Z'),
        briefing: { papers: [{ arxivId: '2605.14205' }] },
      },
    };
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/briefings?') || u.endsWith('/api/briefings')) {
        return { ok: true, status: 200, json: async () => ({ ids: ['brief-ok', 'brief-bad'] }) };
      }
      if (u.includes('brief-ok')) {
        return { ok: true, status: 200, json: async () => briefings['brief-ok'] };
      }
      if (u.includes('brief-bad')) {
        return { ok: false, status: 500, json: async () => ({ error: 'boom' }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'nope' }) };
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.index['2605.14205']).toBe('2026-05-10');
    expect(result.current.index._migratedAt).toBeDefined();
    expect(result.current.index._dedupeVersion).toBe(3);
  });

  it('skips migration when a v3 _dedupeVersion sentinel is already present', async () => {
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({
        _migratedAt: Date.now(),
        _dedupeVersion: 3,
        'seeded.000': '2026-04-01',
      })
    );
    const fetchSpy = vi.spyOn(global, 'fetch');

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    expect(result.current.ready).toBe(true);
    expect(result.current.index['seeded.000']).toBe('2026-04-01');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('re-migrates from briefings when stored index is v1 (no _dedupeVersion)', async () => {
    // v1 index: _migratedAt present but no _dedupeVersion — built from
    // sessions, possibly poisoned by aborted runs. Should be rebuilt from
    // briefings and the polluted entries dropped immediately.
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({
        _migratedAt: Date.parse('2026-05-01T00:00:00Z'),
        'aborted-run.001': '2026-05-01',
        'aborted-run.002': '2026-05-01',
      })
    );
    const briefings = {
      'brief-1': {
        timestamp: Date.parse('2026-05-10T00:00:00Z'),
        briefing: { papers: [{ arxivId: 'real.001' }] },
      },
    };
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/briefings?') || u.endsWith('/api/briefings')) {
        return { ok: true, status: 200, json: async () => ({ ids: ['brief-1'] }) };
      }
      const m = u.match(/\/api\/briefings\/([^?]+)/);
      if (m && briefings[m[1]]) {
        return { ok: true, status: 200, json: async () => briefings[m[1]] };
      }
      return { ok: false, status: 404, json: async () => ({ error: 'nope' }) };
    });

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    // Polluted entries must be gone immediately (in-memory state starts empty
    // on a v1→v2 upgrade) — the pipeline shouldn't dedupe against bad data
    // during the migration window.
    expect(result.current.index['aborted-run.001']).toBeUndefined();

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.index['real.001']).toBe('2026-05-10');
    expect(result.current.index['aborted-run.001']).toBeUndefined();
    expect(result.current.index['aborted-run.002']).toBeUndefined();
    expect(result.current.index._dedupeVersion).toBe(3);
  });

  it('retries migration when initial list fetch 401s (password not hydrated yet)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let listCalls = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/briefings?') || u.endsWith('/api/briefings')) {
        listCalls += 1;
        // First call (empty password) gets 401; second (real password) succeeds.
        if (u.endsWith('password=')) {
          return { ok: false, status: 401, json: async () => ({ error: 'no password' }) };
        }
        return { ok: true, status: 200, json: async () => ({ ids: ['b1'] }) };
      }
      if (u.includes('/api/briefings/b1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            timestamp: Date.parse('2026-05-10T00:00:00Z'),
            briefing: { papers: [{ arxivId: 'paper.1' }] },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    // Mount with empty password (mirrors store-not-yet-hydrated).
    const { result, rerender } = renderHook(({ password }) => useSeenPapers({ password }), {
      initialProps: { password: '' },
    });

    // First migration attempt 401s — sentinels must NOT be set, ready stays false.
    await waitFor(() => expect(listCalls).toBe(1));
    expect(result.current.ready).toBe(false);
    expect(window.localStorage.getItem('aparture-seen-papers-index')).toBeNull();

    // Password hydrates into the store — effect re-fires with the new value.
    rerender({ password: 'real-pw' });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.index['paper.1']).toBe('2026-05-10');
    expect(result.current.index._dedupeVersion).toBe(3);
  });
});

describe('useSeenPapers — migration-window concurrency (regression: audit-2d)', () => {
  // Pin the clock so the 90-day prune never trims our fixture dates. All dates
  // used below sit within HORIZON_DAYS of this instant.
  const NOW = Date.parse('2026-05-20T00:00:00Z');

  beforeEach(() => {
    window.localStorage.clear();
    // Pin the clock so the 90-day prune never trims our mid-May fixture dates,
    // but keep timers advancing with real time so testing-library's waitFor
    // (which polls on timers) and the async migration's microtasks still
    // progress. Without shouldAdvanceTime, faked timers + waitFor deadlock.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps arxivIds recorded DURING the migration window (merge, not clobber)', async () => {
    // Hold the briefing-list fetch open via a deferred promise so the
    // migration is still in flight when recordRun fires.
    let releaseList;
    const listGate = new Promise((resolve) => {
      releaseList = resolve;
    });
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/briefings?') || u.endsWith('/api/briefings')) {
        await listGate;
        return { ok: true, status: 200, json: async () => ({ ids: ['brief-1'] }) };
      }
      if (u.includes('/api/briefings/brief-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            timestamp: Date.parse('2026-05-10T00:00:00Z'),
            briefing: { papers: [{ arxivId: 'migrated.001' }] },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));

    // Migration is blocked on listGate — record a fresh paper meanwhile. This
    // mirrors App.jsx calling seenPapers.recordRun from saveBriefingAndSwitch
    // before seenPapers.ready flips true (recordRun is NOT gated on ready).
    expect(result.current.ready).toBe(false);
    act(() => {
      result.current.recordRun(
        [{ id: 'recorded-during-window.999' }],
        Date.parse('2026-05-18T00:00:00Z')
      );
    });
    expect(result.current.index['recorded-during-window.999']).toBe('2026-05-18');

    // Let the migration finish.
    releaseList();
    await waitFor(() => expect(result.current.ready).toBe(true));

    // The migrated paper is present...
    expect(result.current.index['migrated.001']).toBe('2026-05-10');
    // ...AND the entry recorded during the window survived (would be clobbered
    // by a wholesale setIndex(pruned) on migration completion).
    expect(result.current.index['recorded-during-window.999']).toBe('2026-05-18');

    // localStorage reflects the merged result, not just the migrated set.
    const persisted = JSON.parse(window.localStorage.getItem('aparture-seen-papers-index'));
    expect(persisted['recorded-during-window.999']).toBe('2026-05-18');
    expect(persisted['migrated.001']).toBe('2026-05-10');
    expect(persisted._dedupeVersion).toBe(3);
  });

  it('migration completion keeps the EARLIEST date when an ID appears in both window and briefings', async () => {
    let releaseList;
    const listGate = new Promise((resolve) => {
      releaseList = resolve;
    });
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/briefings?') || u.endsWith('/api/briefings')) {
        await listGate;
        return { ok: true, status: 200, json: async () => ({ ids: ['brief-1'] }) };
      }
      if (u.includes('/api/briefings/brief-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            // Briefing timestamp is LATER than the window recordRun below.
            timestamp: Date.parse('2026-05-15T00:00:00Z'),
            briefing: { papers: [{ arxivId: 'shared.001' }] },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    act(() => {
      // Record the same ID with an EARLIER date during the window.
      result.current.recordRun([{ id: 'shared.001' }], Date.parse('2026-05-08T00:00:00Z'));
    });

    releaseList();
    await waitFor(() => expect(result.current.ready).toBe(true));

    // Earliest-date-wins: the window's 2026-05-08 beats the briefing's 2026-05-15.
    expect(result.current.index['shared.001']).toBe('2026-05-08');
  });

  it('recordRun never leaves the version=0 + _migratedAt state that forces a rebuild', () => {
    // Start from a properly-migrated v3 index so the migration effect is a
    // no-op and we isolate recordRun's sentinel behavior. Pre-fix, recordRun
    // stamped _migratedAt unconditionally; combined with an index that had NO
    // version sentinel this produced the desynced "migratedAt-only" state that
    // trips isVersionUpgrade on the next mount.
    window.localStorage.setItem(
      'aparture-seen-papers-index',
      JSON.stringify({ _migratedAt: NOW, _dedupeVersion: 3 })
    );

    const { result, unmount } = renderHook(() => useSeenPapers({ password: 'pw' }));
    expect(result.current.ready).toBe(true);
    act(() => {
      result.current.recordRun([{ id: 'first.001' }], Date.parse('2026-05-18T00:00:00Z'));
    });

    // After a recordRun, the persisted index must NEVER carry _migratedAt
    // without a matching _dedupeVersion — that desynced pair is exactly what
    // trips isVersionUpgrade=true on the next mount and wipes localStorage.
    const persisted = JSON.parse(window.localStorage.getItem('aparture-seen-papers-index'));
    expect(persisted['first.001']).toBe('2026-05-18');
    const hasMigratedAt = persisted._migratedAt != null;
    const hasVersion = Number.isInteger(persisted._dedupeVersion);
    // The sentinel pair stays coupled: both present here (migration done).
    expect(hasMigratedAt).toBe(true);
    expect(hasVersion).toBe(true);

    unmount();

    // Remount: initialVersion must read CURRENT_DEDUPE_VERSION (not 0), so the
    // localStorage-clearing version-upgrade rebuild does NOT fire and the
    // recorded entry is present in the initial in-memory state.
    const { result: result2 } = renderHook(() => useSeenPapers({ password: 'pw' }));
    expect(result2.current.index['first.001']).toBe('2026-05-18');
    expect(result2.current.ready).toBe(true);
  });

  it('a recordRun before any migration must not stamp _migratedAt alone (pre-fix desync)', async () => {
    // No stored key at all → recordRun fires before migration completes. The
    // persisted index must not gain a lone _migratedAt (which would desync from
    // the absent _dedupeVersion). Block migration so recordRun runs first.
    let releaseList;
    const listGate = new Promise((resolve) => {
      releaseList = resolve;
    });
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/briefings?') || u.endsWith('/api/briefings')) {
        await listGate;
        return { ok: true, status: 200, json: async () => ({ ids: [] }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { result } = renderHook(() => useSeenPapers({ password: 'pw' }));
    expect(result.current.ready).toBe(false);
    act(() => {
      result.current.recordRun([{ id: 'early.001' }], Date.parse('2026-05-18T00:00:00Z'));
    });

    // Persisted by recordRun while migration is still blocked: entry present,
    // but no sentinel stamped at all (so no lone _migratedAt).
    const midFlight = JSON.parse(window.localStorage.getItem('aparture-seen-papers-index'));
    expect(midFlight['early.001']).toBe('2026-05-18');
    expect(midFlight._migratedAt).toBeUndefined();
    expect(midFlight._dedupeVersion).toBeUndefined();

    // Migration finishes — now both sentinels appear together, entry preserved.
    releaseList();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.index['early.001']).toBe('2026-05-18');
    expect(result.current.index._migratedAt).toBeDefined();
    expect(result.current.index._dedupeVersion).toBe(3);
  });
});
