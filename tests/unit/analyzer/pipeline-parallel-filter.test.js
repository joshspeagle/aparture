// Verifies Stage 2 parallel filter execution:
//   1. Multiple filter batches are dispatched concurrently when
//      filterConcurrency > 1.
//   2. Dry-run forces serial execution regardless of config.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnalysisPipeline } from '../../../lib/analyzer/pipeline.js';
import { useAnalyzerStore, initialState } from '../../../stores/analyzerStore.js';

function buildFilterBatchResponse(numPapers) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          verdict: 'MAYBE',
          summary: `Mock filter summary ${i + 1}.`,
          justification: `Mock justification ${i + 1}.`,
        }))
      ),
    }),
  };
}

function buildScoredBatchResponse(numPapers) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          score: 7.5,
          justification: `Mock scoring justification ${i + 1}.`,
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
        summary: `Deep analysis for ${paperTitle} with enough characters to pass validation.`,
        keyFindings: 'Key findings with sufficient length to pass validation.',
        methodology: 'Methodology content with sufficient length to pass validation.',
        limitations: 'Limitations content with sufficient length to pass validation.',
        relevanceAssessment: 'Relevance assessment with sufficient length to pass validation.',
        updatedScore,
      },
      rawResponse: JSON.stringify({ summary: `Deep analysis for ${paperTitle}.`, updatedScore }),
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
        useQuickFilter: true,
        pauseAfterFilter: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 1,
        filterBatchSize: 1,
        scoringBatchSize: 1,
        maxCorrections: 0,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        filterConcurrency: 3,
        scoringConcurrency: 1,
        pdfAnalysisConcurrency: 1,
        ...configOverrides,
      },
      feedback: { events: [] },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });
}

describe('pipeline — parallel filter (Stage 2)', () => {
  let originalFetch;
  let pipeline;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'multiple filter calls overlap in flight when filterConcurrency > 1',
    { timeout: 30000 },
    async () => {
      setupStore({ filterConcurrency: 3, filterBatchSize: 1 });
      pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      let filterInFlight = 0;
      let filterMaxInFlight = 0;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/quick-filter')) {
          filterInFlight += 1;
          filterMaxInFlight = Math.max(filterMaxInFlight, filterInFlight);
          await new Promise((r) => setTimeout(r, 30));
          filterInFlight -= 1;
          return buildFilterBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      // 5 TEST_PAPERS × filterBatchSize=1 = 5 batches. With concurrency=3,
      // at least 2 should overlap (allow up to 3 for the full pool).
      expect(filterMaxInFlight).toBeGreaterThanOrEqual(2);
      expect(filterMaxInFlight).toBeLessThanOrEqual(3);
    }
  );

  test(
    'Anthropic filterModel: warmup barrier serializes first call, then parallelism kicks in',
    { timeout: 30000 },
    async () => {
      setupStore({
        filterModel: 'claude-haiku-4.5',
        scoringModel: 'claude-haiku-4.5',
        filterConcurrency: 3,
        filterBatchSize: 1,
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
        if (typeof url === 'string' && url.includes('/api/quick-filter')) {
          inFlight += 1;
          inFlightHistory.push(inFlight);
          await new Promise((r) => setTimeout(r, 30));
          inFlight -= 1;
          return buildFilterBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      // First dispatch must see inFlight === 1 (warmup alone)
      expect(inFlightHistory[0]).toBe(1);
      // Later dispatches should see overlap once warmup releases
      expect(Math.max(...inFlightHistory)).toBeGreaterThanOrEqual(2);
    }
  );

  test(
    'dry-run forces serial filter execution regardless of config',
    { timeout: 15000 },
    async () => {
      setupStore({ filterConcurrency: 10, filterBatchSize: 1 });

      let filterInFlight = 0;
      let filterMaxInFlight = 0;

      const pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: {
          current: {
            mockAnalyzePDF: async (paper) =>
              JSON.stringify({
                summary: `Mock ${paper.title}`,
                updatedScore: 7.5,
              }),
            mockFetchPapers: async () => [],
            mockQuickFilter: async (batch) => {
              filterInFlight += 1;
              filterMaxInFlight = Math.max(filterMaxInFlight, filterInFlight);
              await new Promise((r) => setTimeout(r, 20));
              filterInFlight -= 1;
              return JSON.stringify(
                batch.map((_, i) => ({
                  paperIndex: i + 1,
                  verdict: 'MAYBE',
                  summary: 'mock',
                  justification: 'mock',
                }))
              );
            },
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

      // Dry-run must serialize for deterministic UI pacing.
      expect(filterMaxInFlight).toBe(1);
    }
  );
});
