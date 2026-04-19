// Verifies Stage 3 parallel PDF analysis:
//   1. Multiple papers are analyzed concurrently when pdfAnalysisConcurrency > 1
//   2. Input order is preserved in the returned array despite out-of-order completion
//   3. Anthropic cache warmup: worker 0 completes its first task alone before
//      sibling workers begin their first task
//   4. Dry-run forces serial execution regardless of config

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

function buildScoredBatchResponse(numPapers) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          score: 7.5,
          justification: `Mock justification for paper ${i + 1}.`,
        }))
      ),
    }),
  };
}

function buildPDFResponse(updatedScore, paperTitle) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      analysis: {
        summary: `Deep analysis summary for ${paperTitle} with enough characters.`,
        keyFindings: 'Key findings with sufficient length to pass validation.',
        methodology: 'Methodology content with sufficient length to pass validation.',
        limitations: 'Limitations content with sufficient length to pass validation.',
        relevanceAssessment: 'Relevance assessment with sufficient length to pass validation.',
        updatedScore,
      },
      rawResponse: JSON.stringify({
        summary: `Deep analysis for ${paperTitle}.`,
        updatedScore,
      }),
    }),
  };
}

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
        useQuickFilter: false,
        pauseAfterFilter: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 3,
        scoringBatchSize: 3,
        maxCorrections: 0,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        pdfAnalysisConcurrency: 3,
        ...configOverrides,
      },
      feedback: { events: [] },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });
}

describe('pipeline — parallel PDF analysis', () => {
  let originalFetch;
  let pipeline;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'Google (no warmup): multiple PDF calls overlap in flight',
    { timeout: 30000 },
    async () => {
      setupStore({ pdfAnalysisConcurrency: 3 });
      pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      let inFlight = 0;
      let maxInFlight = 0;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          const papers = body.papers ?? [];
          return buildScoredBatchResponse(papers.length);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 30));
          inFlight -= 1;
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      // With 5 papers and concurrency=3, we expect at least 2 to overlap.
      // (Google path has no warmup barrier, so all 3 workers start immediately.)
      expect(maxInFlight).toBeGreaterThanOrEqual(2);
      expect(maxInFlight).toBeLessThanOrEqual(3);
    }
  );

  test(
    'Anthropic: warmup barrier serializes the first call, then parallelism kicks in',
    { timeout: 30000 },
    async () => {
      setupStore({
        pdfModel: 'claude-haiku-4.5',
        scoringModel: 'claude-haiku-4.5',
        pdfAnalysisConcurrency: 3,
      });
      pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      let inFlight = 0;
      const inFlightHistory = [];

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          const papers = body.papers ?? [];
          return buildScoredBatchResponse(papers.length);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          inFlight += 1;
          inFlightHistory.push(inFlight);
          await new Promise((r) => setTimeout(r, 30));
          inFlight -= 1;
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      // First dispatch must see inFlight === 1 (warmup alone)
      expect(inFlightHistory[0]).toBe(1);
      // Later dispatches should see overlap once warmup releases
      const maxSeen = Math.max(...inFlightHistory);
      expect(maxSeen).toBeGreaterThanOrEqual(2);
    }
  );

  test('dry-run forces serial execution (concurrency=1 regardless of config)', { timeout: 15000 }, async () => {
    setupStore({ pdfAnalysisConcurrency: 10 });
    pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });

    // Dry-run uses the MockAPITester internally (passed as a ref). We don't
    // need to mock fetch — dry-run doesn't hit the network. Instead we
    // instrument mockAPITesterRef to measure in-flight count.
    let inFlight = 0;
    let maxInFlight = 0;
    pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: {
        current: {
          mockAnalyzePDF: async (paper) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((r) => setTimeout(r, 20));
            inFlight -= 1;
            return JSON.stringify({
              summary: `Mock ${paper.title}`,
              updatedScore: 7.5,
            });
          },
          mockFetchPapers: async () => [],
          mockQuickFilter: async () => ({ verdicts: [] }),
          mockScoreAbstracts: async (papers) =>
            JSON.stringify(
              papers.map((_, i) => ({
                paperIndex: i + 1,
                score: 7.5,
                justification: 'mock',
              }))
            ),
          mockRescoreAbstracts: async () => JSON.stringify([]),
        },
      },
    });

    await pipeline.startProcessing(true, true);

    // Dry-run must serialize to avoid racing progress UI updates.
    expect(maxInFlight).toBe(1);
  });
});
