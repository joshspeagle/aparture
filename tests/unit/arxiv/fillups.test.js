import { describe, it, expect, vi } from 'vitest';
import { applyFillups, planFillupSteps } from '../../../lib/arxiv/fillups.js';

describe('planFillupSteps', () => {
  it('produces cumulative slices from windowFrom and a schedule', () => {
    const steps = planFillupSteps({
      from: '2026-04-28',
      until: '2026-04-29',
      schedule: [3, 7, 14],
    });
    expect(steps).toEqual([
      { extraDays: 3, from: '2026-04-25', until: '2026-04-27' },
      { extraDays: 7, from: '2026-04-21', until: '2026-04-24' },
      { extraDays: 14, from: '2026-04-14', until: '2026-04-20' },
    ]);
  });

  it('returns no steps for empty schedule', () => {
    expect(planFillupSteps({ from: '2026-04-28', until: '2026-04-29', schedule: [] })).toEqual([]);
  });
});

describe('applyFillups', () => {
  const mkPaper = (id, fetchedCategory) => ({
    id,
    title: id,
    abstract: '',
    authors: [],
    published: '2026-04-28',
    updated: '2026-04-28',
    categories: [fetchedCategory],
    pdfUrl: '',
    fetchedCategory,
  });

  it('triggers fill-up for subcats below threshold and stops at threshold', async () => {
    const fetchFn = vi.fn(async ({ narrowSet }) => {
      // Each step returns 3 new papers
      return [
        mkPaper(`${narrowSet}-x`, 'cs.GT'),
        mkPaper(`${narrowSet}-y`, 'cs.GT'),
        mkPaper(`${narrowSet}-z`, 'cs.GT'),
      ];
    });

    const initial = [mkPaper('seed1', 'cs.GT'), mkPaper('seed2', 'cs.GT')];
    const result = await applyFillups({
      papers: initial,
      selectedSubcategories: ['cs.GT'],
      schedule: [3, 7, 14],
      threshold: 5,
      from: '2026-04-28',
      until: '2026-04-29',
      fetchFn,
    });

    // 2 seeds + 3 from step 1 = 5 → threshold met, stop.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.papers).toHaveLength(5);
    expect(result.fillups).toEqual([
      { subcategory: 'cs.GT', triggeredAt: 2, finalCount: 5, stepsUsed: 1 },
    ]);
  });

  it('uses multiple steps when each returns too few papers', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce([mkPaper('a', 'cs.GT')])
      .mockResolvedValueOnce([mkPaper('b', 'cs.GT')])
      .mockResolvedValueOnce([mkPaper('c', 'cs.GT'), mkPaper('d', 'cs.GT'), mkPaper('e', 'cs.GT')]);

    const result = await applyFillups({
      papers: [],
      selectedSubcategories: ['cs.GT'],
      schedule: [3, 7, 14],
      threshold: 5,
      from: '2026-04-28',
      until: '2026-04-29',
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result.papers).toHaveLength(5);
    expect(result.fillups[0]).toMatchObject({
      subcategory: 'cs.GT',
      triggeredAt: 0,
      finalCount: 5,
      stepsUsed: 3,
    });
  });

  it('does not trigger fill-up when subcat is at threshold', async () => {
    const fetchFn = vi.fn();
    const initial = Array.from({ length: 5 }, (_, i) => mkPaper(`p${i}`, 'cs.GT'));
    const result = await applyFillups({
      papers: initial,
      selectedSubcategories: ['cs.GT'],
      schedule: [3, 7, 14],
      threshold: 5,
      from: '2026-04-28',
      until: '2026-04-29',
      fetchFn,
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.papers).toHaveLength(5);
    expect(result.fillups).toEqual([]);
  });

  it('threshold=0 disables fill-up', async () => {
    const fetchFn = vi.fn();
    const result = await applyFillups({
      papers: [],
      selectedSubcategories: ['cs.GT'],
      schedule: [3, 7, 14],
      threshold: 0,
      from: '2026-04-28',
      until: '2026-04-29',
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.fillups).toEqual([]);
  });

  it('empty schedule disables fill-up', async () => {
    const fetchFn = vi.fn();
    await applyFillups({
      papers: [],
      selectedSubcategories: ['cs.GT'],
      schedule: [],
      threshold: 5,
      from: '2026-04-28',
      until: '2026-04-29',
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('handles multiple under-threshold subcats independently', async () => {
    const fetchFn = vi.fn(async ({ narrowSet }) => {
      const subcat = narrowSet.includes('GT') ? 'cs.GT' : 'cs.IT';
      return Array.from({ length: 5 }, (_, i) => mkPaper(`${narrowSet}-${i}`, subcat));
    });

    const result = await applyFillups({
      papers: [],
      selectedSubcategories: ['cs.GT', 'cs.IT'],
      schedule: [3],
      threshold: 5,
      from: '2026-04-28',
      until: '2026-04-29',
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.fillups).toHaveLength(2);
  });
});
