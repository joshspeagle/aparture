import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedback } from '../../../hooks/useFeedback.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFeedback', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const samplePaper = {
    arxivId: '2504.01234',
    paperTitle: 'Circuit-level analysis of reasoning',
    quickSummary: 'mechanistic interpretability paper',
    score: 9.2,
    briefingDate: '2026-04-10',
  };

  it('initializes with empty events', () => {
    const { result } = renderHook(() => useFeedback());
    expect(result.current.events).toEqual([]);
  });

  it('addStar appends a star event with paper metadata', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('star');
    expect(result.current.events[0].arxivId).toBe('2504.01234');
  });

  it('addStar replaces an existing star on the same paper (toggle off)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    act(() => {
      result.current.addStar(samplePaper);
    });
    expect(result.current.events).toHaveLength(0);
  });

  it('addDismiss replaces a previous star on the same paper (latest-wins flip)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    act(() => {
      result.current.addDismiss(samplePaper);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('dismiss');
  });

  it('addPaperComment appends a comment without affecting star/dismiss state', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    act(() => {
      result.current.addPaperComment(samplePaper, 'great paper');
    });
    expect(result.current.events).toHaveLength(2);
    const types = result.current.events.map((e) => e.type).sort();
    expect(types).toEqual(['paper-comment', 'star']);
  });

  it('supports multiple paper comments on the same paper', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addPaperComment(samplePaper, 'first thought');
    });
    act(() => {
      result.current.addPaperComment(samplePaper, 'second thought');
    });
    expect(result.current.events).toHaveLength(2);
  });

  it('addGeneralComment appends an event with no arxivId', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addGeneralComment('too much theory this week', '2026-04-14');
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('general-comment');
    expect(result.current.events[0].arxivId).toBeUndefined();
  });

  it('getNewSince filters events by cutoff timestamp', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    const cutoff = Date.now() + 1000;
    expect(result.current.getNewSince(cutoff)).toEqual([]);
    expect(result.current.getNewSince(0)).toHaveLength(1);
  });

  it('persists across remounts via localStorage', () => {
    const { result, unmount } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    unmount();
    const { result: result2 } = renderHook(() => useFeedback());
    expect(result2.current.events).toHaveLength(1);
  });

  it('keeps the in-memory event when localStorage quota is exceeded (no crash mid-click)', () => {
    const { result } = renderHook(() => useFeedback());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    });
    // Pre-fix this threw out of the state updater, crashing the click handler
    // and losing the input.
    expect(() => {
      act(() => {
        result.current.addStar(samplePaper);
      });
    }).not.toThrow();
    expect(result.current.events).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });

  it('returns a referentially stable object across unrelated re-renders', () => {
    const { result, rerender } = renderHook(() => useFeedback());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    // ...but a new reference once events actually change.
    act(() => {
      result.current.addStar(samplePaper);
    });
    expect(result.current).not.toBe(first);
  });
});

describe('ensureStar / ensureDismiss (non-toggling, gate handlers)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const samplePaper = {
    arxivId: '2504.01234',
    paperTitle: 'Circuit-level analysis of reasoning',
    quickSummary: 'mechanistic interpretability paper',
    score: 9.2,
    briefingDate: '2026-04-10',
  };

  it('ensureStar appends a star event when none exists', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.ensureStar(samplePaper);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('star');
    expect(result.current.events[0].arxivId).toBe('2504.01234');
  });

  it('ensureStar is a no-op when the paper is already starred (never removes)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    const existingId = result.current.events[0].id;
    act(() => {
      result.current.ensureStar(samplePaper);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('star');
    // Same event object — no replacement, no re-stamp.
    expect(result.current.events[0].id).toBe(existingId);
  });

  it('ensureStar keeps the state reference when nothing changes', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.ensureStar(samplePaper);
    });
    const before = result.current.events;
    act(() => {
      result.current.ensureStar(samplePaper);
    });
    expect(result.current.events).toBe(before);
  });

  it('ensureStar replaces a prior dismiss (latest-wins flip)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addDismiss(samplePaper);
    });
    act(() => {
      result.current.ensureStar(samplePaper);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('star');
  });

  it('ensureDismiss is a no-op when already dismissed and replaces a prior star', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(samplePaper);
    });
    act(() => {
      result.current.ensureDismiss(samplePaper);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe('dismiss');
    const existingId = result.current.events[0].id;
    act(() => {
      result.current.ensureDismiss(samplePaper);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].id).toBe(existingId);
  });

  it('ensure* persists to localStorage like the toggling variants', () => {
    const { result, unmount } = renderHook(() => useFeedback());
    act(() => {
      result.current.ensureStar(samplePaper);
    });
    unmount();
    const { result: result2 } = renderHook(() => useFeedback());
    expect(result2.current.events).toHaveLength(1);
    expect(result2.current.events[0].type).toBe('star');
  });
});

describe('addScopedFeedback — bucket scope', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('appends a scoped-feedback event with bucket scope', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'Too many marginal hits',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(1);
    const ev = result.current.events[0];
    expect(ev.type).toBe('scoped-feedback');
    expect(ev.scope).toEqual({ kind: 'bucket', bucket: 'YES' });
    expect(ev.text).toBe('Too many marginal hits');
    expect(ev.briefingDate).toBe('2026-05-17');
  });

  it('latest-wins per (bucket, briefingDate): overwrites same bucket same day', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'first',
        briefingDate: '2026-05-17',
      });
    });
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'second',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].text).toBe('second');
  });

  it('keeps different buckets independent on the same day', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'yes-comment',
        briefingDate: '2026-05-17',
      });
      result.current.addScopedFeedback({
        scope: { kind: 'bucket', bucket: 'NO' },
        text: 'no-comment',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(2);
  });

  it('empty text is a no-op (after trim)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'bucket', bucket: 'YES' },
        text: '   \n  ',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(0);
  });
});

describe('addScopedFeedback — score-review scope', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('latest-wins per briefingDate (one per run)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'score-review' },
        text: 'first',
        briefingDate: '2026-05-17',
      });
    });
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'score-review' },
        text: 'second',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].text).toBe('second');
  });
});

describe('addScopedFeedback — run scope', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('latest-wins per briefingDate', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'run' },
        text: 'first',
        briefingDate: '2026-05-17',
      });
    });
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'run' },
        text: 'updated',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].text).toBe('updated');
  });

  it('different briefingDates coexist independently', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'run' },
        text: 'mon',
        briefingDate: '2026-05-17',
      });
      result.current.addScopedFeedback({
        scope: { kind: 'run' },
        text: 'tue',
        briefingDate: '2026-05-18',
      });
    });
    expect(result.current.events).toHaveLength(2);
  });

  it('cross-scope isolation: bucket, score-review, and run are independent on same briefingDate', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'bucket', bucket: 'YES' },
        text: 'bucket comment',
        briefingDate: '2026-05-17',
      });
      result.current.addScopedFeedback({
        scope: { kind: 'score-review' },
        text: 'score review comment',
        briefingDate: '2026-05-17',
      });
      result.current.addScopedFeedback({
        scope: { kind: 'run' },
        text: 'run comment',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(3);

    act(() => {
      result.current.addScopedFeedback({
        scope: { kind: 'score-review' },
        text: 'updated',
        briefingDate: '2026-05-17',
      });
    });
    expect(result.current.events).toHaveLength(3);
    const scoreReviewEvent = result.current.events.find((e) => e.scope?.kind === 'score-review');
    expect(scoreReviewEvent.text).toBe('updated');
    const bucketEvent = result.current.events.find((e) => e.scope?.kind === 'bucket');
    expect(bucketEvent.text).toBe('bucket comment');
    const runEvent = result.current.events.find((e) => e.scope?.kind === 'run');
    expect(runEvent.text).toBe('run comment');
  });
});
