import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedback } from '../../../hooks/useFeedback.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

afterEach(() => {
  vi.restoreAllMocks();
  useAnalyzerStore.setState(initialState());
});

describe('test-run feedback is tagged and kept out of suggestions (P0-2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAnalyzerStore.setState(initialState());
  });

  const paper = {
    arxivId: '2610.00001',
    paperTitle: 'A paper seen in a dry run',
    quickSummary: 'Mock evaluation for test paper 1.',
    score: 7.3,
    briefingDate: '2026-10-17',
  };

  const setTestState = (patch) =>
    useAnalyzerStore.setState({
      testState: { ...useAnalyzerStore.getState().testState, ...patch },
    });

  it('stamps testMode on every event type created while a Dry Run is running', () => {
    setTestState({ dryRunInProgress: true });
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(paper);
      result.current.addPaperComment({ ...paper, arxivId: '2610.00002' }, 'looks great');
      result.current.addGeneralComment('lead with the flows cluster', '2026-10-17');
      result.current.recordFilterOverride({
        arxivId: '2610.00003',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        briefingDate: '2026-10-17',
      });
      result.current.addScopedFeedback({
        scope: { kind: 'score-review' },
        text: 'too lenient',
        briefingDate: '2026-10-17',
      });
    });
    expect(result.current.events).toHaveLength(5);
    result.current.events.forEach((e) => expect(e.testMode).toBe(true));
    // None of it reaches the Suggest dialog.
    expect(result.current.getNewSince(0)).toEqual([]);
  });

  it('tags Minimal Test feedback the same way', () => {
    setTestState({ minimalTestInProgress: true });
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.ensureStar(paper);
    });
    expect(result.current.events[0].testMode).toBe(true);
  });

  it('leaves real-run feedback untagged and honours an explicit testMode flag', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addStar(paper);
      result.current.addPaperComment({ ...paper, testMode: true }, 'from a dry-run artifact');
    });
    const star = result.current.events.find((e) => e.type === 'star');
    const comment = result.current.events.find((e) => e.type === 'paper-comment');
    expect(star.testMode).toBeUndefined();
    expect(comment.testMode).toBe(true);
    expect(result.current.getNewSince(0).map((e) => e.type)).toEqual(['star']);
  });

  it('a test-run reaction never replaces or deletes a real one', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.addDismiss(paper); // real
    });
    setTestState({ dryRunInProgress: true });
    act(() => {
      result.current.addStar(paper); // test: must not flip the real dismiss
    });
    act(() => {
      result.current.addDismiss(paper); // test: must not toggle the real dismiss off
    });
    const real = result.current.events.filter((e) => !e.testMode);
    expect(real).toHaveLength(1);
    expect(real[0].type).toBe('dismiss');
  });

  it('a test-run scoped note never overwrites the real note for the same scope and day', () => {
    const { result } = renderHook(() => useFeedback());
    const note = (text) => ({ scope: { kind: 'run' }, text, briefingDate: '2026-10-17' });
    act(() => {
      result.current.addScopedFeedback(note('real run note'));
    });
    setTestState({ dryRunInProgress: true });
    act(() => {
      result.current.addScopedFeedback(note('dry-run note'));
    });
    expect(result.current.events).toHaveLength(2);
    expect(result.current.events.find((e) => !e.testMode).text).toBe('real run note');
  });

  it('clearTestEvents removes test-run events and legacy "filter said 123" junk only', () => {
    const legacyJunk = {
      id: 'junk',
      type: 'filter-override',
      arxivId: '2610.00009',
      originalVerdict: 123,
      newVerdict: 'NO',
      timestamp: 5,
      briefingDate: '2026-10-01',
    };
    window.localStorage.setItem('aparture-feedback', JSON.stringify({ events: [legacyJunk] }));
    const { result } = renderHook(() => useFeedback());
    // Legacy junk is already excluded from suggestions…
    expect(result.current.getNewSince(0)).toEqual([]);
    act(() => {
      result.current.addStar(paper); // real
    });
    setTestState({ dryRunInProgress: true });
    act(() => {
      result.current.addPaperComment(paper, 'test-run comment');
    });
    act(() => {
      result.current.clearTestEvents();
    });
    expect(result.current.events.map((e) => e.type)).toEqual(['star']);
    expect(JSON.parse(window.localStorage.getItem('aparture-feedback')).events).toHaveLength(1);
  });
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

describe('per-event incorporation (P1-4)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const seed = (events) =>
    window.localStorage.setItem('aparture-feedback', JSON.stringify({ events }));
  const ev = (id, timestamp, extra = {}) => ({
    id,
    type: 'star',
    arxivId: `2610.${id}`,
    timestamp,
    briefingDate: '2026-10-17',
    ...extra,
  });

  it('markIncorporated removes exactly the given events from the pending set', () => {
    seed([ev('a', 10), ev('b', 20), ev('c', 30)]);
    const { result } = renderHook(() => useFeedback());
    act(() => {
      // Only the newest event motivated an accepted change. Under the old
      // max-timestamp cutoff, a and b would have been "incorporated" too.
      result.current.markIncorporated(['c'], 1000);
    });
    expect(result.current.getNewSince(0).map((e) => e.id)).toEqual(['a', 'b']);
    expect(result.current.events.find((e) => e.id === 'c').incorporatedAt).toBe(1000);
    // Persisted.
    const stored = JSON.parse(window.localStorage.getItem('aparture-feedback')).events;
    expect(stored.find((e) => e.id === 'c').incorporatedAt).toBe(1000);
  });

  it('keeps the first incorporatedAt when an event is marked twice', () => {
    seed([ev('a', 10)]);
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.markIncorporated(['a'], 1000);
    });
    act(() => {
      result.current.markIncorporated(['a'], 2000);
    });
    expect(result.current.events[0].incorporatedAt).toBe(1000);
  });

  it('reopenIncorporatedSince re-opens events incorporated at or after a reverted revision', () => {
    seed([
      ev('early', 10, { incorporatedAt: 500 }),
      ev('reverted', 20, { incorporatedAt: 1000 }),
      ev('later', 30, { incorporatedAt: 1500 }),
    ]);
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.reopenIncorporatedSince(1000);
    });
    expect(result.current.getNewSince(0).map((e) => e.id)).toEqual(['reverted', 'later']);
    expect(result.current.events.find((e) => e.id === 'early').incorporatedAt).toBe(500);
  });

  it('the legacy cutoff still labels pre-upgrade events as incorporated', () => {
    seed([ev('old', 10), ev('new', 30)]);
    const { result } = renderHook(() => useFeedback());
    expect(result.current.getNewSince(20).map((e) => e.id)).toEqual(['new']);
  });
});

describe('removeEvent / updateEventText (P1-10)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const seed = (events) =>
    window.localStorage.setItem('aparture-feedback', JSON.stringify({ events }));

  it('removeEvent deletes exactly one event and persists', () => {
    seed([
      { id: 'a', type: 'star', arxivId: 'p1', timestamp: 1 },
      { id: 'b', type: 'paper-comment', arxivId: 'p1', text: 'typo', timestamp: 2 },
    ]);
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.removeEvent('b');
    });
    expect(result.current.events.map((e) => e.id)).toEqual(['a']);
    expect(JSON.parse(window.localStorage.getItem('aparture-feedback')).events).toHaveLength(1);
    const before = result.current.events;
    act(() => {
      result.current.removeEvent('missing');
    });
    expect(result.current.events).toBe(before);
  });

  it('updateEventText rewrites a comment and makes it pending again', () => {
    seed([
      {
        id: 'c',
        type: 'general-comment',
        text: 'too much theroy',
        timestamp: 10,
        incorporatedAt: 50,
      },
    ]);
    const { result } = renderHook(() => useFeedback());
    expect(result.current.getNewSince(0)).toEqual([]); // incorporated
    act(() => {
      result.current.updateEventText('c', '  too much theory  ');
    });
    const [edited] = result.current.events;
    expect(edited.text).toBe('too much theory');
    expect(edited.incorporatedAt).toBeUndefined();
    expect(edited.editedAt).toEqual(expect.any(Number));
    // Even an event before the legacy cutoff is pending once edited.
    expect(result.current.getNewSince(20).map((e) => e.id)).toEqual(['c']);
  });

  it('updateEventText refuses empty text and non-text event types', () => {
    seed([
      { id: 'c', type: 'paper-comment', arxivId: 'p1', text: 'keep', timestamp: 1 },
      { id: 's', type: 'star', arxivId: 'p2', timestamp: 2 },
    ]);
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.updateEventText('c', '   ');
      result.current.updateEventText('s', 'stars have no text');
    });
    expect(result.current.events.find((e) => e.id === 'c').text).toBe('keep');
    expect(result.current.events.find((e) => e.id === 's').text).toBeUndefined();
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

describe('recordFilterOverride — click-time, latest-wins, validated (P0-2 / P1-6)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const override = (patch = {}) => ({
    arxivId: '2504.01234',
    paperTitle: 'A filtered paper',
    summary: 'one-line filter summary',
    justification: 'why the filter said NO',
    originalVerdict: 'NO',
    newVerdict: 'YES',
    briefingDate: '2026-10-17',
    ...patch,
  });

  it('records an override with the filter context', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override());
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toMatchObject({
      type: 'filter-override',
      arxivId: '2504.01234',
      originalVerdict: 'NO',
      newVerdict: 'YES',
      summary: 'one-line filter summary',
      briefingDate: '2026-10-17',
    });
  });

  it('a second click on the same paper replaces the first (latest-wins)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override({ newVerdict: 'MAYBE' }));
    });
    act(() => {
      result.current.recordFilterOverride(override({ newVerdict: 'YES' }));
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].newVerdict).toBe('YES');
  });

  it("moving a paper back to the filter's own verdict removes the override", () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override({ newVerdict: 'YES' }));
    });
    act(() => {
      result.current.recordFilterOverride(override({ newVerdict: 'NO' }));
    });
    expect(result.current.events).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem('aparture-feedback')).events).toEqual([]);
  });

  it('re-recording the identical override is a no-op (same event, same state reference)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override());
    });
    const before = result.current.events;
    act(() => {
      result.current.recordFilterOverride(override());
    });
    expect(result.current.events).toBe(before);
  });

  it('refuses verdicts outside YES/MAYBE/NO (the dry-run mock used to send 123)', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override({ originalVerdict: 123 }));
      result.current.recordFilterOverride(override({ originalVerdict: undefined }));
      result.current.recordFilterOverride(override({ originalVerdict: 'yes' }));
      result.current.recordFilterOverride(override({ newVerdict: 'PROBABLY' }));
      result.current.recordFilterOverride(override({ arxivId: undefined }));
    });
    expect(result.current.events).toEqual([]);
  });

  it('keeps overrides on the same paper from different run days independent', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override({ briefingDate: '2026-10-16' }));
      result.current.recordFilterOverride(override({ briefingDate: '2026-10-17' }));
    });
    expect(result.current.events).toHaveLength(2);
  });

  it('a test-run override never replaces a real one for the same paper and day', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override({ newVerdict: 'YES' }));
    });
    act(() => {
      result.current.recordFilterOverride(override({ newVerdict: 'MAYBE', testMode: true }));
    });
    expect(result.current.events).toHaveLength(2);
    const real = result.current.events.find((e) => !e.testMode);
    expect(real.newVerdict).toBe('YES');
  });

  it('folds duplicate same-key events left by the old append-only logger', () => {
    const legacy = (id, ts) => ({
      id,
      type: 'filter-override',
      arxivId: '2504.01234',
      originalVerdict: 'NO',
      newVerdict: 'MAYBE',
      timestamp: ts,
      briefingDate: '2026-10-17',
    });
    window.localStorage.setItem(
      'aparture-feedback',
      JSON.stringify({ events: [legacy('old-1', 1), legacy('old-2', 2)] })
    );
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.recordFilterOverride(override({ newVerdict: 'YES' }));
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].newVerdict).toBe('YES');
  });
});
