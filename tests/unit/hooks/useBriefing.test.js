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

  it('keeps at most 14 past briefings in history', () => {
    const { result } = renderHook(() => useBriefing());
    act(() => {
      for (let i = 1; i <= 20; i++) {
        result.current.saveBriefing(`2026-04-${i.toString().padStart(2, '0')}`, {
          executiveSummary: 'x',
          themes: [],
          papers: [],
          debates: [],
          longitudinal: [],
          proactiveQuestions: [],
        });
      }
    });
    expect(result.current.history.length).toBe(14);
  });
});
