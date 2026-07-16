// Verifies per-stage token-usage accumulation (the costTracking slice):
// every LLM-backed route's 200 response carries tokensIn/tokensOut/
// cacheReadTok, and the pipeline records them against the stage that made
// the call. Responses without usage fields (mock/dry-run shape, or an older
// server) must record nothing — the cost UI hides rather than showing $0.00.

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
        scoringModel: 'gemini-2.5-flash',
        filterModel: 'gemini-2.5-flash-lite',
        briefingModel: 'gemini-3.1-pro',
        quickSummaryModel: 'gemini-2.5-flash-lite',
        selectedCategories: ['cs.AI'],
        useQuickFilter: true,
        pauseAfterFilter: false,
        pauseBeforeDeepAnalysis: false,
        pauseBeforeBriefing: false,
        enableScorePostProcessing: false,
        maxDeepAnalysis: 5,
        finalOutputCount: 5,
        daysBack: 1,
        batchSize: 5,
        filterBatchSize: 5,
        scoringBatchSize: 5,
        maxCorrections: 1,
        maxRetries: 0,
        categoriesToScore: ['YES', 'MAYBE'],
        filterConcurrency: 1,
        scoringConcurrency: 1,
        pdfAnalysisConcurrency: 1,
        quickSummaryConcurrency: 1,
        ...configOverrides,
      },
      feedback: { events: [], addFilterOverride: () => {} },
      saveBriefing: async () => {},
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });
}

function mockRoutes({ withUsage }) {
  const u = (tokensIn, tokensOut, cacheReadTok = 0) =>
    withUsage ? { tokensIn, tokensOut, cacheReadTok } : {};
  return vi.fn(async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : {};
    const count = body.papers?.length ?? 1;
    if (typeof url === 'string' && url.includes('/api/quick-filter')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          verdicts: Array.from({ length: count }, (_, i) => ({
            paperIndex: i + 1,
            verdict: 'YES',
            summary: `Summary ${i + 1}.`,
            justification: `Justification ${i + 1}.`,
          })),
          rawResponse: '[]',
          ...u(1000, 100, 50),
        }),
      };
    }
    if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          scores: Array.from({ length: count }, (_, i) => ({
            paperIndex: i + 1,
            score: 7.5,
            justification: `Scoring justification ${i + 1}.`,
          })),
          rawResponse: '[]',
          ...u(2000, 300),
        }),
      };
    }
    if (typeof url === 'string' && /\/api\/analyze-pdf(?:$|\?|#)/.test(url)) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          analysis: {
            summary: 'Deep analysis with enough characters to pass validation checks.',
            keyFindings: 'Key findings with sufficient length to pass validation.',
            methodology: 'Methodology content with sufficient length to pass validation.',
            limitations: 'Limitations content with sufficient length to pass validation.',
            relevanceAssessment: 'Relevance assessment with sufficient length to pass it.',
            updatedScore: 8.0,
          },
          rawResponse: '{}',
          ...u(30000, 1500),
        }),
      };
    }
    if (typeof url === 'string' && url.includes('/api/analyze-pdf-quick')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ quickSummary: 'q', ...u(2000, 250) }),
      };
    }
    if (typeof url === 'string' && url.includes('/api/synthesize')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          briefing: { executiveSummary: 'exec', themes: [], paperCards: [] },
          ...u(40000, 5000),
        }),
      };
    }
    if (typeof url === 'string' && url.includes('/api/check-briefing')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          verdict: 'NO',
          justification: 'grounded',
          ...u(45000, 500),
        }),
      };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

describe('pipeline — per-stage cost tracking', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('accumulates usage per stage across a full run', { timeout: 30000 }, async () => {
    setupStore();
    const pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });
    global.fetch = mockRoutes({ withUsage: true });

    await pipeline.startProcessing(false, true); // 5 TEST_PAPERS

    const { byStage } = useAnalyzerStore.getState().costTracking;

    // One filter batch of 5 papers.
    expect(byStage.filter).toMatchObject({
      model: 'gemini-2.5-flash-lite',
      tokensIn: 1000,
      tokensOut: 100,
      cacheReadTok: 50,
      calls: 1,
    });
    // One scoring batch of 5 papers.
    expect(byStage.scoring).toMatchObject({
      model: 'gemini-2.5-flash',
      tokensIn: 2000,
      tokensOut: 300,
      calls: 1,
    });
    // Post-processing disabled — nothing recorded for it.
    expect(byStage.postProcessing).toBeUndefined();
    // Five per-paper PDF calls.
    expect(byStage.pdf).toMatchObject({
      model: 'gemini-3.1-pro',
      tokensIn: 150000,
      tokensOut: 7500,
      calls: 5,
    });
    // Five quick summaries on the quick-summary model.
    expect(byStage.quickSummary).toMatchObject({
      model: 'gemini-2.5-flash-lite',
      tokensIn: 10000,
      tokensOut: 1250,
      calls: 5,
    });
    // Briefing = synthesis + hallucination check on the briefing model.
    expect(byStage.briefing).toMatchObject({
      model: 'gemini-3.1-pro',
      tokensIn: 85000,
      tokensOut: 5500,
      calls: 2,
    });
  });

  test('records nothing when responses carry no usage fields', { timeout: 30000 }, async () => {
    setupStore();
    const pipeline = createAnalysisPipeline({
      abortControllerRef: { current: new AbortController() },
      pauseRef: { current: false },
      mockAPITesterRef: { current: null },
    });
    global.fetch = mockRoutes({ withUsage: false });

    await pipeline.startProcessing(false, true);

    expect(useAnalyzerStore.getState().costTracking.byStage).toEqual({});
  });
});
