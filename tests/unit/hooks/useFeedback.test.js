import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedback } from '../../../hooks/useFeedback.js';

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
});
