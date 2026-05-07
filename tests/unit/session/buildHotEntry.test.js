import { describe, it, expect } from 'vitest';
import { buildHotEntry, buildColdEntry } from '../../../lib/session/buildHotEntry.js';

describe('buildHotEntry', () => {
  it('drops allPapers + scoredPapers from results', () => {
    const hot = buildHotEntry({
      config: { x: 1 },
      sessionId: 'sess-1',
      finalRanking: [{ id: '1', title: 't' }],
      filterResults: { total: 10, yes: [], maybe: [], no: [] },
    });
    expect(hot.results.finalRanking).toEqual([{ id: '1', title: 't' }]);
    expect(hot.results.allPapers).toBeUndefined();
    expect(hot.results.scoredPapers).toBeUndefined();
  });

  it('reduces filterResults to counts', () => {
    const hot = buildHotEntry({
      filterResults: {
        total: 100,
        yes: [{ id: '1' }, { id: '2' }],
        maybe: [{ id: '3' }],
        no: [{ id: '4' }, { id: '5' }, { id: '6' }],
      },
    });
    expect(hot.filterResults).toEqual({
      total: 100,
      yesCount: 2,
      maybeCount: 1,
      noCount: 3,
    });
  });

  it('zeros out password when not authenticated', () => {
    const hot = buildHotEntry({ password: 'secret', isAuthenticated: false });
    expect(hot.password).toBe('');
  });

  it('keeps password when authenticated', () => {
    const hot = buildHotEntry({ password: 'secret', isAuthenticated: true });
    expect(hot.password).toBe('secret');
  });

  it('preserves config + sessionId verbatim', () => {
    const config = { selectedCategories: ['cs.AI'], filterModel: 'gemini-3.1-flash-lite' };
    const hot = buildHotEntry({ config, sessionId: 'sess-abc' });
    expect(hot.config).toBe(config);
    expect(hot.sessionId).toBe('sess-abc');
  });

  it('handles missing fields gracefully', () => {
    const hot = buildHotEntry({});
    expect(hot.results).toEqual({ finalRanking: [] });
    expect(hot.filterResults).toEqual({
      total: 0,
      yesCount: 0,
      maybeCount: 0,
      noCount: 0,
    });
  });
});

describe('buildColdEntry', () => {
  it('includes allPapers + scoredPapers + finalRanking', () => {
    const cold = buildColdEntry({
      sessionId: 'sess-1',
      results: {
        allPapers: [{ id: '1' }],
        scoredPapers: [{ id: '1', score: 7 }],
        finalRanking: [{ id: '1', finalScore: 8 }],
      },
      filterResults: { total: 1, yes: [{ id: '1' }], maybe: [], no: [] },
    });
    expect(cold.id).toBe('sess-1');
    expect(cold.results.allPapers).toHaveLength(1);
    expect(cold.results.scoredPapers).toHaveLength(1);
    expect(cold.results.finalRanking).toHaveLength(1);
  });

  it('keeps full filterResults verdicts (yes/maybe/no arrays)', () => {
    const cold = buildColdEntry({
      sessionId: 'sess-1',
      filterResults: {
        total: 3,
        yes: [{ id: '1' }],
        maybe: [{ id: '2' }],
        no: [{ id: '3' }],
      },
    });
    expect(cold.filterResults.yes).toHaveLength(1);
    expect(cold.filterResults.maybe).toHaveLength(1);
    expect(cold.filterResults.no).toHaveLength(1);
  });

  it('stamps a timestamp', () => {
    const before = Date.now();
    const cold = buildColdEntry({ sessionId: 'sess-1' });
    expect(cold.timestamp).toBeGreaterThanOrEqual(before);
    expect(cold.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
