// Verifies run-start results hygiene (audit P1-2): startProcessing must
// fully replace the results slice via resetResults() so run-added keys
// (availablePapers, failedPapers, allAnalyzedPapers) from a previous run
// can't leak into the new run — setResults merges patches, so nothing else
// ever removes them. Also covers the run-end finally clearing
// filterResults.inProgress (audit-3 finding 7).

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

function setupStore(configOverrides = {}) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    reactContext: {
      profile: { content: 'test profile content' },
      config: {
        pdfModel: 'gemini-3.1-pro',
        scoringModel: 'gemini-3.1-pro',
        filterModel: 'gemini-3.1-pro',
        briefingModel: 'gemini-3.1-pro',
        selectedCategories: ['cs.AI'],
        useQuickFilter: true,
        pauseAfterFilter: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 1,
        filterBatchSize: 5,
        scoringBatchSize: 5,
        maxCorrections: 0,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        filterConcurrency: 1,
        scoringConcurrency: 1,
        pdfAnalysisConcurrency: 1,
        ...configOverrides,
      },
      feedback: { events: [], addFilterOverride: () => {} },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });
}

describe('pipeline — results reset at run start (P1-2)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'stale run-added results keys are dropped at run start, even when the new run exits early',
    { timeout: 30000 },
    async () => {
      setupStore();

      // Simulate leftovers from a previous run. setResults merges, so these
      // keys would survive every later patch unless run-start replaces the
      // whole slice.
      useAnalyzerStore.getState().setResults({
        allPapers: [{ id: 'stale-all' }],
        scoredPapers: [{ id: 'stale-scored' }],
        finalRanking: [{ id: 'stale-final' }],
        availablePapers: [{ id: 'stale-available' }],
        failedPapers: [{ id: 'stale-failed' }],
        allAnalyzedPapers: [{ id: 'stale-analyzed' }],
      });

      const pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      // Every paper filters as NO with default categoriesToScore
      // ['YES','MAYBE'] → the run exits early ("No papers passed the initial
      // filter") without ever writing availablePapers / failedPapers /
      // allAnalyzedPapers — exactly the case where stale keys used to leak.
      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/quick-filter')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              rawResponse: JSON.stringify(
                Array.from({ length: body.papers?.length ?? 1 }, (_, i) => ({
                  paperIndex: i + 1,
                  verdict: 'NO',
                  summary: 'irrelevant',
                  justification: 'irrelevant',
                }))
              ),
            }),
          };
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true); // 5 TEST_PAPERS

      const { results } = useAnalyzerStore.getState();
      // Run-added keys must be gone entirely (slice replaced, not merged).
      expect(results.availablePapers).toBeUndefined();
      expect(results.failedPapers).toBeUndefined();
      expect(results.allAnalyzedPapers).toBeUndefined();
      // Core keys reflect the new run, not the stale one.
      expect(results.allPapers.map((p) => p.id)).not.toContain('stale-all');
      expect(results.scoredPapers).toEqual([]);
      expect(results.finalRanking).toEqual([]);
    }
  );

  test(
    "a run that fails during Stage 1 fetch leaves the previous run's results intact",
    { timeout: 30000 },
    async () => {
      // No categories selected → fetchPapers throws before any new-run data
      // lands. resetResults must NOT have fired at run-start, or the failed
      // run would wipe the previous run's results (in-memory AND the hot
      // tier, via the debounced save).
      setupStore({ selectedCategories: [] });

      useAnalyzerStore.getState().setResults({
        allPapers: [{ id: 'prev-all' }],
        scoredPapers: [{ id: 'prev-scored' }],
        finalRanking: [{ id: 'prev-final' }],
        availablePapers: [{ id: 'prev-available' }],
      });

      const pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      global.fetch = vi.fn(async (url) => {
        throw new Error(`Failed fetch-stage run must not reach the network: ${url}`);
      });

      await pipeline.startProcessing(false, false); // real Stage-1 path

      const { results, processing } = useAnalyzerStore.getState();
      // The failed run reported its error…
      expect(processing.errors.some((e) => /Failed to fetch papers/.test(e))).toBe(true);
      // …and the previous run's results survived, run-added keys included.
      expect(results.finalRanking).toEqual([{ id: 'prev-final' }]);
      expect(results.allPapers).toEqual([{ id: 'prev-all' }]);
      expect(results.scoredPapers).toEqual([{ id: 'prev-scored' }]);
      expect(results.availablePapers).toEqual([{ id: 'prev-available' }]);
    }
  );

  test(
    'filterResults.inProgress is false after a run aborted mid-filter',
    { timeout: 30000 },
    async () => {
      setupStore({ filterBatchSize: 1, maxRetries: 0 });
      const abortControllerRef = { current: new AbortController() };
      const pipeline = createAnalysisPipeline({
        abortControllerRef,
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      let filterCalls = 0;
      global.fetch = vi.fn(async (url) => {
        if (typeof url === 'string' && url.includes('/api/quick-filter')) {
          filterCalls += 1;
          // Stop the run from the middle of the filter stage.
          abortControllerRef.current.abort();
          throw new Error('Operation aborted');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      expect(filterCalls).toBeGreaterThan(0);
      const { filterResults, processing } = useAnalyzerStore.getState();
      // Neither the normal-path clear nor the run-end finally may leave the
      // "Processing batch X of Y" flag set once the run has ended.
      expect(filterResults.inProgress).toBe(false);
      expect(processing.isRunning).toBe(false);
    }
  );
});
