import { describe, it, expect, vi, beforeEach } from 'vitest';
import { harvest } from '../../../lib/arxiv/ingest.js';
import { ArxivThrottledError } from '../../../lib/arxiv/errors.js';

// No-op inter-request spacing so multi-request tests don't actually sleep the
// jittered 3000–5000 ms between consecutive arXiv calls. Tests that assert the
// spacing behavior inject their own spy instead.
const noSleep = () => Promise.resolve();

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
      sleepImpl: noSleep,
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
      sleepImpl: noSleep,
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
      sleepImpl: noSleep,
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
        sleepImpl: noSleep,
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

describe('ingest.harvest — jittered inter-request spacing', () => {
  it('sleeps BETWEEN consecutive OAI prefix requests but not before the first', async () => {
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('A', ''), categories: ['cs.AI'] }])
      .mockResolvedValueOnce([{ ...examplePaper('B', ''), categories: ['stat.ML'] }]);
    const spacingMsImpl = vi.fn(() => 4242);
    const sleepImpl = vi.fn().mockResolvedValue();

    await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.AI', 'stat.ML'],
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
        spacingMsImpl,
        sleepImpl,
      }
    );

    // Two prefix requests (cs, stat) → exactly one spacing sleep between them
    // (none before the first request).
    expect(harvestOaiImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(4242);
  });

  it('does not sleep when only a single OAI prefix request is made', async () => {
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('A', ''), categories: ['cs.AI'] }]);
    const sleepImpl = vi.fn().mockResolvedValue();

    await harvest(
      { ...baseWindow, mode: 'oai-only', selectedSubcategories: ['cs.AI'] },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
        sleepImpl,
      }
    );

    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it('sleeps BETWEEN consecutive fill-up requests (and across the broad→fill-up boundary) but not before the first request of the run', async () => {
    // One broad OAI prefix request (cs) returns a single cs.GT paper — below
    // the 5-paper threshold, so fill-ups fire. Two fill-up steps each return 0
    // new papers, so both steps run. Total network requests: 1 broad + 2
    // fill-up = 3 → exactly 2 spacing sleeps:
    //   - broad → fill-up step 1 (the broad→fill-up boundary)
    //   - fill-up step 1 → fill-up step 2 (between consecutive fill-ups)
    // and NONE before the broad request (the first of the run).
    const harvestOaiImpl = vi
      .fn()
      // Broad cs fetch: 1 cs.GT paper (below threshold).
      .mockResolvedValueOnce([{ ...examplePaper('seed', ''), categories: ['cs.GT'] }])
      // Fill-up step 1: no new papers (still below threshold → step 2 runs).
      .mockResolvedValueOnce([])
      // Fill-up step 2: no new papers.
      .mockResolvedValueOnce([]);
    const spacingMsImpl = vi.fn(() => 4001);
    const sleepImpl = vi.fn().mockResolvedValue();

    await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        selectedSubcategories: ['cs.GT'],
        fillupSchedule: [3, 7],
        minPapersPerSubcategory: 5,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
        spacingMsImpl,
        sleepImpl,
      }
    );

    // 3 requests total (broad + 2 fill-up steps).
    expect(harvestOaiImpl).toHaveBeenCalledTimes(3);
    // 2 spacing sleeps — one fewer than the request count (no leading delay).
    expect(sleepImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(4001);
  });

  it('does not sleep before the very first request when a single broad fetch triggers exactly one fill-up step', async () => {
    // 1 broad request + 1 fill-up step (the fill returns enough to reach the
    // threshold so no further steps fire) = 2 requests → exactly 1 sleep
    // (broad → fill-up). Proves the first request of the run is never spaced.
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([{ ...examplePaper('seed', ''), categories: ['cs.GT'] }])
      .mockResolvedValueOnce([
        { ...examplePaper('f1', ''), categories: ['cs.GT'] },
        { ...examplePaper('f2', ''), categories: ['cs.GT'] },
        { ...examplePaper('f3', ''), categories: ['cs.GT'] },
        { ...examplePaper('f4', ''), categories: ['cs.GT'] },
      ]);
    const sleepImpl = vi.fn().mockResolvedValue();

    await harvest(
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
        sleepImpl,
      }
    );

    expect(harvestOaiImpl).toHaveBeenCalledTimes(2); // broad + 1 fill-up step
    expect(sleepImpl).toHaveBeenCalledTimes(1); // only the broad→fill-up gap
  });

  it('sleeps BETWEEN consecutive Atom subcategory requests in atom-only mode', async () => {
    const fetchAtomImpl = vi
      .fn()
      .mockResolvedValueOnce([examplePaper('2604.0001', 'cs.AI')])
      .mockResolvedValueOnce([examplePaper('2604.0002', 'cs.LG')]);
    const spacingMsImpl = vi.fn(() => 3777);
    const sleepImpl = vi.fn().mockResolvedValue();

    await harvest(baseWindow, {
      password: 'pw',
      abortSignal: { aborted: false },
      fetchAtomImpl,
      harvestOaiImpl: vi.fn(),
      spacingMsImpl,
      sleepImpl,
    });

    // Two subcategories → one spacing sleep between them.
    expect(fetchAtomImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(3777);
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
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl,
        sleepImpl: noSleep,
      }
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
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl,
        sleepImpl: noSleep,
      }
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
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl,
        sleepImpl: noSleep,
      }
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
        {
          password: 'pw',
          abortSignal: { aborted: false },
          harvestOaiImpl,
          fetchAtomImpl,
          sleepImpl: noSleep,
        }
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
        sleepImpl: noSleep,
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
        sleepImpl: noSleep,
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
        sleepImpl: noSleep,
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

describe('ingest.harvest — targetDaysBack anchor logic', () => {
  // Builds a paper with explicit v1 date (published).
  const paperOn = (id, isoDate, fetchedCategory = 'cs.AI') => ({
    ...examplePaper(id, fetchedCategory),
    categories: [fetchedCategory],
    published: isoDate,
    updated: isoDate,
  });

  it('anchors v1 target on latest day with content and slices to targetDaysBack', async () => {
    // Wide OAI fetch [2026-04-20, 2026-05-07] returns papers across many days.
    // With targetDaysBack=1 and submitted-only: anchor = 2026-05-06 (the latest
    // v1 day with any selected-category paper); v1 target = [2026-05-06, 2026-05-06].
    // Older papers (2026-05-04 and 2026-04-30) must be dropped.
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([
        paperOn('TODAY-A', '2026-05-06'),
        paperOn('TODAY-B', '2026-05-06'),
        paperOn('YESTERDAY', '2026-05-04'),
        paperOn('LAST-WEEK', '2026-04-30'),
      ]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        from: '2026-04-20',
        until: '2026-05-07',
        targetDaysBack: 1,
        windowSemantics: 'submitted-only',
        selectedSubcategories: ['cs.AI'],
        fillupSchedule: [],
        minPapersPerSubcategory: 0,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id).sort()).toEqual(['TODAY-A', 'TODAY-B']);
  });

  it('targetDaysBack=3 slices three days back from anchor', async () => {
    const harvestOaiImpl = vi.fn().mockResolvedValueOnce([
      paperOn('D0', '2026-05-06'),
      paperOn('D1', '2026-05-05'),
      paperOn('D2', '2026-05-04'),
      paperOn('D3', '2026-05-03'), // outside [anchor-2, anchor]
    ]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        from: '2026-04-29',
        until: '2026-05-07',
        targetDaysBack: 3,
        windowSemantics: 'submitted-only',
        selectedSubcategories: ['cs.AI'],
        fillupSchedule: [],
        minPapersPerSubcategory: 0,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id).sort()).toEqual(['D0', 'D1', 'D2']);
  });

  it('falls back to window.until as anchor when no papers match selected subcategories', async () => {
    // No papers at all — anchor falls back to window.until, target window
    // [until - 0, until] = [2026-05-07, 2026-05-07]. Result is empty regardless;
    // the assertion is that the call doesn't throw and returns gracefully.
    const harvestOaiImpl = vi.fn().mockResolvedValueOnce([]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        from: '2026-04-29',
        until: '2026-05-07',
        targetDaysBack: 1,
        windowSemantics: 'submitted-only',
        selectedSubcategories: ['cs.AI'],
        fillupSchedule: [],
        minPapersPerSubcategory: 0,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers).toEqual([]);
  });

  it('does NOT apply anchor logic when windowSemantics is submitted-or-updated', async () => {
    // Same fetch as the slice test, but submitted-or-updated → all papers in
    // the OAI window pass through untouched.
    const harvestOaiImpl = vi
      .fn()
      .mockResolvedValueOnce([paperOn('TODAY', '2026-05-06'), paperOn('OLD-V2', '2024-01-01')]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        from: '2026-04-29',
        until: '2026-05-07',
        targetDaysBack: 1,
        windowSemantics: 'submitted-or-updated',
        selectedSubcategories: ['cs.AI'],
        fillupSchedule: [],
        minPapersPerSubcategory: 0,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
      }
    );

    expect(result.papers.map((p) => p.id).sort()).toEqual(['OLD-V2', 'TODAY']);
  });

  it('clamps fill-up OAI until to window.until so it never asks for future dates', async () => {
    // Anchor = 2026-05-06 → step 1 v1 target = [2026-05-03, 2026-05-05].
    // Naively widening until by lag (+7) would give 2026-05-12 — in the
    // future when window.until is yesterday (2026-05-07). OAI rejects future
    // dates with `badArgument: until date too late` and our parser silently
    // returned zero, killing steps 1 and 2 and forcing fall-through to step 3
    // (which reaches 14 days back). The fix clamps to window.until.
    let capturedFillupUntil = null;
    const harvestOaiImpl = vi.fn().mockImplementation(async ({ set, until }) => {
      // Broad fetch: anchor day has 1 paper for cs.GT (below threshold).
      if (set === 'cs') {
        return [
          {
            ...examplePaper('ANCHOR', ''),
            categories: ['cs.GT'],
            published: '2026-05-06',
            updated: '2026-05-06',
          },
        ];
      }
      // Fill-up step 1 (cs:cs:GT). Capture the until that was sent.
      if (set === 'cs:cs:GT') {
        capturedFillupUntil = until;
        return [
          {
            ...examplePaper('STEP1-IN', ''),
            categories: ['cs.GT'],
            published: '2026-05-04',
            updated: '2026-05-04',
          },
        ];
      }
      return [];
    });

    await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        from: '2026-04-30',
        until: '2026-05-07', // yesterday — production sets this in pipeline.fetchPapers
        targetDaysBack: 1,
        windowSemantics: 'submitted-only',
        selectedSubcategories: ['cs.GT'],
        fillupSchedule: [3],
        minPapersPerSubcategory: 5,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
        sleepImpl: noSleep,
      }
    );

    // Without clamp, this would be '2026-05-12'. With clamp, it must be
    // '2026-05-07' (= window.until).
    expect(capturedFillupUntil).toBe('2026-05-07');
  });

  it('fill-up under submitted-only post-filters wide OAI return to v1 step window', async () => {
    // Broad fetch yields 0 cs.GT for the anchor day → fill-up triggers.
    // The fill-up's OAI fetch (widened by lag buffer) returns a mix of papers;
    // only those with v1 in the step's target window should survive.
    const harvestOaiImpl = vi
      .fn()
      // Broad: one anchor-day paper, plus one re-announced old paper.
      .mockResolvedValueOnce([
        paperOn('ANCHOR', '2026-05-06', 'cs.GT'),
        paperOn('OLD-V2', '2023-01-01', 'cs.GT'),
      ])
      // Fill-up step 1 (3 days back from anchor): widened OAI returns
      // papers with v1 inside AND outside the target window. The post-filter
      // should drop the outside ones.
      .mockResolvedValueOnce([
        paperOn('STEP-IN', '2026-05-04', 'cs.GT'),
        paperOn('STEP-OUT-FUTURE', '2026-05-07', 'cs.GT'),
        paperOn('STEP-OUT-PAST', '2026-04-30', 'cs.GT'),
      ]);

    const result = await harvest(
      {
        ...baseWindow,
        mode: 'oai-only',
        from: '2026-04-29',
        until: '2026-05-07',
        targetDaysBack: 1,
        windowSemantics: 'submitted-only',
        selectedSubcategories: ['cs.GT'],
        fillupSchedule: [3],
        minPapersPerSubcategory: 5,
      },
      {
        password: 'pw',
        abortSignal: { aborted: false },
        harvestOaiImpl,
        fetchAtomImpl: vi.fn(),
        sleepImpl: noSleep,
      }
    );

    // Anchor = 2026-05-06 (only ANCHOR contributes, OLD-V2 is dropped pre-anchor).
    // Target v1 window = [2026-05-06, 2026-05-06]. Step 1 v1 window =
    // [2026-05-03, 2026-05-05]. STEP-IN is v1=2026-05-04 → kept.
    // STEP-OUT-FUTURE (2026-05-07) and STEP-OUT-PAST (2026-04-30) → dropped.
    expect(result.papers.map((p) => p.id).sort()).toEqual(['ANCHOR', 'STEP-IN']);
  });
});
