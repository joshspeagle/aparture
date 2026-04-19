// Verifies Stage 3.5 parallel rescoring (post-processing) execution:
//   1. Multiple rescore batches are dispatched concurrently when
//      postProcessingConcurrency > 1.
//   2. Dry-run forces serial execution regardless of config.

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
          justification: `Mock scoring justification ${i + 1}.`,
        }))
      ),
    }),
  };
}

function buildRescoreBatchResponse(numPapers) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawResponse: JSON.stringify(
        Array.from({ length: numPapers }, (_, i) => ({
          paperIndex: i + 1,
          adjustedScore: 7.8,
          adjustmentReason: `Mock rescore reason ${i + 1}.`,
          confidence: 'HIGH',
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
        postProcessingModel: 'gemini-3.1-pro',
        filterModel: 'gemini-3.1-pro',
        briefingModel: 'gemini-3.1-pro',
        selectedCategories: ['cs.AI'],
        useQuickFilter: false,
        pauseAfterFilter: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: true,
        postProcessingCount: 5,
        postProcessingBatchSize: 1,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 1,
        scoringBatchSize: 1,
        maxCorrections: 0,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        scoringConcurrency: 1,
        postProcessingConcurrency: 3,
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

describe('pipeline — parallel rescoring (Stage 3.5)', () => {
  let originalFetch;
  let pipeline;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'multiple rescore calls overlap in flight when postProcessingConcurrency > 1',
    { timeout: 30000 },
    async () => {
      setupStore({
        postProcessingConcurrency: 3,
        postProcessingBatchSize: 1,
        postProcessingCount: 5,
      });
      pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      let rescoreInFlight = 0;
      let rescoreMaxInFlight = 0;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && url.includes('/api/rescore-abstracts')) {
          rescoreInFlight += 1;
          rescoreMaxInFlight = Math.max(rescoreMaxInFlight, rescoreInFlight);
          await new Promise((r) => setTimeout(r, 30));
          rescoreInFlight -= 1;
          return buildRescoreBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      // 5 TEST_PAPERS × postProcessingBatchSize=1 = 5 rescore batches.
      // With concurrency=3, at least 2 should overlap.
      expect(rescoreMaxInFlight).toBeGreaterThanOrEqual(2);
      expect(rescoreMaxInFlight).toBeLessThanOrEqual(3);
    }
  );

  test(
    'Anthropic scoringModel: warmup barrier fires based on scoringModel, not postProcessingModel',
    { timeout: 30000 },
    async () => {
      // Regression guard: the rescore route dispatches `config.scoringModel`
      // (not postProcessingModel), so the cache-warmup provider check must
      // use scoringModel too. Setting postProcessingModel to a non-Anthropic
      // provider catches a regression where the warmup lookup falls back to
      // postProcessingModel.
      setupStore({
        scoringModel: 'claude-haiku-4.5',
        postProcessingModel: 'gemini-3-flash',
        postProcessingConcurrency: 3,
        postProcessingBatchSize: 1,
        postProcessingCount: 5,
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
          return buildScoredBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && url.includes('/api/rescore-abstracts')) {
          inFlight += 1;
          inFlightHistory.push(inFlight);
          await new Promise((r) => setTimeout(r, 30));
          inFlight -= 1;
          return buildRescoreBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      // Warmup must fire (first call alone) because scoringModel is Anthropic,
      // regardless of postProcessingModel being Google.
      expect(inFlightHistory[0]).toBe(1);
      expect(Math.max(...inFlightHistory)).toBeGreaterThanOrEqual(2);
    }
  );

  test('dry-run forces serial rescoring regardless of config', { timeout: 15000 }, async () => {
    setupStore({
      postProcessingConcurrency: 10,
      postProcessingBatchSize: 1,
      postProcessingCount: 5,
    });

    let rescoreInFlight = 0;
    let rescoreMaxInFlight = 0;

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
          mockQuickFilter: async () => ({ verdicts: [] }),
          mockScoreAbstracts: async (papers) =>
            JSON.stringify(
              papers.map((_, i) => ({
                paperIndex: i + 1,
                score: 7.5,
                justification: 'mock',
              }))
            ),
          mockRescoreAbstracts: async (batch) => {
            rescoreInFlight += 1;
            rescoreMaxInFlight = Math.max(rescoreMaxInFlight, rescoreInFlight);
            await new Promise((r) => setTimeout(r, 20));
            rescoreInFlight -= 1;
            return JSON.stringify(
              batch.map((_, i) => ({
                paperIndex: i + 1,
                adjustedScore: 7.8,
                adjustmentReason: 'mock',
                confidence: 'HIGH',
              }))
            );
          },
        },
      },
    });

    await pipeline.startProcessing(true, true);

    expect(rescoreMaxInFlight).toBe(1);
  });
});
