import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBriefing } from '../../../hooks/useBriefing.js';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useBriefing', () => {
  it('starts with no current briefing', () => {
    const { result } = renderHook(() => useBriefing());
    expect(result.current.current).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it('sets the current briefing and appends to history', () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = {
      executiveSummary: 'Test',
      themes: [],
      papers: [{ arxivId: '2504.01234', title: 't', score: 8 }],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    act(() => {
      result.current.saveBriefing('2026-04-13', briefing);
    });
    expect(result.current.current.date).toBe('2026-04-13');
    expect(result.current.current.briefing.executiveSummary).toBe('Test');
    expect(result.current.history.some((b) => b.date === '2026-04-13')).toBe(true);
  });

  it('keeps at most 90 past briefings in history', () => {
    const { result } = renderHook(() => useBriefing());
    const empty = {
      executiveSummary: 'x',
      themes: [],
      papers: [],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    act(() => {
      // Save 100 dated briefings. Dates generated from epoch so we
      // deterministically exceed the 90-day window.
      for (let i = 0; i < 100; i++) {
        const d = new Date(Date.UTC(2025, 0, 1));
        d.setUTCDate(d.getUTCDate() + i);
        const iso = d.toISOString().slice(0, 10);
        result.current.saveBriefing(iso, empty);
      }
    });
    expect(result.current.history.length).toBe(90);
  });
});
