import { describe, it, expect, vi, beforeEach } from 'vitest';
import { harvest } from '../../../lib/arxiv/ingest.js';
import { ArxivThrottledError } from '../../../lib/arxiv/errors.js';

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

  it('reports progress after each subcategory and awaits waitForResume between them', async () => {
    const fetchAtomImpl = vi
      .fn()
      .mockResolvedValueOnce([examplePaper('A', 'cs.AI')])
      .mockResolvedValueOnce([examplePaper('B', 'cs.LG')]);
    const progressCallback = vi.fn();
    const waitForResume = vi.fn().mockResolvedValue();

    await harvest(baseWindow, {
      password: 'pw',
      abortSignal: { aborted: false },
      fetchAtomImpl,
      harvestOaiImpl: vi.fn(),
      progressCallback,
      waitForResume,
    });

    // Two subcategories → two progress callbacks (1/2, 2/2) and two pause checks.
    expect(progressCallback.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(waitForResume).toHaveBeenCalledTimes(2);
  });
});

describe('ingest.harvest — oai-only mode', () => {
  it('issues one harvestOai call per top-level prefix', async () => {
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([
        { ...examplePaper('A', 'cs.AI'), categories: ['cs.AI', 'cs.LG'] },
        { ...examplePaper('B', 'cs.LG'), categories: ['cs.LG'] },
      ])
      .mockResolvedValueOnce([{ ...examplePaper('C', 'stat.ML'), categories: ['stat.ML'] }]);
    const fetchAtomImpl = vi.fn();

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.AI', 'cs.LG', 'stat.ML'],
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl,
      }
    );

    expect(harvestOaiImpl).toHaveBeenCalledTimes(2); // one for cs, one for stat
    expect(harvestOaiImpl.mock.calls[0][0]).toMatchObject({ set: 'cs' });
    expect(harvestOaiImpl.mock.calls[1][0]).toMatchObject({ set: 'stat' });
    expect(result.papers).toHaveLength(3);
    expect(fetchAtomImpl).not.toHaveBeenCalled();
  });

  it('filters records to selected subcategories and assigns fetchedCategory', async () => {
    const harvestOaiImpl = vi.fn().mockResolvedValueOnce([
      { ...examplePaper('A', ''), categories: ['cs.AI'] },
      { ...examplePaper('B', ''), categories: ['cs.OS'] }, // unselected
      { ...examplePaper('C', ''), categories: ['cs.LG', 'cs.AI'] },
    ]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.AI', 'cs.LG'],
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id).sort()).toEqual(['A', 'C']);
    const a = result.papers.find((p) => p.id === 'A');
    const c = result.papers.find((p) => p.id === 'C');
    expect(a.fetchedCategory).toBe('cs.AI');
    // 'C' has both cs.LG and cs.AI in its categories. Selected order is ['cs.AI', 'cs.LG'],
    // so cs.AI wins as the first-selected match.
    expect(c.fetchedCategory).toBe('cs.AI');
  });
});

describe('ingest.harvest — auto mode', () => {
  it('uses OAI for all prefixes when OAI succeeds', async () => {
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('A', ''), categories: ['cs.AI'] }])
      .mockResolvedValueOnce([{ ...examplePaper('B', ''), categories: ['stat.ML'] }]);
    const fetchAtomImpl = vi.fn();

    const result = await harvest(
      { ...baseWindow, mode: 'auto', selectedSubcategories: ['cs.AI', 'stat.ML'] },
      { password: 'pw', abortSignal: { aborted: false }, harvestOaiImpl, fetchAtomImpl }
    );

    expect(result.modeUsed).toBe('auto-oai');
    expect(fetchAtomImpl).not.toHaveBeenCalled();
  });

  it('falls back to Atom for the failing prefix and all subsequent prefixes', async () => {
    const harvestOaiImpl = vi
      .fn()
      .mockRejectedValueOnce(new ArxivThrottledError('rate limit'))
      .mockResolvedValueOnce([{ ...examplePaper('Z', ''), categories: ['stat.ML'] }]);
    const fetchAtomImpl = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('A', 'cs.AI'), categories: ['cs.AI'] }])
      .mockResolvedValueOnce([{ ...examplePaper('B', 'stat.ML'), categories: ['stat.ML'] }]);

    const result = await harvest(
      { ...baseWindow, mode: 'auto', selectedSubcategories: ['cs.AI', 'stat.ML'] },
      { password: 'pw', abortSignal: { aborted: false }, harvestOaiImpl, fetchAtomImpl }
    );

    expect(result.modeUsed).toBe('auto-atom');
    expect(harvestOaiImpl).toHaveBeenCalledTimes(1); // tripped on first prefix
    expect(fetchAtomImpl).toHaveBeenCalledTimes(2); // cs.AI then stat.ML
  });

  it('records auto-mixed when first prefix succeeded but second failed', async () => {
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('A', ''), categories: ['cs.AI'] }])
      .mockRejectedValueOnce(new ArxivThrottledError('rate limit'));
    const fetchAtomImpl = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('B', 'stat.ML'), categories: ['stat.ML'] }]);

    const result = await harvest(
      { ...baseWindow, mode: 'auto', selectedSubcategories: ['cs.AI', 'stat.ML'] },
      { password: 'pw', abortSignal: { aborted: false }, harvestOaiImpl, fetchAtomImpl }
    );

    expect(result.modeUsed).toBe('auto-mixed');
  });

  it('propagates Atom failure when both paths fail in auto mode', async () => {
    const harvestOaiImpl = vi.fn().mockRejectedValueOnce(new ArxivThrottledError('rate limit'));
    const fetchAtomImpl = vi
      .fn()
      .mockRejectedValueOnce(new ArxivThrottledError('also rate limited'));

    await expect(
      harvest(
        { ...baseWindow, mode: 'auto', selectedSubcategories: ['cs.AI'] },
        { password: 'pw', abortSignal: { aborted: false }, harvestOaiImpl, fetchAtomImpl }
      )
    ).rejects.toBeInstanceOf(ArxivThrottledError);
  });
});

describe('ingest.harvest — fill-ups', () => {
  it('triggers narrow fetch via the chosen driver when a subcat is below threshold', async () => {
    const harvestOaiImpl = vi
      .fn()
      // Broad cs fetch returns 1 cs.GT paper (below threshold)
      .mockResolvedValueOnce([{ ...examplePaper('seed', ''), categories: ['cs.GT'] }])
      // Narrow cs:cs:GT fill-up returns 4 more cs.GT papers
      .mockResolvedValueOnce([
        { ...examplePaper('f1', ''), categories: ['cs.GT'] },
        { ...examplePaper('f2', ''), categories: ['cs.GT'] },
        { ...examplePaper('f3', ''), categories: ['cs.GT'] },
        { ...examplePaper('f4', ''), categories: ['cs.GT'] },
      ]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.GT'],
        fillupSchedule: [3, 7, 14],
        minPapersPerSubcategory: 5,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(harvestOaiImpl).toHaveBeenCalledTimes(2); // broad + 1 fill-up step
    // The second call uses the narrow set
    expect(harvestOaiImpl.mock.calls[1][0]).toMatchObject({ set: 'cs:cs:GT' });
    expect(result.papers).toHaveLength(5);
    expect(result.fillups).toEqual([
      { subcategory: 'cs.GT', triggeredAt: 1, finalCount: 5, stepsUsed: 1 },
    ]);
  });
});

import { clear as clearCache } from '../../../lib/arxiv/cache.js';

describe('ingest.harvest — cache', () => {
  beforeEach(() => clearCache());

  it('serves a cache hit without invoking drivers', async () => {
    // Prime cache by running once
    const harvestOaiImpl1 = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('A', ''), categories: ['cs.AI'] }]);
    await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.AI'],
        cacheTtlMinutes: 60,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl: harvestOaiImpl1,
        fetchAtomImpl: vi.fn(),
      }
    );

    // Second run with same window: cache hit, no driver calls
    const harvestOaiImpl2 = vi.fn();
    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.AI'],
        cacheTtlMinutes: 60,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl: harvestOaiImpl2,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(harvestOaiImpl2).not.toHaveBeenCalled();
    expect(result.perPrefix[0]).toMatchObject({ driver: 'cache', cached: true });
    expect(result.papers).toHaveLength(1);
  });
});

describe('ingest.harvest — windowSemantics', () => {
  it('drops updated-not-created papers when submitted-only', async () => {
    const harvestOaiImpl = vi.fn().mockResolvedValueOnce([
      {
        ...examplePaper('NEW', ''),
        categories: ['cs.AI'],
        published: '2026-04-28',
        updated: '2026-04-28',
      },
      {
        ...examplePaper('OLD-V2', ''),
        categories: ['cs.AI'],
        published: '2025-01-01',
        updated: '2026-04-28',
      },
    ]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.AI'],
        windowSemantics: 'submitted-only',
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id)).toEqual(['NEW']);
  });

  it('drops v2-of-old papers from fill-up records when submitted-only', async () => {
    // Broad fetch: 1 paper (below the 5-paper threshold) — triggers fill-up.
    // Fill-up step 1 returns a mix: a newly-submitted paper inside the
    // step's window AND a v2-of-old update whose original submission predates
    // every fill-up step. Under submitted-only the v2-of-old must be dropped.
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([
        {
          ...examplePaper('NEW-BROAD', ''),
          categories: ['cs.GT'],
          published: '2026-04-28',
          updated: '2026-04-28',
        },
      ])
      .mockResolvedValueOnce([
        {
          ...examplePaper('NEW-FILLUP', ''),
          categories: ['cs.GT'],
          published: '2026-04-26',
          updated: '2026-04-26',
        },
        {
          ...examplePaper('OLD-V2-IN-FILLUP', ''),
          categories: ['cs.GT'],
          published: '2024-01-01',
          updated: '2026-04-26',
        },
      ]);

    const result = await harvest(
      {
        ...baseWindow,
        from: '2026-04-28',
        until: '2026-04-29',
        mode: 'oai-only',
        selectedSubcategories: ['cs.GT'],
        fillupSchedule: [3],
        minPapersPerSubcategory: 5,
        windowSemantics: 'submitted-only',
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id).sort()).toEqual(['NEW-BROAD', 'NEW-FILLUP']);
  });

  it('keeps v2-of-old papers from fill-ups when submitted-or-updated', async () => {
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([
        {
          ...examplePaper('NEW-BROAD', ''),
          categories: ['cs.GT'],
          published: '2026-04-28',
          updated: '2026-04-28',
        },
      ])
      .mockResolvedValueOnce([
        {
          ...examplePaper('OLD-V2-IN-FILLUP', ''),
          categories: ['cs.GT'],
          published: '2024-01-01',
          updated: '2026-04-26',
        },
      ]);

    const result = await harvest(
      {
        ...baseWindow,
        from: '2026-04-28',
        until: '2026-04-29',
        mode: 'oai-only',
        selectedSubcategories: ['cs.GT'],
        fillupSchedule: [3],
        minPapersPerSubcategory: 5,
        windowSemantics: 'submitted-or-updated',
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id).sort()).toEqual(['NEW-BROAD', 'OLD-V2-IN-FILLUP']);
  });

  it('keeps updated-not-created papers when submitted-or-updated', async () => {
    const harvestOaiImpl = vi.fn().mockResolvedValueOnce([
      {
        ...examplePaper('NEW', ''),
        categories: ['cs.AI'],
        published: '2026-04-28',
        updated: '2026-04-28',
      },
      {
        ...examplePaper('OLD-V2', ''),
        categories: ['cs.AI'],
        published: '2025-01-01',
        updated: '2026-04-28',
      },
    ]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.AI'],
        windowSemantics: 'submitted-or-updated',
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id).sort()).toEqual(['NEW', 'OLD-V2']);
  });
});
