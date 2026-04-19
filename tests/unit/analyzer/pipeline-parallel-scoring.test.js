// Verifies Stage 3 parallel scoring execution:
//   1. Multiple scoring batches are dispatched concurrently when
//      scoringConcurrency > 1.
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
        useQuickFilter: false,
        pauseAfterFilter: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 1,
        scoringBatchSize: 1,
        maxCorrections: 0,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        scoringConcurrency: 3,
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

describe('pipeline — parallel scoring (Stage 3)', () => {
  let originalFetch;
  let pipeline;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'multiple scoring calls overlap in flight when scoringConcurrency > 1',
    { timeout: 30000 },
    async () => {
      setupStore({ scoringConcurrency: 3, scoringBatchSize: 1 });
      pipeline = createAnalysisPipeline({
        abortControllerRef: { current: new AbortController() },
        pauseRef: { current: false },
        mockAPITesterRef: { current: null },
      });

      let scoringInFlight = 0;
      let scoringMaxInFlight = 0;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          scoringInFlight += 1;
          scoringMaxInFlight = Math.max(scoringMaxInFlight, scoringInFlight);
          await new Promise((r) => setTimeout(r, 30));
          scoringInFlight -= 1;
          return buildScoredBatchResponse(body.papers?.length ?? 1);
        }
        if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
          return buildPDFResponse(8.0, body.title ?? 'paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);

      // 5 TEST_PAPERS × scoringBatchSize=1 = 5 batches.
      // With concurrency=3, at least 2 should overlap.
      expect(scoringMaxInFlight).toBeGreaterThanOrEqual(2);
      expect(scoringMaxInFlight).toBeLessThanOrEqual(3);
    }
  );

  test('dry-run forces serial scoring regardless of config', { timeout: 15000 }, async () => {
    setupStore({ scoringConcurrency: 10, scoringBatchSize: 1 });

    let scoringInFlight = 0;
    let scoringMaxInFlight = 0;

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
          mockScoreAbstracts: async (batch) => {
            scoringInFlight += 1;
            scoringMaxInFlight = Math.max(scoringMaxInFlight, scoringInFlight);
            await new Promise((r) => setTimeout(r, 20));
            scoringInFlight -= 1;
            return JSON.stringify(
              batch.map((_, i) => ({
                paperIndex: i + 1,
                score: 7.5,
                justification: 'mock',
              }))
            );
          },
          mockRescoreAbstracts: async () => JSON.stringify([]),
        },
      },
    });

    await pipeline.startProcessing(true, true);

    expect(scoringMaxInFlight).toBe(1);
  });
});
