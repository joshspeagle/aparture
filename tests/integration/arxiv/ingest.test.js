import { describe, it, expect, vi } from 'vitest';
import { harvest } from '../../../lib/arxiv/ingest.js';

const examplePaper = (id, fetchedCategory) => ({
  id,
  title: `Paper ${id}`,
  abstract: 'abs',
  authors: ['A'],
  published: '2026-04-28T00:00:00Z',
  updated: '2026-04-28T00:00:00Z',
  categories: [fetchedCategory],
  pdfUrl: `https://export.arxiv.org/pdf/${id}.pdf`,
  fetchedCategory,
});

const baseWindow = {
  from: '2026-04-28',
  until: '2026-04-29',
  selectedSubcategories: ['cs.AI', 'cs.LG'],
  fillupSchedule: [],
  minPapersPerSubcategory: 0,
  mode: 'atom-only',
  windowSemantics: 'submitted-or-updated',
  cacheTtlMinutes: 0,
};

describe('ingest.harvest — atom-only mode', () => {
  it('calls fetchAtom once per selected subcategory and returns merged papers', async () => {
    const fetchAtomImpl = vi
      .fn()
      .mockResolvedValueOnce([examplePaper('2604.0001', 'cs.AI')])
      .mockResolvedValueOnce([examplePaper('2604.0002', 'cs.LG')]);

    const result = await harvest(baseWindow, {
      password: 'pw',
      abortSignal: { aborted: false },
      fetchAtomImpl,
      harvestOaiImpl: vi.fn(),
    });

    expect(fetchAtomImpl).toHaveBeenCalledTimes(2);
    expect(result.papers).toHaveLength(2);
    expect(result.modeUsed).toBe('atom-only');
  });

  it('dedupes papers cross-listed across selected subcategories', async () => {
    const shared = examplePaper('2604.SHARED', 'cs.AI');
    shared.categories = ['cs.AI', 'cs.LG'];
    const fetchAtomImpl = vi
      .fn()
      .mockResolvedValueOnce([shared])
      .mockResolvedValueOnce([{ ...shared, fetchedCategory: 'cs.LG' }]);

    const result = await harvest(baseWindow, {
      password: 'pw',
      abortSignal: { aborted: false },
      fetchAtomImpl,
      harvestOaiImpl: vi.fn(),
    });

    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].id).toBe('2604.SHARED');
  });

  it('sorts papers by published descending', async () => {
    const a = { ...examplePaper('A', 'cs.AI'), published: '2026-04-25T00:00:00Z' };
    const b = { ...examplePaper('B', 'cs.AI'), published: '2026-04-29T00:00:00Z' };
    const fetchAtomImpl = vi.fn().mockResolvedValue([a, b]);

    const result = await harvest(
      { ...baseWindow, selectedSubcategories: ['cs.AI'] },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        fetchAtomImpl,
        harvestOaiImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id)).toEqual(['B', 'A']);
  });
});
