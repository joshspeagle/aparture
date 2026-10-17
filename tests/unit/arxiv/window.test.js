import { describe, it, expect } from 'vitest';
import { buildHarvestWindow, ANNOUNCE_LAG_BUFFER_DAYS } from '../../../lib/arxiv/window.js';

const NOW = new Date('2026-10-17T06:00:00Z');

describe('buildHarvestWindow', () => {
  it('widens a submitted-only window backward by the announcement lag', () => {
    const w = buildHarvestWindow({ selectedCategories: ['stat.ML'], daysBack: 1 }, NOW);
    expect(w.until).toBe('2026-10-16');
    expect(w.from).toBe('2026-10-09');
    expect(ANNOUNCE_LAG_BUFFER_DAYS).toBe(7);
    expect(w.targetDaysBack).toBe(1);
    expect(w.windowSemantics).toBe('submitted-only');
  });

  it('uses the target window as-is for submitted-or-updated', () => {
    const w = buildHarvestWindow(
      {
        selectedCategories: ['stat.ML'],
        daysBack: 3,
        arxivWindowSemantics: 'submitted-or-updated',
      },
      NOW
    );
    expect([w.from, w.until]).toEqual(['2026-10-14', '2026-10-16']);
  });

  it('applies config defaults and drops blank categories', () => {
    const w = buildHarvestWindow({ selectedCategories: ['cs.LG', ' '] }, NOW);
    expect(w.selectedSubcategories).toEqual(['cs.LG']);
    expect(w).toMatchObject({
      fillupSchedule: [3, 7, 14],
      minPapersPerSubcategory: 5,
      mode: 'auto',
      cacheTtlMinutes: 60,
    });
  });
});
