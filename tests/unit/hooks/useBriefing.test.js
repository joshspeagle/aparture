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

  it('persists generationMetadata on each saved entry', () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = {
      executiveSummary: 'Test',
      themes: [],
      papers: [],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
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

  it('tolerates legacy entries without generationMetadata', () => {
    // Seed localStorage with an entry that has no generationMetadata
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
    expect(result.current.history[0].date).toBe('2026-04-10');
    expect(result.current.history[0].generationMetadata).toBeUndefined();
  });

  it('saveBriefing without metadata arg omits the field from the stored entry', () => {
    const { result } = renderHook(() => useBriefing());
    const briefing = {
      executiveSummary: 'no-metadata',
      themes: [],
      papers: [],
      debates: [],
      longitudinal: [],
      proactiveQuestions: [],
    };
    act(() => {
      result.current.saveBriefing('2026-04-11', briefing);
    });
    expect(result.current.current.date).toBe('2026-04-11');
    expect(result.current.current.generationMetadata).toBeUndefined();
  });
});
