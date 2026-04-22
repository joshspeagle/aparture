import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBriefing } from '../../../hooks/useBriefing.js';

beforeEach(() => {
  window.localStorage.clear();
  // saveBriefing now POSTs to /api/briefings. Tests that don't care about
  // the disk tier just need a no-op fetch; describe blocks that care override
  // this per-test.
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: 'x', bytesWritten: 0 }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makeBriefing = (summary = 'Test') => ({
  executiveSummary: summary,
  themes: [],
  papers: [{ arxivId: '2504.01234', title: 't', score: 8 }],
  debates: [],
  longitudinal: [],
  proactiveQuestions: [],
});

describe('useBriefing', () => {
  it('starts with no current briefing', () => {
    const { result } = renderHook(() => useBriefing());
    expect(result.current.current).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it('accepts a password argument without throwing', () => {
    const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
    expect(result.current.current).toBeNull();
  });

  it('sets the current briefing and appends to history', () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = makeBriefing();
    act(() => {
      result.current.saveBriefing('2026-04-13', briefing);
    });
    expect(result.current.current.date).toBe('2026-04-13');
    expect(result.current.current.briefing.executiveSummary).toBe('Test');
    expect(result.current.history.some((b) => b.date === '2026-04-13')).toBe(true);
  });

  it('creates entries with id, timestamp, and archived: false', () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = makeBriefing();
    act(() => {
      result.current.saveBriefing('2026-04-13', briefing);
    });
    const entry = result.current.current;
    expect(entry.id).toBeDefined();
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(typeof entry.timestamp).toBe('number');
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.archived).toBe(false);
  });

  it('saveBriefing returns the new entry id', async () => {
    const { result } = renderHook(() => useBriefing());
    let returnedId;
    await act(async () => {
      returnedId = await result.current.saveBriefing('2026-04-13', makeBriefing());
    });
    expect(returnedId).toBe(result.current.current.id);
  });

  it('multiple saves on the same date create separate entries', async () => {
    const { result } = renderHook(() => useBriefing());
    await act(async () => {
      await result.current.saveBriefing('2026-04-13', makeBriefing('First'));
      await result.current.saveBriefing('2026-04-13', makeBriefing('Second'));
    });
    const entriesForDate = result.current.history.filter((b) => b.date === '2026-04-13');
    expect(entriesForDate).toHaveLength(2);
    expect(entriesForDate[0].id).not.toBe(entriesForDate[1].id);
    // Most recent should be first
    expect(entriesForDate[0].briefing.executiveSummary).toBe('Second');
    expect(entriesForDate[1].briefing.executiveSummary).toBe('First');
  });

  it('keeps at most 90 past briefings in history', async () => {
    const { result } = renderHook(() => useBriefing());
    const empty = makeBriefing('x');
    await act(async () => {
      for (let i = 0; i < 100; i++) {
        const d = new Date(Date.UTC(2025, 0, 1));
        d.setUTCDate(d.getUTCDate() + i);
        const iso = d.toISOString().slice(0, 10);
        await result.current.saveBriefing(iso, empty);
      }
    });
    expect(result.current.history.length).toBe(90);
  });

  it('persists generationMetadata on each saved entry', async () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = makeBriefing();
    const metadata = {
      profileSnapshot: 'my research interests...',
      filterModel: 'gemini-2.5-flash-lite',
      scoringModel: 'gemini-3-flash',
      pdfModel: 'gemini-3.1-pro',
      briefingModel: 'claude-opus-4.6',
      categories: ['cs.AI', 'cs.LG'],
      filterVerdictCounts: { yes: 10, maybe: 5, no: 2 },
      feedbackCutoff: 1700000000000,
      briefingRetryOnYes: true,
      briefingRetryOnMaybe: false,
      pauseAfterFilter: true,
      timestamp: '2026-04-15T10:00:00.000Z',
    };
    await act(async () => {
      await result.current.saveBriefing('2026-04-15', briefing, metadata);
    });
    expect(result.current.current.generationMetadata).toEqual(metadata);
    // History is index-only: generationMetadata lives on current + on disk.
    expect(result.current.history[0].generationMetadata).toBeUndefined();
  });

  it('saveBriefing without metadata arg omits the field from the stored entry', async () => {
    const { result } = renderHook(() => useBriefing());
    await act(async () => {
      await result.current.saveBriefing('2026-04-11', makeBriefing('no-metadata'));
    });
    expect(result.current.current.date).toBe('2026-04-11');
    expect(result.current.current.generationMetadata).toBeUndefined();
  });

  // --- deleteBriefing ---

  it('deleteBriefing removes an entry by id', async () => {
    const { result } = renderHook(() => useBriefing());
    let id1, id2;
    await act(async () => {
      id1 = await result.current.saveBriefing('2026-04-10', makeBriefing('A'));
      id2 = await result.current.saveBriefing('2026-04-11', makeBriefing('B'));
    });
    expect(result.current.history).toHaveLength(2);
    await act(async () => {
      await result.current.deleteBriefing(id1);
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].id).toBe(id2);
  });

  it('deleteBriefing clears current if the deleted entry is current', async () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    await act(async () => {
      id = await result.current.saveBriefing('2026-04-10', makeBriefing('A'));
    });
    expect(result.current.current).not.toBeNull();
    await act(async () => {
      await result.current.deleteBriefing(id);
    });
    expect(result.current.current).toBeNull();
  });

  it('deleteBriefing does not clear current if a different entry is deleted', async () => {
    const { result } = renderHook(() => useBriefing());
    let id1;
    await act(async () => {
      id1 = await result.current.saveBriefing('2026-04-10', makeBriefing('A'));
      await result.current.saveBriefing('2026-04-11', makeBriefing('B'));
    });
    // current is now B
    expect(result.current.current.briefing.executiveSummary).toBe('B');
    await act(async () => {
      await result.current.deleteBriefing(id1);
    });
    expect(result.current.current).not.toBeNull();
    expect(result.current.current.briefing.executiveSummary).toBe('B');
  });

  it('deleteBriefing persists to localStorage', async () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    await act(async () => {
      id = await result.current.saveBriefing('2026-04-10', makeBriefing('A'));
      await result.current.saveBriefing('2026-04-11', makeBriefing('B'));
    });
    await act(async () => {
      await result.current.deleteBriefing(id);
    });
    const stored = JSON.parse(window.localStorage.getItem('aparture-briefing-index'));
    expect(stored).toHaveLength(1);
    expect(stored[0].briefing.executiveSummary).toBe('B');
  });

  // --- toggleArchive ---

  it('toggleArchive flips the archived flag', async () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    await act(async () => {
      id = await result.current.saveBriefing('2026-04-10', makeBriefing('A'));
    });
    expect(result.current.history[0].archived).toBe(false);
    await act(async () => {
      await result.current.toggleArchive(id);
    });
    expect(result.current.history[0].archived).toBe(true);
    await act(async () => {
      await result.current.toggleArchive(id);
    });
    expect(result.current.history[0].archived).toBe(false);
  });

  it('toggleArchive persists to localStorage', async () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    await act(async () => {
      id = await result.current.saveBriefing('2026-04-10', makeBriefing('A'));
    });
    await act(async () => {
      await result.current.toggleArchive(id);
    });
    const stored = JSON.parse(window.localStorage.getItem('aparture-briefing-index'));
    expect(stored[0].archived).toBe(true);
  });

  // --- quickSummariesById / fullReportsById persistence ---

  it('persists quickSummariesById and fullReportsById when provided', async () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = makeBriefing();
    const quick = { '2504.01234': 'A quick summary' };
    const full = { '2504.01234': 'Full detailed report...' };
    await act(async () => {
      await result.current.saveBriefing('2026-04-16', briefing, null, {
        quickSummariesById: quick,
        fullReportsById: full,
      });
    });
    expect(result.current.current.quickSummariesById).toEqual(quick);
    expect(result.current.current.fullReportsById).toEqual(full);
    // History is index-only: heavy fields live on current + on disk (Task 9+).
    expect(result.current.history[0].quickSummariesById).toBeUndefined();
    expect(result.current.history[0].fullReportsById).toBeUndefined();
  });

  it('omits quickSummariesById/fullReportsById when not provided', async () => {
    const { result } = renderHook(() => useBriefing());
    await act(async () => {
      await result.current.saveBriefing('2026-04-16', makeBriefing());
    });
    expect(result.current.current.quickSummariesById).toBeUndefined();
    expect(result.current.current.fullReportsById).toBeUndefined();
  });

  it('persists pipelineArchive when provided', async () => {
    const { result } = renderHook(() => useBriefing());
    const archive = {
      filterResults: { yes: [{ arxivId: '2504.01234' }], maybe: [], no: [], total: 1 },
      scoredPapers: [{ arxivId: '2504.01234', relevanceScore: 8.5 }],
      finalRanking: [{ arxivId: '2504.01234', score: 9.0 }],
    };
    await act(async () => {
      await result.current.saveBriefing('2026-04-16', makeBriefing(), null, {
        pipelineArchive: archive,
      });
    });
    expect(result.current.current.pipelineArchive).toEqual(archive);
    // History is index-only: pipelineArchive lives on current + on disk (Task 9+).
    expect(result.current.history[0].pipelineArchive).toBeUndefined();
  });

  // --- Back-compat / migration ---

  it('tolerates legacy-shape entries in the index key and migrates them', () => {
    // Legacy entries (no id/timestamp/archived) in the new index key should
    // still be migrated by readStoredHistory. Migration from the OLD
    // 'aparture-briefing-history' key to the new 'aparture-briefing-index'
    // key + filesystem is tested separately (Task 12).
    window.localStorage.setItem(
      'aparture-briefing-index',
      JSON.stringify([
        {
          date: '2026-04-10',
          briefing: {
            executiveSummary: 'legacy',
            themes: [],
            papers: [],
            debates: [],
            longitudinal: [],
            proactiveQuestions: [],
          },
        },
      ])
    );
    const { result } = renderHook(() => useBriefing());
    expect(result.current.history).toHaveLength(1);
    const entry = result.current.history[0];
    expect(entry.date).toBe('2026-04-10');
    expect(entry.id).toBe('legacy-2026-04-10');
    expect(typeof entry.timestamp).toBe('number');
    expect(entry.timestamp).toBeGreaterThan(0);
    expect(entry.archived).toBe(false);
  });

  it('migrates legacy current entry on read', () => {
    window.localStorage.setItem(
      'aparture-briefing-current',
      JSON.stringify({
        date: '2026-04-10',
        briefing: { executiveSummary: 'legacy-current' },
      })
    );
    const { result } = renderHook(() => useBriefing());
    expect(result.current.current.id).toBe('legacy-2026-04-10');
    expect(result.current.current.archived).toBe(false);
    expect(typeof result.current.current.timestamp).toBe('number');
  });

  it('does not re-migrate entries that already have all fields', () => {
    const existing = {
      id: 'my-uuid',
      date: '2026-04-10',
      timestamp: 1700000000000,
      briefing: { executiveSummary: 'already migrated' },
      archived: true,
    };
    window.localStorage.setItem('aparture-briefing-index', JSON.stringify([existing]));
    const { result } = renderHook(() => useBriefing());
    const entry = result.current.history[0];
    expect(entry.id).toBe('my-uuid');
    expect(entry.timestamp).toBe(1700000000000);
    expect(entry.archived).toBe(true);
  });

  // --- Quota handling ---

  describe('localStorage quota handling', () => {
    let setItemSpy;
    let warnSpy;
    let throwOnKeys;
    let realSetItem;

    beforeEach(() => {
      throwOnKeys = new Set();
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      realSetItem = window.Storage.prototype.setItem;
      setItemSpy = vi
        .spyOn(window.Storage.prototype, 'setItem')
        .mockImplementation(function (key, value) {
          if (throwOnKeys.has(key)) {
            const err = new Error('mock quota');
            err.name = 'QuotaExceededError';
            throw err;
          }
          return realSetItem.call(this, key, value);
        });
    });

    afterEach(() => {
      setItemSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('saveBriefing does not throw when HISTORY_KEY quota is exceeded', async () => {
      throwOnKeys.add('aparture-briefing-index');
      const { result } = renderHook(() => useBriefing());
      await expect(
        act(async () => {
          await result.current.saveBriefing('2026-04-16', makeBriefing('quota'));
        })
      ).resolves.not.toThrow();
      // In-memory state still reflects the save
      expect(result.current.current.date).toBe('2026-04-16');
      expect(result.current.history).toHaveLength(1);
      // Warning was logged
      expect(warnSpy).toHaveBeenCalled();
    });

    it('saveBriefing does not throw when CURRENT_KEY quota is exceeded', async () => {
      throwOnKeys.add('aparture-briefing-current');
      const { result } = renderHook(() => useBriefing());
      await expect(
        act(async () => {
          await result.current.saveBriefing('2026-04-16', makeBriefing('quota'));
        })
      ).resolves.not.toThrow();
      expect(result.current.current.date).toBe('2026-04-16');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('persists a stripped entry when the full entry hits quota', async () => {
      const { result } = renderHook(() => useBriefing());
      const heavy = {
        pipelineArchive: { scoredPapers: [{ a: 1 }] },
        quickSummariesById: { '2504.01': 'summary' },
        fullReportsById: { '2504.01': 'report' },
      };
      // First setItem call fails (full entry). The second call (stripped)
      // succeeds because the heavy fields are gone.
      let callCount = 0;
      setItemSpy.mockImplementation(function (key, value) {
        if (key === 'aparture-briefing-current' || key === 'aparture-briefing-index') {
          callCount++;
          // Heavy entries contain pipelineArchive/fullReports; strip succeeds.
          if (value.includes('pipelineArchive') || value.includes('fullReportsById')) {
            const err = new Error('mock quota');
            err.name = 'QuotaExceededError';
            throw err;
          }
        }
        return realSetItem.call(this, key, value);
      });

      await act(async () => {
        await result.current.saveBriefing('2026-04-16', makeBriefing('strip'), null, heavy);
      });
      // In-memory still has the heavy fields
      expect(result.current.current.pipelineArchive).toBeDefined();
      // Storage has the stripped version
      const storedCurrent = JSON.parse(window.localStorage.getItem('aparture-briefing-current'));
      expect(storedCurrent.pipelineArchive).toBeUndefined();
      expect(storedCurrent.fullReportsById).toBeUndefined();
      expect(storedCurrent.briefing.executiveSummary).toBe('strip');
      expect(callCount).toBeGreaterThan(2); // full attempt + stripped retry for both keys
    });

    it('re-throws non-quota errors', async () => {
      setItemSpy.mockImplementation(() => {
        const err = new Error('permission denied');
        err.name = 'SecurityError';
        throw err;
      });
      const { result } = renderHook(() => useBriefing());
      await expect(
        act(async () => {
          await result.current.saveBriefing('2026-04-16', makeBriefing('sec'));
        })
      ).rejects.toThrow(/permission denied/);
    });
  });

  // --- Filesystem tier (Task 9) ---

  describe('saveBriefing — filesystem tier', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'x', bytesWritten: 0 }),
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('POSTs the full entry to /api/briefings with the password', async () => {
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      await act(async () => {
        await result.current.saveBriefing('2026-04-21', makeBriefing('x'), null, {
          pipelineArchive: { a: 1 },
        });
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/briefings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"password":"test-pw"'),
        })
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.entry.pipelineArchive).toEqual({ a: 1 });
      expect(body.entry.briefing.executiveSummary).toBe('x');
    });

    it('returns the id even if the POST fails (in-memory state preserved)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      let id;
      await act(async () => {
        id = await result.current.saveBriefing('2026-04-21', makeBriefing('y'));
      });

      expect(id).toBeDefined();
      expect(result.current.current.briefing.executiveSummary).toBe('y');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // --- loadBriefing (Task 10) ---

  describe('loadBriefing', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        if (typeof url === 'string' && url.startsWith('/api/briefings/known')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'known',
              date: '2026-04-21',
              briefing: { executiveSummary: 'loaded' },
            }),
          };
        }
        if (typeof url === 'string' && url.startsWith('/api/briefings/missing')) {
          return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'x', bytesWritten: 0 }),
        };
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('returns the current briefing synchronously when id matches current', async () => {
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      await act(async () => {
        await result.current.saveBriefing('2026-04-21', makeBriefing('in-memory'));
      });
      const id = result.current.current.id;
      const loaded = await result.current.loadBriefing(id);
      expect(loaded.briefing.executiveSummary).toBe('in-memory');
    });

    it('fetches from /api/briefings/[id] for other ids', async () => {
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      const loaded = await result.current.loadBriefing('known');
      expect(loaded.briefing.executiveSummary).toBe('loaded');
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/briefings/known'));
    });

    it('returns null on 404', async () => {
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      const loaded = await result.current.loadBriefing('missing');
      expect(loaded).toBeNull();
    });

    it('returns null on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('network down'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      const loaded = await result.current.loadBriefing('any');
      expect(loaded).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // --- deleteBriefing / toggleArchive — filesystem tier (Task 11) ---

  describe('deleteBriefing / toggleArchive — filesystem tier', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('deleteBriefing sends DELETE /api/briefings/[id]', async () => {
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      let id;
      await act(async () => {
        id = await result.current.saveBriefing('2026-04-21', makeBriefing('x'));
      });
      fetchSpy.mockClear();
      await act(async () => {
        await result.current.deleteBriefing(id);
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/api/briefings/${id}`),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('toggleArchive sends PATCH with the new archived flag', async () => {
      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));
      let id;
      await act(async () => {
        id = await result.current.saveBriefing('2026-04-21', makeBriefing('y'));
      });
      fetchSpy.mockClear();
      await act(async () => {
        await result.current.toggleArchive(id);
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/api/briefings/${id}`),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"archived":true'),
        })
      );
    });
  });

  // --- Migration from aparture-briefing-history (legacy key) — Task 12 ---

  describe('migration from aparture-briefing-history', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'x', bytesWritten: 0 }),
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('POSTs each legacy entry and removes the legacy key', async () => {
      const legacy = [
        {
          id: 'e1',
          date: '2026-04-20',
          timestamp: 1,
          archived: false,
          briefing: {
            executiveSummary: 'one',
            papers: [{ arxivId: 'a', title: 'A', score: 5 }],
          },
          pipelineArchive: { scoredPapers: [{ x: 1 }] },
        },
        {
          id: 'e2',
          date: '2026-04-19',
          timestamp: 2,
          archived: true,
          briefing: { executiveSummary: 'two', papers: [] },
        },
      ];
      window.localStorage.setItem('aparture-briefing-history', JSON.stringify(legacy));

      const { result } = renderHook(() => useBriefing({ password: 'test-pw' }));

      // Wait for the migration effect
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(window.localStorage.getItem('aparture-briefing-history')).toBeNull();

      const index = JSON.parse(window.localStorage.getItem('aparture-briefing-index'));
      expect(index).toHaveLength(2);
      expect(index[0].briefing.executiveSummary).toBe('one');
      expect(index[0].pipelineArchive).toBeUndefined();

      // In-memory state reflects migrated entries
      expect(result.current.history).toHaveLength(2);
    });

    it('keeps going on failed POSTs (skip-and-log, no retry)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

      const legacy = [
        {
          id: 'fail',
          date: '2026-04-20',
          timestamp: 1,
          archived: false,
          briefing: { executiveSummary: 'bad', papers: [] },
        },
        {
          id: 'ok',
          date: '2026-04-19',
          timestamp: 2,
          archived: false,
          briefing: { executiveSummary: 'good', papers: [] },
        },
      ];
      window.localStorage.setItem('aparture-briefing-history', JSON.stringify(legacy));

      renderHook(() => useBriefing({ password: 'test-pw' }));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(window.localStorage.getItem('aparture-briefing-history')).toBeNull();
      const index = JSON.parse(window.localStorage.getItem('aparture-briefing-index'));
      expect(index.map((b) => b.id)).toEqual(['ok']); // failed entry not in index
      warnSpy.mockRestore();
    });
  });
});
