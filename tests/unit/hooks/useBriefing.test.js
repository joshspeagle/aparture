import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBriefing } from '../../../hooks/useBriefing.js';

beforeEach(() => {
  window.localStorage.clear();
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

  it('saveBriefing returns the new entry id', () => {
    const { result } = renderHook(() => useBriefing());
    let returnedId;
    act(() => {
      returnedId = result.current.saveBriefing('2026-04-13', makeBriefing());
    });
    expect(returnedId).toBe(result.current.current.id);
  });

  it('multiple saves on the same date create separate entries', () => {
    const { result } = renderHook(() => useBriefing());
    act(() => {
      result.current.saveBriefing('2026-04-13', makeBriefing('First'));
      result.current.saveBriefing('2026-04-13', makeBriefing('Second'));
    });
    const entriesForDate = result.current.history.filter((b) => b.date === '2026-04-13');
    expect(entriesForDate).toHaveLength(2);
    expect(entriesForDate[0].id).not.toBe(entriesForDate[1].id);
    // Most recent should be first
    expect(entriesForDate[0].briefing.executiveSummary).toBe('Second');
    expect(entriesForDate[1].briefing.executiveSummary).toBe('First');
  });

  it('keeps at most 90 past briefings in history', () => {
    const { result } = renderHook(() => useBriefing());
    const empty = makeBriefing('x');
    act(() => {
      for (let i = 0; i < 100; i++) {
        const d = new Date(Date.UTC(2025, 0, 1));
        d.setUTCDate(d.getUTCDate() + i);
        const iso = d.toISOString().slice(0, 10);
        result.current.saveBriefing(iso, empty);
      }
    });
    expect(result.current.history.length).toBe(90);
  });

  it('persists generationMetadata on each saved entry', () => {
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
    act(() => {
      result.current.saveBriefing('2026-04-15', briefing, metadata);
    });
    expect(result.current.current.generationMetadata).toEqual(metadata);
    expect(result.current.history[0].generationMetadata).toEqual(metadata);
  });

  it('saveBriefing without metadata arg omits the field from the stored entry', () => {
    const { result } = renderHook(() => useBriefing());
    act(() => {
      result.current.saveBriefing('2026-04-11', makeBriefing('no-metadata'));
    });
    expect(result.current.current.date).toBe('2026-04-11');
    expect(result.current.current.generationMetadata).toBeUndefined();
  });

  // --- deleteBriefing ---

  it('deleteBriefing removes an entry by id', () => {
    const { result } = renderHook(() => useBriefing());
    let id1, id2;
    act(() => {
      id1 = result.current.saveBriefing('2026-04-10', makeBriefing('A'));
      id2 = result.current.saveBriefing('2026-04-11', makeBriefing('B'));
    });
    expect(result.current.history).toHaveLength(2);
    act(() => {
      result.current.deleteBriefing(id1);
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].id).toBe(id2);
  });

  it('deleteBriefing clears current if the deleted entry is current', () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    act(() => {
      id = result.current.saveBriefing('2026-04-10', makeBriefing('A'));
    });
    expect(result.current.current).not.toBeNull();
    act(() => {
      result.current.deleteBriefing(id);
    });
    expect(result.current.current).toBeNull();
  });

  it('deleteBriefing does not clear current if a different entry is deleted', () => {
    const { result } = renderHook(() => useBriefing());
    let id1;
    act(() => {
      id1 = result.current.saveBriefing('2026-04-10', makeBriefing('A'));
      result.current.saveBriefing('2026-04-11', makeBriefing('B'));
    });
    // current is now B
    expect(result.current.current.briefing.executiveSummary).toBe('B');
    act(() => {
      result.current.deleteBriefing(id1);
    });
    expect(result.current.current).not.toBeNull();
    expect(result.current.current.briefing.executiveSummary).toBe('B');
  });

  it('deleteBriefing persists to localStorage', () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    act(() => {
      id = result.current.saveBriefing('2026-04-10', makeBriefing('A'));
      result.current.saveBriefing('2026-04-11', makeBriefing('B'));
    });
    act(() => {
      result.current.deleteBriefing(id);
    });
    const stored = JSON.parse(window.localStorage.getItem('aparture-briefing-history'));
    expect(stored).toHaveLength(1);
    expect(stored[0].briefing.executiveSummary).toBe('B');
  });

  // --- toggleArchive ---

  it('toggleArchive flips the archived flag', () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    act(() => {
      id = result.current.saveBriefing('2026-04-10', makeBriefing('A'));
    });
    expect(result.current.history[0].archived).toBe(false);
    act(() => {
      result.current.toggleArchive(id);
    });
    expect(result.current.history[0].archived).toBe(true);
    act(() => {
      result.current.toggleArchive(id);
    });
    expect(result.current.history[0].archived).toBe(false);
  });

  it('toggleArchive persists to localStorage', () => {
    const { result } = renderHook(() => useBriefing());
    let id;
    act(() => {
      id = result.current.saveBriefing('2026-04-10', makeBriefing('A'));
    });
    act(() => {
      result.current.toggleArchive(id);
    });
    const stored = JSON.parse(window.localStorage.getItem('aparture-briefing-history'));
    expect(stored[0].archived).toBe(true);
  });

  // --- quickSummariesById / fullReportsById persistence ---

  it('persists quickSummariesById and fullReportsById when provided', () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = makeBriefing();
    const quick = { '2504.01234': 'A quick summary' };
    const full = { '2504.01234': 'Full detailed report...' };
    act(() => {
      result.current.saveBriefing('2026-04-16', briefing, null, {
        quickSummariesById: quick,
        fullReportsById: full,
      });
    });
    expect(result.current.current.quickSummariesById).toEqual(quick);
    expect(result.current.current.fullReportsById).toEqual(full);
    expect(result.current.history[0].quickSummariesById).toEqual(quick);
    expect(result.current.history[0].fullReportsById).toEqual(full);
  });

  it('omits quickSummariesById/fullReportsById when not provided', () => {
    const { result } = renderHook(() => useBriefing());
    act(() => {
      result.current.saveBriefing('2026-04-16', makeBriefing());
    });
    expect(result.current.current.quickSummariesById).toBeUndefined();
    expect(result.current.current.fullReportsById).toBeUndefined();
  });

  it('persists pipelineArchive when provided', () => {
    const { result } = renderHook(() => useBriefing());
    const archive = {
      filterResults: { yes: [{ arxivId: '2504.01234' }], maybe: [], no: [], total: 1 },
      scoredPapers: [{ arxivId: '2504.01234', relevanceScore: 8.5 }],
      finalRanking: [{ arxivId: '2504.01234', score: 9.0 }],
    };
    act(() => {
      result.current.saveBriefing('2026-04-16', makeBriefing(), null, {
        pipelineArchive: archive,
      });
    });
    expect(result.current.current.pipelineArchive).toEqual(archive);
    expect(result.current.history[0].pipelineArchive).toEqual(archive);
  });

  // --- Back-compat / migration ---

  it('tolerates legacy entries without id/timestamp/archived and migrates them', () => {
    window.localStorage.setItem(
      'aparture-briefing-history',
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
    expect(entry.generationMetadata).toBeUndefined();
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
    window.localStorage.setItem('aparture-briefing-history', JSON.stringify([existing]));
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

    it('saveBriefing does not throw when HISTORY_KEY quota is exceeded', () => {
      throwOnKeys.add('aparture-briefing-history');
      const { result } = renderHook(() => useBriefing());
      expect(() => {
        act(() => {
          result.current.saveBriefing('2026-04-16', makeBriefing('quota'));
        });
      }).not.toThrow();
      // In-memory state still reflects the save
      expect(result.current.current.date).toBe('2026-04-16');
      expect(result.current.history).toHaveLength(1);
      // Warning was logged
      expect(warnSpy).toHaveBeenCalled();
    });

    it('saveBriefing does not throw when CURRENT_KEY quota is exceeded', () => {
      throwOnKeys.add('aparture-briefing-current');
      const { result } = renderHook(() => useBriefing());
      expect(() => {
        act(() => {
          result.current.saveBriefing('2026-04-16', makeBriefing('quota'));
        });
      }).not.toThrow();
      expect(result.current.current.date).toBe('2026-04-16');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('persists a stripped entry when the full entry hits quota', () => {
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
        if (key === 'aparture-briefing-current' || key === 'aparture-briefing-history') {
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

      act(() => {
        result.current.saveBriefing('2026-04-16', makeBriefing('strip'), null, heavy);
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

    it('re-throws non-quota errors', () => {
      setItemSpy.mockImplementation(() => {
        const err = new Error('permission denied');
        err.name = 'SecurityError';
        throw err;
      });
      const { result } = renderHook(() => useBriefing());
      expect(() => {
        act(() => {
          result.current.saveBriefing('2026-04-16', makeBriefing('sec'));
        });
      }).toThrow(/permission denied/);
    });
  });
});
