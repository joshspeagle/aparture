// End-to-end behavior of config.refusalPolicy when /api/analyze-pdf returns
// HTTP 422 + CONTENT_REFUSAL (a safety classifier declining).
//
// Modeled on pipeline-playwright-skip.test.js — the refusal path deliberately
// reuses that stage's skip machinery, so the two should behave alike.
//
// Three properties matter, one per policy:
//   'skip'     — record it, mark the paper, keep the run alive
//   'fallback' — re-issue once against refusalFallbackModel
//   'fail'     — propagate rather than silently dropping the paper
// Plus the cross-cutting one: a refusal never enters the retry ladder.

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

function buildRefusalResponse() {
  return {
    ok: false,
    status: 422,
    json: async () => ({
      code: 'CONTENT_REFUSAL',
      error: 'anthropic declined this request (cyber)',
      provider: 'anthropic',
      model: 'claude-opus-5',
      category: 'cyber',
      raw: 'cyber',
    }),
  };
}

function buildSuccessPDFResponse(title) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      analysis: {
        summary: `Deep analysis summary for ${title} with enough characters.`,
        keyFindings: 'Key findings with sufficient length to pass validation.',
        methodology: 'Methodology content with sufficient length to pass validation.',
        limitations: 'Limitations content with sufficient length to pass validation.',
        relevanceAssessment: 'Relevance assessment with sufficient length to pass validation.',
        updatedScore: 8.0,
      },
      rawResponse: JSON.stringify({ summary: `Deep analysis for ${title}.`, updatedScore: 8.0 }),
    }),
  };
}

function setupStore(configOverrides = {}) {
  useAnalyzerStore.setState(initialState());
  useAnalyzerStore.setState({
    reactContext: {
      profile: { content: 'test profile content' },
      config: {
        pdfModel: 'claude-opus-5',
        scoringModel: 'claude-haiku-4.5',
        filterModel: 'claude-haiku-4.5',
        briefingModel: 'claude-haiku-4.5',
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
        // Deliberately non-zero: a refusal must short-circuit this ladder
        // rather than burning all 3 retries on a deterministic decline.
        maxRetries: 3,
        categoriesToScore: ['YES', 'MAYBE'],
        ...configOverrides,
      },
      feedback: { events: [] },
      saveBriefing: null,
      briefingHistory: [],
    },
    password: 'ignored-in-this-test',
  });

  return createAnalysisPipeline({
    abortControllerRef: { current: new AbortController() },
    pauseRef: { current: false },
    mockAPITesterRef: { current: null },
  });
}

describe('pipeline — safety-refusal policy', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test(
    'skip policy: records the refusal, marks the paper, keeps running',
    { timeout: 30000 },
    async () => {
      const pipeline = setupStore({ refusalPolicy: 'skip' });
      let pdfCallCount = 0;

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse((body.papers ?? []).length);
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
          pdfCallCount += 1;
          if (pdfCallCount === 1) return buildRefusalResponse();
          return buildSuccessPDFResponse(`Paper ${pdfCallCount}`);
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      useAnalyzerStore.getState().addRefusal({ stage: 'pdf', scope: 'leftover from prior run' });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      // Prior-run entries are cleared at run start.
      expect(state.refusals.some((r) => r.scope === 'leftover from prior run')).toBe(false);

      const recorded = state.refusals.filter((r) => r.stage === 'pdf');
      expect(recorded.length).toBe(1);
      expect(recorded[0].provider).toBe('anthropic');
      expect(recorded[0].category).toBe('cyber');

      // The paper stays in results, flagged, rather than vanishing.
      expect(
        state.results.finalRanking.some((p) => p.pdfAnalysisSkipReason === 'content-refusal')
      ).toBe(true);

      // And the rest of the run completed — the other papers were analysed.
      expect(state.results.finalRanking.some((p) => p.deepAnalysis)).toBe(true);
    }
  );

  test('a refusal does not consume the retry ladder', { timeout: 30000 }, async () => {
    // maxRetries is 3 above. If refusals were treated as ordinary failures,
    // the first paper alone would generate 4 PDF calls. Short-circuiting
    // means exactly one call per paper.
    const pipeline = setupStore({ refusalPolicy: 'skip' });
    let pdfCallCount = 0;

    global.fetch = vi.fn(async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : {};
      if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
        return buildScoredBatchResponse((body.papers ?? []).length);
      }
      if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
        pdfCallCount += 1;
        return buildRefusalResponse();
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await pipeline.startProcessing(false, true);
    const state = useAnalyzerStore.getState();

    const refusedPapers = state.refusals.filter((r) => r.stage === 'pdf').length;
    expect(refusedPapers).toBeGreaterThan(0);
    // One call per refused paper — no retry amplification.
    expect(pdfCallCount).toBe(refusedPapers);
  });

  test(
    'fallback policy: re-issues once against refusalFallbackModel',
    { timeout: 30000 },
    async () => {
      const pipeline = setupStore({
        refusalPolicy: 'fallback',
        refusalFallbackModel: 'claude-haiku-4.5',
      });
      const modelsTried = [];

      global.fetch = vi.fn(async (url, options) => {
        const body = options?.body ? JSON.parse(options.body) : {};
        if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
          return buildScoredBatchResponse((body.papers ?? []).length);
        }
        if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
          modelsTried.push(body.model);
          // The primary model always refuses; the fallback always succeeds.
          if (body.model === 'claude-opus-5') return buildRefusalResponse();
          return buildSuccessPDFResponse('fallback-analysed paper');
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await pipeline.startProcessing(false, true);
      const state = useAnalyzerStore.getState();

      // The fallback model was actually reached...
      expect(modelsTried).toContain('claude-haiku-4.5');
      // ...and produced a real analysis, so nothing was skipped.
      expect(state.results.finalRanking.some((p) => p.deepAnalysis)).toBe(true);
      expect(
        state.results.finalRanking.some((p) => p.pdfAnalysisSkipReason === 'content-refusal')
      ).toBe(false);
    }
  );

  test('fail policy: does not silently skip the paper', { timeout: 30000 }, async () => {
    const pipeline = setupStore({ refusalPolicy: 'fail' });

    global.fetch = vi.fn(async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : {};
      if (typeof url === 'string' && url.includes('/api/score-abstracts')) {
        return buildScoredBatchResponse((body.papers ?? []).length);
      }
      if (typeof url === 'string' && url.includes('/api/analyze-pdf')) {
        return buildRefusalResponse();
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await pipeline.startProcessing(false, true);
    const state = useAnalyzerStore.getState();

    // Under 'fail' the paper must NOT be quietly marked as a skip — the
    // whole point of the policy is that refusals surface as errors.
    expect(
      state.results.finalRanking.some((p) => p.pdfAnalysisSkipReason === 'content-refusal')
    ).toBe(false);
    expect(state.processing.errors.length).toBeGreaterThan(0);
  });
});
