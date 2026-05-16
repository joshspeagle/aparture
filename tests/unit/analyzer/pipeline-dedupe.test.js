// Verifies the dedupe pass in pipeline.fetchPapers:
//   1. Remove mode drops matched arxivIds, status line reports the count.
//   2. Flag mode keeps them all but decorates matched ones.
//   3. Empty index is a no-op (and status line says "loading" if not ready).

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

// Mock the harvest module so we can return a controlled paper list without
// hitting the network. Module-level mock so the import inside pipeline.js
// resolves to ours.
vi.mock('../../../lib/arxiv/ingest.js', () => ({
  harvest: vi.fn(),
}));

import { harvest } from '../../../lib/arxiv/ingest.js';

function makePaper(id) {
  return {
    id,
    title: `Paper ${id}`,
    abstract: 'abstract',
    authors: ['A'],
    published: '2026-05-14',
    updated: '2026-05-14',
    categories: ['cs.AI'],
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    fetchedCategory: 'cs.AI',
  };
}

function setupStore({ seenPapersIndex = {}, seenPapersReady = true, removeDuplicates = true }) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    reactContext: {
      profile: { content: 'test' },
      config: {
        selectedCategories: ['cs.AI'],
        useQuickFilter: false,
        pauseAfterFilter: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        daysBack: 1,
        arxivIngestion: 'auto',
        minPapersPerSubcategory: 5,
        lookbackExtensions: [3, 7, 14],
        arxivCacheTtlMinutes: 60,
        arxivWindowSemantics: 'submitted-only',
        removeDuplicates,
      },
      feedback: { events: [] },
      saveBriefing: null,
      briefingHistory: [],
      seenPapersIndex,
      seenPapersReady,
    },
    password: 'pw',
  });
}

describe('pipeline.fetchPapers — dedupe pass', () => {
  beforeEach(() => {
    harvest.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Remove mode drops papers already in seenPapersIndex', async () => {
    const seenPapersIndex = {
      '2605.14210': '2026-05-10',
      '2605.14211': '2026-05-12',
    };
    setupStore({ seenPapersIndex, removeDuplicates: true });

    harvest.mockResolvedValue({
      papers: ['2605.14205', '2605.14210', '2605.14211', '2605.14212', '2605.14213'].map(makePaper),
      modeUsed: 'oai',
      perPrefix: [],
      fillups: [],
    });

    const pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });

    global.fetch = vi.fn(async (url) => {
      if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
        return { ok: true, status: 200, json: async () => ({ rawResponse: '[]' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    await pipeline.startProcessing(false, false);

    const allPapers = useAnalyzerStore.getState().results.allPapers;
    expect(allPapers).toHaveLength(3);
    expect(allPapers.map((p) => p.id).sort()).toEqual(['2605.14205', '2605.14212', '2605.14213']);
    expect(allPapers.every((p) => !p.isDuplicate)).toBe(true);

    const statusLog = useAnalyzerStore.getState().processing.statusLog;
    expect(statusLog.some((l) => /removed 2 duplicates/.test(l))).toBe(true);
  });

  test('Flag mode keeps all papers and decorates matched ones', async () => {
    const seenPapersIndex = {
      '2605.14210': '2026-05-10',
      '2605.14211': '2026-05-12',
    };
    setupStore({ seenPapersIndex, removeDuplicates: false });

    harvest.mockResolvedValue({
      papers: ['2605.14205', '2605.14210', '2605.14211', '2605.14212', '2605.14213'].map(makePaper),
      modeUsed: 'oai',
      perPrefix: [],
      fillups: [],
    });

    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });

    await pipeline.startProcessing(false, false);

    const allPapers = useAnalyzerStore.getState().results.allPapers;
    expect(allPapers).toHaveLength(5);
    const flagged = allPapers.filter((p) => p.isDuplicate);
    expect(flagged).toHaveLength(2);
    const byId = Object.fromEntries(allPapers.map((p) => [p.id, p]));
    expect(byId['2605.14210'].firstSeenDate).toBe('2026-05-10');
    expect(byId['2605.14211'].firstSeenDate).toBe('2026-05-12');
    expect(byId['2605.14205'].isDuplicate).toBeUndefined();

    const statusLog = useAnalyzerStore.getState().processing.statusLog;
    expect(statusLog.some((l) => /flagged 2 duplicates/.test(l))).toBe(true);
  });

  test('empty index + not-ready → no-op, status hint appended', async () => {
    setupStore({ seenPapersIndex: {}, seenPapersReady: false, removeDuplicates: true });

    harvest.mockResolvedValue({
      papers: ['2605.14205', '2605.14210'].map(makePaper),
      modeUsed: 'oai',
      perPrefix: [],
      fillups: [],
    });

    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    const pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });

    await pipeline.startProcessing(false, false);

    const allPapers = useAnalyzerStore.getState().results.allPapers;
    expect(allPapers).toHaveLength(2);
    const statusLog = useAnalyzerStore.getState().processing.statusLog;
    expect(statusLog.some((l) => /seen-papers index still loading/.test(l))).toBe(true);
  });
});
