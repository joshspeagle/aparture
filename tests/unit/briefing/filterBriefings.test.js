import { describe, it, expect } from 'vitest';
import { filterBriefings } from '../../../lib/briefing/filterBriefings.js';

const b1 = {
  date: '2025-01-10',
  briefing: {
    executiveSummary: 'attention heads',
    papers: [
      { arxivId: '2501.11111', title: 'Circuit analysis' },
      { arxivId: '2501.22222', title: 'Diffusion uncertainty' },
    ],
  },
};
const b2 = {
  date: '2025-01-15',
  briefing: {
    executiveSummary: 'galaxy formation',
    papers: [
      { arxivId: '2501.33333', title: 'Dark matter halos' },
      { arxivId: '2501.44444', title: 'Cosmological simulations' },
    ],
  },
};
const b3 = {
  date: '2025-02-01',
  briefing: {
    executiveSummary: 'signal processing',
    papers: [{ arxivId: '2502.55555', title: 'Wavelet decomposition' }],
  },
};

const history = [b1, b2, b3];

describe('filterBriefings', () => {
  it('returns all briefings when no filters are applied', () => {
    const out = filterBriefings(history, [], {});
    expect(out).toHaveLength(3);
    expect(out.map((b) => b.date)).toEqual(['2025-01-10', '2025-01-15', '2025-02-01']);
  });

  it('filters by dateRange inclusive on both ends', () => {
    const out = filterBriefings(history, [], { dateRange: ['2025-01-10', '2025-01-15'] });
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.date)).toEqual(['2025-01-10', '2025-01-15']);
  });

  it('filters by dateRange with only start set', () => {
    const out = filterBriefings(history, [], { dateRange: ['2025-01-15', null] });
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.date)).toEqual(['2025-01-15', '2025-02-01']);
  });

  it('filters by dateRange with only end set', () => {
    const out = filterBriefings(history, [], { dateRange: [null, '2025-01-15'] });
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.date)).toEqual(['2025-01-10', '2025-01-15']);
  });

  it('filters by query matching paper titles (case-insensitive substring)', () => {
    const out = filterBriefings(history, [], { query: 'wavelet' });
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2025-02-01');
  });

  it('filters by query matching executive summary', () => {
    const out = filterBriefings(history, [], { query: 'galaxy' });
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2025-01-15');
  });

  it('filters by starredOnly — keeps briefings that contain at least one starred paper', () => {
    const feedbackEvents = [
      { type: 'star', arxivId: '2501.11111' },
      { type: 'dismiss', arxivId: '2502.55555' },
    ];
    const out = filterBriefings(history, feedbackEvents, { starredOnly: true });
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2025-01-10');
  });

  it('combines dateRange + starredOnly + query (all must match)', () => {
    const feedbackEvents = [{ type: 'star', arxivId: '2501.11111' }];
    const out = filterBriefings(history, feedbackEvents, {
      dateRange: ['2025-01-01', '2025-01-31'],
      starredOnly: true,
      query: 'circuit',
    });
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2025-01-10');
  });

  it('returns an empty array when no briefings match', () => {
    const out = filterBriefings(history, [], { query: 'nonexistent' });
    expect(out).toEqual([]);
  });

  it('handles empty history gracefully', () => {
    expect(filterBriefings([], [], {})).toEqual([]);
    expect(filterBriefings([], [], { query: 'anything' })).toEqual([]);
  });

  it('handles missing briefing fields gracefully', () => {
    const partial = [{ date: '2025-01-01', briefing: {} }];
    const out = filterBriefings(partial, [], { query: 'anything' });
    expect(out).toEqual([]);
  });
});
